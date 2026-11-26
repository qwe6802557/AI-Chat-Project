import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import {
  AgentDailyMemory,
  type MemoryCategory,
} from '../entities/agent-daily-memory.entity';
import { EmbeddingService } from '../../knowledge-base/services/embedding.service';
import { extractSearchTerms } from '../../knowledge-base/utils/chunk-highlight.util';
import {
  escapeLikePattern,
  toPgVectorLiteral,
} from '../../knowledge-base/utils/pg-vector.util';

export interface DailyMemoryRow {
  id: string;
  userId: string;
  sessionId: string | null;
  dateKey: string;
  category: MemoryCategory;
  content: string;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DailyMemorySearchItem extends DailyMemoryRow {
  score?: number;
}

export interface UpsertDailyMemoryInput {
  content: string;
  category: MemoryCategory;
  dateKey?: string;
  sessionId?: string | null;
  embedding?: number[] | null;
}

export interface UpsertDailyMemoryResult {
  item: DailyMemoryRow;
  action: 'created' | 'merged';
  similarity?: number;
}

export interface SearchDailyMemoriesOptions {
  category?: string;
  dateKey?: string;
  page?: number;
  limit?: number;
  forAutoRecall?: boolean;
}

export interface DailyMemoryPageResult {
  items: DailyMemorySearchItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface SqlDenseMemoryRow extends DailyMemoryRow {
  denseScore: number;
}

interface SqlSparseMemoryRow extends DailyMemoryRow {
  matchCount: number;
  trgmScore: number;
}

/**
 * 日常情境记忆 pgvector + pg_trgm SQL 检索与语义去重存储服务
 */
@Injectable()
export class MemoryVectorStoreService {
  private static readonly DEDUP_SIMILARITY_THRESHOLD = 0.9;
  private static readonly RRF_K = 60;
  private static readonly MIN_AUTO_RECALL_DENSE_SCORE = 0.45;
  private static readonly MIN_AUTO_RECALL_TRGM_SCORE = 0.35;
  private static readonly TIME_DECAY_HALF_LIFE_DAYS = 30;
  private static readonly RETURNING_COLUMNS =
    '"id", "userId", "sessionId", "dateKey", "category", "content", "isArchived", "createdAt", "updatedAt"';

  constructor(
    @InjectRepository(AgentDailyMemory)
    private readonly dailyMemoryRepo: Repository<AgentDailyMemory>,
    private readonly embeddingService: EmbeddingService,
  ) {}

  /**
   * 写入日常记忆；存在高度语义相似历史条目时合并更新并重置未归档状态
   */
  async upsertDailyMemory(
    userId: string,
    input: UpsertDailyMemoryInput,
  ): Promise<UpsertDailyMemoryResult> {
    const cleanContent = input.content.trim();
    const dateKey = input.dateKey || new Date().toISOString().slice(0, 10);
    const hasValidVector =
      Array.isArray(input.embedding) &&
      input.embedding.length === EmbeddingService.VECTOR_DIMENSION;

    return this.dailyMemoryRepo.manager.transaction(
      async (em: EntityManager) => {
        if (hasValidVector) {
          const vectorLiteral = toPgVectorLiteral(input.embedding!);
          await em.query("SET LOCAL hnsw.iterative_scan = 'relaxed_order'");
          await em.query('SET LOCAL hnsw.ef_search = 40');

          const nearestRows = await em.query<
            Array<{ id: string; similarity: number }>
          >(
            `
            SELECT
              "id",
              (1 - ("embedding" <=> $2::vector(1024)))::float8 AS "similarity"
            FROM "agent_daily_memories"
            WHERE "userId" = $1
              AND "embedding" IS NOT NULL
            ORDER BY "embedding" <=> $2::vector(1024) ASC
            LIMIT 1
          `,
            [userId, vectorLiteral],
          );

          const nearest = nearestRows[0];
          if (
            nearest &&
            Number(nearest.similarity) >=
              MemoryVectorStoreService.DEDUP_SIMILARITY_THRESHOLD
          ) {
            const updatedRows = await em.query<DailyMemoryRow[]>(
              `
              UPDATE "agent_daily_memories"
              SET
                "content" = $2,
                "category" = $3,
                "dateKey" = $4,
                "sessionId" = COALESCE($5, "sessionId"),
                "embedding" = $6::vector(1024),
                "isArchived" = false,
                "updatedAt" = NOW()
              WHERE "id" = $1
              RETURNING ${MemoryVectorStoreService.RETURNING_COLUMNS}
            `,
              [
                nearest.id,
                cleanContent,
                input.category,
                dateKey,
                input.sessionId ?? null,
                vectorLiteral,
              ],
            );

            return {
              item: updatedRows[0],
              action: 'merged',
              similarity: Number(Number(nearest.similarity).toFixed(4)),
            };
          }

          const insertedRows = await em.query<DailyMemoryRow[]>(
            `
            INSERT INTO "agent_daily_memories" (
              "userId", "sessionId", "dateKey", "category", "content", "embedding", "isArchived"
            )
            VALUES ($1, $2, $3, $4, $5, $6::vector(1024), false)
            RETURNING ${MemoryVectorStoreService.RETURNING_COLUMNS}
          `,
            [
              userId,
              input.sessionId ?? null,
              dateKey,
              input.category,
              cleanContent,
              vectorLiteral,
            ],
          );

          return {
            item: insertedRows[0],
            action: 'created',
          };
        }

        const insertedRows = await em.query<DailyMemoryRow[]>(
          `
          INSERT INTO "agent_daily_memories" (
            "userId", "sessionId", "dateKey", "category", "content", "embedding", "isArchived"
          )
          VALUES ($1, $2, $3, $4, $5, NULL, false)
          RETURNING ${MemoryVectorStoreService.RETURNING_COLUMNS}
        `,
          [
            userId,
            input.sessionId ?? null,
            dateKey,
            input.category,
            cleanContent,
          ],
        );

        return {
          item: insertedRows[0],
          action: 'created',
        };
      },
    );
  }

