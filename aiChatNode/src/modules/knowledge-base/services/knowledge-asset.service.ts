import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import type { Response } from 'express';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { Repository } from 'typeorm';
import { resolveKnowledgeUploadDir } from '../constants/knowledge-queue.constants';
import { KnowledgeAsset } from '../entities/knowledge-asset.entity';

export interface NormalizedWebpResult {
  buffer: Buffer;
  mimeType: 'image/webp';
  width: number;
  height: number;
  sizeBytes: number;
}

export interface WrittenAssetFileResult extends NormalizedWebpResult {
  assetId: string;
  storagePath: string;
  absolutePath: string;
}

/**
 * 知识库视觉资产压缩落盘、HMAC 安全签名与读取服务
 */
@Injectable()
export class KnowledgeAssetService {
  private readonly logger = new Logger(KnowledgeAssetService.name);
  static readonly MAX_INGEST_DIMENSION = 1600;
  static readonly MAX_CHAT_DIMENSION = 1280;

  constructor(
    @InjectRepository(KnowledgeAsset)
    private readonly assetRepo: Repository<KnowledgeAsset>,
    private readonly configService: ConfigService,
  ) {}

  private getAssetRootDir(): string {
    return path.resolve(resolveKnowledgeUploadDir(), 'assets');
  }

  private getSignSecret(): string {
    const isProduction =
      (this.configService.get<string>('NODE_ENV') || process.env.NODE_ENV) ===
      'production';
    const signSecret =
      this.configService.get<string>('FILE_URL_SIGN_SECRET') ||
      process.env.FILE_URL_SIGN_SECRET;
    const jwtSecret =
      this.configService.get<string>('JWT_SECRET') || process.env.JWT_SECRET;

    if (!signSecret && isProduction) {
      throw new Error(
        '生产环境必须配置 FILE_URL_SIGN_SECRET，禁止复用 JWT_SECRET 签发资产链接',
      );
    }

    const secret = signSecret || jwtSecret;
    if (!secret) {
      throw new Error('FILE_URL_SIGN_SECRET 或 JWT_SECRET 必须至少配置一个');
    }
    return secret;
  }

  private getUrlTtlSeconds(): number {
    const raw =
      this.configService.get<string>('FILE_URL_TTL_SECONDS') ||
      process.env.FILE_URL_TTL_SECONDS ||
      '86400';
    const ttl = Number(raw);
    if (!Number.isFinite(ttl) || ttl <= 0) {
      return 86400;
    }
    return Math.floor(ttl);
  }

  private createSignature(assetId: string, expires: number): string {
    return createHmac('sha256', this.getSignSecret())
      .update(`kb-asset:${assetId}:${expires}`)
      .digest('hex');
  }

