import { AgentExecutorService } from './agent-executor.service';
import { AIClientService } from './ai-client.service';
import { ToolRegistryService } from '../../tools/tools.registry.service';

describe('AgentExecutorService', () => {
  let service: AgentExecutorService;
  let aiClientServiceMock: jest.Mocked<Partial<AIClientService>>;
  let toolRegistryServiceMock: jest.Mocked<Partial<ToolRegistryService>>;

  beforeEach(() => {
    aiClientServiceMock = {
      createChatCompletion: jest.fn(),
    };
    toolRegistryServiceMock = {
      toOpenAITools: jest.fn().mockImplementation((toolNames: string[]) =>
        toolNames.map((n) => ({
          type: 'function',
          function: { name: n, description: `Tool ${n}`, parameters: {} },
        })),
      ),
      executeTool: jest.fn(),
      evaluateToolRisk: jest.fn().mockReturnValue({
        level: 'low',
        requiresApproval: false,
      }),
    };

    service = new AgentExecutorService(
      aiClientServiceMock as AIClientService,
      toolRegistryServiceMock as ToolRegistryService,
    );
  });

  it('应该在模型无工具调用时直接收敛返回答案', async () => {
    (aiClientServiceMock.createChatCompletion as jest.Mock).mockResolvedValueOnce({
      content: '你好！今天天气很好。',
      reasoningContent: '用户打招呼，直接回复即可',
      toolCalls: [],
      usage: { promptTokens: 10, completionTokens: 15, totalTokens: 25 },
    });

    const result = await service.execute({
      modelId: 'test-model',
      messages: [{ role: 'user', content: '你好' }],
      enabledTools: ['weather'],
    });

    expect(result.content).toBe('你好！今天天气很好。');
    expect(result.trajectory).toHaveLength(0);
    expect(result.totalUsage.totalTokens).toBe(25);
    expect(toolRegistryServiceMock.executeTool).not.toHaveBeenCalled();
  });

  it('应该支持单步工具调用并收敛输出最终答案', async () => {
    (aiClientServiceMock.createChatCompletion as jest.Mock)
      .mockResolvedValueOnce({
        content: '',
        reasoningContent: '需要调用天气工具查询北京天气',
        toolCalls: [
          {
            id: 'call_1',
            type: 'function',
            function: {
              name: 'weather',
              arguments: JSON.stringify({ city: '北京' }),
            },
          },
        ],
        usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
      })
      .mockResolvedValueOnce({
        content: '北京今天晴，气温 20℃。',
        toolCalls: [],
        usage: { promptTokens: 35, completionTokens: 12, totalTokens: 47 },
      });

    (toolRegistryServiceMock.executeTool as jest.Mock).mockResolvedValueOnce({
      id: 'tool_rec_1',
      name: 'weather',
      title: '实时天气',
      callType: 'model_function_call',
      args: { city: '北京' },
      result: {
        status: 'success',
        output: '晴，20℃',
        durationMs: 150,
      },
      createdAt: new Date().toISOString(),
    });

    const result = await service.execute({
      modelId: 'test-model',
      messages: [{ role: 'user', content: '北京天气怎么样？' }],
      enabledTools: ['weather'],
    });

    expect(result.content).toBe('北京今天晴，气温 20℃。');
    expect(result.trajectory).toHaveLength(1);
    expect(result.trajectory[0].actionName).toBe('weather');
    expect(result.trajectory[0].actionArgs).toEqual({ city: '北京' });
    expect(result.trajectory[0].observation).toBe('晴，20℃');
    expect(result.totalUsage.totalTokens).toBe(77);
  });

  it('在外部通道环境中遇到需要审批的高危工具时应触发静态安全策略拦截', async () => {
    (toolRegistryServiceMock.evaluateToolRisk as jest.Mock).mockReturnValueOnce({
      level: 'high',
      requiresApproval: true,
      reason: '高风险系统操作',
    });

    (aiClientServiceMock.createChatCompletion as jest.Mock)
      .mockResolvedValueOnce({
        content: '',
        toolCalls: [
          {
            id: 'call_danger',
            type: 'function',
            function: {
              name: 'code_interpreter',
              arguments: JSON.stringify({ code: 'os.system("rm -rf /")' }),
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        content: '抱歉，当前外部通道环境无法执行高危操作。',
        toolCalls: [],
      });

    const result = await service.execute({
      modelId: 'test-model',
      messages: [{ role: 'user', content: '执行高危脚本' }],
      enabledTools: ['code_interpreter'],
    });

    expect(toolRegistryServiceMock.executeTool).not.toHaveBeenCalled();
    expect(result.trajectory).toHaveLength(1);
    expect(result.trajectory[0].status).toBe('error');
    expect(result.trajectory[0].observation).toContain('安全策略拦截');
    expect(result.content).toBe('抱歉，当前外部通道环境无法执行高危操作。');
  });

  it('应该在达到最大循环轮数时剥离工具权限强制收敛', async () => {
    (aiClientServiceMock.createChatCompletion as jest.Mock)
      .mockResolvedValueOnce({
        content: '',
        toolCalls: [{ id: 'c1', type: 'function', function: { name: 'calculator', arguments: '{"exp":"1+1"}' } }],
      })
      .mockResolvedValueOnce({
        content: '经过计算结果为 4。',
        toolCalls: [],
      });

    (toolRegistryServiceMock.executeTool as jest.Mock).mockResolvedValue({
      result: { status: 'success', output: '4', durationMs: 50 },
    });

    const result = await service.execute({
      modelId: 'test-model',
      messages: [{ role: 'user', content: '计算多次' }],
      enabledTools: ['calculator'],
      maxLoops: 1,
    });

    expect(result.content).toBe('经过计算结果为 4。');
    const secondCall = (aiClientServiceMock.createChatCompletion as jest.Mock).mock.calls[1];
    expect(secondCall[2].tools).toBeUndefined();
  });
});
