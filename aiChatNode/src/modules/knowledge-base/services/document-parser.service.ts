import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import pdfParse from 'pdf-parse';
import * as mammoth from 'mammoth';

export type DocumentFileKind = 'image' | 'pdf' | 'docx' | 'text';

export interface ParsedDocumentResult {
  text: string;
  charCount: number;
}

const SUPPORTED_IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'];
const SUPPORTED_IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/webp'];
const SUPPORTED_TEXT_EXTENSIONS = [
  '.txt',
  '.md',
  '.markdown',
  '.json',
  '.js',
  '.ts',
  '.py',
];

/**
 * 多格式文档与图像类型识别、文本解析服务
 */
@Injectable()
export class DocumentParserService {
  private readonly logger = new Logger(DocumentParserService.name);

  /**
   * 解析上传文件归属的处理管线类别
   */
  static resolveDocumentKind(
    fileName: string,
    mimeType?: string,
  ): DocumentFileKind | null {
    const dotIndex = fileName.lastIndexOf('.');
    const ext = dotIndex >= 0 ? fileName.toLowerCase().slice(dotIndex) : '';
    const normalizedMime = (mimeType || '').toLowerCase().trim();

    if (
      SUPPORTED_IMAGE_EXTENSIONS.includes(ext) ||
      SUPPORTED_IMAGE_MIMES.includes(normalizedMime)
    ) {
      return 'image';
    }

    if (ext === '.pdf' || normalizedMime === 'application/pdf') {
      return 'pdf';
    }

    if (
      ext === '.docx' ||
      normalizedMime ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      return 'docx';
    }

    if (
      SUPPORTED_TEXT_EXTENSIONS.includes(ext) ||
      Boolean(normalizedMime.startsWith('text/'))
    ) {
      return 'text';
    }

    return null;
  }

  /**
   * 校验文件扩展名与 MIME 类型是否受支持
   */
  static isSupportedFile(fileName: string, mimeType?: string): boolean {
    return DocumentParserService.resolveDocumentKind(fileName, mimeType) !== null;
  }

  /**
   * 根据文件名后缀与 Buffer 解析出清洗后的纯文本
   */
  async parseBuffer(
    buffer: Buffer,
    fileName: string,
    mimeType?: string,
  ): Promise<ParsedDocumentResult> {
    const dotIndex = fileName.lastIndexOf('.');
    const ext = dotIndex >= 0 ? fileName.toLowerCase().slice(dotIndex) : '';
    const kind = DocumentParserService.resolveDocumentKind(fileName, mimeType);
    if (!kind || kind === 'image') {
      throw new BadRequestException(
        `暂不支持的纯文本解析格式: ${ext || '未知'}`,
      );
    }

    let rawText = '';

    try {
      if (ext === '.pdf' || mimeType === 'application/pdf') {
        const data = await pdfParse(buffer);
        rawText = data.text || '';
      } else if (
        ext === '.docx' ||
        mimeType ===
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ) {
        const result = await mammoth.extractRawText({ buffer });
        rawText = result.value || '';
      } else {
        rawText = buffer.toString('utf-8');
      }
    } catch (err: any) {
      this.logger.error(`解析文件 [${fileName}] 失败: ${err.message}`, err.stack);
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(`文件解析失败: ${err.message || '未知错误'}`);
    }

    const cleanedText = this.sanitizeText(rawText);
    if (!cleanedText.trim()) {
      throw new BadRequestException(`文件 [${fileName}] 内容为空或无法提取有效文字`);
    }

    return {
      text: cleanedText,
      charCount: cleanedText.length,
    };
  }

  /**
   * 文本清洗：滤除非法控制字符、保持段落结构
   */
  private sanitizeText(text: string): string {
    return text
      .replace(/\0/g, '')
      .replace(/[\r\n]{3,}/g, '\n\n')
      .trim();
  }
}
