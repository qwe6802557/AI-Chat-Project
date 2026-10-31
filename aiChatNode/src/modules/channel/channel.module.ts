import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChannelConfig } from './entities/channel-config.entity';
import { AgentRole } from './entities/agent-role.entity';
import { ChannelManagerService } from './channel-manager.service';
import { ChannelController } from './channel.controller';
import { ChatModule } from '../chat/chat.module';
import { AiProviderModule } from '../ai-provider/ai-provider.module';
import { CreditsModule } from '../credits/credits.module';
import { UserModule } from '../user/user.module';
import { KnowledgeBaseModule } from '../knowledge-base/knowledge-base.module';

/**
 * 智能助理通道模块 (支持多实例与角色解耦及知识库RAG)
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([ChannelConfig, AgentRole]),
    forwardRef(() => ChatModule),
    AiProviderModule,
    CreditsModule,
    UserModule,
    KnowledgeBaseModule,
  ],
  controllers: [ChannelController],
  providers: [ChannelManagerService],
  exports: [ChannelManagerService],
})
export class ChannelModule {}
