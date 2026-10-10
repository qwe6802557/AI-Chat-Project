import { PassThrough } from 'node:stream';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import type { Repository } from 'typeorm';
import { FilesService } from './files.service';
import { ChatAttachment } from '../chat/entities/chat-attachment.entity';

class MockStreamResponse extends PassThrough {
  statusCodeValue?: number;
  headers: Record<string, string> = {};

  status(code: number) {
    this.statusCodeValue = code;
    return this;
  }

  setHeader(name: string, value: string) {
    this.headers[name] = value;
  }
}

describe('FilesService', () => {
  const findOneMock = jest.fn();
  const findMock = jest.fn();
  const createMock = jest.fn((dto) => ({ id: 'doc-1', ...dto }));
  const saveMock = jest.fn(async (entity) => entity);

  const attachmentRepository = {
    findOne: findOneMock,
    find: findMock,
    create: createMock,
    save: saveMock,
  } as unknown as Repository<ChatAttachment>;

  const configService = {
    get: jest.fn((key: string) => {
      const values: Record<string, string> = {
        FILE_URL_SIGN_SECRET: 'signed-secret',
        FILE_URL_TTL_SECONDS: '3600',
      };
      return values[key];
    }),
  } as unknown as ConfigService;

  const uploadsRoot = path.resolve(process.cwd(), 'uploads');

  let service: FilesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    service = new FilesService(attachmentRepository, configService);
    await rm(uploadsRoot, { recursive: true, force: true });
  });

  afterAll(async () => {
    await rm(uploadsRoot, { recursive: true, force: true });
  });

  it('builds signed file urls with expires and signature', () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);

    const url = service.buildSignedFileUrl('file-1');

    expect(url).toMatch(
      /^\/files\/file-1\?expires=\d+&signature=[a-f0-9]{64}$/,
    );

    jest.restoreAllMocks();
  });

  it('rejects file access when signature is invalid', async () => {
    const res = new MockStreamResponse() as unknown as Response;

    await service.streamFileById('file-1', res, {
      expires: `${Math.floor(Date.now() / 1000) + 3600}`,
      signature: 'invalid-signature',
    });

    expect((res as unknown as MockStreamResponse).statusCodeValue).toBe(403);
    expect(findOneMock).not.toHaveBeenCalled();
  });

  it('streams file when signature is valid', async () => {
    const storagePath = 'chat/2099/01/demo.webp';
    const absolutePath = path.join(
      uploadsRoot,
      'chat',
      '2099',
      '01',
      'demo.webp',
    );
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, 'signed-file-content', 'utf8');

    findOneMock.mockResolvedValue({
      id: 'file-1',
      storagePath,
      storageMime: 'image/webp',
      sizeBytes: Buffer.byteLength('signed-file-content'),
    });

    const signedUrl = service.buildSignedFileUrl('file-1');
    const url = new URL(`http://localhost${signedUrl}`);

    const res = new MockStreamResponse();
    const chunks: Buffer[] = [];
    res.on('data', (chunk: Buffer) => chunks.push(chunk));

    await service.streamFileById('file-1', res as unknown as Response, {
      expires: url.searchParams.get('expires') || undefined,
      signature: url.searchParams.get('signature') || undefined,
    });

    await new Promise<void>((resolve) => res.on('finish', () => resolve()));

    expect(res.statusCodeValue).toBeUndefined();
    expect(res.headers['Content-Type']).toBe('image/webp');
    expect(Buffer.concat(chunks).toString('utf8')).toBe('signed-file-content');
  });

  it('throws when ttl config is invalid', () => {
    const invalidConfigService = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          FILE_URL_SIGN_SECRET: 'signed-secret',
          FILE_URL_TTL_SECONDS: '0',
        };
        return values[key];
      }),
    } as unknown as ConfigService;

    expect(
      () => new FilesService(attachmentRepository, invalidConfigService),
    ).toThrow('FILE_URL_TTL_SECONDS 必须是大于 0 的整数秒数');
  });

  it('requires dedicated sign secret in production', () => {
    const productionConfigService = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          NODE_ENV: 'production',
          JWT_SECRET: 'jwt-secret',
        };
        return values[key];
      }),
    } as unknown as ConfigService;

    expect(
      () => new FilesService(attachmentRepository, productionConfigService),
    ).toThrow('生产环境必须配置 FILE_URL_SIGN_SECRET');
  });

  it('identifies supported images, PDFs, Word docs, and code/text files accurately', () => {
    expect(FilesService.resolveUploadFileKind('image/png', 'a.png')).toBe(
      'image',
    );
    expect(
      FilesService.resolveUploadFileKind('application/pdf', 'spec.pdf'),
    ).toBe('pdf');
    expect(
      FilesService.resolveUploadFileKind(
        'application/octet-stream',
        'report.docx',
      ),
    ).toBe('docx');
    expect(
      FilesService.resolveUploadFileKind('video/mp2t', 'service.ts'),
    ).toBe('text');
    expect(
      FilesService.resolveUploadFileKind('application/octet-stream', 'note.md'),
    ).toBe('text');
    expect(
      FilesService.isSupportedUploadFile(
        'application/x-msdownload',
        'virus.exe',
      ),
    ).toBe(false);
  });

  it('truncates extracted text exceeding 30,000 characters by preserving head and tail', () => {
    const longText = 'A'.repeat(25000) + 'B'.repeat(10000);
    const result = service.truncateExtractedText(longText);

    expect(result.charCount).toBe(35000);
    expect(result.truncated).toBe(true);
    expect(result.text).toContain('中间已省略 5000 字符');
    expect(result.text.startsWith('A'.repeat(100))).toBe(true);
    expect(result.text.endsWith('B'.repeat(100))).toBe(true);
  });

  it('saves uploaded markdown/code documents and caches extractedText and charCount', async () => {
    const content = '# 架构设计文档\n这是核心实现逻辑。';
    const file = {
      originalname: 'architecture.md',
      mimetype: 'text/markdown',
      size: Buffer.byteLength(content),
      buffer: Buffer.from(content, 'utf8'),
    } as Express.Multer.File;

    const results = await service.saveUploadedImages('user-1', [file]);

    expect(results).toHaveLength(1);
    expect(results[0]?.category).toBe('document');
    expect(results[0]?.charCount).toBe(content.length);
    expect(results[0]?.extractedText).toBe(content);
    expect(results[0]?.truncated).toBe(false);
  });

  it('returns cached extractedText for document attachments in getImageDataForAIByIds', async () => {
    findMock.mockResolvedValueOnce([
      {
        id: 'doc-1',
        userId: 'user-1',
        messageId: null,
        originalName: 'main.ts',
        storageMime: 'text/plain; charset=utf-8',
        storagePath: 'chat/2026/10/main.ts',
        extractedText: 'export const answer = 42;',
        charCount: 25,
      },
    ]);

    const prepared = await service.getImageDataForAIByIds('user-1', ['doc-1']);

    expect(prepared.attachmentIds).toEqual(['doc-1']);
    expect(prepared.fileDataForAI).toEqual([
      {
        base64: '',
        type: 'text/plain; charset=utf-8',
        name: 'main.ts',
        extractedText: 'export const answer = 42;',
        charCount: 25,
      },
    ]);
  });
});
