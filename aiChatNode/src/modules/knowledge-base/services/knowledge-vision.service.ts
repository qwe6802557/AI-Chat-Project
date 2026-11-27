import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AIClientService } from '../../chat/services/ai-client.service';
import type { ChatMessage } from '../../chat/types/completion.types';
import { extractJsonFromLlmOutput } from '../../memory/utils/memory-json.util';
import { resolveEffectiveSupportsVision } from '../../chat/utils/vision-profile.util';

export type VisualContentType =
  | 'chart'
  | 'table'
  | 'diagram'
  | 'screenshot'
  | 'document_page'
  | 'photo';

export interface ExtractVisualContentParams {
  imageBuffer: Buffer;
  mimeType: string;
  fileName: string;
  pageNumber?: number;
  pageTextHint?: string;
}

export interface VisualExtractionResult {
  visualType: VisualContentType;
  title: string;
  summary: string;
  ocrText: string;
  tableMarkdown: string;
  searchableText: string;
  modelId: string;
}

const VALID_VISUAL_TYPES: ReadonlySet<VisualContentType> = new Set([
  'chart',
  'table',
  'diagram',
  'screenshot',
  'document_page',
  'photo',
]);

/**
 * 知识库多模态视觉解析路由服务（复用 AIClientService 熔断与故障转移）
 */
@Injectable()
export class KnowledgeVisionService {
  private readonly logger = new Logger(KnowledgeVisionService.name);

  constructor(
    @Inject(forwardRef(() => AIClientService))
    private readonly aiClientService: AIClientService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 按环境变量与线上启用视觉能力动态解析最优视觉模型
   */
  async resolveVisionModelId(): Promise<string> {
    const activeModels = await this.aiClientService.getAvailableModels();
    const activeChatModels = activeModels.filter(
      (model) =>
        model.isActive &&
        model.category === 'chat' &&
        model.provider?.isActive !== false,
    );

    const configured =
      this.configService.get<string>('KNOWLEDGE_VISION_MODEL') ||
      process.env.KNOWLEDGE_VISION_MODEL;
    const preferredId = configured?.trim();

    if (preferredId) {
      const matched = activeChatModels.find((m) => m.modelId === preferredId);
      if (matched) {
        return matched.modelId;
      }
      this.logger.warn(
        `配置的 KNOWLEDGE_VISION_MODEL [${preferredId}] 未启用或不存在，回退至已启用视觉模型池选择`,
      );
    }

    const visionModels = activeChatModels.filter((m) =>
      resolveEffectiveSupportsVision({
        providerName: m.provider?.name,
        modelId: m.modelId,
        category: m.category,
        supportsVision: m.supportsVision,
      }),
    );
    if (visionModels.length === 0) {
      throw new Error(
        '未检测到可用的视觉解析模型，请在模型管理中启用支持视觉能力的模型（如 glm-4v-flash）或配置 KNOWLEDGE_VISION_MODEL',
      );
    }

    const sorted = [...visionModels].sort((a, b) => {
      if (a.isDefault !== b.isDefault) {
        return a.isDefault ? -1 : 1;
      }
      return a.sortOrder - b.sortOrder;
    });

    return sorted[0].modelId;
  }

  /**
   * 提取图片/图表页的结构化摘要、OCR 文本与 Markdown 表格供统一向量化检索
   */
  async extractVisualContent(
    params: ExtractVisualContentParams,
  ): Promise<VisualExtractionResult> {
    const modelId = await this.resolveVisionModelId();
    const base64 = params.imageBuffer.toString('base64');
    const dataUrl = `data:${params.mimeType || 'image/webp'};base64,${base64}`;

    const hintBlock = params.pageTextHint?.trim()
      ? `\n补充参考文本（同页文本层提取，供术语对齐参考）：\n${params.pageTextHint.trim().slice(0, 600)}`
      : '';

    const pageInfo = params.pageNumber
      ? `第 ${params.pageNumber} 页`
      : '独立图像';
    const userPrompt = [
      `请分析来源文档《${params.fileName}》（${pageInfo}）中的图像内容，并严格输出单个 JSON 对象（不要输出多余解释）：`,
      '{"visualType":"chart|table|diagram|screenshot|document_page|photo","title":"不超过40字标题","summary":"详细描述核心结论、指标趋势、结构关系或关键实体","ocrText":"完整转录图像中的关键文字、数字、坐标轴标签与图例","tableMarkdown":"若包含表格或对比数据请转为标准 Markdown 表格，否则为空字符串"}',
      hintBlock,
    ]
      .filter(Boolean)
      .join('\n');

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content:
          '你是严谨的企业知识库多模态文档分析专家。请准确提取图像、图表、表格与扫描页中的真实信息，绝不臆造未出现的数值，仅返回合法 JSON。',
      },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: dataUrl, detail: 'high' },
          },
          {
            type: 'text',
            text: userPrompt,
          },
        ],
      },
    ];

    /* glm-4v-flash 限制 max_tokens ∈ [1, 1024]，其他视觉模型保持 2048 */
    const maxTokens =
      modelId.trim().toLowerCase() === 'glm-4v-flash' ? 1024 : 2048;

    const completion = await this.aiClientService.createChatCompletion(
      modelId,
      messages,
      {
        temperature: 0.1,
        maxTokens,
        abortSignal: AbortSignal.timeout(45000),
      },
    );

    const parsed = extractJsonFromLlmOutput<Record<string, unknown>>(
      completion.content,
    );

    const rawType = this.extractTrimmedString(
      parsed.visualType,
    ) as VisualContentType;
    const visualType: VisualContentType = VALID_VISUAL_TYPES.has(rawType)
      ? rawType
      : 'document_page';
    const title = this.extractTrimmedString(parsed.title) || params.fileName;
    const summary = this.extractTrimmedString(parsed.summary);
    const ocrText = this.extractTrimmedString(parsed.ocrText);
    const tableMarkdown = this.extractTrimmedString(parsed.tableMarkdown);

    if (!summary && !ocrText && !tableMarkdown) {
      throw new Error(`视觉模型 [${modelId}] 未提取到有效图文信息`);
    }

    const searchableText = this.buildSearchableText({
      visualType,
      title,
      summary,
      ocrText,
      tableMarkdown,
      pageNumber: params.pageNumber,
    });

    return {
      visualType,
      title,
      summary,
      ocrText,
      tableMarkdown,
      searchableText,
      modelId,
    };
  }

  private extractTrimmedString(value: unknown): string {
    if (typeof value === 'string') {
      return value.trim();
    }
    if (typeof value === 'number') {
      return String(value);
    }
    return '';
  }

  private buildSearchableText(params: {
    visualType: VisualContentType;
    title: string;
    summary: string;
    ocrText: string;
    tableMarkdown: string;
    pageNumber?: number;
  }): string {
    const headerPrefix = params.pageNumber
      ? `[第 ${params.pageNumber} 页 · 视觉内容(${params.visualType})]`
      : `[独立图像 · 视觉内容(${params.visualType})]`;

    const sections = [`${headerPrefix} ${params.title}`];
    if (params.summary) {
      sections.push(`核心摘要：${params.summary}`);
    }
    if (params.tableMarkdown) {
      sections.push(`结构化数据表：\n${params.tableMarkdown}`);
    }
    if (params.ocrText) {
      sections.push(`图像识别原文：\n${params.ocrText}`);
    }

    return sections.join('\n\n').trim();
  }
}
