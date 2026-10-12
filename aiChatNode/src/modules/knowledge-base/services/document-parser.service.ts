import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import pdfParse from 'pdf-parse';
import * as mammoth from 'mammoth';

export interface ParsedDocumentResult {
  text: string;
  charCount: number;
}

/**
 * 多格式文档文本解析服务
 */
@Injectable()
export class DocumentParserService {
  private readonly logger = new Logger(DocumentParserService.name);

  /**
   * 根据文件名后缀与 Buffer 解析出清洗后的纯文本
   */
  async parseBuffer(
    buffer: Buffer,
    fileName: string,
    mimeType?: string,
  ): Promise<ParsedDocumentResult> {
    const ext = fileName.toLowerCase().slice(fileName.lastIndexOf('.'));
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
      } else if (
        ['.txt', '.md', '.markdown', '.json', '.js', '.ts', '.py'].includes(ext) ||
        mimeType?.startsWith('text/')
      ) {
        rawText = buffer.toString('utf-8');
      } else {
        throw new BadRequestException(
          `暂不支持的文件格式: ${ext}，仅支持 .pdf, .docx, .md, .txt 等格式`,
        );
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
