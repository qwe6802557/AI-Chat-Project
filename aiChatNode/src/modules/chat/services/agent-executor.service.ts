import { Injectable, Logger } from '@nestjs/common';
import { AIClientService } from './ai-client.service';
import { ToolRegistryService } from '../../tools/tools.registry.service';
import type { ChatMessage } from '../types/completion.types';

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

        // 高危工具静态风控策略拦截：外部通道或离线执行无权直接放行高危操作
        const riskEvaluation = this.toolRegistryService.evaluateToolRisk(
          fnName,
          parsedArgs,
          options.context,
        );

        if (riskEvaluation.requiresApproval) {
          const observation = `【安全策略拦截】该操作涉及高风险工具或敏感指令（原因: ${riskEvaluation.reason || '未经授权的操作'}）。外部通道环境无权直接授权高危操作，请通过 Web 控制台由管理员核准执行。`;
          trajectory.push({
            loopIndex: loopCount + 1,
            thought,
            actionName: fnName,
            actionArgs: parsedArgs,
            observation,
            durationMs: 0,
            status: 'error',
          });
          currentMessages.push({
            role: 'tool',
            tool_call_id: tc.id,
            name: fnName,
            content: observation,
          });
          continue;
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
