import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KnowledgeChunk } from '../entities/knowledge-chunk.entity';
import { KnowledgeDocument } from '../entities/knowledge-document.entity';
import { EmbeddingService } from './embedding.service';

export interface RagSearchResult {
  chunkId: string;
  documentId: string;
  knowledgeBaseId: string;
  documentTitle: string;
  content: string;
  chunkIndex: number;
  score: number;
  charCount: number;
  metadata?: Record<string, any>;
}

export interface HybridSearchOptions {
  userId: string;
  query: string;
  knowledgeBaseIds?: string[];
  limit?: number;
}

/**
 * 轻量级混合双路检索与 RRF 融合引擎
 */
@Injectable()
export class HybridRagService {
  private readonly logger = new Logger(HybridRagService.name);
  private static readonly RRF_K = 60; // 倒数排名融合通用平滑常数

  constructor(
    @InjectRepository(KnowledgeChunk)
    private readonly chunkRepo: Repository<KnowledgeChunk>,
    @InjectRepository(KnowledgeDocument)
    private readonly docRepo: Repository<KnowledgeDocument>,
    private readonly embeddingService: EmbeddingService,
  ) {}

  /**
   * 执行双路召回（稠密语义向量 + 稀疏关键词）与 RRF 融合排序
   */
  async search(options: HybridSearchOptions): Promise<RagSearchResult[]> {
    const { userId, query, knowledgeBaseIds, limit = 5 } = options;
    const cleanQuery = query.trim();
    if (!cleanQuery) return [];

    // 1. 计算查询文本的 1024 维语义向量
    let queryVector: number[] = [];
    try {
      queryVector = await this.embeddingService.embedQuery(cleanQuery);
    } catch (err: any) {
      this.logger.warn(`向量生成降级为纯关键词召回: ${err.message}`);
    }

    // 2. 构建基础切片查询构建器
    const qb = this.chunkRepo
      .createQueryBuilder('chunk')
      .innerJoinAndSelect('chunk.document', 'doc')
      .where('chunk.userId = :userId', { userId });

    if (knowledgeBaseIds && knowledgeBaseIds.length > 0) {
      qb.andWhere('chunk.knowledgeBaseId IN (:...kbIds)', {
        kbIds: knowledgeBaseIds,
      });
    }

    // 只拉取已完成解析的切片
    qb.andWhere('doc.status = :docStatus', { docStatus: 'completed' });

    // 限制单次检索候选切片池上限（例如最多 300 条候选以兼顾性能与准确度）
    const candidateChunks = await qb.take(300).getMany();
    if (candidateChunks.length === 0) return [];

    // 3. Dense 稠密向量排序 (计算已归一化向量的余弦内积)
    const denseRankMap = new Map<string, number>();
    if (queryVector.length > 0) {
      const denseScored = candidateChunks
        .filter((c) => c.embedding && c.embedding.length > 0)
        .map((c) => {
          const sim = this.cosineSimilarity(queryVector, c.embedding!);
          return { id: c.id, sim };
        })
        .filter((item) => item.sim >= 0.35)
        .sort((a, b) => b.sim - a.sim);

      denseScored.slice(0, 30).forEach((item, index) => {
        denseRankMap.set(item.id, index + 1);
      });
    }

    // 4. Sparse 稀疏关键词匹配打分
    const sparseRankMap = new Map<string, number>();
    const keywords = this.extractKeywords(cleanQuery);
    if (keywords.length > 0) {
      const sparseScored = candidateChunks
        .map((c) => {
          let matchCount = 0;
          const lowerContent = c.content.toLowerCase();
          for (const kw of keywords) {
            if (lowerContent.includes(kw.toLowerCase())) {
              matchCount++;
            }
          }
          return { id: c.id, matchCount };
        })
        .filter((item) => item.matchCount > 0)
        .sort((a, b) => b.matchCount - a.matchCount);

      sparseScored.slice(0, 30).forEach((item, index) => {
        sparseRankMap.set(item.id, index + 1);
      });
    }

    // 5. RRF 倒数排名融合算法: Score = 1 / (60 + DenseRank) + 1 / (60 + SparseRank)
    const chunkMap = new Map(candidateChunks.map((c) => [c.id, c]));
    const candidateIds = new Set([
      ...denseRankMap.keys(),
      ...sparseRankMap.keys(),
    ]);

    // 若双路均未命中任何高相关切片，返回空列表，避免无关提问强塞切片导致幻觉
    if (candidateIds.size === 0) {
      return [];
    }

    const fusedResults: { id: string; rrfScore: number }[] = [];
    for (const id of candidateIds) {
      const denseRank = denseRankMap.get(id);
      const sparseRank = sparseRankMap.get(id);

      let rrfScore = 0;
      if (denseRank !== undefined) {
        rrfScore += 1 / (HybridRagService.RRF_K + denseRank);
      }
      if (sparseRank !== undefined) {
        rrfScore += 1 / (HybridRagService.RRF_K + sparseRank);
      }

      fusedResults.push({ id, rrfScore });
    }

    fusedResults.sort((a, b) => b.rrfScore - a.rrfScore);
    const topItems = fusedResults.slice(0, limit);

    return topItems.map((item) => {
      const chunk = chunkMap.get(item.id)!;
      // 归一化得分映射至 0.5 ~ 0.99 便于前端直观呈现置信度
      const normalizedScore = Number(
        Math.min(0.99, Math.max(0.6, item.rrfScore * 25)).toFixed(2),
      );

      return {
        chunkId: chunk.id,
        documentId: chunk.documentId,
        knowledgeBaseId: chunk.knowledgeBaseId,
        documentTitle: chunk.document?.title || '未命名文档',
        content: chunk.content,
        chunkIndex: chunk.chunkIndex,
        score: normalizedScore,
        charCount: chunk.charCount,
        metadata: chunk.metadata || undefined,
      };
    });
  }

  /**
   * 两个单位向量的内积（等于余弦相似度）
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    const len = Math.min(a.length, b.length);
    let dot = 0;
    for (let i = 0; i < len; i++) {
      dot += a[i] * b[i];
    }
    return dot;
  }

  /**
   * 简易关键词提取（中文分词词缀与英文单词提取）
   */
  private extractKeywords(query: string): string[] {
    const tokens: string[] = [];
    const enTokens = query.match(/[a-zA-Z0-9_\-\.]{2,}/g) || [];
    tokens.push(...enTokens);

    // 中文 2~4 字符滑动切词
    const cnOnly = query.replace(/[^\u4e00-\u9fa5]/g, '');
    for (let i = 0; i < cnOnly.length - 1; i++) {
      tokens.push(cnOnly.slice(i, i + 2));
      if (i + 3 <= cnOnly.length) {
        tokens.push(cnOnly.slice(i, i + 3));
      }
    }

    return Array.from(new Set(tokens)).filter((t) => t.length >= 2);
  }
}
