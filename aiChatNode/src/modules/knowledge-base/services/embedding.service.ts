import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * 文本向量化嵌入服务 (基于 SiliconFlow BAAI/bge-m3, 1024 维)
 */
@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly modelName = 'BAAI/bge-m3';
  static readonly VECTOR_DIMENSION = 1024;

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
  }

  /**
   * 单文本语义向量计算
   */
  async embedQuery(text: string): Promise<number[]> {
    const results = await this.embedDocuments([text]);
    return results[0];
  }

  /**
   * 批量文本向量计算（支持自动切分 batch 批次）
   */
  async embedDocuments(
    texts: string[],
    batchSize = 16,
  ): Promise<number[][]> {
    if (texts.length === 0) return [];
    if (!this.apiKey) {
      this.logger.error('未配置 SILICONFLOW_API_KEY，无法调用 Embedding 服务');
      throw new Error('未配置 SILICONFLOW_API_KEY，无法计算向量');
    }

    const allEmbeddings: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchVectors = await this.callSiliconFlowApi(batch);
      allEmbeddings.push(...batchVectors);
    }

    return allEmbeddings;
  }

  /**
   * 调用 SiliconFlow OpenAI 兼容 Embedding 端点
   */
  private async callSiliconFlowApi(inputs: string[]): Promise<number[][]> {
    const url = `${this.baseUrl}/embeddings`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.modelName,
        input: inputs,
        encoding_format: 'float',
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      this.logger.error(
        `SiliconFlow Embedding API 调用失败 [${response.status}]: ${errText}`,
      );
      throw new Error(`Embedding 服务响应异常 (${response.status}): ${errText}`);
    }

    const data: any = await response.json();
    if (!data?.data || !Array.isArray(data.data)) {
      throw new Error('Embedding API 返回格式不合法');
    }

    // 保证按照 index 严格排序
    const sorted = [...data.data].sort((a, b) => a.index - b.index);
    return sorted.map((item) => {
      const vec: number[] = item.embedding;
      return this.normalizeVector(vec);
    });
  }

  /**
   * 向量 L2 范数归一化，确保点积精确等于余弦相似度
   */
  private normalizeVector(v: number[]): number[] {
    let sumSquares = 0;
    for (let i = 0; i < v.length; i++) {
      sumSquares += v[i] * v[i];
    }
    const norm = Math.sqrt(sumSquares);
    if (norm === 0) return v;
    return v.map((val) => val / norm);
  }
}
