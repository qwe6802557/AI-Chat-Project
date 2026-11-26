import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { KnowledgeBase } from './entities/knowledge-base.entity';
import { KnowledgeDocument } from './entities/knowledge-document.entity';
import { KnowledgeChunk } from './entities/knowledge-chunk.entity';
import { DocumentParserService } from './services/document-parser.service';
import { RecursiveChunkerService } from './services/recursive-chunker.service';
import { EmbeddingService } from './services/embedding.service';
import { RerankService } from './services/rerank.service';
import { HybridRagService } from './services/hybrid-rag.service';
import { KnowledgeBaseService } from './services/knowledge-base.service';
import { KnowledgeProgressService } from './services/knowledge-progress.service';
import { KnowledgeIngestProcessor } from './processors/knowledge-ingest.processor';
import { KnowledgeBaseController } from './knowledge-base.controller';
import { KNOWLEDGE_INGEST_QUEUE } from './constants/knowledge-queue.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      KnowledgeBase,
      KnowledgeDocument,
      KnowledgeChunk,
    ]),
    BullModule.registerQueue({
      name: KNOWLEDGE_INGEST_QUEUE,
    }),
  ],
  controllers: [KnowledgeBaseController],
  providers: [
    DocumentParserService,
    RecursiveChunkerService,
    EmbeddingService,
    RerankService,
    HybridRagService,
    KnowledgeProgressService,
    KnowledgeIngestProcessor,
    KnowledgeBaseService,
  ],
  exports: [
    HybridRagService,
    KnowledgeBaseService,
    EmbeddingService,
    RerankService,
    KnowledgeProgressService,
  ],
})
export class KnowledgeBaseModule {}
