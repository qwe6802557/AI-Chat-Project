import { BadRequestException } from '@nestjs/common';
import type { AiModelService } from '../../ai-provider/ai-model.service';
import type { AiProviderService } from '../../ai-provider/ai-provider.service';
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
  const claudeAdapter: Pick<
    ClaudeAdapter,
    'providerName' | 'createChatCompletion' | 'createStreamChatCompletion'
  > = {
    providerName: 'Claude',
    createChatCompletion: claudeCreateChatCompletionMock,
    createStreamChatCompletion: claudeCreateStreamChatCompletionMock,
  };
  const zaiwenCreateChatCompletionMock =
    jest.fn<ZaiwenAdapter['createChatCompletion']>();
  const zaiwenCreateStreamChatCompletionMock =
    jest.fn<ZaiwenAdapter['createStreamChatCompletion']>();
  const zaiwenAdapter: Pick<
    ZaiwenAdapter,
    'providerName' | 'createChatCompletion' | 'createStreamChatCompletion'
  > = {
    providerName: 'Zaiwen',
    createChatCompletion: zaiwenCreateChatCompletionMock,
    createStreamChatCompletion: zaiwenCreateStreamChatCompletionMock,
  };
  const findByModelIdMock = jest.fn<AiModelService['findByModelId']>();
  const aiModelService: Pick<AiModelService, 'findByModelId'> = {
    findByModelId: findByModelIdMock,
  };
  const incrementAccessCountMock =
    jest.fn<AiProviderService['incrementAccessCount']>();
  const aiProviderService: Pick<AiProviderService, 'incrementAccessCount'> = {
    incrementAccessCount: incrementAccessCountMock,
  };

  let service: AIClientService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AIClientService(
      claudeAdapter as ClaudeAdapter,
      zaiwenAdapter as ZaiwenAdapter,
      aiModelService as AiModelService,
      aiProviderService as AiProviderService,
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
});
