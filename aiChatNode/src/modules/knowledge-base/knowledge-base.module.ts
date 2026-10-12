import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KnowledgeBase } from './entities/knowledge-base.entity';
import { KnowledgeDocument } from './entities/knowledge-document.entity';
import { KnowledgeChunk } from './entities/knowledge-chunk.entity';
import { DocumentParserService } from './services/document-parser.service';
import { RecursiveChunkerService } from './services/recursive-chunker.service';
import { EmbeddingService } from './services/embedding.service';
import { HybridRagService } from './services/hybrid-rag.service';
import { KnowledgeBaseService } from './services/knowledge-base.service';
import { KnowledgeBaseController } from './knowledge-base.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      KnowledgeBase,
      KnowledgeDocument,
      KnowledgeChunk,
    ]),
  ],
  controllers: [KnowledgeBaseController],
  providers: [
    DocumentParserService,
    RecursiveChunkerService,
    EmbeddingService,
    HybridRagService,
    KnowledgeBaseService,
  ],
  exports: [HybridRagService, KnowledgeBaseService],
})
export class KnowledgeBaseModule {}
