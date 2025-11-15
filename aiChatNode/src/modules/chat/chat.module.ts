import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { OpenAIService } from './openai.service';
import { ChatMessage } from './entities/chat.entity';
import { UserModule } from '../user/user.module';

@Module({
  imports: [TypeOrmModule.forFeature([ChatMessage]), UserModule],
  controllers: [ChatController],
  providers: [ChatService, OpenAIService],
})
export class ChatModule {}
