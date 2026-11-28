import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AgentRole } from '../../channel/entities/agent-role.entity';
import { AiModelService } from '../../ai-provider/ai-model.service';
import { AgentExecutorService } from '../../chat/services/agent-executor.service';
import {
  SwarmOrchestratorService,
  type SwarmTimelineEvent,
} from '../../chat/services/swarm-orchestrator.service';
import type { CompletionUsageStats } from '../../chat/types/completion.types';
import { HybridRagService } from '../../knowledge-base/services/hybrid-rag.service';
import { TraceContextService } from '../../observability/services/trace-context.service';
import { ToolRegistryService } from '../../tools/tools.registry.service';
import type {
  DagWorkflowGraph,
  DagWorkflowNode,
} from '../entities/agent-workflow.entity';
import {
  DEFAULT_DAG_TIMEOUT_MS,
  MAX_LAYER_CONCURRENCY,
  evaluateConditionRule,
  resolveTemplateString,
  validateDagGraph,
} from '../utils/dag-validator.util';

export type DagNodeRuntimeStatus =
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped';

export interface DagNodeStatusEvent {
  nodeId: string;
  nodeType: DagWorkflowNode['type'];
  label: string;
  status: DagNodeRuntimeStatus;
  modelId?: string | null;
  durationMs?: number;
  outputSnippet?: string;
  error?: string;
}

export type DagExecutionStreamEvent =
  | { type: 'node_status'; event: DagNodeStatusEvent }
  | { type: 'timeline'; timelineEvent: SwarmTimelineEvent };

export interface DagExecutionOptions {
  graph: DagWorkflowGraph;
  userId: string;
  input: string;
  sessionId?: string;
  defaultModelId?: string;
  timeoutMs?: number;
  abortSignal?: AbortSignal;
  initialVariables?: Record<string, string>;
}

export interface DagNodeScopeEntry {
  output?: string;
  input?: string;
  data?: Record<string, unknown>;
  error?: string;
  [key: string]: unknown;
}

export interface DagExecutionResult {
  content: string;
  status: 'completed' | 'failed' | 'aborted';
  timeline: SwarmTimelineEvent[];
  nodeStatuses: Record<string, DagNodeRuntimeStatus>;
  usage: CompletionUsageStats;
  durationMs: number;
  error?: string;
}

interface NodeOutcome {
  output: string;
  data: Record<string, any>;
  modelId?: string | null;
  usage?: CompletionUsageStats;
  matchedHandle?: string;
}

/**
 * 轻量异步事件队列，使 Promise.allSettled 并行分支能实时推送 SSE 状态事件
 */
class AsyncEventChannel<T> {
  private readonly buffer: T[] = [];
  private waiter: (() => void) | null = null;
  private ended = false;

  push(item: T): void {
    if (this.ended) return;
    this.buffer.push(item);
    if (this.waiter) {
      const wake = this.waiter;
      this.waiter = null;
      wake();
    }
  }

  close(): void {
    this.ended = true;
    if (this.waiter) {
      const wake = this.waiter;
      this.waiter = null;
      wake();
    }
  }

  async *[Symbol.asyncIterator](): AsyncIterableIterator<T> {
    while (true) {
      if (this.buffer.length > 0) {
        yield this.buffer.shift()!;
        continue;
      }
      if (this.ended) {
        return;
      }
      await new Promise<void>((resolve) => {
        this.waiter = resolve;
      });
    }
  }
}

/**
 * 可视化 DAG 工作流拓扑调度与并发执行引擎
 * 支持 6 类节点原语、条件分支动态剪枝、同层 <=4 并发扇出与 90s 全局超时熔断
 */
@Injectable()
export class DagWorkflowExecutorService {
  private readonly logger = new Logger(DagWorkflowExecutorService.name);

  constructor(
    private readonly agentExecutorService: AgentExecutorService,
    private readonly swarmOrchestratorService: SwarmOrchestratorService,
    private readonly toolRegistryService: ToolRegistryService,
    private readonly hybridRagService: HybridRagService,
    private readonly aiModelService: AiModelService,
    @InjectRepository(AgentRole)
    private readonly roleRepo: Repository<AgentRole>,
    @Optional()
    private readonly traceContext?: TraceContextService,
  ) {}

