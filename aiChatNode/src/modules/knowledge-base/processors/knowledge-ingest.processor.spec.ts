import { UnrecoverableError } from 'bullmq';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { KnowledgeIngestProcessor } from './knowledge-ingest.processor';

describe('KnowledgeIngestProcessor', () => {
  let processor: KnowledgeIngestProcessor;
  let mockKbRepo: any;
  let mockDocRepo: any;
  let mockChunkRepo: any;
  let mockTxManager: any;
  let mockParserService: any;
  let mockChunkerService: any;
  let mockEmbeddingService: any;
  let mockProgressService: any;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kb-ingest-proc-'));

    mockKbRepo = {
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    mockTxManager = {
      findOne: jest.fn(),
      query: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    mockDocRepo = {
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      count: jest.fn().mockResolvedValue(1),
      manager: {
        transaction: jest.fn((cb: (em: any) => Promise<any>) => cb(mockTxManager)),
      },
    };
    mockChunkRepo = {
      count: jest.fn().mockResolvedValue(2),
    };
    mockParserService = {
      parseBuffer: jest.fn(),
    };
    mockChunkerService = {
      splitText: jest.fn(),
    };
    mockEmbeddingService = {
      embedDocuments: jest.fn(),
    };
    mockProgressService = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    processor = new KnowledgeIngestProcessor(
      mockKbRepo,
      mockDocRepo,
      mockChunkRepo,
      mockParserService,
      mockChunkerService,
      mockEmbeddingService,
      mockProgressService,
    );
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('应推进分阶段进度、事务写入 vector 切片并自动清理临时原文件', async () => {
    const filePath = path.join(tempDir, 'sample.md');
    await fs.writeFile(filePath, '# Hello\npgvector test');

    const docRecord = {
      id: 'doc-1',
      knowledgeBaseId: 'kb-1',
      userId: 'u1',
      title: 'sample',
      fileName: 'sample.md',
      fileType: 'md',
      filePath,
      progress: 0,
    };
    mockDocRepo.findOne.mockResolvedValue(docRecord);
    mockTxManager.findOne.mockResolvedValue(docRecord);
    mockParserService.parseBuffer.mockResolvedValue({
      text: 'chunk-a\n\nchunk-b',
      charCount: 16,
    });
    mockChunkerService.splitText.mockReturnValue([
      { chunkIndex: 0, content: 'chunk-a', charCount: 7 },
      { chunkIndex: 1, content: 'chunk-b', charCount: 7 },
    ]);
    mockEmbeddingService.embedDocuments.mockImplementation(
      async (texts: string[], _bs: number, onBatch?: (p: number, t: number) => Promise<void>) => {
        if (onBatch) await onBatch(texts.length, texts.length);
        return [
          [0.6, 0.8],
          [0.8, 0.6],
        ];
      },
    );

    await processor.process({
      data: { documentId: 'doc-1', knowledgeBaseId: 'kb-1', userId: 'u1' },
      attemptsMade: 0,
      opts: { attempts: 3 },
    } as any);

    expect(mockTxManager.query).toHaveBeenNthCalledWith(
      1,
      'DELETE FROM "knowledge_chunks" WHERE "documentId" = $1',
      ['doc-1'],
    );
    expect(mockTxManager.query.mock.calls[1][0]).toContain('::vector(1024)');
    await expect(fs.access(filePath)).rejects.toThrow();

    const publishedStages = mockProgressService.publish.mock.calls.map(
      (c: any[]) => `${c[0].type}:${c[0].stage}:${c[0].progress}`,
    );
    expect(publishedStages).toContain('progress:parsing:10');
    expect(publishedStages).toContain('progress:chunking:50');
    expect(publishedStages).toContain('progress:embedding:85');
    expect(publishedStages).toContain('progress:saving:90');
    expect(publishedStages).toContain('completed:completed:100');
  });

  it('无有效切片时抛出 UnrecoverableError 并在失败后保留原文件供后续排查', async () => {
    const filePath = path.join(tempDir, 'empty.txt');
    await fs.writeFile(filePath, '   ');

    mockDocRepo.findOne.mockResolvedValue({
      id: 'doc-empty',
      knowledgeBaseId: 'kb-1',
      userId: 'u1',
      title: 'empty',
      fileName: 'empty.txt',
      fileType: 'txt',
      filePath,
      progress: 25,
    });
    mockParserService.parseBuffer.mockResolvedValue({ text: ' ', charCount: 1 });
    mockChunkerService.splitText.mockReturnValue([]);

    await expect(
      processor.process({
        data: { documentId: 'doc-empty', knowledgeBaseId: 'kb-1', userId: 'u1' },
        attemptsMade: 0,
        opts: { attempts: 3 },
      } as any),
    ).rejects.toThrow(UnrecoverableError);

    expect(mockDocRepo.update).toHaveBeenCalledWith(
      'doc-empty',
      expect.objectContaining({ status: 'failed', stage: 'failed' }),
    );
    expect(mockProgressService.publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'failed', documentId: 'doc-empty' }),
    );
    await expect(fs.access(filePath)).resolves.toBeUndefined();
  });

  it('处理途中文档被删除时应安全中止并清理临时文件', async () => {
    const filePath = path.join(tempDir, 'deleted.txt');
    await fs.writeFile(filePath, 'hello');

    mockDocRepo.findOne.mockResolvedValue({
      id: 'doc-del',
      knowledgeBaseId: 'kb-1',
      userId: 'u1',
      fileName: 'deleted.txt',
      filePath,
    });
    mockDocRepo.update.mockResolvedValue({ affected: 0 });

    await expect(
      processor.process({
        data: { documentId: 'doc-del', knowledgeBaseId: 'kb-1', userId: 'u1' },
        attemptsMade: 0,
        opts: { attempts: 3 },
      } as any),
    ).resolves.toBeUndefined();

    await expect(fs.access(filePath)).rejects.toThrow();
  });

  it('支持独立图片与混合 PDF 视觉路由入库，并在中途失败时自动清理未提交视觉资产', async () => {
    const mockAssetService = {
      writeNormalizedAssetFile: jest.fn().mockResolvedValue({
        assetId: 'asset-img-1',
        storagePath: 'assets/u1/doc-mm/asset-img-1.webp',
        absolutePath: path.join(tempDir, 'asset-img-1.webp'),
        buffer: Buffer.from('webp'),
        mimeType: 'image/webp',
        width: 800,
        height: 600,
        sizeBytes: 2048,
      }),
      removeAssetFiles: jest.fn().mockResolvedValue(undefined),
      cleanupDocumentAssetFiles: jest.fn().mockResolvedValue(undefined),
    };
    const mockVisionService = {
      extractVisualContent: jest.fn().mockResolvedValue({
        visualType: 'diagram',
        title: '系统拓扑图',
        summary: '展示双路检索引擎数据流',
        ocrText: 'pgvector HNSW',
        tableMarkdown: '',
        searchableText: '[独立图像 · 视觉内容(diagram)] 系统拓扑图\n\n核心摘要：展示双路检索引擎数据流',
        modelId: 'glm-4v-flash',
      }),
    };
    const mockPdfVisualRouter = {
      inspectAndRenderPages: jest.fn().mockResolvedValue({
        totalPages: 2,
        visualPagesDetected: 1,
        visualPagesRendered: 1,
        visualPagesSkippedByCap: 0,
        pages: [
          {
            pageNumber: 1,
            text: 'A'.repeat(120),
            isVisualPage: false,
            metrics: { textLength: 120, imageOpCount: 0, vectorDrawOpCount: 0 },
          },
          {
            pageNumber: 2,
            text: 'Chart 2',
            isVisualPage: true,
            metrics: { textLength: 7, imageOpCount: 1, vectorDrawOpCount: 0 },
            renderedPngBuffer: Buffer.from('png-page-2'),
          },
        ],
      }),
    };

    const multimodalProcessor = new KnowledgeIngestProcessor(
      mockKbRepo,
      mockDocRepo,
      mockChunkRepo,
      mockParserService,
      mockChunkerService,
      mockEmbeddingService,
      mockProgressService,
      mockAssetService as any,
      mockVisionService as any,
      mockPdfVisualRouter as any,
    );

    const pdfPath = path.join(tempDir, 'mixed.pdf');
    await fs.writeFile(pdfPath, 'fake-pdf');
    const docRecord = {
      id: 'doc-mm',
      knowledgeBaseId: 'kb-1',
      userId: 'u1',
      title: 'mixed',
      fileName: 'mixed.pdf',
      fileType: 'pdf',
      filePath: pdfPath,
      progress: 0,
    };
    mockDocRepo.findOne.mockResolvedValue(docRecord);
    mockTxManager.findOne.mockResolvedValue(docRecord);
    mockTxManager.query.mockResolvedValue([]);
    mockChunkerService.splitText.mockReturnValue([
      { chunkIndex: 0, content: 'A'.repeat(120), charCount: 120 },
    ]);
    mockEmbeddingService.embedDocuments.mockResolvedValue([
      [0.1, 0.2],
      [0.3, 0.4],
    ]);

    await multimodalProcessor.process({
      data: { documentId: 'doc-mm', knowledgeBaseId: 'kb-1', userId: 'u1' },
      attemptsMade: 0,
      opts: { attempts: 3 },
    } as any);

    expect(mockVisionService.extractVisualContent).toHaveBeenCalledTimes(1);
    const stages = mockProgressService.publish.mock.calls.map(
      (c: any[]) => c[0].stage,
    );
    expect(stages).toContain('vision_extracting');
    expect(mockTxManager.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO "knowledge_assets"'),
      expect.any(Array),
    );

    mockEmbeddingService.embedDocuments.mockRejectedValueOnce(new Error('embed failed'));
    const failPath = path.join(tempDir, 'fail.png');
    await fs.writeFile(failPath, 'fake-png');
    mockDocRepo.findOne.mockResolvedValue({
      id: 'doc-fail-img',
      knowledgeBaseId: 'kb-1',
      userId: 'u1',
      title: 'fail',
      fileName: 'fail.png',
      fileType: 'png',
      filePath: failPath,
      progress: 0,
    });

    await expect(
      multimodalProcessor.process({
        data: { documentId: 'doc-fail-img', knowledgeBaseId: 'kb-1', userId: 'u1' },
        attemptsMade: 0,
        opts: { attempts: 3 },
      } as any),
    ).rejects.toThrow('embed failed');

    expect(mockAssetService.removeAssetFiles).toHaveBeenCalledWith([
      'assets/u1/doc-mm/asset-img-1.webp',
    ]);
  });
});
