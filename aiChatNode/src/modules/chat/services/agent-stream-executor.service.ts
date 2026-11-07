import { Injectable, Logger } from '@nestjs/common';
import { AIClientService } from './ai-client.service';
import { ToolRegistryService } from '../../tools/tools.registry.service';
import { ApprovalManagerService } from './approval-manager.service';
import { ActiveStreamRegistry } from './active-stream.registry';
import type {
  ChatMessage,
  CompletionChunk,
  CompletionOptions,
} from '../types/completion.types';
import type { ToolExecutionRecord } from '../../tools/types/tools.types';

export interface AgentStreamOptions {
  modelId: string;
  initialMessages: ChatMessage[];
  tools?: Array<{ type: 'function'; function: { name: string; description: string; parameters: any } }>;
  options?: CompletionOptions;
  context: { userId: string; sessionId: string; userMessage: string };
  toolExecutionRecords: ToolExecutionRecord[];
  maxLoops?: number;
  timeoutMs?: number;
}

/**
 * 单角色深度 ReAct 循环流式执行器
 * 原生支持 Thought -> Action -> Observation 递归工具调用、即时干预 (Steering) 检查点注入与优雅中断
 */
@Injectable()
export class AgentStreamExecutorService {
  private readonly logger = new Logger(AgentStreamExecutorService.name);

  constructor(
    private readonly aiClientService: AIClientService,
    private readonly toolRegistryService: ToolRegistryService,
    private readonly approvalManagerService: ApprovalManagerService,
    private readonly activeStreamRegistry: ActiveStreamRegistry,
  ) {}

