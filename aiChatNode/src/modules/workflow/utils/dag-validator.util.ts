import { BadRequestException } from '@nestjs/common';
import type {
  DagConditionRule,
  DagWorkflowEdge,
  DagWorkflowGraph,
  DagWorkflowNode,
} from '../entities/agent-workflow.entity';

export const MAX_DAG_NODES = 20;
export const MAX_LAYER_CONCURRENCY = 4;
export const DEFAULT_DAG_TIMEOUT_MS = 90_000;

export interface ValidatedDagTopology {
  nodeMap: Map<string, DagWorkflowNode>;
  outgoingEdges: Map<string, DagWorkflowEdge[]>;
  incomingEdges: Map<string, DagWorkflowEdge[]>;
  topologicalOrder: string[];
  startNode: DagWorkflowNode;
  endNodes: DagWorkflowNode[];
}

/**
 * 校验 DAG 工作流结构合法性（节点上限 <= 20、唯一 Start、至少 1 个 End、无自环与有向环路）
 */
export function validateDagGraph(
  graph: DagWorkflowGraph,
): ValidatedDagTopology {
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
    throw new BadRequestException('工作流画布数据格式无效');
  }

  if (graph.nodes.length === 0) {
    throw new BadRequestException('工作流至少需要包含 Start 与 End 节点');
  }

  if (graph.nodes.length > MAX_DAG_NODES) {
    throw new BadRequestException(
      `安全护栏限制：单张工作流节点总数不能超过 ${MAX_DAG_NODES} 个`,
    );
  }

  const nodeMap = new Map<string, DagWorkflowNode>();
  const outgoingEdges = new Map<string, DagWorkflowEdge[]>();
  const incomingEdges = new Map<string, DagWorkflowEdge[]>();
  const inDegree = new Map<string, number>();

  for (const node of graph.nodes) {
    if (!node?.id || !node?.type) {
      throw new BadRequestException('存在缺少唯一 ID 或类型声明的工作流节点');
    }
    if (nodeMap.has(node.id)) {
      throw new BadRequestException(`存在重复的工作流节点 ID: ${node.id}`);
    }
    nodeMap.set(node.id, node);
    outgoingEdges.set(node.id, []);
    incomingEdges.set(node.id, []);
    inDegree.set(node.id, 0);
  }

  const startNodes = graph.nodes.filter((n) => n.type === 'start');
  if (startNodes.length !== 1) {
    throw new BadRequestException(
      `工作流必须有且仅有 1 个 Start 触发节点（当前为 ${startNodes.length} 个）`,
    );
  }

  const endNodes = graph.nodes.filter((n) => n.type === 'end');
  if (endNodes.length === 0) {
    throw new BadRequestException('工作流至少需要包含 1 个 End 收敛节点');
  }

  for (const edge of graph.edges) {
    if (!edge?.source || !edge?.target) {
      throw new BadRequestException('存在起点或终点缺失的工作流连线');
    }
    if (edge.source === edge.target) {
      throw new BadRequestException(`禁止节点自环连接: ${edge.source}`);
    }
    if (!nodeMap.has(edge.source) || !nodeMap.has(edge.target)) {
      throw new BadRequestException(
        `连线引用了不存在的节点 (${edge.source} -> ${edge.target})`,
      );
    }

    outgoingEdges.get(edge.source)!.push(edge);
    incomingEdges.get(edge.target)!.push(edge);
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
  }

  // Kahn 拓扑排序检测有向环路
  const queue: string[] = [];
  for (const [nodeId, deg] of inDegree.entries()) {
    if (deg === 0) {
      queue.push(nodeId);
    }
  }

  const topologicalOrder: string[] = [];
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    topologicalOrder.push(currentId);
    for (const edge of outgoingEdges.get(currentId) || []) {
      const nextDeg = (inDegree.get(edge.target) || 0) - 1;
      inDegree.set(edge.target, nextDeg);
      if (nextDeg === 0) {
        queue.push(edge.target);
      }
    }
  }

  if (topologicalOrder.length !== graph.nodes.length) {
    throw new BadRequestException(
      '工作流拓扑存在有向环路，仅允许无环 DAG 编排执行',
    );
  }

  return {
    nodeMap,
    outgoingEdges,
    incomingEdges,
    topologicalOrder,
    startNode: startNodes[0],
    endNodes,
  };
}

