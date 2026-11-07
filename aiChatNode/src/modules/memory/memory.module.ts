import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentCoreProfile } from './entities/agent-core-profile.entity';
import { AgentDailyMemory } from './entities/agent-daily-memory.entity';
import { MemoryExtractorService } from './services/memory-extractor.service';
import { MemoryDistillerService } from './services/memory-distiller.service';
import { MemoryContextService } from './services/memory-context.service';
import { MemoryController } from './memory.controller';
import { KnowledgeBaseModule } from '../knowledge-base/knowledge-base.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AgentCoreProfile, AgentDailyMemory]),
    KnowledgeBaseModule,
  ],
  controllers: [MemoryController],
  providers: [
    MemoryExtractorService,
    MemoryDistillerService,
    MemoryContextService,
  ],
  exports: [
    MemoryContextService,
    MemoryExtractorService,
    MemoryDistillerService,
  ],
})
export class MemoryModule {}
