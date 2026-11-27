import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { KnowledgeChunk } from '../entities/knowledge-chunk.entity';
import { KnowledgeDocument } from '../entities/knowledge-document.entity';
import { EmbeddingService } from './embedding.service';
import { RerankService } from './rerank.service';
import { KnowledgeAssetService } from './knowledge-asset.service';
import {
  computeHighlightSpans,
  extractSearchTerms,
  HighlightSpan,
} from '../utils/chunk-highlight.util';
import { escapeLikePattern, toPgVectorLiteral } from '../utils/pg-vector.util';
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
  chunkType?: 'text' | 'visual';
  assetId?: string;
  assetType?: string;
  visualType?: string;
  pageNumber?: number;
  visualAssetUrl?: string;
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

interface SqlCandidateChunk {
  id: string;
  documentId: string;
  knowledgeBaseId: string;
  chunkIndex: number;
  content: string;
  charCount: number;
  metadata: Record<string, any> | null;
  documentTitle: string;
  denseScore?: number;
  matchCount?: number;
  trgmScore?: number;
}

interface FusedCandidate {
  chunk: SqlCandidateChunk;
  hitSource: RagHitSource;
  denseScore?: number;
  denseRank?: number;
  sparseRank?: number;
  rrfScore: number;
  calibratedScore: number;
}

/**
 * 混合双路 SQL 下推检索、RRF 融合与 Cross-Encoder 精排引擎
 */
@Injectable()
export class HybridRagService {
  private readonly logger = new Logger(HybridRagService.name);
  private static readonly RRF_K = 60;
  private static readonly RECALL_TOP_K = 30;
  private static readonly RERANK_CANDIDATE_LIMIT = 15;
  private static readonly MIN_DENSE_SCORE = 0.35;
  private static readonly MIN_TRGM_SIMILARITY = 0.2;

  constructor(
    @InjectRepository(KnowledgeChunk)
    private readonly chunkRepo: Repository<KnowledgeChunk>,
    @InjectRepository(KnowledgeDocument)
    private readonly docRepo: Repository<KnowledgeDocument>,
    private readonly embeddingService: EmbeddingService,
    @Optional()
    private readonly rerankService?: RerankService,
    @Optional()
    private readonly assetService?: KnowledgeAssetService,
  ) {}

  /**
   * 执行 PostgreSQL pgvector + pg_trgm 下推召回、RRF 融合与可选 Rerank 精排
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

    const searchTerms = extractSearchTerms(cleanQuery);
    const needDense = mode !== 'sparse';
    const needSparse = mode !== 'dense' && searchTerms.length > 0;

    const [denseRows, sparseRows] = await Promise.all([
      needDense
        ? this.queryDenseCandidates({
            userId,
            cleanQuery,
            knowledgeBaseIds,
            documentIds,
          })
        : Promise.resolve([]),
      needSparse
        ? this.querySparseCandidates({
            userId,
            cleanQuery,
            searchTerms,
            knowledgeBaseIds,
            documentIds,
          })
        : Promise.resolve([]),
    ]);

    const chunkMap = new Map<string, SqlCandidateChunk>();
    const denseRankMap = new Map<string, number>();
    const denseScoreMap = new Map<string, number>();

    denseRows.forEach((row, index) => {
      chunkMap.set(row.id, row);
      denseRankMap.set(row.id, index + 1);
      denseScoreMap.set(row.id, Number(row.denseScore ?? 0));
    });

    const sparseRankMap = new Map<string, number>();
    const sparseRatioMap = new Map<string, number>();
    const sparseTermDenominator = Math.max(1, Math.min(searchTerms.length, 12));

    sparseRows.forEach((row, index) => {
      if (!chunkMap.has(row.id)) {
        chunkMap.set(row.id, row);
      }
      sparseRankMap.set(row.id, index + 1);
      const matchCount = Number(row.matchCount ?? 0);
      const trgmScore = Number(row.trgmScore ?? 0);
      const ratio =
        matchCount > 0
          ? Math.min(1, matchCount / sparseTermDenominator)
          : Math.min(1, Math.max(0, trgmScore));
      sparseRatioMap.set(row.id, ratio);
    });

    const candidateIds = new Set<string>([
      ...(needDense ? denseRankMap.keys() : []),
      ...(needSparse ? sparseRankMap.keys() : []),
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

    const rerankPool = fusedList.slice(
      0,
      HybridRagService.RERANK_CANDIDATE_LIMIT,
    );
    let finalCandidates: Array<
      FusedCandidate & {
        finalScore: number;
        rerankScore?: number;
        rerankApplied: boolean;
      }
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

    const filtered =
      typeof minScore === 'number' && minScore > 0
        ? finalCandidates.filter((item) => item.finalScore >= minScore)
        : finalCandidates;

    return filtered.map((item) => {
      const { highlights, matchedTerms } = computeHighlightSpans(
        item.chunk.content,
        searchTerms,
      );
      const metadata = item.chunk.metadata || undefined;
      const assetId =
        typeof metadata?.assetId === 'string' && metadata.assetId
          ? metadata.assetId
          : undefined;
      const visualAssetUrl =
        assetId && this.assetService
          ? this.assetService.buildSignedAssetUrl(assetId)
          : undefined;

      return {
        chunkId: item.chunk.id,
        documentId: item.chunk.documentId,
        knowledgeBaseId: item.chunk.knowledgeBaseId,
        documentTitle: item.chunk.documentTitle || '未命名文档',
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
        chunkType:
          metadata?.chunkType === 'visual' || assetId ? 'visual' : 'text',
        assetId,
        assetType:
          typeof metadata?.assetType === 'string'
            ? metadata.assetType
            : undefined,
        visualType:
          typeof metadata?.visualType === 'string'
            ? metadata.visualType
            : undefined,
        pageNumber:
          typeof metadata?.pageNumber === 'number'
            ? metadata.pageNumber
            : undefined,
        visualAssetUrl,
        metadata,
      };
    });
  }

  /**
   * 通过 pgvector HNSW 迭代扫描下推 Top-K 语义向量召回
   */
  private async queryDenseCandidates(params: {
    userId: string;
    cleanQuery: string;
    knowledgeBaseIds?: string[];
    documentIds?: string[];
  }): Promise<SqlCandidateChunk[]> {
    const queryVector = await this.embeddingService.embedQuery(
      params.cleanQuery,
    );
    const vectorLiteral = toPgVectorLiteral(queryVector);

    const conditions = [
      'c."userId" = $2',
      'c."isEnabled" = true',
      'd."status" = \'completed\'',
      'c."embedding" IS NOT NULL',
    ];
    const queryParams: unknown[] = [vectorLiteral, params.userId];

    if (params.knowledgeBaseIds && params.knowledgeBaseIds.length > 0) {
      queryParams.push(params.knowledgeBaseIds);
      conditions.push(
        `c."knowledgeBaseId" = ANY($${queryParams.length}::uuid[])`,
      );
    }
    if (params.documentIds && params.documentIds.length > 0) {
      queryParams.push(params.documentIds);
      conditions.push(`c."documentId" = ANY($${queryParams.length}::uuid[])`);
    }

    const sql = `
      SELECT
        c."id",
        c."documentId",
        c."knowledgeBaseId",
        c."chunkIndex",
        c."content",
        c."charCount",
        c."metadata",
        d."title" AS "documentTitle",
        (1 - (c."embedding" <=> $1::vector))::float8 AS "denseScore"
      FROM "knowledge_chunks" c
      INNER JOIN "knowledge_documents" d ON d."id" = c."documentId"
      WHERE ${conditions.join(' AND ')}
      ORDER BY c."embedding" <=> $1::vector ASC
      LIMIT ${HybridRagService.RECALL_TOP_K}
    `;

    const rows = await this.chunkRepo.manager.transaction<SqlCandidateChunk[]>(
      async (em: EntityManager) => {
        // 开启 pgvector 0.8+ 迭代扫描，避免多租户/知识库过滤后 HNSW 提前截断召回不足
        await em.query("SET LOCAL hnsw.iterative_scan = 'relaxed_order'");
        await em.query('SET LOCAL hnsw.ef_search = 64');
        return em.query(sql, queryParams);
      },
    );

    return rows.filter(
      (row) => Number(row.denseScore ?? 0) >= HybridRagService.MIN_DENSE_SCORE,
    );
  }

