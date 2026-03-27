import { BadRequestException } from '@nestjs/common';
import type { AiModelService } from '../../ai-provider/ai-model.service';
import type { AiProviderService } from '../../ai-provider/ai-provider.service';
import type { RedisService } from '../../../common/redis/redis.service';
import type { ClaudeAdapter } from '../adapters/claude.adapter';
import type { ZaiwenAdapter } from '../adapters/zaiwen.adapter';
import type { CompletionChunk } from '../types/completion.types';
import { AIClientService } from './ai-client.service';

async function* createAsyncChunks(
  chunks: CompletionChunk[],
): AsyncIterable<CompletionChunk> {
  for (const chunk of chunks) {
    await Promise.resolve();
    yield chunk;
  }
}

describe('AIClientService', () => {
  const claudeCreateChatCompletionMock =
    jest.fn<ClaudeAdapter['createChatCompletion']>();
  const claudeCreateStreamChatCompletionMock =
    jest.fn<ClaudeAdapter['createStreamChatCompletion']>();
  const claudeHealthCheckMock = jest.fn<ClaudeAdapter['healthCheck']>();
  const claudeAdapter: Pick<
    ClaudeAdapter,
    | 'providerName'
    | 'isConfigured'
    | 'createChatCompletion'
    | 'createStreamChatCompletion'
    | 'healthCheck'
  > = {
    providerName: 'Claude',
    isConfigured: true,
    createChatCompletion: claudeCreateChatCompletionMock,
    createStreamChatCompletion: claudeCreateStreamChatCompletionMock,
    healthCheck: claudeHealthCheckMock,
  };
  const zaiwenCreateChatCompletionMock =
    jest.fn<ZaiwenAdapter['createChatCompletion']>();
  const zaiwenCreateStreamChatCompletionMock =
    jest.fn<ZaiwenAdapter['createStreamChatCompletion']>();
  const zaiwenHealthCheckMock = jest.fn<ZaiwenAdapter['healthCheck']>();
  const zaiwenAdapter: Pick<
    ZaiwenAdapter,
    | 'providerName'
    | 'isConfigured'
    | 'createChatCompletion'
    | 'createStreamChatCompletion'
    | 'healthCheck'
  > = {
    providerName: 'Zaiwen',
    isConfigured: true,
    createChatCompletion: zaiwenCreateChatCompletionMock,
    createStreamChatCompletion: zaiwenCreateStreamChatCompletionMock,
    healthCheck: zaiwenHealthCheckMock,
  };
  const findByModelIdMock = jest.fn<AiModelService['findByModelId']>();
  const aiModelService: Pick<AiModelService, 'findByModelId'> = {
    findByModelId: findByModelIdMock,
  };
  const incrementAccessCountMock =
    jest.fn<AiProviderService['incrementAccessCount']>();
  const findAllProvidersMock = jest.fn<AiProviderService['findAll']>();
  const aiProviderService: Pick<
    AiProviderService,
    'incrementAccessCount' | 'findAll'
  > = {
    incrementAccessCount: incrementAccessCountMock,
    findAll: findAllProvidersMock,
  };
  const redisGetMock = jest.fn<RedisService['get']>();
  const redisSetMock = jest.fn<RedisService['set']>();
  const redisService: Pick<RedisService, 'get' | 'set'> = {
    get: redisGetMock,
    set: redisSetMock,
  };

  let service: AIClientService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AIClientService(
      claudeAdapter as ClaudeAdapter,
      zaiwenAdapter as ZaiwenAdapter,
      aiModelService as AiModelService,
      aiProviderService as AiProviderService,
      redisService as RedisService,
    );
  });

  it('decorates non-stream usage with estimated cost', async () => {
    findByModelIdMock.mockResolvedValue({
      isActive: true,
      inputPrice: 0.5,
      outputPrice: 2,
      provider: { id: 'provider-1', name: 'Zaiwen', isActive: true },
      modelName: 'GLM-5',
    });
    zaiwenCreateChatCompletionMock.mockResolvedValue({
      content: 'ok',
      model: 'GLM-5',
      usage: {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      },
    });

    const result = await service.createChatCompletion('GLM-5', []);

    expect(result.usage).toEqual({
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
      estimatedInputCost: 0.05,
      estimatedOutputCost: 0.1,
      estimatedTotalCost: 0.15000000000000002,
    });
  });

  it('decorates stream usage with estimated cost', async () => {
    findByModelIdMock.mockResolvedValue({
      isActive: true,
      inputPrice: 0.5,
      outputPrice: 2,
      provider: { id: 'provider-1', name: 'Zaiwen', isActive: true },
      modelName: 'GLM-5',
    });
    zaiwenCreateStreamChatCompletionMock.mockResolvedValue(
      createAsyncChunks([
        {
          delta: { content: 'hi' },
          finish_reason: null,
        },
        {
          delta: { content: '' },
          finish_reason: null,
          usage: {
            promptTokens: 100,
            completionTokens: 50,
            totalTokens: 150,
          },
        },
      ]),
    );

    const chunks: CompletionChunk[] = [];
    for await (const chunk of await service.createStreamChatCompletion(
      'GLM-5',
      [],
    )) {
      chunks.push(chunk);
    }

    expect(chunks[1]?.usage).toEqual({
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
      estimatedInputCost: 0.05,
      estimatedOutputCost: 0.1,
      estimatedTotalCost: 0.15000000000000002,
    });
  });

  it('throws when provider is disabled', async () => {
    findByModelIdMock.mockResolvedValue({
      isActive: true,
      provider: { id: 'provider-1', name: 'Zaiwen', isActive: false },
      modelName: 'GLM-5',
    });

    await expect(
      service.createStreamChatCompletion('GLM-5', []),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('checks provider health when requested', async () => {
    findAllProvidersMock.mockResolvedValue([
      { id: 'provider-1', name: 'Zaiwen', isActive: true },
      { id: 'provider-2', name: 'Claude', isActive: true },
    ]);
    redisGetMock.mockResolvedValue(null);
    redisSetMock.mockResolvedValue('OK');

    zaiwenHealthCheckMock.mockResolvedValue({
      status: 'up',
      responseTimeMs: 120,
      modelCount: 3,
      sampleModelId: 'GLM-5',
    });
    claudeHealthCheckMock.mockRejectedValue(new Error('provider timeout'));

    const result = await service.checkProvidersHealth({ timeoutMs: 5000 });

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      providerId: 'provider-1',
      name: 'Zaiwen',
      isActive: true,
      isConfigured: true,
      status: 'up',
      cached: false,
      responseTimeMs: 120,
      modelCount: 3,
      sampleModelId: 'GLM-5',
    });
    expect(typeof result[0]?.checkedAt).toBe('string');
    expect(result[1]).toMatchObject({
      providerId: 'provider-2',
      name: 'Claude',
      isActive: true,
      isConfigured: true,
      status: 'down',
      cached: false,
      message: 'provider timeout',
    });
    expect(typeof result[1]?.checkedAt).toBe('string');
  });

  it('returns cached provider health when cache hit exists', async () => {
    findAllProvidersMock.mockResolvedValue([
      { id: 'provider-1', name: 'Zaiwen', isActive: true },
    ]);
    redisGetMock.mockResolvedValue(
      JSON.stringify({
        providerId: 'provider-1',
        name: 'Zaiwen',
        isActive: true,
        isConfigured: true,
        status: 'up',
        cached: false,
        checkedAt: '2026-03-27T15:00:00.000Z',
        responseTimeMs: 80,
        modelCount: 3,
      }),
    );

    await expect(service.checkProvidersHealth()).resolves.toEqual([
      {
        providerId: 'provider-1',
        name: 'Zaiwen',
        isActive: true,
        isConfigured: true,
        status: 'up',
        cached: true,
        checkedAt: '2026-03-27T15:00:00.000Z',
        responseTimeMs: 80,
        modelCount: 3,
      },
    ]);

    expect(zaiwenHealthCheckMock).not.toHaveBeenCalled();
  });

  it('maps provider health 404 to down status without bubbling adapter noise', async () => {
    findAllProvidersMock.mockResolvedValue([
      { id: 'provider-1', name: 'Zaiwen', isActive: true },
    ]);
    redisGetMock.mockResolvedValue(null);
    redisSetMock.mockResolvedValue('OK');

    zaiwenHealthCheckMock.mockRejectedValue(
      new Error(
        'Zaiwen 健康检查接口不可用：当前 BASE_URL 不支持 /models，请检查兼容路径配置',
      ),
    );

    const result = await service.checkProvidersHealth({ timeoutMs: 3000 });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      providerId: 'provider-1',
      name: 'Zaiwen',
      status: 'down',
      cached: false,
      message:
        'Zaiwen 健康检查接口不可用：当前 BASE_URL 不支持 /models，请检查兼容路径配置',
    });
  });
});
