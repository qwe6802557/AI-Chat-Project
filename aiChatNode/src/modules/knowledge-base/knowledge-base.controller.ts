import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { KnowledgeBaseService } from './services/knowledge-base.service';
import { HybridRagService } from './services/hybrid-rag.service';
import { KnowledgeProgressService } from './services/knowledge-progress.service';
import {
  CreateKnowledgeBaseDto,
  UpdateKnowledgeBaseDto,
  SearchKnowledgeBaseDto,
  UpdateKnowledgeChunkDto,
} from './dto';

@ApiTags('知识库管理与 RAG 检索')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller('knowledge-bases')
export class KnowledgeBaseController {
  constructor(
    private readonly kbService: KnowledgeBaseService,
    private readonly ragService: HybridRagService,
    private readonly progressService: KnowledgeProgressService,
  ) {}

  @Post()
  @ApiOperation({ summary: '创建新知识库' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateKnowledgeBaseDto,
  ) {
    return this.kbService.createKnowledgeBase(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: '获取当前用户的所有知识库' })
  async list(@CurrentUser('id') userId: string) {
    return this.kbService.getKnowledgeBases(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取指定知识库详情' })
  async getOne(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.kbService.getKnowledgeBaseById(userId, id);
  }

  @Put(':id')
  @ApiOperation({ summary: '更新知识库信息' })
  async update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateKnowledgeBaseDto,
  ) {
    return this.kbService.updateKnowledgeBase(userId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除知识库（级联清空文档及切片）' })
  async delete(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    await this.kbService.deleteKnowledgeBase(userId, id);
    return { success: true };
  }

  @Post(':id/documents')
  @ApiOperation({ summary: '上传并解析入库文档 (PDF/DOCX/MD/TXT)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
    }),
  )
  async uploadDocument(
    @CurrentUser('id') userId: string,
    @Param('id') kbId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('请选择要上传的文件');
    }
    return this.kbService.uploadAndProcessDocument(userId, kbId, file);
  }

  @Get(':id/documents')
  @ApiOperation({ summary: '获取知识库文档列表' })
  async getDocuments(
    @CurrentUser('id') userId: string,
    @Param('id') kbId: string,
  ) {
    return this.kbService.getDocuments(userId, kbId);
  }

  @Get(':id/documents/events')
  @ApiOperation({ summary: '订阅知识库文档异步解析进度 SSE 流' })
  async streamDocumentEvents(
    @CurrentUser('id') userId: string,
    @Param('id') kbId: string,
    @Res() res: Response,
  ) {
    await this.kbService.getKnowledgeBaseById(userId, kbId);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const writeEvent = (payload: unknown) => {
      if (res.writableEnded || res.destroyed) return;
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    let closed = false;
    let unsubscribe: (() => Promise<void>) | null = null;
    const heartbeatTimer = setInterval(() => {
      if (!res.writableEnded && !res.destroyed) {
        res.write(': heartbeat\n\n');
      }
    }, 25000);

    const cleanup = () => {
      if (closed) return;
      closed = true;
      clearInterval(heartbeatTimer);
      if (unsubscribe) {
        const fn = unsubscribe;
        unsubscribe = null;
        void fn();
      }
    };

    res.on('close', cleanup);
    res.on('error', cleanup);

    try {
      // 先订阅频道再读 DB 快照，消除建连窗口事件丢失；重复状态按幂等合并
      unsubscribe = await this.progressService.subscribe(
        userId,
        kbId,
        (evt) => {
          writeEvent(evt);
        },
      );
      if (closed) {
        cleanup();
        return;
      }

      const activeDocs = await this.kbService.getActiveDocumentsSnapshot(
        userId,
        kbId,
      );
      writeEvent({
        type: 'snapshot',
        knowledgeBaseId: kbId,
        documents: activeDocs.map((doc) => ({
          documentId: doc.id,
          knowledgeBaseId: doc.knowledgeBaseId,
          status: doc.status,
          stage: doc.stage,
          progress: doc.progress,
          chunkCount: doc.chunkCount,
          charCount: doc.charCount,
          errorMessage: doc.errorMessage,
          updatedAt: doc.updatedAt?.toISOString?.() || new Date().toISOString(),
        })),
      });
    } catch (error) {
      cleanup();
      if (!res.writableEnded && !res.destroyed) {
        const msg = error instanceof Error ? error.message : '订阅流异常';
        writeEvent({ type: 'error', message: msg });
        res.end();
      }
    }
  }

  @Post('documents/:docId/retry')
  @ApiOperation({ summary: '重新将解析失败的文档加入异步队列' })
  async retryDocument(
    @CurrentUser('id') userId: string,
    @Param('docId') docId: string,
  ) {
    return this.kbService.retryDocument(userId, docId);
  }

  @Delete('documents/:docId')
  @ApiOperation({ summary: '删除文档' })
  async deleteDocument(
    @CurrentUser('id') userId: string,
    @Param('docId') docId: string,
  ) {
    await this.kbService.deleteDocument(userId, docId);
    return { success: true };
  }

  @Get('documents/:docId/chunks')
  @ApiOperation({ summary: '获取文档切片详情列表' })
  async getChunks(
    @CurrentUser('id') userId: string,
    @Param('docId') docId: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('keyword') keyword?: string,
    @Query('enabledOnly') enabledOnly?: string,
  ) {
    return this.kbService.getChunks(
      userId,
      docId,
      page ? Number(page) : 1,
      pageSize ? Number(pageSize) : 20,
      {
        keyword,
        enabledOnly: enabledOnly === 'true',
      },
    );
  }

  @Get('chunks/:chunkId/context')
  @ApiOperation({ summary: '获取命中切片及其前后邻接上下文窗口' })
  async getChunkContext(
    @CurrentUser('id') userId: string,
    @Param('chunkId') chunkId: string,
    @Query('window') window?: number,
  ) {
    return this.kbService.getChunkContext(
      userId,
      chunkId,
      window ? Number(window) : 1,
    );
  }

  @Patch('chunks/:chunkId')
  @ApiOperation({ summary: '编辑切片正文（自动重算向量）或启停状态' })
  async updateChunk(
    @CurrentUser('id') userId: string,
    @Param('chunkId') chunkId: string,
    @Body() dto: UpdateKnowledgeChunkDto,
  ) {
    return this.kbService.updateChunk(userId, chunkId, dto);
  }

  @Post('search')
  @ApiOperation({ summary: '混合双路 RAG 语义检索与 Rerank 测试' })
  async search(
    @CurrentUser('id') userId: string,
    @Body() dto: SearchKnowledgeBaseDto,
  ) {
    return this.ragService.search({
      userId,
      query: dto.query,
      knowledgeBaseIds: dto.knowledgeBaseIds,
      documentIds: dto.documentIds,
      limit: dto.limit,
      mode: dto.mode,
      minScore: dto.minScore,
      enableRerank: dto.enableRerank,
    });
  }
}
