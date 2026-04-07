import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Response } from 'express';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import type { CreateChatDto } from './dto';

async function* createStreamChunks() {
  await Promise.resolve();
  yield {
    type: 'reasoning_start',
    reasoning: {
      mode: 'raw',
      source: 'extracted_tag',
      title: 'Think',
    },
    finish_reason: null,
  };
  await Promise.resolve();
  yield {
    type: 'reasoning_delta',
    delta: { content: '内部推理' },
    finish_reason: null,
  };
  await Promise.resolve();
  yield {
    type: 'reasoning_done',
    finish_reason: null,
  };
  await Promise.resolve();
  yield {
    type: 'answer_delta',
    delta: { content: 'Hi' },
    finish_reason: null,
  };
  await Promise.resolve();
  yield {
    delta: { content: '' },
    finish_reason: 'stop',
  };
  await Promise.resolve();
  yield {
    delta: { content: '' },
    finish_reason: null,
    usage: {
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
      estimatedInputCost: 0.01,
      estimatedOutputCost: 0.02,
      estimatedTotalCost: 0.03,
    },
  };
}

describe('ChatController', () => {
  let controller: ChatController;
  const chatService = {
    create: jest.fn(),
    createStream: jest.fn(),
    saveStreamMessage: jest.fn(),
    releaseReservedChatChargeSafely: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [
        {
          provide: ChatService,
          useValue: chatService,
        },
      ],
    }).compile();

    controller = module.get(ChatController);
  });

  it('rejects create when current user is missing', async () => {
    await expect(
      controller.create({ message: 'hello' }, undefined),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects create when dto userId does not match current user', async () => {
    await expect(
      controller.create(
        { userId: 'other-user', message: 'hello' },
        'current-user',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('injects current user id before delegating create', async () => {
    chatService.create.mockResolvedValue({ id: 'msg-1' });

    const dto: CreateChatDto = { message: 'hello' };
    await controller.create(dto, 'current-user');

    expect(chatService.create).toHaveBeenCalledWith({
      message: 'hello',
      userId: 'current-user',
    });
  });

  it('rejects createStream when dto userId does not match current user', async () => {
    await expect(
      controller.createStream(
        { userId: 'other-user', message: 'hello' },
        { on: jest.fn() } as unknown as Response,
        'current-user',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('persists stream usage after the final usage chunk arrives', async () => {
    const res = {
      on: jest.fn(),
      setHeader: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
      status: jest.fn().mockReturnThis(),
      writableEnded: false,
    } as unknown as Response;

    chatService.createStream.mockResolvedValue({
      sessionId: 'session-1',
      userId: 'current-user',
      userMessage: 'hello',
      modelId: 'GLM-5',
      clientRequestId: 'request-1',
      attachmentIds: ['file-1'],
      stream: createStreamChunks(),
    });
    chatService.saveStreamMessage.mockResolvedValue({
      savedMessage: { id: 'msg-1' },
      charge: {
        id: 'charge-1',
        clientRequestId: 'request-1',
        modelId: 'GLM-5',
        billingMode: 'flat_per_request',
        credits: 100,
        status: 'captured',
      },
      creditsSnapshot: {
        total: 2000,
        consumed: 100,
        remaining: 1900,
        reserved: 0,
      },
    });

    await controller.createStream({ message: 'hello' }, res, 'current-user');

    expect(chatService.saveStreamMessage).toHaveBeenCalledWith(
      'current-user',
      'session-1',
      'request-1',
      'hello',
      'Hi',
      {
        mode: 'raw',
        source: 'extracted_tag',
        title: 'Think',
        content: '内部推理',
      },
      'GLM-5',
      {
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
        estimatedInputCost: 0.01,
        estimatedOutputCost: 0.02,
        estimatedTotalCost: 0.03,
      },
      ['file-1'],
    );
  });
});
