import { BadRequestException } from '@nestjs/common';
import { AIClientService } from './ai-client.service';

describe('AIClientService', () => {
  const claudeAdapter = {
    createChatCompletion: jest.fn(),
    createStreamChatCompletion: jest.fn(),
  };
  const zaiwenAdapter = {
    createChatCompletion: jest.fn(),
    createStreamChatCompletion: jest.fn(),
  };
  const aiModelService = {
    findByModelId: jest.fn(),
  };
  const aiProviderService = {
    incrementAccessCount: jest.fn(),
  };

  let service: AIClientService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AIClientService(
      claudeAdapter as any,
      zaiwenAdapter as any,
      aiModelService as any,
      aiProviderService as any,
    );
  });

  it('decorates non-stream usage with estimated cost', async () => {
    aiModelService.findByModelId.mockResolvedValue({
      isActive: true,
      inputPrice: 0.5,
      outputPrice: 2,
      provider: { id: 'provider-1', name: 'Zaiwen', isActive: true },
      modelName: 'GLM-5',
    });
    zaiwenAdapter.createChatCompletion.mockResolvedValue({
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
    aiModelService.findByModelId.mockResolvedValue({
      isActive: true,
      inputPrice: 0.5,
      outputPrice: 2,
      provider: { id: 'provider-1', name: 'Zaiwen', isActive: true },
      modelName: 'GLM-5',
    });
    zaiwenAdapter.createStreamChatCompletion.mockResolvedValue(
      (async function* () {
        yield {
          delta: { content: 'hi' },
          finish_reason: null,
        };
        yield {
          delta: { content: '' },
          finish_reason: null,
          usage: {
            promptTokens: 100,
            completionTokens: 50,
            totalTokens: 150,
          },
        };
      })(),
    );

    const chunks = [];
    for await (const chunk of await service.createStreamChatCompletion('GLM-5', [])) {
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
    aiModelService.findByModelId.mockResolvedValue({
      isActive: true,
      provider: { id: 'provider-1', name: 'Zaiwen', isActive: false },
      modelName: 'GLM-5',
    });

    await expect(service.createStreamChatCompletion('GLM-5', [])).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
