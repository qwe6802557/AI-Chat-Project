import { ConfigService } from '@nestjs/config';
import type { AIClientService } from '../../chat/services/ai-client.service';
import type { AiModel } from '../../ai-provider/entities/ai-model.entity';
import { MemoryLlmService } from './memory-llm.service';

describe('MemoryLlmService', () => {
  const buildModel = (overrides: Partial<AiModel>): AiModel =>
    ({
      id: 'id-1',
      modelId: 'spark-x2.6-4b',
      modelName: 'Spark X2.6 4B',
      isActive: true,
      isDefault: false,
      sortOrder: 10,
      category: 'chat',
      provider: { isActive: true } as AiModel['provider'],
      ...overrides,
    }) as AiModel;

  const createConfigMock = (values: Record<string, string | undefined>) =>
    ({
      get: jest.fn((key: string) => values[key]),
    }) as unknown as ConfigService;

  it('跳过已停用的环境变量模型并回落至 DEFAULT_CHAT_MODEL 或首个健康模型', async () => {
    const createChatCompletionMock = jest.fn().mockResolvedValue({
      content:
        '```json\n{"items":[{"category":"fact","content":"使用 NestJS"}]}\n```',
    });
    const aiClientMock = {
      getAvailableModels: jest.fn().mockResolvedValue([
        buildModel({
          modelId: 'flux-image',
          category: 'image',
          sortOrder: 1,
        }),
        buildModel({
          modelId: 'spark-x2.6-4b',
          isDefault: false,
          sortOrder: 5,
        }),
        buildModel({
          modelId: 'openrouter/free',
          isDefault: true,
          sortOrder: 1,
        }),
      ]),
      createChatCompletion: createChatCompletionMock,
    } as unknown as AIClientService;

    const service = new MemoryLlmService(
      aiClientMock,
      createConfigMock({
        MEMORY_EXTRACTOR_MODEL: 'gemini-3.8-flash-low',
        DEFAULT_CHAT_MODEL: 'spark-x2.6-4b',
      }),
    );

    const res = await service.completeJson<{
      items: Array<{ content: string }>;
    }>([{ role: 'user', content: 'test' }], {
      preferredModelEnvKey: 'MEMORY_EXTRACTOR_MODEL',
    });

    expect(createChatCompletionMock).toHaveBeenCalledWith(
      'spark-x2.6-4b',
      [{ role: 'user', content: 'test' }],
      { temperature: 0.1 },
    );
    expect(res.items[0].content).toBe('使用 NestJS');
  });

  it('当未配置或配置的默认模型均不可用时回退至默认对话模型', async () => {
    const aiClientMock = {
      getAvailableModels: jest.fn().mockResolvedValue([
        buildModel({
          modelId: 'kilo-auto/free',
          isDefault: false,
          sortOrder: 20,
        }),
        buildModel({
          modelId: 'openrouter/free',
          isDefault: true,
          sortOrder: 5,
        }),
      ]),
    } as unknown as AIClientService;

    const service = new MemoryLlmService(aiClientMock, createConfigMock({}));
    const modelId = await service.resolveChatModelId('MEMORY_DISTILLER_MODEL');
    expect(modelId).toBe('openrouter/free');
  });

  it('没有任何启用对话模型时明确抛出错误', async () => {
    const aiClientMock = {
      getAvailableModels: jest
        .fn()
        .mockResolvedValue([
          buildModel({ modelId: 'img-gen', category: 'image' }),
        ]),
    } as unknown as AIClientService;

    const service = new MemoryLlmService(aiClientMock, createConfigMock({}));
    await expect(service.resolveChatModelId()).rejects.toThrow(
      '当前无可用对话模型',
    );
  });
});
