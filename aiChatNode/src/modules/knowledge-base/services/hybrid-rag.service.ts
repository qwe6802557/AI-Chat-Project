import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KnowledgeChunk } from '../entities/knowledge-chunk.entity';
import { KnowledgeDocument } from '../entities/knowledge-document.entity';
import { EmbeddingService } from './embedding.service';
import { RerankService } from './rerank.service';
import {
  computeHighlightSpans,
  extractSearchTerms,
  HighlightSpan,
} from '../utils/chunk-highlight.util';
import type { RetrievalMode } from '../dto/search-knowledge-base.dto';

export type RagHitSource = 'hybrid' | 'dense' | 'sparse';

export interface RagSearchResult {
  chunkId: string;
  documentId: string;
  knowledgeBaseId: string;
  documentTitle: string;
  content: string;
  chunkIndex: number;
  score: number;
  charCount: number;
  hitSource: RagHitSource;
  denseScore?: number;
  denseRank?: number;
  sparseRank?: number;
  rerankScore?: number;
  rerankApplied?: boolean;
  matchedTerms: string[];
  highlights: HighlightSpan[];
  metadata?: Record<string, any>;
}

export interface HybridSearchOptions {
  userId: string;
  query: string;
  knowledgeBaseIds?: string[];
  documentIds?: string[];
  limit?: number;
  mode?: RetrievalMode;
  minScore?: number;
  enableRerank?: boolean;
}

interface FusedCandidate {
  chunk: KnowledgeChunk;
  hitSource: RagHitSource;
  denseScore?: number;
  denseRank?: number;
  sparseRank?: number;
  rrfScore: number;
  calibratedScore: number;
}

/**
 * 混合双路检索、RRF 融合与 Cross-Encoder 精排引擎
 */
@Injectable()
export class HybridRagService {
  private readonly logger = new Logger(HybridRagService.name);
  private static readonly RRF_K = 60;
  private static readonly MAX_CANDIDATE_POOL = 2000;
  private static readonly RERANK_CANDIDATE_LIMIT = 15;

  constructor(
    @InjectRepository(KnowledgeChunk)
    private readonly chunkRepo: Repository<KnowledgeChunk>,
    @InjectRepository(KnowledgeDocument)
    private readonly docRepo: Repository<KnowledgeDocument>,
    private readonly embeddingService: EmbeddingService,
    @Optional()
    private readonly rerankService?: RerankService,
  ) {}

