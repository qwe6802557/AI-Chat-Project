import { BadRequestException } from '@nestjs/common';
import {
  DagWorkflowExecutorService,
  type DagExecutionResult,
  type DagExecutionStreamEvent,
} from './dag-workflow-executor.service';
import { MAX_DAG_NODES, validateDagGraph } from '../utils/dag-validator.util';
import type {
  DagWorkflowGraph,
  DagWorkflowNode,
} from '../entities/agent-workflow.entity';
import type { AgentExecutorService } from '../../chat/services/agent-executor.service';
import type { SwarmOrchestratorService } from '../../chat/services/swarm-orchestrator.service';
import type { ToolRegistryService } from '../../tools/tools.registry.service';
import type { HybridRagService } from '../../knowledge-base/services/hybrid-rag.service';
import type { AiModelService } from '../../ai-provider/ai-model.service';
import type { Repository } from 'typeorm';
import type { AgentRole } from '../../channel/entities/agent-role.entity';

describe('DagWorkflowExecutorService & Validator', () => {
  let executor: DagWorkflowExecutorService;
  let mockAgentExecutor: Partial<AgentExecutorService>;
  let mockSwarmOrchestrator: Partial<SwarmOrchestratorService>;
  let mockToolRegistry: Partial<ToolRegistryService>;
  let mockHybridRag: Partial<HybridRagService>;
  let mockAiModelService: Partial<AiModelService>;
  let mockRoleRepo: Partial<Repository<AgentRole>>;

  beforeEach(() => {
    mockAgentExecutor = {
      execute: jest.fn((opts) => {
        const rawMsg = opts.messages[0]?.content;
        const msgText =
          typeof rawMsg === 'string' ? rawMsg : JSON.stringify(rawMsg || '');
        return Promise.resolve({
          content: `Agent(${opts.modelId}): 处理了 ${msgText.slice(0, 40)}`,
          trajectory: [],
          totalUsage: {
            promptTokens: 30,
            completionTokens: 20,
            totalTokens: 50,
          },
          totalDurationMs: 120,
        });
      }),
    };
    mockSwarmOrchestrator = {
      execute: jest.fn(),
    };
    mockToolRegistry = {
      executeTool: jest.fn((name, args) =>
        Promise.resolve({
          id: 't-1',
          name,
          title: name,
          callType: 'user_preset',
          args,
          result: {
            status: 'success',
            output: `tool:${name}=${JSON.stringify(args)}`,
            durationMs: 12,
          },
          createdAt: new Date().toISOString(),
        }),
      ),
    };
    mockHybridRag = {
      search: jest.fn(() =>
        Promise.resolve([
          {
            chunkId: 'c1',
            documentId: 'd1',
            knowledgeBaseId: 'kb-1',
            documentTitle: '阶段4设计手册.pdf',
            content: '支持基于 Trace ID 的拓扑定位',
            chunkIndex: 0,
            score: 0.92,
            hitSource: 'hybrid' as const,
          },
        ]),
      ),
    };
    mockAiModelService = {
      findActiveModels: jest.fn(() =>
        Promise.resolve([
          {
            modelId: 'edge-tts',
            isDefault: true,
            isActive: true,
            category: 'voice',
          },
          {
            modelId: 'GLM-5',
            isDefault: true,
            isActive: true,
            category: 'chat',
          },
        ] as Awaited<ReturnType<AiModelService['findActiveModels']>>),
      ),
    };
    mockRoleRepo = {
      findOne: jest.fn(() => Promise.resolve(null)),
      find: jest.fn(() => Promise.resolve([])),
    };

    executor = new DagWorkflowExecutorService(
      mockAgentExecutor as AgentExecutorService,
      mockSwarmOrchestrator as SwarmOrchestratorService,
      mockToolRegistry as ToolRegistryService,
      mockHybridRag as HybridRagService,
      mockAiModelService as AiModelService,
      mockRoleRepo as Repository<AgentRole>,
    );
  });

  it('rejects cyclic graphs and graphs exceeding MAX_DAG_NODES', () => {
    const cyclicGraph: DagWorkflowGraph = {
      nodes: [
        {
          id: 'start',
          type: 'start',
          position: { x: 0, y: 0 },
          data: { label: '开始' },
        },
        {
          id: 'a1',
          type: 'agent',
          position: { x: 100, y: 0 },
          data: { label: 'A1' },
        },
        {
          id: 'a2',
          type: 'agent',
          position: { x: 200, y: 0 },
          data: { label: 'A2' },
        },
        {
          id: 'end',
          type: 'end',
          position: { x: 300, y: 0 },
          data: { label: '结束' },
        },
      ],
      edges: [
        { id: 'e1', source: 'start', target: 'a1' },
        { id: 'e2', source: 'a1', target: 'a2' },
        { id: 'e3', source: 'a2', target: 'a1' },
        { id: 'e4', source: 'a2', target: 'end' },
      ],
    };
    expect(() => validateDagGraph(cyclicGraph)).toThrow(BadRequestException);

    const oversizedNodes = Array.from(
      { length: MAX_DAG_NODES + 1 },
      (_, i) => ({
        id: `n-${i}`,
        type: (i === 0
          ? 'start'
          : i === MAX_DAG_NODES
            ? 'end'
            : 'agent') as DagWorkflowNode['type'],
        position: { x: i * 10, y: 0 },
        data: { label: `Node ${i}` },
      }),
    );
    expect(() =>
      validateDagGraph({ nodes: oversizedNodes, edges: [] }),
    ).toThrow(BadRequestException);
  });

  it('executes parallel RAG + Tool fan-out, condition pruning, and template aggregation', async () => {
    const graph: DagWorkflowGraph = {
      nodes: [
        {
          id: 'start',
          type: 'start',
          position: { x: 0, y: 0 },
          data: { label: '开始' },
        },
        {
          id: 'rag_1',
          type: 'rag',
          position: { x: 100, y: -60 },
          data: { label: '知识检索', knowledgeBaseIds: ['kb-1'], topK: 3 },
        },
        {
          id: 'tool_1',
          type: 'tool',
          position: { x: 100, y: 60 },
          data: {
            label: '计算器',
            toolName: 'calculator',
            argsTemplate: { expression: '2+3' },
          },
        },
        {
          id: 'cond_1',
          type: 'condition',
          position: { x: 240, y: 0 },
          data: {
            label: '关键词判定',
            rules: [
              {
                id: 'rule_hit',
                label: '命中Trace',
                variable: 'rag_1.output',
                operator: 'contains',
                value: 'Trace ID',
              },
            ],
          },
        },
        {
          id: 'agent_hit',
          type: 'agent',
          position: { x: 380, y: -60 },
          data: {
            label: '深度总结专家',
            promptTemplate: '资料={{rag_1.output}} | 计算={{tool_1.output}}',
          },
        },
        {
          id: 'agent_skip',
          type: 'agent',
          position: { x: 380, y: 60 },
          data: { label: '兜底分支' },
        },
        {
          id: 'end',
          type: 'end',
          position: { x: 520, y: 0 },
          data: { label: '汇总', responseTemplate: '{{agent_hit.output}}' },
        },
      ],
      edges: [
        { id: 'e1', source: 'start', target: 'rag_1' },
        { id: 'e2', source: 'start', target: 'tool_1' },
        { id: 'e3', source: 'rag_1', target: 'cond_1' },
        { id: 'e4', source: 'tool_1', target: 'cond_1' },
        {
          id: 'e5',
          source: 'cond_1',
          sourceHandle: 'rule_hit',
          target: 'agent_hit',
        },
        {
          id: 'e6',
          source: 'cond_1',
          sourceHandle: 'else',
          target: 'agent_skip',
        },
        { id: 'e7', source: 'agent_hit', target: 'end' },
        { id: 'e8', source: 'agent_skip', target: 'end' },
      ],
    };

    const events: DagExecutionStreamEvent[] = [];
    const gen = executor.executeStream({
      graph,
      userId: 'u-1',
      input: '请评估阶段4方案',
    });

    let finalRes: DagExecutionResult | undefined;
    while (true) {
      const next = await gen.next();
      if (next.done) {
        finalRes = next.value;
        break;
      }
      events.push(next.value);
    }

    expect(finalRes).toBeDefined();
    expect(finalRes.status).toBe('completed');
    expect(finalRes.nodeStatuses.rag_1).toBe('completed');
    expect(finalRes.nodeStatuses.tool_1).toBe('completed');
    expect(finalRes.nodeStatuses.cond_1).toBe('completed');
    expect(finalRes.nodeStatuses.agent_hit).toBe('completed');
    expect(finalRes.nodeStatuses.agent_skip).toBe('skipped');
    expect(finalRes.nodeStatuses.end).toBe('completed');
    expect(mockAgentExecutor.execute).toHaveBeenCalledTimes(1);
    expect(finalRes.usage.totalTokens).toBe(50);
    expect(finalRes.content).toContain('Agent(GLM-5)');
    expect(
      events.some(
        (e) =>
          e.type === 'node_status' &&
          e.event.nodeId === 'agent_skip' &&
          e.event.status === 'skipped',
      ),
    ).toBe(true);
  });
});
