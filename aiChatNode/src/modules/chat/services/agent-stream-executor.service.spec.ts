import { AgentStreamExecutorService } from './agent-stream-executor.service';
import { ActiveStreamRegistry } from './active-stream.registry';
import type { AIClientService } from './ai-client.service';
import type { ToolRegistryService } from '../../tools/tools.registry.service';
import type { ApprovalManagerService } from './approval-manager.service';
import type { CompletionChunk } from '../types/completion.types';

describe('AgentStreamExecutorService', () => {
  let service: AgentStreamExecutorService;
  let aiClientServiceMock: jest.Mocked<Partial<AIClientService>>;
  let toolRegistryServiceMock: jest.Mocked<Partial<ToolRegistryService>>;
  let approvalManagerServiceMock: jest.Mocked<Partial<ApprovalManagerService>>;
  let activeStreamRegistry: ActiveStreamRegistry;

  beforeEach(() => {
    activeStreamRegistry = new ActiveStreamRegistry();

    aiClientServiceMock = {
      createStreamChatCompletion: jest.fn(),
    };

    toolRegistryServiceMock = {
      getPlugin: jest.fn().mockReturnValue({
        metadata: { title: '测试工具', icon: 'tool' },
      }),
      executeTool: jest.fn().mockResolvedValue({
        id: 'call_1',
        name: 'test_tool',
        result: { status: 'success', output: '执行结果内容', durationMs: 120 },
      }),
      evaluateToolRisk: jest.fn().mockReturnValue({
        level: 'low',
        requiresApproval: false,
      }),
    };

    approvalManagerServiceMock = {
      createPendingApproval: jest.fn(),
      waitForDecision: jest.fn(),
    };

    service = new AgentStreamExecutorService(
      aiClientServiceMock as AIClientService,
      toolRegistryServiceMock as ToolRegistryService,
      approvalManagerServiceMock as ApprovalManagerService,
      activeStreamRegistry,
    );
  });

  it('应该正常产出流式文本并在退出时清理注册表', async () => {
    async function* mockStream(): AsyncIterable<CompletionChunk> {
      yield { delta: { content: '你好' } };
      yield { delta: { content: '世界' }, finish_reason: 'stop', usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 } };
    }

    (aiClientServiceMock.createStreamChatCompletion as jest.Mock).mockResolvedValueOnce(mockStream());

    const chunks: CompletionChunk[] = [];
    const stream = service.executeStream({
      modelId: 'test-model',
      initialMessages: [{ role: 'user', content: '测试' }],
      context: { userId: 'u1', sessionId: 'sess-1', userMessage: '测试' },
      toolExecutionRecords: [],
    });

    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    const text = chunks.map((c) => c.delta?.content || '').join('');
    expect(text).toBe('你好世界');
    // 验证无论执行结束与否，finally 中均已自动注销
    expect(activeStreamRegistry.has('sess-1')).toBe(false);
  });

  it('应该在 Checkpoint 处捕获并注入即时干预 (Steer) 并产出 steer_applied 事件', async () => {
    // 第一次 LLM 返回工具调用，并在工具执行前模拟外部用户推入 steer 指令
    async function* mockRound1(): AsyncIterable<CompletionChunk> {
      yield {
        delta: {
          tool_calls: [
            {
              index: 0,
              id: 'call_99',
              function: { name: 'search', arguments: '{"q":"weather"}' },
            },
          ],
        },
      };
    }

    async function* mockRound2(): AsyncIterable<CompletionChunk> {
      yield { delta: { content: '收到东京干预，已切换为东京天气。' }, finish_reason: 'stop' };
    }

    (aiClientServiceMock.createStreamChatCompletion as jest.Mock)
      .mockResolvedValueOnce(mockRound1())
      .mockResolvedValueOnce(mockRound2());

    // 监听工具调用时由外部推入 steer
    (toolRegistryServiceMock.executeTool as jest.Mock).mockImplementationOnce(async () => {
      activeStreamRegistry.steer('sess-steer-1', '不要查北京天气，重点查东京天气');
      return {
        id: 'call_99',
        name: 'search',
        result: { status: 'success', output: '北京晴朗', durationMs: 50 },
      };
    });

    const chunks: CompletionChunk[] = [];
    const stream = service.executeStream({
      modelId: 'test-model',
      initialMessages: [{ role: 'user', content: '查天气' }],
      context: { userId: 'u1', sessionId: 'sess-steer-1', userMessage: '查天气' },
      toolExecutionRecords: [],
    });

    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    // 验证事件流中产出了 steer_applied 事件
    const steerChunk = chunks.find((c) => c.type === 'steer_applied');
    expect(steerChunk).toBeDefined();
    expect(steerChunk?.steer?.message).toBe('不要查北京天气，重点查东京天气');

    // 验证第二轮 createStreamChatCompletion 调用时，入参 messages 包含了干预文本
    const secondCallMessages = (aiClientServiceMock.createStreamChatCompletion as jest.Mock).mock.calls[1][1];
    const steerMessage = secondCallMessages.find((m: any) =>
      typeof m.content === 'string' && m.content.includes('不要查北京天气，重点查东京天气'),
    );
    expect(steerMessage).toBeDefined();
  });
});
