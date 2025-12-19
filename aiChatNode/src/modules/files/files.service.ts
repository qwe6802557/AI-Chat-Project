import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Response } from 'express';
import sharp from 'sharp';
import { ChatAttachment } from '../chat/entities/chat-attachment.entity';
import type { FileDataDto } from '../chat/dto';

export interface UploadedImageResult {
  id: string;
  url: string;
  name: string;
  mime: string;
  sizeBytes: number;
  width?: number | null;
  height?: number | null;
}

@Injectable()
export class FilesService {
  static readonly MAX_FILES = 4;
  static readonly MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
  static readonly MAX_IMAGE_DIMENSION = 2048;
  static readonly ALLOWED_IMAGE_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
  ] as const;

  private readonly logger = new Logger(FilesService.name);

  constructor(
    @InjectRepository(ChatAttachment)
    private readonly attachmentRepository: Repository<ChatAttachment>,
  ) {}

  private getUploadRoot(): string {
    const configured = process.env.UPLOAD_DIR?.trim();
    const root = configured ? configured : 'uploads';
    return path.resolve(process.cwd(), root);
  }

  private buildStoragePath(extension: string): {
    storagePath: string;
    absoluteDir: string;
    absolutePath: string;
  } {
    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const fileName = `${randomUUID()}.${extension}`;

    const storagePath = `chat/${year}/${month}/${fileName}`; // 统一使用 /
    const absoluteDir = path.join(this.getUploadRoot(), 'chat', year, month);
    const absolutePath = path.join(absoluteDir, fileName);

    return { storagePath, absoluteDir, absolutePath };
  }

  private resolveAbsolutePath(storagePath: string): string {
    return path.join(this.getUploadRoot(), ...storagePath.split('/'));
  }

  private toPublicResult(entity: ChatAttachment): UploadedImageResult {
    return {
      id: entity.id,
      url: `/files/${entity.id}`,
      name: entity.originalName,
      mime: entity.storageMime,
      sizeBytes: entity.sizeBytes,
      width: entity.width,
      height: entity.height,
    };
  }

  private async processImageBuffer(file: Express.Multer.File): Promise<{
    buffer: Buffer;
    mime: string;
    width: number;
    height: number;
  }> {
    const { data, info } = await sharp(file.buffer, {
      failOnError: true,
      limitInputPixels: 50_000_000,
    })
      .rotate()
      .resize({
        width: FilesService.MAX_IMAGE_DIMENSION,
        height: FilesService.MAX_IMAGE_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });

    return {
      buffer: data,
      mime: 'image/webp',
      width: info.width,
      height: info.height,
    };
  }

  private async processImageRawBuffer(buffer: Buffer): Promise<{
    buffer: Buffer;
    mime: string;
    width: number;
    height: number;
  }> {
    const { data, info } = await sharp(buffer, {
      failOnError: true,
      limitInputPixels: 50_000_000,
    })
      .rotate()
      .resize({
        width: FilesService.MAX_IMAGE_DIMENSION,
        height: FilesService.MAX_IMAGE_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });

    return {
      buffer: data,
      mime: 'image/webp',
      width: info.width,
      height: info.height,
    };
  }

  private parseDataUrl(dataUrl: string): { mime: string; buffer: Buffer } {
    const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl || '');
    if (!match) {
      throw new BadRequestException('非法的 base64 数据（必须是 data:*;base64, 前缀）');
    }

    const mime = match[1] || '';
    const base64 = match[2] || '';

    if (!FilesService.ALLOWED_IMAGE_MIME_TYPES.includes(mime as any)) {
      throw new BadRequestException(`不支持的文件类型: ${mime}`);
    }

    let buffer: Buffer;
    try {
      buffer = Buffer.from(base64, 'base64');
    } catch {
      throw new BadRequestException('base64 解码失败');
    }

    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('文件内容为空');
    }

    if (buffer.length > FilesService.MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException(
        `图片大小不能超过 ${Math.round(FilesService.MAX_FILE_SIZE_BYTES / 1024 / 1024)}MB`,
      );
    }

    return { mime, buffer };
  }

  private bufferToDataUrl(buffer: Buffer, mime: string): string {
    return `data:${mime};base64,${buffer.toString('base64')}`;
  }

  /**
   * 保存上传的图片并写入 DB（messageId/sessionId 暂不绑定）
   */
  async saveUploadedImages(
    userId: string | undefined,
    files: Express.Multer.File[],
  ): Promise<UploadedImageResult[]> {
    if (!userId) {
      throw new BadRequestException('未获取到用户信息，请重新登录');
    }

    if (!files || files.length === 0) {
      throw new BadRequestException('请至少上传 1 张图片');
    }

    if (files.length > FilesService.MAX_FILES) {
      throw new BadRequestException(`最多只能上传 ${FilesService.MAX_FILES} 张图片`);
    }

    const results: UploadedImageResult[] = [];

    for (const file of files) {
      if (!FilesService.ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype as any)) {
        throw new BadRequestException(`不支持的文件类型: ${file.mimetype}`);
      }

      if (file.size > FilesService.MAX_FILE_SIZE_BYTES) {
        throw new BadRequestException(
          `图片大小不能超过 ${Math.round(FilesService.MAX_FILE_SIZE_BYTES / 1024 / 1024)}MB`,
        );
      }

      const processed = await this.processImageBuffer(file);
      const { storagePath, absoluteDir, absolutePath } = this.buildStoragePath(
        'webp',
      );

      await fs.mkdir(absoluteDir, { recursive: true });
      await fs.writeFile(absolutePath, processed.buffer, { flag: 'wx' });

      const entity = this.attachmentRepository.create({
        userId,
        originalName: file.originalname,
        originalMime: file.mimetype,
        storageMime: processed.mime,
        storagePath,
        sizeBytes: processed.buffer.length,
        width: processed.width,
        height: processed.height,
      });

      const saved = await this.attachmentRepository.save(entity);
      results.push(this.toPublicResult(saved));
    }

    return results;
  }

  /**
   * 兼容旧版：从聊天接口传入的 base64 文件（files）创建附件并返回“用于 AI 的压缩后 dataURL”
   */
  async createImageAttachmentsFromChatFiles(
    userId: string,
    files: FileDataDto[],
  ): Promise<{ attachmentIds: string[]; fileDataForAI: FileDataDto[] }> {
    if (!files || files.length === 0) {
      return { attachmentIds: [], fileDataForAI: [] };
    }

    if (files.length > FilesService.MAX_FILES) {
      throw new BadRequestException(`最多只能上传 ${FilesService.MAX_FILES} 张图片`);
    }

    const attachmentIds: string[] = [];
    const fileDataForAI: FileDataDto[] = [];

    for (const file of files) {
      const { mime, buffer } = this.parseDataUrl(file.base64);

      // 双重校验：DTO 的 type 必须与 dataURL 一致
      if (file.type && file.type !== mime) {
        throw new BadRequestException(
          `文件类型不一致: type=${file.type}, dataUrl=${mime}`,
        );
      }

      const processed = await this.processImageRawBuffer(buffer);
      const { storagePath, absoluteDir, absolutePath } = this.buildStoragePath(
        'webp',
      );

      await fs.mkdir(absoluteDir, { recursive: true });
      await fs.writeFile(absolutePath, processed.buffer, { flag: 'wx' });

      const entity = this.attachmentRepository.create({
        userId,
        originalName: file.name,
        originalMime: mime,
        storageMime: processed.mime,
        storagePath,
        sizeBytes: processed.buffer.length,
        width: processed.width,
        height: processed.height,
      });

      const saved = await this.attachmentRepository.save(entity);
      attachmentIds.push(saved.id);

      // 返回给 AI 的压缩后 dataURL
      fileDataForAI.push({
        base64: this.bufferToDataUrl(processed.buffer, processed.mime),
        type: processed.mime,
        name: file.name,
      });
    }

    return { attachmentIds, fileDataForAI };
  }

  /**
   * 从已上传的 fileIds 读取文件并转成 AI 可用的 dataURL
   */
  async getImageDataForAIByIds(
    userId: string,
    fileIds: string[],
  ): Promise<{ attachmentIds: string[]; fileDataForAI: FileDataDto[] }> {
    if (!fileIds || fileIds.length === 0) {
      return { attachmentIds: [], fileDataForAI: [] };
    }

    if (fileIds.length > FilesService.MAX_FILES) {
      throw new BadRequestException(`最多只能上传 ${FilesService.MAX_FILES} 张图片`);
    }

    const attachments = await this.attachmentRepository.find({
      where: { id: In(fileIds), userId },
    });

    if (attachments.length !== fileIds.length) {
      throw new BadRequestException('部分附件不存在或无权限访问');
    }

    // 禁止复用已绑定到消息的附件（避免串消息/越权）
    const used = attachments.find((a) => a.messageId);
    if (used) {
      throw new BadRequestException('附件已被使用，请重新上传');
    }

    // 按传入顺序返回
    const byId = new Map(attachments.map((a) => [a.id, a]));
    const ordered = fileIds.map((id) => byId.get(id)!);

    const fileDataForAI: FileDataDto[] = [];
    for (const att of ordered) {
      const absolutePath = this.resolveAbsolutePath(att.storagePath);
      const buf = await fs.readFile(absolutePath);
      fileDataForAI.push({
        base64: this.bufferToDataUrl(buf, att.storageMime),
        type: att.storageMime,
        name: att.originalName,
      });
    }

    return { attachmentIds: ordered.map((a) => a.id), fileDataForAI };
  }

  /**
   * 统一入口：合并 fileIds + files（base64），并返回 AI 用 dataURL + 待绑定附件 id
   */
  async prepareChatAttachments(params: {
    userId: string;
    fileIds?: string[];
    files?: FileDataDto[];
  }): Promise<{ attachmentIds: string[]; fileDataForAI: FileDataDto[] }> {
    const fileIds = params.fileIds || [];
    const inlineFiles = params.files || [];

    if (fileIds.length + inlineFiles.length > FilesService.MAX_FILES) {
      throw new BadRequestException(`最多只能上传 ${FilesService.MAX_FILES} 张图片`);
    }

    const fromIds = await this.getImageDataForAIByIds(params.userId, fileIds);
    const fromInline = await this.createImageAttachmentsFromChatFiles(
      params.userId,
      inlineFiles,
    );

    return {
      attachmentIds: [...fromIds.attachmentIds, ...fromInline.attachmentIds],
      fileDataForAI: [...fromIds.fileDataForAI, ...fromInline.fileDataForAI],
    };
  }

  /**
   * 将附件绑定到消息（用于历史回看/跨设备同步）
   */
  async bindAttachmentsToMessage(params: {
    userId: string;
    sessionId: string;
    messageId: string;
    attachmentIds: string[];
  }): Promise<void> {
    const { attachmentIds } = params;
    if (!attachmentIds || attachmentIds.length === 0) return;

    const result = await this.attachmentRepository.update(
      {
        id: In(attachmentIds),
        userId: params.userId,
        messageId: IsNull(),
      },
      {
        sessionId: params.sessionId,
        messageId: params.messageId,
      },
    );

    if (result.affected !== attachmentIds.length) {
      this.logger.warn(
        `部分附件绑定失败: expected=${attachmentIds.length}, affected=${result.affected}`,
      );
    }
  }

  /**
   * 根据附件 id 输出文件（公开访问，便于 img 直接加载）
   * 这里使用真实 HTTP 状态码，不走全局统一 JSON 包装。
   */
  async streamFileById(id: string, res: Response): Promise<void> {
    const attachment = await this.attachmentRepository.findOne({
      where: { id },
    });

    if (!attachment) {
      res.status(404).end();
      return;
    }

    const absolutePath = this.resolveAbsolutePath(attachment.storagePath);

    try {
      await fs.access(absolutePath);
    } catch {
      res.status(404).end();
      return;
    }

    res.setHeader('Content-Type', attachment.storageMime);
    res.setHeader(
      'Cache-Control',
      'public, max-age=31536000, immutable',
    );
    res.setHeader('Content-Length', String(attachment.sizeBytes));

    const stream = createReadStream(absolutePath);
    stream.on('error', (err) => {
      this.logger.warn(`读取文件失败: ${id} - ${err?.message || err}`);
      if (!res.headersSent) {
        res.status(404).end();
      } else {
        res.end();
      }
    });
    stream.pipe(res);
  }
}
