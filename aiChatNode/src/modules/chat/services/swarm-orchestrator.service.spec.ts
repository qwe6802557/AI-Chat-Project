import { SwarmOrchestratorService } from './swarm-orchestrator.service';
import type { AIClientService } from './ai-client.service';
import type { AgentExecutorService } from './agent-executor.service';
import { AgentRole } from '../../channel/entities/agent-role.entity';

describe('SwarmOrchestratorService', () => {
  let service: SwarmOrchestratorService;
  let mockAiClientService: Partial<AIClientService>;
  let mockAgentExecutorService: Partial<AgentExecutorService>;

  const mockTeamRole: AgentRole = {
    id: 'team-supervisor-1',
    userId: 'user-1',
    name: '研发主控中心',
    description: '负责统筹与任务分发',
    avatar: null,
    boundModelId: 'spark-x2.6',
    systemPrompt: '你是技术主控架构师',
    isDefault: false,
    isTeam: true,
    teamConfig: {
      subAgentRoleIds: ['sub-code-1', 'sub-review-2'],
      routerStrategy: 'supervisor',
      maxHandoffs: 3,
    },
    knowledgeBaseIds: [],
    enabledTools: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    user: {} as any,
  };

  const mockSubCodeRole: AgentRole = {
    id: 'sub-code-1',
    userId: 'user-1',
    name: '代码专家',
    description: '精通算法与Python代码编写',
    avatar: null,
    boundModelId: 'qwen2.5-coder',
    systemPrompt: '你是资深Python算法专家',
    isDefault: false,
    isTeam: false,
    teamConfig: null,
    knowledgeBaseIds: [],
    enabledTools: ['code_interpreter'],
    createdAt: new Date(),
    updatedAt: new Date(),
    user: {} as any,
  };

  beforeEach(() => {
    mockAiClientService = {
      createChatCompletion: jest.fn(),
    };
    mockAgentExecutorService = {
      execute: jest.fn(),
    };

    service = new SwarmOrchestratorService(
      mockAiClientService as AIClientService,
      mockAgentExecutorService as AgentExecutorService,
    );
  });

  describe('Supervisor Swarm Strategy', () => {
    it('delegates task to sub-agent and produces final consolidated answer', async () => {
      // Round 1: Supervisor calls handoff_to_agent
      (mockAiClientService.createChatCompletion as jest.Mock)
        .mockResolvedValueOnce({
          content: '我已将算法编写任务转交代码专家。',
          toolCalls: [
            {
              id: 'call_handoff_1',
              type: 'function',
              function: {
                name: 'handoff_to_agent',
                arguments: JSON.stringify({
                  targetAgentName: '代码专家',
                  taskDescription: '编写斐波那契数列算法并验证',
                }),
              },
            },
          ],
          usage: { promptTokens: 50, completionTokens: 20, totalTokens: 70 },
        })
        // Round 2: Supervisor synthesizes final response
        .mockResolvedValueOnce({
          content: '代码专家已成功验证斐波那契数列，以下是算法实现与总结。',
          toolCalls: [],
          usage: { promptTokens: 60, completionTokens: 30, totalTokens: 90 },
        });

      (mockAgentExecutorService.execute as jest.Mock).mockResolvedValueOnce({
        content: 'def fib(n): return n if n <= 1 else fib(n-1) + fib(n-2)',
        trajectory: [],
        usage: { promptTokens: 40, completionTokens: 25, totalTokens: 65 },
        durationMs: 80,
      });

      const events: any[] = [];
      const result = await service.execute({
        teamRole: mockTeamRole,
        subAgentRoles: [mockSubCodeRole],
        userMessage: '请帮我写一个斐波那契算法',
        messages: [{ role: 'user', content: '请帮我写一个斐波那契算法' }],
        defaultModelId: 'spark-x2.6',
        onTimelineEvent: (e) => events.push(e),
      });

      expect(mockAgentExecutorService.execute).toHaveBeenCalledTimes(1);
      expect(mockAgentExecutorService.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          modelId: 'qwen2.5-coder',
          systemInstruction: '你是资深Python算法专家',
        }),
      );

      expect(result.content).toContain('代码专家已成功验证斐波那契数列');
      expect(result.timeline).toHaveLength(2); // 1 handoff + 1 conclude
      expect(result.timeline[0].toAgent).toBe('代码专家');
      expect(result.timeline[0].status).toBe('completed');
      expect(result.timeline[1].type).toBe('conclude');
      expect(events.length).toBeGreaterThanOrEqual(2);
    });

    it('terminates loop when maxHandoffs is reached', async () => {
      // Supervisor always wants to handoff
      (mockAiClientService.createChatCompletion as jest.Mock).mockResolvedValue({
        content: '继续委派',
        toolCalls: [
          {
            id: 'call_loop',
            type: 'function',
            function: {
              name: 'handoff_to_agent',
              arguments: JSON.stringify({
                targetAgentName: '代码专家',
                taskDescription: '继续循环',
              }),
            },
          },
        ],
        usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
      });

      (mockAgentExecutorService.execute as jest.Mock).mockResolvedValue({
        content: '局部执行结果',
        trajectory: [],
        usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
        durationMs: 20,
      });

      const result = await service.execute({
        teamRole: {
          ...mockTeamRole,
          teamConfig: { subAgentRoleIds: ['sub-code-1'], maxHandoffs: 2 },
        },
        subAgentRoles: [mockSubCodeRole],
        userMessage: '测试超限',
        messages: [{ role: 'user', content: '测试超限' }],
        defaultModelId: 'spark-x2.6',
        maxHandoffs: 2,
      });

      expect(mockAgentExecutorService.execute).toHaveBeenCalledTimes(2);
      expect(result.timeline.filter((e) => e.type === 'handoff')).toHaveLength(2);
    });
  });

  describe('Sequential Pipeline Strategy', () => {
    it('executes sub-agents sequentially passing context forward', async () => {
      const mockReviewRole: AgentRole = {
        ...mockSubCodeRole,
        id: 'sub-review-2',
        name: '代码审查员',
        systemPrompt: '你是代码质检专家',
      };

      (mockAgentExecutorService.execute as jest.Mock)
        .mockResolvedValueOnce({
          content: '代码草稿已生成',
          trajectory: [],
          usage: { promptTokens: 20, completionTokens: 20, totalTokens: 40 },
          durationMs: 30,
        })
        .mockResolvedValueOnce({
          content: '代码审查通过，无严重漏洞',
          trajectory: [],
          usage: { promptTokens: 30, completionTokens: 20, totalTokens: 50 },
          durationMs: 40,
        });

      const result = await service.execute({
        teamRole: {
          ...mockTeamRole,
          teamConfig: {
            subAgentRoleIds: ['sub-code-1', 'sub-review-2'],
            routerStrategy: 'sequential',
          },
        },
        subAgentRoles: [mockSubCodeRole, mockReviewRole],
        userMessage: '生成并质检代码',
        messages: [{ role: 'user', content: '生成并质检代码' }],
        defaultModelId: 'spark-x2.6',
      });

      expect(mockAgentExecutorService.execute).toHaveBeenCalledTimes(2);
      expect(result.content).toBe('代码审查通过，无严重漏洞');
      expect(result.timeline).toHaveLength(3); // 2 executions + 1 conclude
    });
  });
});