  /**
   * 执行具备 ReAct 闭环调度与即时干预能力的流式生成
   */
  async *executeStream(params: AgentStreamOptions): AsyncIterable<CompletionChunk> {
    const { sessionId, userId } = params.context;
    const maxLoops = params.maxLoops ?? 5;
    const startTime = Date.now();
    const timeoutMs = params.timeoutMs ?? 30000;

    // 绑定/复用 AbortController
    const abortController = new AbortController();
    if (params.options?.abortSignal) {
      params.options.abortSignal.addEventListener('abort', () => abortController.abort(), { once: true });
    }

    // 注册到活跃流注册表
    this.activeStreamRegistry.register({
      sessionId,
      userId,
      abortController,
      steerQueue: [],
    });

    let loopCount = 0;
    const currentMessages: ChatMessage[] = [...params.initialMessages];
    let accumulatedPromptTokens = 0;
    let accumulatedCompletionTokens = 0;
    let lastFinishReason: string | null = null;

    try {
      while (loopCount <= maxLoops) {
        if (abortController.signal.aborted) {
          this.logger.log(`会话 ${sessionId} 收到中止信号，提前退出 ReAct 循环`);
          break;
        }

        const isTimeExhausted = Date.now() - startTime >= timeoutMs;
        const isMaxLoop = loopCount >= maxLoops || isTimeExhausted;
        const roundTools = isMaxLoop ? undefined : params.tools;

        // Checkpoint 1: 检查并在补全前注入未决的即时干预指令
        const pendingSteersBefore = this.activeStreamRegistry.consumeSteerQueue(sessionId);
        for (const steer of pendingSteersBefore) {
          currentMessages.push({
            role: 'user',
            content: `【用户即时干预指导】: ${steer.message}`,
          });
          yield {
            type: 'steer_applied',
            steer: {
              id: steer.id,
              message: steer.message,
              loopIndex: loopCount + 1,
              timestamp: steer.timestamp,
            },
          };
          this.logger.log(`会话 ${sessionId} 已在轮次 ${loopCount + 1} 补全前应用即时干预: "${steer.message}"`);
        }

        const stream = await this.aiClientService.createStreamChatCompletion(
          params.modelId,
          currentMessages,
          {
            ...params.options,
            abortSignal: abortController.signal,
            tools: roundTools,
          },
        );

        let roundContent = '';
        const toolCallMap = new Map<number, { id: string; name: string; arguments: string }>();

        for await (const chunk of stream) {
          if (abortController.signal.aborted) break;

          if (chunk.finish_reason) {
            lastFinishReason = chunk.finish_reason;
          }

          if (chunk.usage) {
            accumulatedPromptTokens += Number(chunk.usage.promptTokens || 0);
            accumulatedCompletionTokens += Number(chunk.usage.completionTokens || 0);
          }

          if (chunk.type === 'answer_delta' || (!chunk.type && chunk.delta?.content)) {
            roundContent += chunk.delta?.content || '';
          }

          if (chunk.delta?.tool_calls && Array.isArray(chunk.delta.tool_calls)) {
            for (const tc of chunk.delta.tool_calls) {
              const index = tc.index ?? 0;
              if (!toolCallMap.has(index)) {
                const callId = tc.id || `call_${Date.now()}_${index}`;
                toolCallMap.set(index, {
                  id: callId,
                  name: tc.function?.name || '',
                  arguments: tc.function?.arguments || '',
                });
                const plugin = this.toolRegistryService.getPlugin(tc.function?.name || '');
                yield {
                  type: 'tool_call_start',
                  toolCall: {
                    id: callId,
                    name: tc.function?.name || '',
                    title: plugin?.metadata.title || tc.function?.name || '未知工具',
                    icon: plugin?.metadata.icon || 'tool',
                    status: 'calling',
                    args: {},
                  },
                };
              } else {
                const existing = toolCallMap.get(index)!;
                if (tc.id && !existing.id) existing.id = tc.id;
                if (tc.function?.name) existing.name = tc.function.name;
                if (tc.function?.arguments) existing.arguments += tc.function.arguments;
              }
            }
            continue;
          }

          yield chunk;
        }

        const toolCalls = Array.from(toolCallMap.values()).filter((c) => c.name);
        if (toolCalls.length === 0 || isMaxLoop) {
          break;
        }

        currentMessages.push({
          role: 'assistant',
          content: roundContent || '',
          tool_calls: toolCalls.map((c) => ({
            id: c.id,
            type: 'function',
            function: {
              name: c.name,
              arguments: c.arguments,
            },
          })),
        });

        // 串行执行各工具调用并处理审批与干预
        for (const call of toolCalls) {
          if (abortController.signal.aborted) break;

          let parsedArgs: Record<string, any> = {};
          try {
            parsedArgs = call.arguments ? JSON.parse(call.arguments) : {};
          } catch {
            parsedArgs = { raw: call.arguments };
          }

          const plugin = this.toolRegistryService.getPlugin(call.name);

          // 评估工具执行风险并进行动态风控审批
          const riskEvaluation = this.toolRegistryService.evaluateToolRisk(
            call.name,
            parsedArgs,
            params.context,
          );

          if (riskEvaluation.requiresApproval) {
            const pendingApproval = await this.approvalManagerService.createPendingApproval({
              sessionId: params.context.sessionId,
              userId: params.context.userId,
              toolCallId: call.id,
              toolName: call.name,
              args: parsedArgs,
              riskEvaluation,
            });

            yield {
              type: 'tool_approval_required',
              toolCall: {
                id: call.id,
                name: call.name,
                title: plugin?.metadata.title || call.name,
                icon: plugin?.metadata.icon || 'tool',
                status: 'pending_approval',
                args: parsedArgs,
                approvalId: pendingApproval.approvalId,
                riskLevel: riskEvaluation.level,
                riskReason: riskEvaluation.reason,
              },
            };

            const decisionResult = await this.approvalManagerService.waitForDecision(
              pendingApproval.approvalId,
            );

            if (decisionResult.decision !== 'approved') {
              const rejectionReason =
                decisionResult.decision === 'timeout'
                  ? '审批超时（超过 10 分钟未确认），系统自动终止该高危工具执行'
                  : decisionResult.reason || '操作者已拒绝执行此高危工具';

              yield {
                type: 'tool_call_result',
                toolCall: {
                  id: call.id,
                  name: call.name,
                  title: plugin?.metadata.title || call.name,
                  icon: plugin?.metadata.icon || 'tool',
                  status: 'rejected',
                  args: parsedArgs,
                  error: rejectionReason,
                },
              };

              currentMessages.push({
                role: 'tool',
                tool_call_id: call.id,
                name: call.name,
                content: `工具调用已被操作者拒绝: ${rejectionReason}`,
              });
              continue;
            }
          }

          const execRecord = await this.toolRegistryService.executeTool(
            call.name,
            parsedArgs,
            params.context,
          );
          execRecord.id = call.id || execRecord.id;
          execRecord.callType = 'model_function_call';
          params.toolExecutionRecords.push(execRecord);

          yield {
            type: 'tool_call_result',
            toolCall: {
              id: call.id,
              name: call.name,
              title: plugin?.metadata.title || call.name,
              icon: plugin?.metadata.icon || 'tool',
              status: execRecord.result.status === 'success' ? 'success' : 'error',
              durationMs: execRecord.result.durationMs,
              args: parsedArgs,
              output: execRecord.result.output,
              error: execRecord.result.error,
            },
          };

          currentMessages.push({
            role: 'tool',
            tool_call_id: call.id,
            name: call.name,
            content:
              execRecord.result.status === 'success'
                ? typeof execRecord.result.output === 'string'
                  ? execRecord.result.output
                  : JSON.stringify(execRecord.result.output)
                : `工具执行失败: ${execRecord.result.error}`,
          });
        }

        // Checkpoint 2: 工具执行完毕后，再次检查是否有用户在工具等待期间提交的即时干预
        const pendingSteersAfter = this.activeStreamRegistry.consumeSteerQueue(sessionId);
        for (const steer of pendingSteersAfter) {
          currentMessages.push({
            role: 'user',
            content: `【用户即时干预指导】: ${steer.message}`,
          });
          yield {
            type: 'steer_applied',
            steer: {
              id: steer.id,
              message: steer.message,
              loopIndex: loopCount + 1,
              timestamp: steer.timestamp,
            },
          };
          this.logger.log(`会话 ${sessionId} 已在工具执行后应用即时干预: "${steer.message}"`);
        }

        loopCount++;
      }

      if (accumulatedPromptTokens > 0 || accumulatedCompletionTokens > 0) {
        yield {
          finish_reason: lastFinishReason || 'stop',
          usage: {
            promptTokens: accumulatedPromptTokens,
            completionTokens: accumulatedCompletionTokens,
            totalTokens: accumulatedPromptTokens + accumulatedCompletionTokens,
          },
        };
      }
    } finally {
      // 无论何种退出路径，必定注销活跃流句柄，严防内存泄漏
      this.activeStreamRegistry.unregister(sessionId);
    }
  }
}
