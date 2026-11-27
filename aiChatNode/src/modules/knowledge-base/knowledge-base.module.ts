import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { KnowledgeBase } from './entities/knowledge-base.entity';
import { KnowledgeDocument } from './entities/knowledge-document.entity';
import { KnowledgeChunk } from './entities/knowledge-chunk.entity';
import { KnowledgeAsset } from './entities/knowledge-asset.entity';
import { DocumentParserService } from './services/document-parser.service';
import { RecursiveChunkerService } from './services/recursive-chunker.service';
import { EmbeddingService } from './services/embedding.service';
import { RerankService } from './services/rerank.service';
import { HybridRagService } from './services/hybrid-rag.service';
import { KnowledgeBaseService } from './services/knowledge-base.service';
import { KnowledgeProgressService } from './services/knowledge-progress.service';
import { KnowledgeAssetService } from './services/knowledge-asset.service';
import { KnowledgeVisionService } from './services/knowledge-vision.service';
import { PdfVisualRouterService } from './services/pdf-visual-router.service';
import { KnowledgeIngestProcessor } from './processors/knowledge-ingest.processor';
import { KnowledgeBaseController } from './knowledge-base.controller';
import { KnowledgeAssetsController } from './knowledge-assets.controller';
import { KNOWLEDGE_INGEST_QUEUE } from './constants/knowledge-queue.constants';
import { RedisModule } from '../../common/redis/redis.module';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [
    RedisModule,
    forwardRef(() => ChatModule),
    TypeOrmModule.forFeature([
      KnowledgeBase,
      KnowledgeDocument,
      KnowledgeChunk,
      KnowledgeAsset,
    ]),
    BullModule.registerQueue({
      name: KNOWLEDGE_INGEST_QUEUE,
    }),
  ],
  controllers: [KnowledgeBaseController, KnowledgeAssetsController],
  providers: [
    DocumentParserService,
    RecursiveChunkerService,
    EmbeddingService,
    RerankService,
    HybridRagService,
    KnowledgeProgressService,
    KnowledgeAssetService,
    KnowledgeVisionService,
    PdfVisualRouterService,
    KnowledgeIngestProcessor,
    KnowledgeBaseService,
  ],
  exports: [
    HybridRagService,
    KnowledgeBaseService,
    EmbeddingService,
    RerankService,
    KnowledgeProgressService,
    KnowledgeAssetService,
    KnowledgeVisionService,
  ],
})
export class KnowledgeBaseModule {}
