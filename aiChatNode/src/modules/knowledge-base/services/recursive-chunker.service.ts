import { Injectable } from '@nestjs/common';

export interface ChunkItem {
  chunkIndex: number;
  content: string;
  charCount: number;
}

export interface ChunkerOptions {
  chunkSize?: number;
  overlap?: number;
}

/**
 * 递归语义切片服务（Recursive Character Text Splitter）
 */
@Injectable()
export class RecursiveChunkerService {
  private static readonly DEFAULT_CHUNK_SIZE = 500;
  private static readonly DEFAULT_OVERLAP = 100;
  private static readonly SEPARATORS = [
    '\n\n',
    '\n',
    '。',
    '！',
    '？',
    '；',
    '. ',
    '! ',
    '? ',
    '; ',
    ' ',
    '',
  ];

  /**
   * 将长文本切分为带重叠窗口的切片数组
   */
  splitText(text: string, options?: ChunkerOptions): ChunkItem[] {
    const chunkSize = options?.chunkSize ?? RecursiveChunkerService.DEFAULT_CHUNK_SIZE;
    const overlap = options?.overlap ?? RecursiveChunkerService.DEFAULT_OVERLAP;

    if (!text || text.trim().length === 0) {
      return [];
    }

    const rawChunks = this.splitRecursive(
      text.trim(),
      RecursiveChunkerService.SEPARATORS,
      chunkSize,
    );

    const mergedChunks = this.mergeWithOverlap(rawChunks, chunkSize, overlap);

    return mergedChunks.map((content, index) => ({
      chunkIndex: index,
      content,
      charCount: content.length,
    }));
  }

  /**
   * 按分隔符层级递归分段
   */
  private splitRecursive(
    text: string,
    separators: string[],
    maxChunkSize: number,
  ): string[] {
    if (text.length <= maxChunkSize || separators.length === 0) {
      return [text];
    }

    const separator = separators[0];
    const nextSeparators = separators.slice(1);

    const splits = separator === '' ? text.split('') : text.split(separator);
    const goodSplits: string[] = [];

    for (let i = 0; i < splits.length; i++) {
      const piece = splits[i];
      if (!piece) continue;

      if (piece.length <= maxChunkSize) {
        goodSplits.push(piece);
      } else {
        const subSplits = this.splitRecursive(
          piece,
          nextSeparators,
          maxChunkSize,
        );
        goodSplits.push(...subSplits);
      }
    }

    return goodSplits;
  }

  /**
   * 将小片段合并为目标 chunkSize，并在块间注入 overlap 重叠
   */
  private mergeWithOverlap(
    pieces: string[],
    chunkSize: number,
    overlap: number,
  ): string[] {
    const chunks: string[] = [];
    let currentChunk = '';

    for (const piece of pieces) {
      const candidate = currentChunk ? `${currentChunk}\n${piece}` : piece;

      if (candidate.length <= chunkSize) {
        currentChunk = candidate;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          const tailOverlap = currentChunk.slice(-overlap);
          currentChunk = `${tailOverlap}\n${piece}`;
        } else {
          chunks.push(piece.slice(0, chunkSize).trim());
          currentChunk = piece.slice(chunkSize - overlap);
        }
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks.filter((c) => c.length > 0);
  }
}
