import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface RerankResultItem {
  index: number;
  relevanceScore: number;
}

/**
 * Cross-Encoder 精排服务（基于 SiliconFlow BAAI/bge-reranker-v2-m3）
 */
@Injectable()
export class RerankService {
  private readonly logger = new Logger(RerankService.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly modelName: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey =
      this.configService.get<string>('SILICONFLOW_API_KEY') ||
      process.env.SILICONFLOW_API_KEY ||
      '';
    const rawUrl =
      this.configService.get<string>('SILICONFLOW_BASE_URL') ||
      process.env.SILICONFLOW_BASE_URL ||
      'https://api.siliconflow.cn/v1';
    this.baseUrl = rawUrl.replace(/\/+$/, '');
    this.modelName =
      this.configService.get<string>('SILICONFLOW_RERANK_MODEL') ||
      process.env.SILICONFLOW_RERANK_MODEL ||
      'BAAI/bge-reranker-v2-m3';
  }

  /**
   * 对候选文档切片按查询相关性重新打分排序；异常时返回 null 供上层平滑降级
   */
  async rerank(
    query: string,
    documents: string[],
    topN: number,
  ): Promise<RerankResultItem[] | null> {
    if (!this.apiKey || documents.length === 0) {
      return null;
    }

    const url = `${this.baseUrl}/rerank`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.modelName,
          query,
          documents,
          top_n: Math.min(topN, documents.length),
          return_documents: false,
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
        const errText = await response.text();
        this.logger.warn(
          `Rerank API 返回非 2xx [${response.status}]，已回退 RRF: ${errText}`,
        );
        return null;
      }

      const payload: any = await response.json();
      if (!Array.isArray(payload?.results)) {
        this.logger.warn('Rerank API 返回格式异常，已回退 RRF');
        return null;
      }

      return payload.results
        .filter(
          (item: any) =>
            typeof item?.index === 'number' &&
            typeof item?.relevance_score === 'number',
        )
        .map((item: any) => ({
          index: item.index,
          relevanceScore: item.relevance_score,
        }));
    } catch (err: any) {
      this.logger.warn(`Rerank 调用失败，已回退 RRF: ${err.message}`);
      return null;
    }
  }
}
