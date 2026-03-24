import { PassThrough } from 'node:stream';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ConfigService } from '@nestjs/config';
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
  const attachmentRepository = {
    findOne: jest.fn(),
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
    const res = new MockStreamResponse();

    await service.streamFileById('file-1', res as any, {
      expires: `${Math.floor(Date.now() / 1000) + 3600}`,
      signature: 'invalid-signature',
    });

    expect(res.statusCodeValue).toBe(403);
    expect(attachmentRepository.findOne).not.toHaveBeenCalled();
  });

  it('streams file when signature is valid', async () => {
    const storagePath = 'chat/2099/01/demo.webp';
    const absolutePath = path.join(uploadsRoot, 'chat', '2099', '01', 'demo.webp');
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, 'signed-file-content', 'utf8');

    attachmentRepository.findOne = jest.fn().mockResolvedValue({
      id: 'file-1',
      storagePath,
      storageMime: 'image/webp',
      sizeBytes: Buffer.byteLength('signed-file-content'),
    });

    const signedUrl = service.buildSignedFileUrl('file-1');
    const url = new URL(`http://localhost${signedUrl}`);

    const res = new MockStreamResponse();
    const chunks: Buffer[] = [];
    res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));

    await service.streamFileById('file-1', res as any, {
      expires: url.searchParams.get('expires') || undefined,
      signature: url.searchParams.get('signature') || undefined,
    });

    await new Promise<void>((resolve) => res.on('finish', () => resolve()));

    expect(res.statusCodeValue).toBeUndefined();
    expect(res.headers['Content-Type']).toBe('image/webp');
    expect(Buffer.concat(chunks).toString('utf8')).toBe('signed-file-content');
  });

  it('throws when ttl config is invalid', async () => {
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

  it('requires dedicated sign secret in production', async () => {
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
});
