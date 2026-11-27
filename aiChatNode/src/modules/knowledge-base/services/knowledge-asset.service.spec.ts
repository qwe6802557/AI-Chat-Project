import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { KnowledgeAssetService } from './knowledge-asset.service';

describe('KnowledgeAssetService', () => {
  let service: KnowledgeAssetService;
  let mockAssetRepo: any;
  let mockConfigService: any;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kb-asset-test-'));
    process.env.KNOWLEDGE_UPLOAD_DIR = tempDir;

    mockAssetRepo = {
      findOne: jest.fn(),
    };
    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'FILE_URL_SIGN_SECRET') return 'test-asset-secret-key';
        if (key === 'FILE_URL_TTL_SECONDS') return '3600';
        return undefined;
      }),
    };

    service = new KnowledgeAssetService(mockAssetRepo, mockConfigService);
  });

  afterEach(async () => {
    delete process.env.KNOWLEDGE_UPLOAD_DIR;
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('能规范化 PNG 为 WebP 落盘，签发并验证 HMAC 签名，支持按租户读取 Data URL', async () => {
    const rawPng = await sharp({
      create: {
        width: 120,
        height: 80,
        channels: 3,
        background: { r: 37, g: 99, b: 235 },
      },
    })
      .png()
      .toBuffer();

    const written = await service.writeNormalizedAssetFile({
      userId: 'u-1',
      documentId: 'doc-1',
      buffer: rawPng,
    });

    expect(written.mimeType).toBe('image/webp');
    expect(written.width).toBe(120);
    expect(written.height).toBe(80);
    await expect(fs.access(written.absolutePath)).resolves.toBeUndefined();

    const signedUrl = service.buildSignedAssetUrl(written.assetId);
    const parsedUrl = new URL(`http://localhost${signedUrl}`);
    const expires = parsedUrl.searchParams.get('expires')!;
    const signature = parsedUrl.searchParams.get('signature')!;

    expect(service.verifyAssetSignature(written.assetId, expires, signature)).toBe(true);
    expect(service.verifyAssetSignature(written.assetId, expires, 'tampered')).toBe(false);
    expect(service.verifyAssetSignature(written.assetId, '100', signature)).toBe(false);

    mockAssetRepo.findOne.mockResolvedValue({
      id: written.assetId,
      userId: 'u-1',
      storagePath: written.storagePath,
      mimeType: 'image/webp',
      width: 120,
      height: 80,
    });
    const dataUrl = await service.readAssetAsDataUrl(written.assetId, 'u-1');
    expect(dataUrl).toMatch(/^data:image\/webp;base64,/);

    await service.cleanupDocumentAssetFiles('u-1', 'doc-1');
    await expect(fs.access(written.absolutePath)).rejects.toThrow();
  });

  it('阻断非法的签名流式请求与不存在资产访问', async () => {
    const fakeRes: any = { setHeader: jest.fn() };
    await expect(
      service.streamAssetById('asset-x', fakeRes, {
        expires: '9999999999',
        signature: 'bad-sig',
      }),
    ).rejects.toThrow(ForbiddenException);

    const signedUrl = service.buildSignedAssetUrl('asset-missing');
    const urlObj = new URL(`http://localhost${signedUrl}`);
    mockAssetRepo.findOne.mockResolvedValue(null);

    await expect(
      service.streamAssetById('asset-missing', fakeRes, {
        expires: urlObj.searchParams.get('expires')!,
        signature: urlObj.searchParams.get('signature')!,
      }),
    ).rejects.toThrow(NotFoundException);
  });
});
