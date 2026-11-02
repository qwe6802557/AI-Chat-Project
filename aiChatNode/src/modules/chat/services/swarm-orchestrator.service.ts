import { Injectable, Logger } from '@nestjs/common';
import { AIClientService } from './ai-client.service';
import { AgentExecutorService } from './agent-executor.service';
import { AgentRole } from '../../channel/entities/agent-role.entity';
import { ChatMessage, CompletionUsageStats } from '../types/completion.types';

export interface SwarmTimelineEvent {
  id: string;
  type: 'handoff' | 'subagent_execution' | 'conclude';
  timestamp: number;
  fromAgent: string;
  toAgent: string;
  modelId?: string;
  task?: string;
  outputSnippet?: string;
  durationMs?: number;
  status: 'running' | 'completed' | 'failed';
}

export interface SwarmOrchestrationOptions {
  teamRole: AgentRole;
  subAgentRoles: AgentRole[];
  userMessage: string;
  messages: ChatMessage[];
  defaultModelId: string;
  maxHandoffs?: number;
  timeoutMs?: number;
  context?: {
    userId?: string;
    sessionId?: string;
    channelType?: string;
  };
  onTimelineEvent?: (event: SwarmTimelineEvent) => void;
}

export interface SwarmExecutionResult {
  content: string;
  timeline: SwarmTimelineEvent[];
  usage: CompletionUsageStats;
  durationMs: number;
}

@Injectable()
export class SwarmOrchestratorService {
  private readonly logger = new Logger(SwarmOrchestratorService.name);

  constructor(
    private readonly aiClientService: AIClientService,
    private readonly agentExecutorService: AgentExecutorService,
  ) {}

  /**
   * 执行多智能体 Swarm 协同编排
   */
  async execute(options: SwarmOrchestrationOptions): Promise<SwarmExecutionResult> {
    const startTime = Date.now();
    const routerStrategy = options.teamRole.teamConfig?.routerStrategy || 'supervisor';

    if (routerStrategy === 'sequential') {
      return this.executeSequentialPipeline(options, startTime);
    }

    return this.executeSupervisorSwarm(options, startTime);
  }

  /**
   * 主控分发与动态协同交接模式 (Supervisor-Worker Swarm)
   */
  private async executeSupervisorSwarm(
    options: SwarmOrchestrationOptions,
    startTime: number,
  ): Promise<SwarmExecutionResult> {
    const timeline: SwarmTimelineEvent[] = [];
    const maxHandoffs = options.maxHandoffs ?? options.teamRole.teamConfig?.maxHandoffs ?? 3;
    const supervisorModelId = options.teamRole.boundModelId || options.defaultModelId;
    const subAgentMap = new Map<string, AgentRole>();
    options.subAgentRoles.forEach((role) => {
      subAgentMap.set(role.name.toLowerCase(), role);
      subAgentMap.set(role.id, role);
    });

    // 构造专供主控智能体委派子任务的虚拟工具契约
    const subAgentDescriptions = options.subAgentRoles
      .map((r) => `"${r.name}": ${r.description || '专属专家'} (模型: ${r.boundModelId || '默认'}, 工具: ${(r.enabledTools || []).join(',') || '无'})`)
      .join('; ');

    const handoffTool = {
      type: 'function' as const,
      function: {
        name: 'handoff_to_agent',
        description: `将特定领域的子任务委派给协同团队内的专业子智能体。可选子智能体列表：[${subAgentDescriptions}]`,
        parameters: {
          type: 'object',
          properties: {
            targetAgentName: {
              type: 'string',
              description: '被委派的目标子智能体名称',
            },
            taskDescription: {
              type: 'string',
              description: '详细具体的子任务目标、执行需求与上下文数据',
            },
          },
          required: ['targetAgentName', 'taskDescription'],
        },
      },
    };

    const supervisorSystemPrompt = [
      options.teamRole.systemPrompt || '你是一个资深多智能体主控架构师 (Supervisor Agent)。',
      '你拥有专门的专家协同团队。面对复杂问题，你应优先调用 handoff_to_agent 工具将专业子任务分发给最匹配的子智能体。',
      '在获得各子智能体的反馈后，整合汇总为高权威性、结构严谨的最终答卷回复用户。',
    ].join('\n');

    const currentMessages: ChatMessage[] = [
      { role: 'system', content: supervisorSystemPrompt },
      ...options.messages,
    ];

    const accumulatedUsage: CompletionUsageStats = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };

    let hopCount = 0;
    let finalAnswer = '';