  /**
   * 通过 PostgreSQL pg_trgm GIN 索引与多词元匹配下推稀疏检索
   */
  private async querySparseCandidates(params: {
    userId: string;
    cleanQuery: string;
    searchTerms: string[];
    knowledgeBaseIds?: string[];
    documentIds?: string[];
  }): Promise<SqlCandidateChunk[]> {
    const terms = params.searchTerms.slice(0, 12);
    if (terms.length === 0) return [];

    const likePatterns = terms.map((t) => `%${escapeLikePattern(t)}%`);
    const conditions = [
      'c."userId" = $1',
      'c."isEnabled" = true',
      'd."status" = \'completed\'',
      '(c."content" ILIKE ANY($2::text[]) OR c."content" % $3)',
    ];
    const queryParams: unknown[] = [
      params.userId,
      likePatterns,
      params.cleanQuery,
    ];

    if (params.knowledgeBaseIds && params.knowledgeBaseIds.length > 0) {
      queryParams.push(params.knowledgeBaseIds);
      conditions.push(
        `c."knowledgeBaseId" = ANY($${queryParams.length}::uuid[])`,
      );
    }
    if (params.documentIds && params.documentIds.length > 0) {
      queryParams.push(params.documentIds);
      conditions.push(`c."documentId" = ANY($${queryParams.length}::uuid[])`);
    }

    const sql = `
      SELECT
        c."id",
        c."documentId",
        c."knowledgeBaseId",
        c."chunkIndex",
        c."content",
        c."charCount",
        c."metadata",
        d."title" AS "documentTitle",
        (
          SELECT COUNT(*)::int
          FROM unnest($2::text[]) AS p
          WHERE c."content" ILIKE p
        ) AS "matchCount",
        word_similarity($3, c."content")::float8 AS "trgmScore"
      FROM "knowledge_chunks" c
      INNER JOIN "knowledge_documents" d ON d."id" = c."documentId"
      WHERE ${conditions.join(' AND ')}
      ORDER BY "matchCount" DESC, "trgmScore" DESC
      LIMIT ${HybridRagService.RECALL_TOP_K}
    `;

    const rows = await this.chunkRepo.manager.query<SqlCandidateChunk[]>(
      sql,
      queryParams,
    );

    return rows.filter(
      (row) =>
        Number(row.matchCount ?? 0) > 0 ||
        Number(row.trgmScore ?? 0) >= HybridRagService.MIN_TRGM_SIMILARITY,
    );
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
}
