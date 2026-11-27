import type { ConfigService } from '@nestjs/config';
import type { AIClientService } from '../../chat/services/ai-client.service';
import type {
  ChatMessage,
  CompletionOptions,
  CompletionResponse,
} from '../../chat/types/completion.types';
import { KnowledgeVisionService } from './knowledge-vision.service';

type AvailableModelItem = Awaited<
  ReturnType<AIClientService['getAvailableModels']>
>[number];

interface MockAiClientService {
  getAvailableModels: jest.Mock<Promise<Partial<AvailableModelItem>[]>, []>;
  createChatCompletion: jest.Mock<
    Promise<CompletionResponse>,
    [string, ChatMessage[], CompletionOptions?]
  >;
}

interface MockConfigService {
  get: jest.Mock<string | undefined, [string]>;
}

describe('KnowledgeVisionService', () => {
  let service: KnowledgeVisionService;
  let mockAiClientService: MockAiClientService;
  let mockConfigService: MockConfigService;

  beforeEach(() => {
    delete process.env.KNOWLEDGE_VISION_MODEL;
    mockAiClientService = {
      getAvailableModels: jest.fn<Promise<Partial<AvailableModelItem>[]>, []>(),
      createChatCompletion: jest.fn<
        Promise<CompletionResponse>,
        [string, ChatMessage[], CompletionOptions?]
      >(),
    };
    mockConfigService = {
      get: jest.fn<string | undefined, [string]>().mockReturnValue(undefined),
    };
    service = new KnowledgeVisionService(
      mockAiClientService as unknown as AIClientService,
      mockConfigService as unknown as ConfigService,
    );
  });

  afterEach(() => {
    delete process.env.KNOWLEDGE_VISION_MODEL;
  });

  it('优先选用 KNOWLEDGE_VISION_MODEL，否则按默认和排序优选 supportsVision 模型', async () => {
    mockAiClientService.getAvailableModels.mockResolvedValue([
      {
        modelId: 'spark-x2.6-4b',
        isActive: true,
        isDefault: true,
        sortOrder: 1,
        category: 'chat',
        supportsVision: false,
        provider: { isActive: true } as AvailableModelItem['provider'],
      },
      {
        modelId: 'glm-4v-flash',
        isActive: true,
        isDefault: false,
        sortOrder: 8,
        category: 'chat',
        supportsVision: true,
        provider: { isActive: true } as AvailableModelItem['provider'],
      },
      {
        modelId: 'Qwen/Qwen2.5-VL-72B-Instruct',
        isActive: true,
        isDefault: false,
        sortOrder: 11,
        category: 'chat',
        supportsVision: true,
        provider: { isActive: true } as AvailableModelItem['provider'],
      },
    ]);

    expect(await service.resolveVisionModelId()).toBe('glm-4v-flash');

    mockConfigService.get.mockImplementation((key: string) =>
      key === 'KNOWLEDGE_VISION_MODEL'
        ? 'Qwen/Qwen2.5-VL-72B-Instruct'
        : undefined,
    );
    expect(await service.resolveVisionModelId()).toBe(
      'Qwen/Qwen2.5-VL-72B-Instruct',
    );
  });

  it('无可用视觉模型时应明确抛错，绝不静默降级至纯文本模型', async () => {
    mockAiClientService.getAvailableModels.mockResolvedValue([
      {
        modelId: 'spark-x2.6-4b',
        isActive: true,
        isDefault: true,
        sortOrder: 1,
        category: 'chat',
        supportsVision: false,
        provider: { isActive: true } as AvailableModelItem['provider'],
      },
    ]);

    await expect(service.resolveVisionModelId()).rejects.toThrow(
      '未检测到可用的视觉解析模型',
    );
  });

  it('正确调用视觉模型提取结构化 JSON 并拼装高密度检索正文', async () => {
    mockAiClientService.getAvailableModels.mockResolvedValue([
      {
        modelId: 'glm-4v-flash',
        isActive: true,
        isDefault: false,
        sortOrder: 8,
        category: 'chat',
        supportsVision: true,
        provider: { isActive: true } as AvailableModelItem['provider'],
      },
    ]);
    mockAiClientService.createChatCompletion.mockResolvedValue({
      content:
        '```json\n{"visualType":"chart","title":"Q3 性能对比图","summary":"混合检索命中率提升 38%","ocrText":"pgvector HNSW 12ms","tableMarkdown":"| 方案 | 延迟 |\\n| --- | --- |\\n| HNSW | 12ms |"}\n```',
      model: 'glm-4v-flash',
      usage: { promptTokens: 100, completionTokens: 60, totalTokens: 160 },
    });

    const result = await service.extractVisualContent({
      imageBuffer: Buffer.from('webp-bytes'),
      mimeType: 'image/webp',
      fileName: 'perf.pdf',
      pageNumber: 3,
      pageTextHint: '第三章 性能评测',
    });

    expect(result.modelId).toBe('glm-4v-flash');
    expect(result.visualType).toBe('chart');
    expect(result.title).toBe('Q3 性能对比图');
    expect(result.searchableText).toContain(
      '[第 3 页 · 视觉内容(chart)] Q3 性能对比图',
    );
    expect(result.searchableText).toContain('混合检索命中率提升 38%');
    expect(result.searchableText).toContain('| HNSW | 12ms |');

    const [, callMessages, callOptions] =
      mockAiClientService.createChatCompletion.mock.calls[0];
    expect(Array.isArray(callMessages[1].content)).toBe(true);
    if (Array.isArray(callMessages[1].content)) {
      expect(callMessages[1].content[0]).toMatchObject({
        type: 'image_url',
        image_url: { detail: 'high' },
      });
    }

    /* glm-4v-flash 应使用 maxTokens: 1024 */
    expect(callOptions?.maxTokens).toBe(1024);
  });

  it('非 glm-4v-flash 视觉模型使用 maxTokens: 2048', async () => {
    mockAiClientService.getAvailableModels.mockResolvedValue([
      {
        modelId: 'Qwen/Qwen2.5-VL-72B-Instruct',
        isActive: true,
        isDefault: false,
        sortOrder: 11,
        category: 'chat',
        supportsVision: true,
        provider: { isActive: true } as AvailableModelItem['provider'],
      },
    ]);
    mockAiClientService.createChatCompletion.mockResolvedValue({
      content:
        '{"visualType":"table","title":"测试表格","summary":"概要","ocrText":"OCR","tableMarkdown":"| A |\\n| --- |"}',
      model: 'Qwen/Qwen2.5-VL-72B-Instruct',
      usage: { promptTokens: 80, completionTokens: 40, totalTokens: 120 },
    });

    await service.extractVisualContent({
      imageBuffer: Buffer.from('png-data'),
      mimeType: 'image/png',
      fileName: 'report.pdf',
    });

    const [, , callOptions] =
      mockAiClientService.createChatCompletion.mock.calls[0];
    expect(callOptions?.maxTokens).toBe(2048);
  });
});
