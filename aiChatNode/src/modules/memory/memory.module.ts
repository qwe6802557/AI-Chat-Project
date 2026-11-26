import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentCoreProfile } from './entities/agent-core-profile.entity';
import { AgentDailyMemory } from './entities/agent-daily-memory.entity';
import { MemoryExtractorService } from './services/memory-extractor.service';
import { MemoryDistillerService } from './services/memory-distiller.service';
import { MemoryContextService } from './services/memory-context.service';
import { MemoryLlmService } from './services/memory-llm.service';
import { MemoryVectorStoreService } from './services/memory-vector-store.service';
import { MemoryController } from './memory.controller';
import { KnowledgeBaseModule } from '../knowledge-base/knowledge-base.module';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AgentCoreProfile, AgentDailyMemory]),
    KnowledgeBaseModule,
    forwardRef(() => ChatModule),
  ],
  controllers: [MemoryController],
  providers: [
    MemoryLlmService,
    MemoryVectorStoreService,
    MemoryExtractorService,
    MemoryDistillerService,
    MemoryContextService,
  ],
  exports: [
    MemoryLlmService,
    MemoryVectorStoreService,
    MemoryContextService,
    MemoryExtractorService,
    MemoryDistillerService,
  ],
})
export class MemoryModule {}
