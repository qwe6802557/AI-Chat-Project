import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatController } from './chat.controller';
import { ChatSessionController } from './chat-session.controller';
import { ChatService } from './chat.service';
import { ChatSessionService } from './chat-session.service';
import { AIClientService } from './services/ai-client.service';
import { ClaudeAdapter } from './adapters/claude.adapter';
import { ChatMessage } from './entities/chat.entity';
import { ChatSession } from './entities/chat-session.entity';
import { UserModule } from '../user/user.module';
import { AiProviderModule } from '../ai-provider/ai-provider.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChatMessage, ChatSession]),
    UserModule,
    AiProviderModule, // 导入 AI 供应商模块
  ],
  controllers: [ChatController, ChatSessionController],
  providers: [
    ChatService,
    ChatSessionService,
    AIClientService, // 新增：AI 客户端服务
    ClaudeAdapter, // 新增：Claude 适配器
  ],
  exports: [ChatService, ChatSessionService],
})
export class ChatModule {}
