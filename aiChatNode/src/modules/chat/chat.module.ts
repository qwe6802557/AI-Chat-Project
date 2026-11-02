import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatController } from './chat.controller';
import { ChatSessionController } from './chat-session.controller';
import { ChatService } from './chat.service';
import { ChatSessionService } from './chat-session.service';
import { AIClientService } from './services/ai-client.service';
import { AgentExecutorService } from './services/agent-executor.service';
import { ApprovalManagerService } from './services/approval-manager.service';
import { ClaudeAdapter } from './adapters/claude.adapter';
import { ZaiwenAdapter } from './adapters/zaiwen.adapter';
import { Grok2APIAdapter } from './adapters/grok2api.adapter';
import { ZhipuAdapter } from './adapters/zhipu.adapter';
import { SiliconFlowAdapter } from './adapters/siliconflow.adapter';
import { OFMAdapter } from './adapters/ofm.adapter';
import { XfyunMaaSAdapter } from './adapters/xfyun-maas.adapter';
import { ChatMessage } from './entities/chat.entity';
import { ChatSession } from './entities/chat-session.entity';
import { ChatAttachment } from './entities/chat-attachment.entity';
import { RedisModule } from '../../common/redis/redis.module';
import { UserModule } from '../user/user.module';
import { AiProviderModule } from '../ai-provider/ai-provider.module';
import { CreditsModule } from '../credits/credits.module';
import { FilesModule } from '../files/files.module';
import { WebSearchModule } from '../web-search/web-search.module';
import { ToolsModule } from '../tools/tools.module';
import { KnowledgeBaseModule } from '../knowledge-base/knowledge-base.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChatMessage, ChatSession, ChatAttachment]),
    UserModule,
    forwardRef(() => AiProviderModule),
    CreditsModule,
    FilesModule,
    RedisModule,
    WebSearchModule,
    ToolsModule,
    KnowledgeBaseModule,
  ],
  controllers: [ChatController, ChatSessionController],
  providers: [
    ChatService,
    ChatSessionService,
    AIClientService,
    ClaudeAdapter,
    ZaiwenAdapter,
    Grok2APIAdapter,
    ZhipuAdapter,
    SiliconFlowAdapter,
    OFMAdapter,
    XfyunMaaSAdapter,
    AgentExecutorService,
    ApprovalManagerService,
  ],
  exports: [
    ChatService,
    ChatSessionService,
    AIClientService,
    AgentExecutorService,
    ApprovalManagerService,
  ],
})
export class ChatModule {}
