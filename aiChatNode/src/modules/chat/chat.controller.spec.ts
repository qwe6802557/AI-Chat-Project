import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Request, Response } from 'express';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

describe('ChatController', () => {
  let controller: ChatController;
  const chatService = {
    create: jest.fn(),
    createStream: jest.fn(),
    saveStreamMessage: jest.fn(),
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
      controller.create(
        { message: 'hello' } as any,
        { user: undefined } as unknown as Request,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects create when dto userId does not match current user', async () => {
    await expect(
      controller.create(
        { userId: 'other-user', message: 'hello' } as any,
        { user: { id: 'current-user' } } as unknown as Request,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('injects current user id before delegating create', async () => {
    chatService.create.mockResolvedValue({ id: 'msg-1' });

    const dto = { message: 'hello' } as any;
    await controller.create(
      dto,
      { user: { id: 'current-user' } } as unknown as Request,
    );

    expect(chatService.create).toHaveBeenCalledWith({
      message: 'hello',
      userId: 'current-user',
    });
  });

  it('rejects createStream when dto userId does not match current user', async () => {
    await expect(
      controller.createStream(
        { userId: 'other-user', message: 'hello' } as any,
        { on: jest.fn() } as unknown as Response,
        { user: { id: 'current-user' } } as unknown as Request,
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
      attachmentIds: ['file-1'],
      stream: (async function* () {
        yield {
          delta: { content: 'Hi' },
          finish_reason: null,
        };
        yield {
          delta: { content: '' },
          finish_reason: 'stop',
        };
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
      })(),
    });
    chatService.saveStreamMessage.mockResolvedValue({ id: 'msg-1' });

    await controller.createStream(
      { message: 'hello' } as any,
      res,
      { user: { id: 'current-user' } } as unknown as Request,
    );

    expect(chatService.saveStreamMessage).toHaveBeenCalledWith(
      'current-user',
      'session-1',
      'hello',
      'Hi',
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
