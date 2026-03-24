import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { ChatSessionController } from './chat-session.controller';
import { ChatSessionService } from './chat-session.service';
import { ChatService } from './chat.service';

describe('ChatSessionController', () => {
  let controller: ChatSessionController;
  const chatSessionService = {
    clearAllByUserId: jest.fn(),
  };
  const chatService = {};

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatSessionController],
      providers: [
        {
          provide: ChatSessionService,
          useValue: chatSessionService,
        },
        {
          provide: ChatService,
          useValue: chatService,
        },
      ],
    }).compile();

    controller = module.get(ChatSessionController);
  });

  it('rejects clearAll when request user does not match body userId', async () => {
    await expect(
      controller.clearAll(
        { userId: 'other-user' },
        { user: { id: 'current-user' } } as unknown as Request,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('delegates clearAll when request user matches body userId', async () => {
    chatSessionService.clearAllByUserId.mockResolvedValue({ deletedCount: 3 });

    await expect(
      controller.clearAll(
        { userId: 'current-user' },
        { user: { id: 'current-user' } } as unknown as Request,
      ),
    ).resolves.toEqual({
      message: '已清空所有会话',
      deletedCount: 3,
    });

    expect(chatSessionService.clearAllByUserId).toHaveBeenCalledWith(
      'current-user',
    );
  });
});