  /**
   * 同步等待完整 DAG 执行收敛（供外部通道或非流式接口调用）
   */
  async execute(options: DagExecutionOptions): Promise<DagExecutionResult> {
    const events: DagExecutionStreamEvent[] = [];
    const { result } = await this.runInternal(options, (evt) => {
      events.push(evt);
    });
    return result;
  }

  /**
   * 流式执行 DAG，实时吐出每个并行节点的运行态、协同时间线及最终结果
   */
  async *executeStream(
    options: DagExecutionOptions,
  ): AsyncGenerator<DagExecutionStreamEvent, DagExecutionResult> {
    const channel = new AsyncEventChannel<DagExecutionStreamEvent>();
    let finalResult: DagExecutionResult | null = null;
    let executionError: unknown = null;

    const runPromise = this.runInternal(options, (evt) => channel.push(evt))
      .then(({ result }) => {
        finalResult = result;
      })
      .catch((err) => {
        executionError = err;
      })
      .finally(() => {
        channel.close();
      });

    for await (const evt of channel) {
      yield evt;
    }

    await runPromise;
    if (executionError) {
      throw executionError instanceof Error
        ? executionError
        : new Error(
            typeof executionError === 'string'
              ? executionError
              : JSON.stringify(executionError),
          );
    }

    return (
      finalResult || {
        content: '',
        status: 'failed',
        timeline: [],
        nodeStatuses: {},
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        durationMs: 0,
      }
    );
  }

  private async runInternal(
    options: DagExecutionOptions,
    onEvent: (event: DagExecutionStreamEvent) => void,
  ): Promise<{ result: DagExecutionResult }> {
    const startMs = Date.now();
    const topology = validateDagGraph(options.graph);
    const timeoutMs = Math.min(
      DEFAULT_DAG_TIMEOUT_MS,
      Math.max(5000, options.timeoutMs ?? DEFAULT_DAG_TIMEOUT_MS),
    );

    const abortController = new AbortController();
    const timeoutHandle = setTimeout(() => {
      abortController.abort(
        new Error(
          `工作流执行超时（超过 ${Math.round(timeoutMs / 1000)}s 安全熔断阈值）`,
        ),
      );
    }, timeoutMs);
    if (typeof timeoutHandle.unref === 'function') {
      timeoutHandle.unref();
    }

    const onExternalAbort = () => {
      abortController.abort(new Error('客户端中断工作流执行'));
    };
    if (options.abortSignal) {
      if (options.abortSignal.aborted) {
        onExternalAbort();
      } else {
        options.abortSignal.addEventListener('abort', onExternalAbort, {
          once: true,
        });
      }
    }

    const fallbackModelId = await this.resolveDefaultModelId(
      options.defaultModelId,
    );
    const timeline: SwarmTimelineEvent[] = [];
    const nodeStatuses: Record<string, DagNodeRuntimeStatus> = {};
    const stateMap = new Map<string, 'pending' | DagNodeRuntimeStatus>();
    const skippedEdgeIds = new Set<string>();
    const scope: Record<string, DagNodeScopeEntry> = {};
    const accumulatedUsage: CompletionUsageStats = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };

    for (const node of options.graph.nodes) {
      stateMap.set(node.id, 'pending');
    }

    const emitTimeline = (evt: SwarmTimelineEvent) => {
      timeline.push(evt);
      onEvent({ type: 'timeline', timelineEvent: evt });
    };