/**
 * 安全读取变量作用域路径（支持 nodeId.field.subField，阻止原型链污染）
 */
export function resolveScopePath(
  scope: Record<string, any>,
  rawPath: string,
): unknown {
  const cleanPath = rawPath.trim();
  if (!cleanPath) return undefined;

  const segments = cleanPath.split('.').filter(Boolean);
  let cursor: unknown = scope;

  for (const seg of segments) {
    if (seg === '__proto__' || seg === 'constructor' || seg === 'prototype') {
      return undefined;
    }
    if (cursor === null || cursor === undefined || typeof cursor !== 'object') {
      return undefined;
    }
    if (!Object.prototype.hasOwnProperty.call(cursor, seg)) {
      return undefined;
    }
    cursor = (cursor as Record<string, unknown>)[seg];
  }

  return cursor;
}

/**
 * 安全替换 {{nodeId.output}} 模板占位符
 */
export function resolveTemplateString(
  template: string | undefined | null,
  scope: Record<string, unknown>,
): string {
  if (!template) return '';
  return template.replace(
    /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g,
    (_, path: string) => {
      const val = resolveScopePath(scope, path);
      if (val === undefined || val === null) {
        return '';
      }
      if (typeof val === 'string') {
        return val;
      }
      try {
        return JSON.stringify(val);
      } catch {
        return '[unserializable]';
      }
    },
  );
}

/**
 * 安全评估 Condition 分支规则（无 eval，含正则防护）
 */
export function evaluateConditionRule(
  rule: DagConditionRule,
  scope: Record<string, any>,
): boolean {
  const variablePath = rule.variable.replace(/^\{\{|\}\}$/g, '').trim();
  const rawVal = resolveScopePath(scope, variablePath);
  const textVal =
    rawVal === undefined || rawVal === null
      ? ''
      : typeof rawVal === 'string'
        ? rawVal
        : JSON.stringify(rawVal);
  const expected = rule.value ?? '';

  switch (rule.operator) {
    case 'not_empty':
      return textVal.trim().length > 0;
    case 'contains':
      return textVal.toLowerCase().includes(expected.toLowerCase());
    case 'not_contains':
      return !textVal.toLowerCase().includes(expected.toLowerCase());
    case 'equals':
      return textVal.trim() === expected.trim();
    case 'not_equals':
      return textVal.trim() !== expected.trim();
    case 'gt': {
      const a = Number(textVal);
      const b = Number(expected);
      return Number.isFinite(a) && Number.isFinite(b) && a > b;
    }
    case 'lt': {
      const a = Number(textVal);
      const b = Number(expected);
      return Number.isFinite(a) && Number.isFinite(b) && a < b;
    }
    case 'regex': {
      if (!expected || expected.length > 120) return false;
      try {
        return new RegExp(expected, 'i').test(textVal);
      } catch {
        return false;
      }
    }
    default:
      return false;
  }
}

/**
 * 构建新建工作流的默认可运行起步拓扑 (Start -> Agent -> End)
 */
export function createStarterWorkflowGraph(): DagWorkflowGraph {
  return {
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: [
      {
        id: 'start',
        type: 'start',
        position: { x: 80, y: 180 },
        data: {
          label: '触发输入',
          description: '接收用户提问与上下文变量',
          defaultInput: '请帮我分析今日核心运维与业务重点，并给出行动清单。',
        },
      },
      {
        id: 'agent_1',
        type: 'agent',
        position: { x: 400, y: 180 },
        data: {
          label: '主分析智能体',
          description: '调用指定模型或已有智能体角色完成核心推理',
          promptTemplate: '{{start.input}}',
          maxLoops: 3,
        },
      },
      {
        id: 'end',
        type: 'end',
        position: { x: 740, y: 180 },
        data: {
          label: '输出汇聚',
          description: '整理最终响应结果',
          responseTemplate: '{{agent_1.output}}',
        },
      },
    ],
    edges: [
      {
        id: 'e-start-agent_1',
        source: 'start',
        target: 'agent_1',
      },
      {
        id: 'e-agent_1-end',
        source: 'agent_1',
        target: 'end',
      },
    ],
  };
}
