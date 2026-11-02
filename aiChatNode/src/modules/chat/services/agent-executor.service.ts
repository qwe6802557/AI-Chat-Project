import { Injectable, Logger } from '@nestjs/common';
import { AIClientService } from './ai-client.service';
import { ToolRegistryService } from '../../tools/tools.registry.service';
import type { ChatMessage, CompletionResponse } from '../types/completion.types';

export interface AgentTrajectoryStep {
  loopIndex: number;
  thought?: string;
  actionName: string;
  actionArgs: Record<string, any>;
  observation: string;
  durationMs: number;
  status: 'success' | 'error';
}

export interface AgentExecutionResult {
  content: string;
  trajectory: AgentTrajectoryStep[];
  totalUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  totalDurationMs: number;
}

export interface AgentExecutionOptions {
  modelId: string;
  messages: ChatMessage[];
  systemInstruction?: string;
  enabledTools?: string[];
  maxLoops?: number;
  timeoutMs?: number;
  context?: {
    userId?: string;
    sessionId?: string;
    userMessage?: string;
  };
}

/**
 * 统一 ReAct 智能体循环执行器 (支持多轮思考、工具自调用与超时收敛)
 */
@Injectable()
export class AgentExecutorService {
  private readonly logger = new Logger(AgentExecutorService.name);

  constructor(
    private readonly aiClientService: AIClientService,
    private readonly toolRegistryService: ToolRegistryService,
  ) {}

  /**
   * 执行 ReAct 智能体循环，返回最终答案与完整执行轨迹
   */
  async execute(options: AgentExecutionOptions): Promise<AgentExecutionResult> {
    const startTime = Date.now();
    const maxLoops = options.maxLoops ?? 3;
    const timeoutMs = options.timeoutMs ?? 12000;
    const currentMessages: ChatMessage[] = [];

    if (options.systemInstruction) {
      currentMessages.push({ role: 'system', content: options.systemInstruction });
    }
    currentMessages.push(...options.messages);

    const openAiTools = options.enabledTools?.length
      ? this.toolRegistryService.toOpenAITools(options.enabledTools)
      : [];

    const trajectory: AgentTrajectoryStep[] = [];
    const totalUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };

    let loopCount = 0;
    let finalContent = '';

    while (loopCount <= maxLoops) {
      const elapsed = Date.now() - startTime;
      const isTimeExhausted = timeoutMs - elapsed < 2000;
      const isFinalRound = loopCount >= maxLoops || isTimeExhausted;

      // 超时预警或达到最大循环时剥离工具权限，强制输出最终结论
      const roundTools = isFinalRound || openAiTools.length === 0 ? undefined : openAiTools;

      const completion = await this.aiClientService.createChatCompletion(
        options.modelId,
        currentMessages,
        { tools: roundTools },
      );

      if (completion.usage) {
        totalUsage.promptTokens += completion.usage.promptTokens || 0;
        totalUsage.completionTokens += completion.usage.completionTokens || 0;
        totalUsage.totalTokens = totalUsage.promptTokens + totalUsage.completionTokens;
      }

      const thought = completion.reasoning?.content || (completion as any).reasoningContent || undefined;

      // 无工具调用需求或已达最终轮次，收敛输出最终回答
      if (!completion.toolCalls || completion.toolCalls.length === 0 || isFinalRound) {
        finalContent = completion.content || completion.reasoning?.content || '';
        break;
      }

      currentMessages.push({
        role: 'assistant',
        content: completion.content || '',
        tool_calls: completion.toolCalls,
      });

      for (const tc of completion.toolCalls) {
        const fnName = tc.function?.name || '';
        let parsedArgs: Record<string, any> = {};
        try {
          parsedArgs = tc.function?.arguments ? JSON.parse(tc.function.arguments) : {};
        } catch {
          parsedArgs = { raw: tc.function?.arguments };
        }

        const toolStart = Date.now();
        const execRecord = await this.toolRegistryService.executeTool(
          fnName,
          parsedArgs,
          options.context,
        );
        const toolDurationMs = Date.now() - toolStart;

        const observation =
          execRecord.result.status === 'success'
            ? typeof execRecord.result.output === 'string'
              ? execRecord.result.output
              : JSON.stringify(execRecord.result.output)
            : `工具执行失败: ${execRecord.result.error || '未知错误'}`;

        trajectory.push({
          loopIndex: loopCount + 1,
          thought,
          actionName: fnName,
          actionArgs: parsedArgs,
          observation,
          durationMs: toolDurationMs,
          status: execRecord.result.status,
        });

        currentMessages.push({
          role: 'tool',
          tool_call_id: tc.id,
          name: fnName,
          content: observation,
        });
      }

      loopCount++;
    }

    const totalDurationMs = Date.now() - startTime;
    this.logger.log(
      `ReAct 循环执行完毕: 循环 ${loopCount} 轮, 工具调用 ${trajectory.length} 次, 总耗时 ${totalDurationMs}ms`,
    );

    return {
      content: finalContent,
      trajectory,
      totalUsage,
      totalDurationMs,
    };
  }
}