    try {
      while (true) {
        if (abortController.signal.aborted) {
          const reason =
            abortController.signal.reason instanceof Error
              ? abortController.signal.reason.message
              : '工作流已中止';
          throw new Error(reason);
        }

        // 先传播条件剪枝跳过的下游节点与失败传播
        let propagated = true;
        while (propagated) {
          propagated = false;
          for (const nodeId of topology.topologicalOrder) {
            if (stateMap.get(nodeId) !== 'pending') continue;
            const incoming = topology.incomingEdges.get(nodeId) || [];
            if (incoming.length === 0) continue;

            const allIncomingSkipped = incoming.every(
              (edge) =>
                skippedEdgeIds.has(edge.id) ||
                stateMap.get(edge.source) === 'skipped',
            );
            if (allIncomingSkipped) {
              stateMap.set(nodeId, 'skipped');
              nodeStatuses[nodeId] = 'skipped';
              const node = topology.nodeMap.get(nodeId)!;
              for (const out of topology.outgoingEdges.get(nodeId) || []) {
                skippedEdgeIds.add(out.id);
              }
              scope[nodeId] = { output: '', skipped: true };
              onEvent({
                type: 'node_status',
                event: {
                  nodeId,
                  nodeType: node.type,
                  label: node.data?.label || node.type,
                  status: 'skipped',
                },
              });
              await this.traceContext?.recordInstantSpan({
                spanType: 'dag_node',
                nodeId,
                name: `Node · ${node.data?.label || node.type}`,
                status: 'skipped',
                input: null,
                output: '条件分支未命中，已跳过',
              });
              propagated = true;
            }
          }
        }

        // 筛选入边均已就绪（至少一条已完成或无入边）的待执行节点
        const readyNodeIds: string[] = [];
        for (const nodeId of topology.topologicalOrder) {
          if (stateMap.get(nodeId) !== 'pending') continue;
          const incoming = topology.incomingEdges.get(nodeId) || [];
          if (incoming.length === 0) {
            readyNodeIds.push(nodeId);
            continue;
          }

          const activeIncoming = incoming.filter(
            (edge) => !skippedEdgeIds.has(edge.id),
          );
          if (activeIncoming.length === 0) continue;

          const hasFailedUpstream = activeIncoming.some(
            (edge) => stateMap.get(edge.source) === 'failed',
          );
          if (hasFailedUpstream) {
            stateMap.set(nodeId, 'failed');
            nodeStatuses[nodeId] = 'failed';
            continue;
          }

          const allActiveCompleted = activeIncoming.every(
            (edge) => stateMap.get(edge.source) === 'completed',
          );
          if (allActiveCompleted) {
            readyNodeIds.push(nodeId);
          }
        }

        if (readyNodeIds.length === 0) {
          break;
        }

        // 限制同层并发上限 <= 4
        for (
          let idx = 0;
          idx < readyNodeIds.length;
          idx += MAX_LAYER_CONCURRENCY
        ) {
          if (abortController.signal.aborted) {
            throw new Error('工作流执行已终止');
          }

          const batch = readyNodeIds.slice(idx, idx + MAX_LAYER_CONCURRENCY);
          await Promise.allSettled(
            batch.map(async (nodeId) => {
              const node = topology.nodeMap.get(nodeId)!;
              stateMap.set(nodeId, 'running');
              nodeStatuses[nodeId] = 'running';

              const nodeStartMs = Date.now();
              const label = node.data?.label || node.type;
              onEvent({
                type: 'node_status',
                event: {
                  nodeId,
                  nodeType: node.type,
                  label,
                  status: 'running',
                  modelId: node.data?.modelId || null,
                },
              });

              const timelineEvtId = `dag_${nodeId}_${nodeStartMs}`;
              if (node.type !== 'start' && node.type !== 'end') {
                emitTimeline({
                  id: timelineEvtId,
                  type: 'dag_node',
                  nodeId,
                  timestamp: nodeStartMs,
                  fromAgent: 'DAG 引擎',
                  toAgent: label,
                  modelId: node.data?.modelId || undefined,
                  task: node.data?.description || node.type.toUpperCase(),
                  status: 'running',
                });
              }

              try {
                const outcome = await this.executeSingleNode(
                  node,
                  {
                    userId: options.userId,
                    input: options.input,
                    sessionId: options.sessionId,
                    fallbackModelId,
                    initialVariables: options.initialVariables,
                  },
                  scope,
                  emitTimeline,
                );

                const durationMs = Date.now() - nodeStartMs;
                stateMap.set(nodeId, 'completed');
                nodeStatuses[nodeId] = 'completed';
                scope[nodeId] = {
                  output: outcome.output,
                  ...outcome.data,
                };

                if (outcome.usage) {
                  accumulatedUsage.promptTokens +=
                    outcome.usage.promptTokens || 0;
                  accumulatedUsage.completionTokens +=
                    outcome.usage.completionTokens || 0;
                  accumulatedUsage.totalTokens =
                    accumulatedUsage.promptTokens +
                    accumulatedUsage.completionTokens;
                }

                // 若为条件节点，按命中 Handle 剪枝未选中分支
                if (node.type === 'condition') {
                  const matchedHandle = outcome.matchedHandle || 'else';
                  const outs = topology.outgoingEdges.get(nodeId) || [];
                  for (const edge of outs) {
                    const edgeHandle = edge.sourceHandle || 'else';
                    if (edgeHandle !== matchedHandle) {
                      skippedEdgeIds.add(edge.id);
                    }
                  }
                }

                const snippet = (outcome.output || '').slice(0, 160);
                onEvent({
                  type: 'node_status',
                  event: {
                    nodeId,
                    nodeType: node.type,
                    label,
                    status: 'completed',
                    modelId: outcome.modelId ?? node.data?.modelId ?? null,
                    durationMs,
                    outputSnippet: snippet,
                  },
                });

                if (node.type !== 'start' && node.type !== 'end') {
                  const existingTimeline = timeline.find(
                    (t) => t.id === timelineEvtId,
                  );
                  if (existingTimeline) {
                    existingTimeline.status = 'completed';
                    existingTimeline.durationMs = durationMs;
                    existingTimeline.outputSnippet = snippet;
                    existingTimeline.modelId =
                      outcome.modelId || existingTimeline.modelId;
                    onEvent({
                      type: 'timeline',
                      timelineEvent: { ...existingTimeline },
                    });
                  }
                }
              } catch (err: any) {
                const errMsg = err instanceof Error ? err.message : String(err);
                const durationMs = Date.now() - nodeStartMs;
                stateMap.set(nodeId, 'failed');
                nodeStatuses[nodeId] = 'failed';
                scope[nodeId] = { output: '', error: errMsg };

                onEvent({
                  type: 'node_status',
                  event: {
                    nodeId,
                    nodeType: node.type,
                    label,
                    status: 'failed',
                    durationMs,
                    error: errMsg,
                  },
                });

                const existingTimeline = timeline.find(
                  (t) => t.id === timelineEvtId,
                );
                if (existingTimeline) {
                  existingTimeline.status = 'failed';
                  existingTimeline.durationMs = durationMs;
                  existingTimeline.outputSnippet = errMsg;
                  onEvent({
                    type: 'timeline',
                    timelineEvent: { ...existingTimeline },
                  });
                }
              }
            }),
          );
        }
      }

      // 定位激活并成功完成的 End 节点汇聚结果
      const completedEndNode = topology.endNodes.find(
        (n) => stateMap.get(n.id) === 'completed',
      );
      const anyFailedNode = options.graph.nodes.find(
        (n) => stateMap.get(n.id) === 'failed',
      );

      if (!completedEndNode && anyFailedNode) {
        const errMsg =
          scope[anyFailedNode.id]?.error ||
          `节点 [${anyFailedNode.data?.label || anyFailedNode.id}] 执行失败`;
        return {
          result: {
            content: '',
            status: 'failed',
            timeline,
            nodeStatuses,
            usage: accumulatedUsage,
            durationMs: Date.now() - startMs,
            error: errMsg,
          },
        };
      }

      let finalContent = '';
      if (completedEndNode) {
        finalContent = String(scope[completedEndNode.id]?.output || '').trim();
      }
      if (!finalContent) {
        for (const id of [...topology.topologicalOrder].reverse()) {
          if (stateMap.get(id) === 'completed' && scope[id]?.output) {
            finalContent = String(scope[id].output);
            break;
          }
        }
      }

      emitTimeline({
        id: `dag_conclude_${Date.now()}`,
        type: 'conclude',
        timestamp: Date.now(),
        fromAgent: 'DAG 引擎',
        toAgent: '用户',
        status: 'completed',
        durationMs: Date.now() - startMs,
      });

      return {
        result: {
          content: finalContent || '工作流执行完成，暂无文本输出。',
          status: 'completed',
          timeline,
          nodeStatuses,
          usage: accumulatedUsage,
          durationMs: Date.now() - startMs,
        },
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const isAborted =
        abortController.signal.aborted || /中止|abort|超时/i.test(message);
      return {
        result: {
          content: '',
          status: isAborted ? 'aborted' : 'failed',
          timeline,
          nodeStatuses,
          usage: accumulatedUsage,
          durationMs: Date.now() - startMs,
          error: message,
        },
      };
    } finally {
      clearTimeout(timeoutHandle);
      if (options.abortSignal) {
        options.abortSignal.removeEventListener('abort', onExternalAbort);
      }
    }
  }