  /**
   * 执行双路或单路召回、RRF 融合与可选 Rerank 精排，并生成安全高亮区间
   */
  async search(options: HybridSearchOptions): Promise<RagSearchResult[]> {
    const {
      userId,
      query,
      knowledgeBaseIds,
      documentIds,
      limit = 5,
      mode = 'hybrid',
      minScore,
      enableRerank = true,
    } = options;
    const cleanQuery = query.trim();
    if (!cleanQuery) return [];

    // 1. 按检索模式按需计算 1024 维查询向量
    let queryVector: number[] = [];
    if (mode !== 'sparse') {
      try {
        queryVector = await this.embeddingService.embedQuery(cleanQuery);
      } catch (err: any) {
        this.logger.warn(`向量生成降级为关键词召回: ${err.message}`);
      }
    }

    // 2. 拉取已解析且处于启用状态的候选切片池
    const qb = this.chunkRepo
      .createQueryBuilder('chunk')
      .innerJoinAndSelect('chunk.document', 'doc')
      .where('chunk.userId = :userId', { userId })
      .andWhere('chunk.isEnabled = :isEnabled', { isEnabled: true });

    if (knowledgeBaseIds && knowledgeBaseIds.length > 0) {
      qb.andWhere('chunk.knowledgeBaseId IN (:...kbIds)', {
        kbIds: knowledgeBaseIds,
      });
    }

    if (documentIds && documentIds.length > 0) {
      qb.andWhere('chunk.documentId IN (:...docIds)', {
        docIds: documentIds,
      });
    }

    qb.andWhere('doc.status = :docStatus', { docStatus: 'completed' });

    const candidateChunks = await qb
      .take(HybridRagService.MAX_CANDIDATE_POOL)
      .getMany();
    if (candidateChunks.length === 0) return [];

    // 3. Dense 稠密向量召回
    const denseRankMap = new Map<string, number>();
    const denseScoreMap = new Map<string, number>();
    if (mode !== 'sparse' && queryVector.length > 0) {
      const denseScored = candidateChunks
        .filter((c) => c.embedding && c.embedding.length > 0)
        .map((c) => ({
          id: c.id,
          sim: this.cosineSimilarity(queryVector, c.embedding!),
        }))
        .filter((item) => item.sim >= 0.35)
        .sort((a, b) => b.sim - a.sim);

      denseScored.slice(0, 30).forEach((item, index) => {
        denseRankMap.set(item.id, index + 1);
        denseScoreMap.set(item.id, item.sim);
      });
    }

    // 4. Sparse 稀疏关键词召回
    const searchTerms = extractSearchTerms(cleanQuery);
    const sparseRankMap = new Map<string, number>();
    const sparseRatioMap = new Map<string, number>();
    if (mode !== 'dense' && searchTerms.length > 0) {
      const sparseScored = candidateChunks
        .map((c) => {
          let matchCount = 0;
          const lowerContent = c.content.toLowerCase();
          for (const term of searchTerms) {
            if (lowerContent.includes(term.toLowerCase())) {
              matchCount++;
            }
          }
          return {
            id: c.id,
            matchCount,
            ratio: matchCount / searchTerms.length,
          };
        })
        .filter((item) => item.matchCount > 0)
        .sort((a, b) => b.matchCount - a.matchCount);

      sparseScored.slice(0, 30).forEach((item, index) => {
        sparseRankMap.set(item.id, index + 1);
        sparseRatioMap.set(item.id, item.ratio);
      });
    }

    // 5. RRF 倒数排名融合
    const chunkMap = new Map(candidateChunks.map((c) => [c.id, c]));
    const candidateIds = new Set<string>([
      ...(mode !== 'sparse' ? denseRankMap.keys() : []),
      ...(mode !== 'dense' ? sparseRankMap.keys() : []),
    ]);

    if (candidateIds.size === 0) {
      return [];
    }

    const fusedList: FusedCandidate[] = [];
    for (const id of candidateIds) {
      const chunk = chunkMap.get(id);
      if (!chunk) continue;

      const denseRank = denseRankMap.get(id);
      const sparseRank = sparseRankMap.get(id);
      const denseScore = denseScoreMap.get(id);
      const sparseRatio = sparseRatioMap.get(id) ?? 0;

      let rrfScore = 0;
      if (denseRank !== undefined) {
        rrfScore += 1 / (HybridRagService.RRF_K + denseRank);
      }
      if (sparseRank !== undefined) {
        rrfScore += 1 / (HybridRagService.RRF_K + sparseRank);
      }

      const hitSource: RagHitSource =
        denseRank !== undefined && sparseRank !== undefined
          ? 'hybrid'
          : denseRank !== undefined
            ? 'dense'
            : 'sparse';

      const calibratedScore = this.calibrateRrfScore({
        rrfScore,
        denseScore,
        sparseRank,
        sparseRatio,
      });

      fusedList.push({
        chunk,
        hitSource,
        denseScore:
          denseScore !== undefined
            ? Number(Math.min(1, Math.max(0, denseScore)).toFixed(4))
            : undefined,
        denseRank,
        sparseRank,
        rrfScore,
        calibratedScore,
      });
    }

    fusedList.sort((a, b) => b.rrfScore - a.rrfScore);

    // 6. 可选 Cross-Encoder 精排（对 Top-15 粗排重排，失败则平滑回退 RRF）
    const rerankPool = fusedList.slice(
      0,
      HybridRagService.RERANK_CANDIDATE_LIMIT,
    );
    let finalCandidates: Array<
      FusedCandidate & { finalScore: number; rerankScore?: number; rerankApplied: boolean }
    >;

    const rerankResults =
      enableRerank && this.rerankService
        ? await this.rerankService.rerank(
            cleanQuery,
            rerankPool.map((item) => item.chunk.content),
            limit,
          )
        : null;

    if (rerankResults && rerankResults.length > 0) {
      finalCandidates = rerankResults
        .filter((r) => r.index >= 0 && r.index < rerankPool.length)
        .map((r) => {
          const base = rerankPool[r.index];
          const clampedRerank = Number(
            Math.min(0.99, Math.max(0.01, r.relevanceScore)).toFixed(4),
          );
          return {
            ...base,
            rerankScore: clampedRerank,
            rerankApplied: true,
            finalScore: Number(clampedRerank.toFixed(2)),
          };
        })
        .sort((a, b) => (b.rerankScore ?? 0) - (a.rerankScore ?? 0))
        .slice(0, limit);
    } else {
      finalCandidates = fusedList.slice(0, limit).map((item) => ({
        ...item,
        rerankApplied: false,
        finalScore: item.calibratedScore,
      }));
    }

    // 7. 最低置信度阈值过滤并计算服务端高亮偏移
    const filtered =
      typeof minScore === 'number' && minScore > 0
        ? finalCandidates.filter((item) => item.finalScore >= minScore)
        : finalCandidates;

    return filtered.map((item) => {
      const { highlights, matchedTerms } = computeHighlightSpans(
        item.chunk.content,
        searchTerms,
      );

      return {
        chunkId: item.chunk.id,
        documentId: item.chunk.documentId,
        knowledgeBaseId: item.chunk.knowledgeBaseId,
        documentTitle: item.chunk.document?.title || '未命名文档',
        content: item.chunk.content,
        chunkIndex: item.chunk.chunkIndex,
        score: item.finalScore,
        charCount: item.chunk.charCount,
        hitSource: item.hitSource,
        denseScore: item.denseScore,
        denseRank: item.denseRank,
        sparseRank: item.sparseRank,
        rerankScore: item.rerankScore,
        rerankApplied: item.rerankApplied,
        matchedTerms,
        highlights,
        metadata: item.chunk.metadata || undefined,
      };
    });
  }

  /**
   * 客观校准 RRF 分数至 0.01 ~ 0.99，避免对单路弱命中强行保底
   */
  private calibrateRrfScore(params: {
    rrfScore: number;
    denseScore?: number;
    sparseRank?: number;
    sparseRatio: number;
  }): number {
    const { rrfScore, denseScore, sparseRank, sparseRatio } = params;
    const maxRrf = 2 / (HybridRagService.RRF_K + 1);
    const rrfNorm = Math.min(1, rrfScore / maxRrf);

    let rawScore: number;
    if (denseScore !== undefined && sparseRank !== undefined) {
      rawScore = Math.max(
        denseScore * 0.85 + sparseRatio * 0.15,
        0.5 + rrfNorm * 0.48,
      );
    } else if (denseScore !== undefined) {
      rawScore = denseScore * 0.92;
    } else {
      const rankDecay = 1 / (1 + ((sparseRank ?? 1) - 1) * 0.12);
      rawScore = 0.35 + 0.45 * sparseRatio * rankDecay;
    }

    return Number(Math.min(0.99, Math.max(0.01, rawScore)).toFixed(2));
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
}
