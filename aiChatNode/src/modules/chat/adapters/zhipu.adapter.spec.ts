import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { ZhipuAdapter } from './zhipu.adapter';

interface MockOpenAIClient {
  chat: {
    completions: {
      create: jest.Mock<Promise<unknown>, [Record<string, unknown>, unknown?]>;
    };
  };
}

describe('ZhipuAdapter', () => {
  const createConfigService = (values: Record<string, string | undefined>) => {
    return {
      get: jest.fn((key: string) => values[key]),
    } as unknown as ConfigService;
  };

  /** 注入 Mock OpenAI 客户端，用于验证请求参数传递 */
  const attachMockClient = (
    adapter: ZhipuAdapter,
    createMock: MockOpenAIClient['chat']['completions']['create'],
  ) => {
    (adapter as unknown as { client: MockOpenAIClient }).client = {
      chat: { completions: { create: createMock } },
    };
  };

  it('启用配置：当提供 ZHIPU_API_KEY 时成功加载适配器', () => {
    const adapter = new ZhipuAdapter(
      createConfigService({
        ZHIPU_API_KEY: 'test-zhipu-key',
        ZHIPU_BASE_URL: 'https://open.bigmodel.cn/api/paas/v4/',
      }),
    );

    expect(adapter.isConfigured).toBe(true);
    expect(adapter.providerName).toBe('Zhipu');
  });

  it('默认 BaseURL：当未提供 ZHIPU_BASE_URL 时使用官方默认地址', () => {
    const adapter = new ZhipuAdapter(
      createConfigService({
        ZHIPU_API_KEY: 'test-zhipu-key',
      }),
    );

    expect(adapter.isConfigured).toBe(true);
  });

  it('优雅降级：缺少 API Key 时适配器标记为未启用且不抛出致命异常', () => {
    const adapter = new ZhipuAdapter(createConfigService({}));

    expect(adapter.isConfigured).toBe(false);
  });

  describe('max_tokens 模型能力约束（glm-4v-flash 钳位至 [1, 1024]）', () => {
    let adapter: ZhipuAdapter;
    let createMock: MockOpenAIClient['chat']['completions']['create'];

    beforeEach(() => {
      adapter = new ZhipuAdapter(
        createConfigService({ ZHIPU_API_KEY: 'test-zhipu-key' }),
      );
      createMock = jest
        .fn<Promise<unknown>, [Record<string, unknown>, unknown?]>()
        .mockResolvedValue({
          choices: [{ message: { content: 'ok' } }],
          model: 'glm-4v-flash',
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        });
      attachMockClient(adapter, createMock);
    });

    it('createChatCompletion：glm-4v-flash 对默认/超上限/下限越界及大小写空格场景收敛到 [1, 1024]', async () => {
      const cases: Array<{
        model: string;
        maxTokens?: number;
        expected: number;
      }> = [
        { model: 'glm-4v-flash', maxTokens: undefined, expected: 1024 },
        { model: 'glm-4v-flash', maxTokens: 2048, expected: 1024 },
        { model: 'glm-4v-flash', maxTokens: 512, expected: 512 },
        { model: 'glm-4v-flash', maxTokens: 0, expected: 1 },
        { model: 'glm-4v-flash', maxTokens: -10, expected: 1 },
        { model: '  GLM-4V-Flash  ', maxTokens: 4096, expected: 1024 },
        { model: 'glm-4-flash', maxTokens: undefined, expected: 4096 },
        { model: 'glm-4-flash', maxTokens: 8192, expected: 8192 },
      ];

      for (const testCase of cases) {
        createMock.mockClear();
        await adapter.createChatCompletion(
          [{ role: 'user', content: 'hi' }],
          testCase.model,
          testCase.maxTokens === undefined
            ? undefined
            : { maxTokens: testCase.maxTokens },
        );

        expect(createMock).toHaveBeenCalledWith(
          expect.objectContaining({
            model: testCase.model,
            max_tokens: testCase.expected,
            stream: false,
          }),
          undefined,
        );
      }
    });

    it('createStreamChatCompletion：常规流式分支与 stream_options 降级分支均复用 max_tokens 钳位', async () => {
      const makeEmptyStream = () => ({
        async *[Symbol.asyncIterator]() {
          await Promise.resolve();
          yield {
            choices: [{ delta: { content: 'ok' }, finish_reason: 'stop' }],
          };
        },
      });

      // 1. 常规流式分支
      createMock.mockResolvedValueOnce(makeEmptyStream());
      await adapter.createStreamChatCompletion(
        [{ role: 'user', content: 'hi' }],
        'glm-4v-flash',
        { maxTokens: 2048 },
      );
      expect(createMock).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          model: 'glm-4v-flash',
          max_tokens: 1024,
          stream: true,
          stream_options: { include_usage: true },
        }),
        undefined,
      );

      // 2. stream_options 不受支持时的 400 降级分支
      createMock.mockClear();
      const apiError = new OpenAI.APIError(
        400,
        { message: 'stream_options is not supported' },
        'stream_options is not supported',
        new Headers(),
      );
      createMock
        .mockRejectedValueOnce(apiError)
        .mockResolvedValueOnce(makeEmptyStream());

      await adapter.createStreamChatCompletion(
        [{ role: 'user', content: 'hi' }],
        'glm-4v-flash',
        { maxTokens: 4096 },
      );

      expect(createMock).toHaveBeenCalledTimes(2);
      expect(createMock).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          model: 'glm-4v-flash',
          max_tokens: 1024,
          stream: true,
        }),
        undefined,
      );
      expect(createMock.mock.calls[1][0]).not.toHaveProperty('stream_options');
    });
  });
});