  private async executeSingleNode(
    node: DagWorkflowNode,
    ctx: {
      userId: string;
      input: string;
      sessionId?: string;
      fallbackModelId: string;
      initialVariables?: Record<string, string>;
    },
    scope: Record<string, DagNodeScopeEntry>,
    emitTimeline: (evt: SwarmTimelineEvent) => void,
  ): Promise<NodeOutcome> {
    const label = node.data?.label || node.type;
    const run = async (): Promise<NodeOutcome> => {
      switch (node.type) {
        case 'start': {
          return {
            output: ctx.input,
            data: {
              input: ctx.input,
              ...(ctx.initialVariables || {}),
            },
          };
        }

        case 'rag': {
          const kbIds = node.data?.knowledgeBaseIds || [];
          const query =
            resolveTemplateString(node.data?.queryTemplate, scope).trim() ||
            ctx.input;
          if (!kbIds.length) {
            return {
              output: '',
              data: { contextText: '', sources: [], hitCount: 0 },
            };
          }

          const results = await this.hybridRagService.search({
            userId: ctx.userId,
            query,
            knowledgeBaseIds: kbIds,
            limit: Math.min(10, Math.max(1, Number(node.data?.topK || 5))),
          });

          const contextText = results
            .map(
              (r, idx) =>
                `[${idx + 1}] 《${r.documentTitle}》(${(r.score * 100).toFixed(0)}%):\n${r.content}`,
            )
            .join('\n\n');

          return {
            output: contextText || '未检索到高相关知识切片',
            data: {
              contextText,
              sources: results,
              hitCount: results.length,
            },
          };
        }

        case 'tool': {
          const toolName = node.data?.toolName || '';
          if (!toolName) {
            throw new Error(`工具节点 [${label}] 未选择内置插件`);
          }
          const resolvedArgs: Record<string, any> = {};
          for (const [k, rawTpl] of Object.entries(
            node.data?.argsTemplate || {},
          )) {
            resolvedArgs[k] = resolveTemplateString(rawTpl, scope);
          }

          const record = await this.toolRegistryService.executeTool(
            toolName,
            resolvedArgs,
            {
              userId: ctx.userId,
              sessionId: ctx.sessionId || '',
              userMessage: ctx.input,
            },
          );

          if (record.result.status !== 'success') {
            throw new Error(
              record.result.error || `工具 [${toolName}] 执行失败`,
            );
          }

          const outputStr =
            typeof record.result.output === 'string'
              ? record.result.output
              : JSON.stringify(record.result.output ?? '');

          return {
            output: outputStr,
            data: { rawOutput: record.result.output as unknown, toolName },
          };
        }

        case 'condition': {
          const rules = node.data?.rules || [];
          let matchedHandle = 'else';
          let matchedLabel = '默认分支 (Else)';

          for (const rule of rules) {
            if (evaluateConditionRule(rule, scope)) {
              matchedHandle = rule.id;
              matchedLabel = rule.label || rule.id;
              break;
            }
          }

          return {
            output: matchedLabel,
            data: { matchedHandle, matchedLabel },
            matchedHandle,
          };
        }

        case 'agent': {
          const promptText =
            resolveTemplateString(node.data?.promptTemplate, scope).trim() ||
            ctx.input;

          let role: AgentRole | null = null;
          if (node.data?.roleId) {
            role = await this.roleRepo.findOne({
              where: { id: node.data.roleId, userId: ctx.userId },
            });
          }

          const effectiveModelId =
            node.data?.modelId || role?.boundModelId || ctx.fallbackModelId;

          if (role?.isTeam && role.teamConfig?.subAgentRoleIds?.length) {
            const subRoles = await this.roleRepo.find({
              where: {
                id: In(role.teamConfig.subAgentRoleIds),
                userId: ctx.userId,
              },
            });

            if (subRoles.length > 0) {
              const swarmRes = await this.swarmOrchestratorService.execute({
                teamRole: role,
                subAgentRoles: subRoles,
                userMessage: promptText,
                messages: [{ role: 'user', content: promptText }],
                defaultModelId: effectiveModelId,
                context: {
                  userId: ctx.userId,
                  sessionId: ctx.sessionId,
                  userMessage: promptText,
                },
                onTimelineEvent: emitTimeline,
              });

              return {
                output: swarmRes.content,
                data: {
                  roleName: role.name,
                  strategy: role.teamConfig.routerStrategy || 'supervisor',
                },
                modelId: effectiveModelId,
                usage: swarmRes.usage,
              };
            }
          }

          // 若节点或关联角色附带知识库，则自动前置检索注入上下文
          const kbIds = node.data?.knowledgeBaseIds?.length
            ? node.data.knowledgeBaseIds
            : role?.knowledgeBaseIds || [];
          let ragSupplement = '';
          if (kbIds.length > 0) {
            const hits = await this.hybridRagService.search({
              userId: ctx.userId,
              query: promptText,
              knowledgeBaseIds: kbIds,
              limit: 4,
            });
            if (hits.length > 0) {
              ragSupplement = hits
                .map(
                  (h, i) => `[${i + 1}] 《${h.documentTitle}》: ${h.content}`,
                )
                .join('\n\n');
            }
          }

          const basePrompt =
            node.data?.systemPrompt || role?.systemPrompt || '';
          const systemInstruction = ragSupplement
            ? `${basePrompt ? `${basePrompt}\n\n` : ''}【参考知识库】：\n${ragSupplement}`
            : basePrompt || undefined;

          const enabledTools = node.data?.enabledTools?.length
            ? node.data.enabledTools
            : role?.enabledTools || [];

          const agentResult = await this.agentExecutorService.execute({
            modelId: effectiveModelId,
            systemInstruction,
            messages: [{ role: 'user', content: promptText }],
            enabledTools,
            maxLoops: Math.min(
              5,
              Math.max(1, Number(node.data?.maxLoops || 3)),
            ),
            timeoutMs: 30000,
            context: {
              userId: ctx.userId,
              sessionId: ctx.sessionId,
              userMessage: promptText,
            },
          });

          return {
            output: agentResult.content,
            data: { trajectory: agentResult.trajectory },
            modelId: effectiveModelId,
            usage: agentResult.totalUsage,
          };
        }

        case 'end': {
          const tpl = node.data?.responseTemplate?.trim();
          if (tpl) {
            const resolved = resolveTemplateString(tpl, scope).trim();
            return {
              output: resolved,
              data: { assembled: true },
            };
          }

          // 未配置显式模板时，自动选取最近完成的非 start 上游产出
          let fallbackOutput = '';
          for (const key of Object.keys(scope).reverse()) {
            if (key !== 'start' && key !== node.id && scope[key]?.output) {
              fallbackOutput = String(scope[key].output);
              break;
            }
          }
          return {
            output: fallbackOutput || ctx.input,
            data: { assembled: false },
          };
        }
      }
    };

    const nodeInputSummary =
      node.type === 'start'
        ? ctx.input
        : node.data?.promptTemplate
          ? resolveTemplateString(node.data.promptTemplate, scope)
          : node.data?.queryTemplate
            ? resolveTemplateString(node.data.queryTemplate, scope)
            : ctx.input;

    if (!this.traceContext) {
      return run();
    }

    return this.traceContext.withSpan(
      {
        spanType: 'dag_node',
        nodeId: node.id,
        name: `Node · ${label}`,
        modelId: node.data?.modelId ?? null,
        input: nodeInputSummary,
        metadata: { nodeType: node.type, nodeId: node.id },
      },
      async (recorder) => {
        const outcome = await run();
        if (outcome.modelId) {
          recorder?.setModelId(outcome.modelId);
        }
        if (outcome.usage) {
          recorder?.setUsage({
            promptTokens: outcome.usage.promptTokens,
            completionTokens: outcome.usage.completionTokens,
          });
        }
        recorder?.setOutput(outcome.output);
        return outcome;
      },
    );
  }

  private async resolveDefaultModelId(preferred?: string): Promise<string> {
    if (preferred?.trim()) {
      return preferred.trim();
    }
    try {
      const models = await this.aiModelService.findActiveModels(true, 'chat');
      const chatModels = models.filter(
        (m) => m.category === 'chat' && m.isActive,
      );
      const picked =
        chatModels.find((m) => m.isDefault) ||
        chatModels[0] ||
        models.find((m) => m.isDefault && m.isActive);
      return picked?.modelId || 'GLM-5';
    } catch {
      return 'GLM-5';
    }
  }
}
