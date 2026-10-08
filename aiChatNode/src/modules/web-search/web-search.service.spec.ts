import { ConfigService } from '@nestjs/config';
import { WebSearchService } from './web-search.service';

describe('WebSearchService', () => {
  let service: WebSearchService;
  let mockConfig: Record<string, string | undefined>;

  beforeEach(() => {
    mockConfig = {};
    const configService = {
      get: jest.fn((key: string) => mockConfig[key]),
    } as unknown as ConfigService;
    service = new WebSearchService(configService);
  });

  it('buildContextPrompt: 格式化来源列表生成正确的 Prompt 上下文', () => {
    const prompt = service.buildContextPrompt([
      {
        id: 1,
        title: '测试标题',
        url: 'https://example.com/test',
        snippet: '这是测试摘要内容',
        sitename: 'example.com',
      },
    ]);

    expect(prompt).toContain('[联网检索结果]');
    expect(prompt).toContain('[1] 标题: 测试标题');
    expect(prompt).toContain('链接: https://example.com/test');
    expect(prompt).toContain('摘要: 这是测试摘要内容');
    expect(prompt).toContain('[回答规范]');
  });

  it('buildContextPrompt: 空来源返回空字符串', () => {
    expect(service.buildContextPrompt([])).toBe('');
  });

  it('search: 未配置 API 密钥时优雅返回空来源且不抛出致命异常', async () => {
    const result = await service.search('2026年最新技术');
    expect(result.query).toBe('2026年最新技术');
    expect(result.sources).toEqual([]);
    expect(result.contextPrompt).toBe('');
  });

  it('search: 空输入直接返回空结果', async () => {
    const result = await service.search('   ');
    expect(result.query).toBe('');
    expect(result.sources).toEqual([]);
  });

  it('search: 正确解析 Bocha API webPages.value 返回格式', async () => {
    mockConfig['BOCHA_API_KEY'] = 'test-bocha-key';
    mockConfig['WEB_SEARCH_PROVIDER'] = 'bocha';

    const mockResponse = {
      code: 200,
      data: {
        webPages: {
          value: [
            {
              name: '博查新闻标题',
              url: 'https://news.example.com/article1',
              summary: '这是新闻摘要',
              siteName: 'ExampleNews',
              siteIcon: 'https://example.com/icon.png',
            },
          ],
        },
      },
    };

    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    }) as any;

    try {
      const result = await service.search('科技前沿');
      expect(result.query).toBe('科技前沿');
      expect(result.sources).toHaveLength(1);
      expect(result.sources[0].title).toBe('博查新闻标题');
      expect(result.sources[0].url).toBe('https://news.example.com/article1');
      expect(result.sources[0].snippet).toBe('这是新闻摘要');
      expect(result.sources[0].sitename).toBe('ExampleNews');
      expect(result.contextPrompt).toContain('博查新闻标题');
    } finally {
      global.fetch = originalFetch;
    }
  });
});