  /**
   * 校验知识库视觉资产访问签名及过期时间
   */
  verifyAssetSignature(
    assetId: string,
    expiresRaw?: string,
    signature?: string,
  ): boolean {
    if (!assetId || !expiresRaw || !signature) {
      return false;
    }

    const expires = Number(expiresRaw);
    if (!Number.isInteger(expires)) {
      return false;
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (expires < nowSeconds) {
      return false;
    }

    const expected = this.createSignature(assetId, expires);
    if (expected.length !== signature.length) {
      return false;
    }

    return timingSafeEqual(
      Buffer.from(expected, 'utf8'),
      Buffer.from(signature, 'utf8'),
    );
  }

  /**
   * 生成带时效 HMAC 签名的知识库视觉资产访问路径
   */
  buildSignedAssetUrl(assetId: string): string {
    const expires = Math.floor(Date.now() / 1000) + this.getUrlTtlSeconds();
    const signature = this.createSignature(assetId, expires);
    return `/knowledge-bases/assets/${assetId}?expires=${expires}&signature=${signature}`;
  }

  /**
   * 统一旋转纠偏、等比缩放并编码为 WebP
   */
  async normalizeImageToWebp(
    buffer: Buffer,
    maxDimension = KnowledgeAssetService.MAX_INGEST_DIMENSION,
  ): Promise<NormalizedWebpResult> {
    try {
      const { data, info } = await sharp(buffer, {
        failOnError: true,
        limitInputPixels: 50_000_000,
      })
        .rotate()
        .resize({
          width: maxDimension,
          height: maxDimension,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 82 })
        .toBuffer({ resolveWithObject: true });

      return {
        buffer: data,
        mimeType: 'image/webp',
        width: info.width,
        height: info.height,
        sizeBytes: data.length,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new BadRequestException(`图片规范化处理失败: ${msg}`);
    }
  }

  /**
   * 将规范化后的 WebP 图像写入用户文档专属资产目录
   */
  async writeNormalizedAssetFile(params: {
    userId: string;
    documentId: string;
    buffer: Buffer;
    maxDimension?: number;
  }): Promise<WrittenAssetFileResult> {
    const normalized = await this.normalizeImageToWebp(
      params.buffer,
      params.maxDimension ?? KnowledgeAssetService.MAX_INGEST_DIMENSION,
    );
    const assetId = randomUUID();
    const relativeSegments = [
      'assets',
      params.userId,
      params.documentId,
      `${assetId}.webp`,
    ];
    const storagePath = relativeSegments.join('/');
    const absolutePath = this.resolveSafeAssetPath(storagePath);

    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, normalized.buffer);

    return {
      ...normalized,
      assetId,
      storagePath,
      absolutePath,
    };
  }

  /**
   * 校验签名后流式输出知识库视觉资产
   */
  async streamAssetById(
    assetId: string,
    res: Response,
    auth: { expires?: string; signature?: string },
  ): Promise<void> {
    if (!this.verifyAssetSignature(assetId, auth.expires, auth.signature)) {
      throw new ForbiddenException('知识库资产访问签名无效或已过期');
    }

    const asset = await this.assetRepo.findOne({ where: { id: assetId } });
    if (!asset) {
      throw new NotFoundException('知识库视觉资产不存在');
    }

    const absolutePath = this.resolveSafeAssetPath(asset.storagePath);
    try {
      await fs.access(absolutePath);
    } catch {
      throw new NotFoundException('知识库视觉资产文件已丢失');
    }

    res.setHeader('Content-Type', asset.mimeType || 'image/webp');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    await new Promise<void>((resolve, reject) => {
      const stream = createReadStream(absolutePath);
      stream.on('error', reject);
      res.on('close', resolve);
      res.on('finish', resolve);
      stream.pipe(res);
    });
  }

  /**
   * 为多模态对话读取租户名下视觉资产并按需缩放为 Data URL
   */
  async readAssetAsDataUrl(
    assetId: string,
    userId: string,
    maxDimension = KnowledgeAssetService.MAX_CHAT_DIMENSION,
  ): Promise<string | null> {
    const asset = await this.assetRepo.findOne({
      where: { id: assetId, userId },
    });
    if (!asset) {
      return null;
    }

    const absolutePath = this.resolveSafeAssetPath(asset.storagePath);
    try {
      const rawBuffer = await fs.readFile(absolutePath);
      const needsResize =
        asset.width > maxDimension || asset.height > maxDimension;
      const finalBuffer = needsResize
        ? (await this.normalizeImageToWebp(rawBuffer, maxDimension)).buffer
        : rawBuffer;
      const mimeType = asset.mimeType || 'image/webp';
      return `data:${mimeType};base64,${finalBuffer.toString('base64')}`;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`读取视觉资产 [${assetId}] 失败: ${msg}`);
      return null;
    }
  }

  /**
   * 清理指定存储路径列表对应的磁盘资产文件
   */
  async removeAssetFiles(storagePaths: string[]): Promise<void> {
    await Promise.all(
      storagePaths.map(async (storagePath) => {
        if (!storagePath) return;
        try {
          const absolutePath = this.resolveSafeAssetPath(storagePath);
          await fs.unlink(absolutePath);
        } catch (error: unknown) {
          const nodeErr = error as NodeJS.ErrnoException;
          if (nodeErr?.code !== 'ENOENT') {
            this.logger.warn(
              `删除视觉资产文件失败 [${storagePath}]: ${nodeErr?.message || String(error)}`,
            );
          }
        }
      }),
    );
  }

  /**
   * 递归清理整份文档对应的视觉资产目录
   */
  async cleanupDocumentAssetFiles(
    userId: string,
    documentId: string,
  ): Promise<void> {
    const docDir = path.resolve(this.getAssetRootDir(), userId, documentId);
    const rootDir = this.getAssetRootDir();
    if (!docDir.startsWith(`${rootDir}${path.sep}`)) {
      throw new ForbiddenException('非法视觉资产目录路径');
    }

    try {
      await fs.rm(docDir, { recursive: true, force: true });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`清理文档视觉资产目录失败 [${docDir}]: ${msg}`);
    }
  }

  /**
   * 严格校验资产相对路径，阻断路径穿越访问
   */
  private resolveSafeAssetPath(storagePath: string): string {
    const uploadRoot = path.resolve(resolveKnowledgeUploadDir());
    const assetRoot = this.getAssetRootDir();
    const cleaned = storagePath.replace(/^[/\\]+/, '');
    const segments = cleaned.split(/[/\\]+/).filter(Boolean);
    const resolved = path.resolve(uploadRoot, ...segments);

    if (!resolved.startsWith(`${assetRoot}${path.sep}`)) {
      throw new ForbiddenException('非法的知识库视觉资产存储路径');
    }
    return resolved;
  }
}
