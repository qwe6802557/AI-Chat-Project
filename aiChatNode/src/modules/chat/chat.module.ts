import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatController } from './chat.controller';
import { ChatSessionController } from './chat-session.controller';
import { ChatService } from './chat.service';
import { ChatSessionService } from './chat-session.service';
import { OpenAIService } from './openai.service';
import { ChatMessage } from './entities/chat.entity';
import { ChatSession } from './entities/chat-session.entity';
import { UserModule } from '../user/user.module';

@Module({
  imports: [TypeOrmModule.forFeature([ChatMessage, ChatSession]), UserModule],
  controllers: [ChatController, ChatSessionController],
  providers: [ChatService, ChatSessionService, OpenAIService],
})
export class ChatModule {}