  /**
   * 手动录入单条日常记忆（强制向量化后执行去重写入）
   */
  async createManualDailyMemory(
    userId: string,
    input: { category: MemoryCategory; content: string },
  ): Promise<UpsertDailyMemoryResult> {
    const cleanContent = input.content.trim();
    const embedding = await this.embeddingService.embedQuery(cleanContent);
    return this.upsertDailyMemory(userId, {
      category: input.category,
      content: cleanContent,
      embedding,
    });
  }

  /**
   * 基于 pgvector HNSW 与 pg_trgm 的 SQL 双路混合检索，RRF 融合并结合轻度时间衰减排序
   */
  async searchDailyMemories(
    userId: string,
    query: string,
    options?: SearchDailyMemoriesOptions,
  ): Promise<DailyMemoryPageResult> {
    const cleanQuery = query.trim();
    const page = Math.max(1, options?.page ?? 1);
    const limit = Math.max(1, Math.min(100, options?.limit ?? 20));

    if (!cleanQuery) {
      return { items: [], total: 0, page, limit, totalPages: 0 };
    }

    const queryVector = await this.embeddingService.embedQuery(cleanQuery);
    const vectorLiteral = toPgVectorLiteral(queryVector);
    const searchTerms = extractSearchTerms(cleanQuery).slice(0, 8);
    const recallLimit = Math.max(limit * 3, 30);

    const { denseRows, sparseRows } =
      await this.dailyMemoryRepo.manager.transaction(
        async (em: EntityManager) => {
          await em.query("SET LOCAL hnsw.iterative_scan = 'relaxed_order'");
          await em.query('SET LOCAL hnsw.ef_search = 64');

          const denseParams: unknown[] = [vectorLiteral, userId];
          const denseFilterSql = this.buildFilterConditions(
            denseParams,
            options,
          );
          const denseQueryRows = await em.query<SqlDenseMemoryRow[]>(
            `
              SELECT
                ${MemoryVectorStoreService.RETURNING_COLUMNS},
                (1 - ("embedding" <=> $1::vector(1024)))::float8 AS "denseScore"
              FROM "agent_daily_memories"
              WHERE "userId" = $2
                AND "embedding" IS NOT NULL
                ${denseFilterSql}
              ORDER BY "embedding" <=> $1::vector(1024) ASC
              LIMIT ${recallLimit}
            `,
            denseParams,
          );

          const likePatterns = (
            searchTerms.length > 0 ? searchTerms : [cleanQuery]
          ).map((term) => `%${escapeLikePattern(term)}%`);
          const sparseParams: unknown[] = [userId, likePatterns, cleanQuery];
          const sparseFilterSql = this.buildFilterConditions(
            sparseParams,
            options,
          );
          const sparseQueryRows = await em.query<SqlSparseMemoryRow[]>(
            `
              SELECT
                ${MemoryVectorStoreService.RETURNING_COLUMNS},
                (
                  SELECT COUNT(*)::int
                  FROM unnest($2::text[]) AS p
                  WHERE "content" ILIKE p ESCAPE '\\'
                ) AS "matchCount",
                GREATEST(
                  word_similarity($3, "content"),
                  similarity($3, "content")
                )::float8 AS "trgmScore"
              FROM "agent_daily_memories"
              WHERE "userId" = $1
                AND ("content" ILIKE ANY($2::text[]) ESCAPE '\\' OR word_similarity($3, "content") >= 0.25)
                ${sparseFilterSql}
              ORDER BY "matchCount" DESC, "trgmScore" DESC, "createdAt" DESC
              LIMIT ${recallLimit}
            `,
            sparseParams,
          );

          return {
            denseRows: denseQueryRows,
            sparseRows: sparseQueryRows,
          };
        },
      );

    return this.fuseAndPaginate({
      denseRows,
      sparseRows,
      searchTermsCount: Math.max(1, searchTerms.length),
      page,
      limit,
      forAutoRecall: Boolean(options?.forAutoRecall),
    });
  }