    while (hopCount <= maxHandoffs) {
      const isMaxHopReached = hopCount >= maxHandoffs;
      const tools = isMaxHopReached ? undefined : [handoffTool];

      const completion = await this.aiClientService.createChatCompletion(
        supervisorModelId,
        currentMessages,
        { tools },
      );

      if (completion.usage) {
        accumulatedUsage.promptTokens += completion.usage.promptTokens || 0;
        accumulatedUsage.completionTokens += completion.usage.completionTokens || 0;
        accumulatedUsage.totalTokens = accumulatedUsage.promptTokens + accumulatedUsage.completionTokens;
      }

      const toolCalls = completion.toolCalls || [];
      const handoffCall = toolCalls.find((tc) => tc.function?.name === 'handoff_to_agent');

      if (!handoffCall || isMaxHopReached) {
        finalAnswer = completion.content || '协同编排执行完毕。';
        break;
      }

      let parsedArgs: { targetAgentName?: string; taskDescription?: string } = {};
      try {
        parsedArgs = JSON.parse(handoffCall.function?.arguments || '{}');
      } catch {
        parsedArgs = {};
      }

      const targetAgentName = (parsedArgs.targetAgentName || '').trim();
      const taskDescription = (parsedArgs.taskDescription || '').trim();
      const targetRole = subAgentMap.get(targetAgentName.toLowerCase()) || options.subAgentRoles[0];

      if (!targetRole) {
        currentMessages.push({
          role: 'tool',
          tool_call_id: handoffCall.id,
          name: 'handoff_to_agent',
          content: `未找到指定的子角色 [${targetAgentName}]，请直接由你自身作答。`,
        });
        hopCount++;
        continue;
      }

      // 记录时间线协同事件
      const timelineEvent: SwarmTimelineEvent = {
        id: `swarm_${Date.now()}_${hopCount}`,
        type: 'handoff',
        timestamp: Date.now(),
        fromAgent: options.teamRole.name,
        toAgent: targetRole.name,
        modelId: targetRole.boundModelId || supervisorModelId,
        task: taskDescription,
        status: 'running',
      };
      timeline.push(timelineEvent);
      options.onTimelineEvent?.(timelineEvent);

      const subStartTime = Date.now();
      const subResult = await this.agentExecutorService.execute({
        modelId: targetRole.boundModelId || supervisorModelId,
        systemInstruction: targetRole.systemPrompt || undefined,
        messages: [{ role: 'user', content: taskDescription }],
        enabledTools: targetRole.enabledTools || [],
        maxLoops: 2,
        timeoutMs: 15000,
        context: options.context,
      });

      timelineEvent.status = 'completed';
      timelineEvent.durationMs = Date.now() - subStartTime;
      timelineEvent.outputSnippet = subResult.content.slice(0, 160);
      options.onTimelineEvent?.(timelineEvent);

      if (subResult.totalUsage) {
        accumulatedUsage.promptTokens += subResult.totalUsage.promptTokens || 0;
        accumulatedUsage.completionTokens += subResult.totalUsage.completionTokens || 0;
        accumulatedUsage.totalTokens = accumulatedUsage.promptTokens + accumulatedUsage.completionTokens;
      }

      // 回填子智能体产出供主控继续推理
      currentMessages.push({
        role: 'assistant',
        content: completion.content || '',
        tool_calls: [handoffCall],
      });

      currentMessages.push({
        role: 'tool',
        tool_call_id: handoffCall.id,
        name: 'handoff_to_agent',
        content: `[协同响应来自: ${targetRole.name}]\n${subResult.content}`,
      });

      hopCount++;
    }

    const concludeEvent: SwarmTimelineEvent = {
      id: `swarm_conclude_${Date.now()}`,
      type: 'conclude',
      timestamp: Date.now(),
      fromAgent: options.teamRole.name,
      toAgent: '用户',
      status: 'completed',
      durationMs: Date.now() - startTime,
    };
    timeline.push(concludeEvent);
    options.onTimelineEvent?.(concludeEvent);

    return {
      content: finalAnswer,
      timeline,
      usage: accumulatedUsage,
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * 严格依序流水线执行模式 (Sequential Pipeline)
   */
  private async executeSequentialPipeline(
    options: SwarmOrchestrationOptions,
    startTime: number,
  ): Promise<SwarmExecutionResult> {
    const timeline: SwarmTimelineEvent[] = [];
    const accumulatedUsage: CompletionUsageStats = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };

    let currentInput = options.userMessage;
    let previousAgentName = options.teamRole.name;

    for (const subRole of options.subAgentRoles) {
      const stepStartTime = Date.now();
      const timelineEvent: SwarmTimelineEvent = {
        id: `seq_${Date.now()}_${subRole.id}`,
        type: 'subagent_execution',
        timestamp: Date.now(),
        fromAgent: previousAgentName,
        toAgent: subRole.name,
        modelId: subRole.boundModelId || options.defaultModelId,
        task: currentInput.slice(0, 120),
        status: 'running',
      };
      timeline.push(timelineEvent);
      options.onTimelineEvent?.(timelineEvent);

      const subResult = await this.agentExecutorService.execute({
        modelId: subRole.boundModelId || options.defaultModelId,
        systemInstruction: subRole.systemPrompt || undefined,
        messages: [{ role: 'user', content: currentInput }],
        enabledTools: subRole.enabledTools || [],
        maxLoops: 2,
        timeoutMs: 15000,
        context: options.context,
      });

      timelineEvent.status = 'completed';
      timelineEvent.durationMs = Date.now() - stepStartTime;
      timelineEvent.outputSnippet = subResult.content.slice(0, 160);
      options.onTimelineEvent?.(timelineEvent);

      if (subResult.totalUsage) {
        accumulatedUsage.promptTokens += subResult.totalUsage.promptTokens || 0;
        accumulatedUsage.completionTokens += subResult.totalUsage.completionTokens || 0;
        accumulatedUsage.totalTokens = accumulatedUsage.promptTokens + accumulatedUsage.completionTokens;
      }

      currentInput = subResult.content;
      previousAgentName = subRole.name;
    }

    const concludeEvent: SwarmTimelineEvent = {
      id: `seq_conclude_${Date.now()}`,
      type: 'conclude',
      timestamp: Date.now(),
      fromAgent: previousAgentName,
      toAgent: '用户',
      status: 'completed',
      durationMs: Date.now() - startTime,
    };
    timeline.push(concludeEvent);
    options.onTimelineEvent?.(concludeEvent);

    return {
      content: currentInput,
      timeline,
      usage: accumulatedUsage,
      durationMs: Date.now() - startTime,
    };
  }
}
