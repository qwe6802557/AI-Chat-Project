import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatController } from './chat.controller';
import { ChatSessionController } from './chat-session.controller';
import { ChatService } from './chat.service';
import { ChatSessionService } from './chat-session.service';
import { AIClientService } from './services/ai-client.service';
import { ClaudeAdapter } from './adapters/claude.adapter';
import { ZaiwenAdapter } from './adapters/zaiwen.adapter';
import { ChatMessage } from './entities/chat.entity';
import { ChatSession } from './entities/chat-session.entity';
import { ChatAttachment } from './entities/chat-attachment.entity';
import { RedisModule } from '../../common/redis/redis.module';
import { UserModule } from '../user/user.module';
import { AiProviderModule } from '../ai-provider/ai-provider.module';
import { FilesModule } from '../files/files.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChatMessage, ChatSession, ChatAttachment]),
    UserModule,
    AiProviderModule,
    FilesModule, // 导入文件模块
    RedisModule,
  ],
  controllers: [ChatController, ChatSessionController],
  providers: [
    ChatService,
    ChatSessionService,
    AIClientService, // AI 客户端服务
    ClaudeAdapter, // Claude 适配器
    ZaiwenAdapter, // 在问适配器
  ],
  exports: [ChatService, ChatSessionService, AIClientService],
})
export class ChatModule {}