  private buildFilterConditions(
    queryParams: unknown[],
    options?: SearchDailyMemoriesOptions,
  ): string {
    const clauses: string[] = [];
    if (options?.category) {
      queryParams.push(options.category);
      clauses.push(`AND "category" = $${queryParams.length}`);
    }
    if (options?.dateKey) {
      queryParams.push(options.dateKey);
      clauses.push(`AND "dateKey" = $${queryParams.length}`);
    }
    return clauses.join(' ');
  }

  private fuseAndPaginate(params: {
    denseRows: SqlDenseMemoryRow[];
    sparseRows: SqlSparseMemoryRow[];
    searchTermsCount: number;
    page: number;
    limit: number;
    forAutoRecall: boolean;
  }): DailyMemoryPageResult {
    const rowMap = new Map<string, DailyMemoryRow>();
    const denseRankMap = new Map<string, number>();
    const denseScoreMap = new Map<string, number>();
    const sparseRankMap = new Map<string, number>();
    const sparseScoreMap = new Map<string, number>();
    const sparseMatchCountMap = new Map<string, number>();

    params.denseRows.forEach((row, index) => {
      rowMap.set(row.id, row);
      denseRankMap.set(row.id, index + 1);
      denseScoreMap.set(row.id, Number(row.denseScore ?? 0));
    });

    params.sparseRows.forEach((row, index) => {
      if (!rowMap.has(row.id)) {
        rowMap.set(row.id, row);
      }
      const matchCount = Number(row.matchCount ?? 0);
      const trgmScore = Number(row.trgmScore ?? 0);
      if (
        matchCount === 0 &&
        trgmScore < MemoryVectorStoreService.MIN_AUTO_RECALL_TRGM_SCORE
      ) {
        return;
      }
      sparseRankMap.set(row.id, index + 1);
      sparseMatchCountMap.set(row.id, matchCount);
      const matchRatio =
        matchCount > 0
          ? Math.min(1, 0.55 + 0.45 * (matchCount / params.searchTermsCount))
          : trgmScore;
      sparseScoreMap.set(row.id, Math.max(trgmScore, matchRatio));
    });

    const candidateIds = new Set<string>([
      ...denseRankMap.keys(),
      ...sparseRankMap.keys(),
    ]);

    const nowMs = Date.now();
    const ranked: Array<{ item: DailyMemorySearchItem; rankScore: number }> =
      [];

    for (const id of candidateIds) {
      const row = rowMap.get(id);
      if (!row) continue;

      const denseRank = denseRankMap.get(id);
      const sparseRank = sparseRankMap.get(id);
      const denseScore = denseScoreMap.get(id) ?? 0;
      const sparseScore = sparseScoreMap.get(id) ?? 0;
      const matchCount = sparseMatchCountMap.get(id) ?? 0;

      if (
        params.forAutoRecall &&
        denseScore < MemoryVectorStoreService.MIN_AUTO_RECALL_DENSE_SCORE &&
        sparseScore < MemoryVectorStoreService.MIN_AUTO_RECALL_TRGM_SCORE &&
        matchCount === 0
      ) {
        continue;
      }

      const rrf =
        (denseRank ? 1 / (MemoryVectorStoreService.RRF_K + denseRank) : 0) +
        (sparseRank ? 1 / (MemoryVectorStoreService.RRF_K + sparseRank) : 0);

      const createdMs = row.createdAt
        ? new Date(row.createdAt).getTime()
        : nowMs;
      const ageDays = Math.max(0, (nowMs - createdMs) / (1000 * 60 * 60 * 24));
      const recencyFactor =
        1 +
        0.12 *
          Math.exp(
            -ageDays / MemoryVectorStoreService.TIME_DECAY_HALF_LIFE_DAYS,
          );

      const displayScore = Number(
        Math.min(1, Math.max(denseScore, sparseScore)).toFixed(4),
      );
      if (displayScore < 0.25 && matchCount === 0) {
        continue;
      }

      ranked.push({
        item: {
          id: row.id,
          userId: row.userId,
          sessionId: row.sessionId,
          dateKey: row.dateKey,
          category: row.category,
          content: row.content,
          isArchived: row.isArchived,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          score: displayScore,
        },
        rankScore: rrf * recencyFactor + displayScore * 0.01,
      });
    }

    ranked.sort((a, b) => b.rankScore - a.rankScore);

    const total = ranked.length;
    const start = (params.page - 1) * params.limit;
    const items = ranked
      .slice(start, start + params.limit)
      .map((entry) => entry.item);

    return {
      items,
      total,
      page: params.page,
      limit: params.limit,
      totalPages: total === 0 ? 0 : Math.ceil(total / params.limit),
    };
  }
}
