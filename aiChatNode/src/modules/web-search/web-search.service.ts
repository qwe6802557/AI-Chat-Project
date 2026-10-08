import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SearchSource, WebSearchResult } from './types/web-search.types';

@Injectable()
export class WebSearchService {
  private readonly logger = new Logger(WebSearchService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * 解析网站域名
   */
  private extractDomain(url: string): string {
    try {
      const parsed = new URL(url);
      return parsed.hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  }

  /**
   * 生成网站图标地址
   */
  private resolveFaviconUrl(url: string, providedIcon?: string): string {
    if (providedIcon) {
      return providedIcon;
    }
    const domain = this.extractDomain(url);
    if (!domain) {
      return '';
    }
    return `https://www.google.com/s2/favicons?sz=32&domain=${domain}`;
  }

  /**
   * 通过 Tavily API 进行实时搜索
   */
  private async searchViaTavily(query: string, apiKey: string): Promise<SearchSource[]> {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: 5,
        search_depth: 'basic',
      }),
    });

    if (!response.ok) {
      throw new Error(`Tavily 搜索请求失败: HTTP ${response.status}`);
    }

    const data = await response.json();
    const rawResults = Array.isArray(data.results) ? data.results : [];

    return rawResults.slice(0, 5).map((item: any, index: number) => ({
      id: index + 1,
      title: item.title || '网页标题',
      url: item.url || '',
      snippet: item.content || item.snippet || '',
      icon: this.resolveFaviconUrl(item.url),
      sitename: this.extractDomain(item.url),
    }));
  }

  /**
   * 通过博查 Bocha API 进行实时搜索
   */
  private async searchViaBocha(query: string, apiKey: string): Promise<SearchSource[]> {
    const response = await fetch('https://api.bochaai.com/v1/web-search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        freshness: 'noLimit',
        summary: true,
        count: 5,
      }),
    });

    if (!response.ok) {
      throw new Error(`博查搜索请求失败: HTTP ${response.status}`);
    }

    const json = await response.json();
    const webpages =
      json.data?.webPages?.value ||
      json.data?.webpages ||
      json.data?.value ||
      [];

    return webpages.slice(0, 5).map((item: any, index: number) => ({
      id: index + 1,
      title: item.name || item.title || '网页标题',
      url: item.url || '',
      snippet: item.summary || item.snippet || '',
      icon: this.resolveFaviconUrl(item.url, item.siteIcon || item.icon),
      sitename: item.siteName || this.extractDomain(item.url),
    }));
  }

  /**
   * 生成送入大模型的检索增强 Prompt 上下文
   */
  buildContextPrompt(sources: SearchSource[]): string {
    if (!sources || sources.length === 0) {
      return '';
    }

    const formattedSources = sources
      .map(
        (source) =>
          `[${source.id}] 标题: ${source.title}\n来源: ${source.sitename || source.url}\n链接: ${source.url}\n摘要: ${source.snippet}`,
      )
      .join('\n\n');

    return `\n\n[联网检索结果]\n${formattedSources}\n\n[回答规范]\n请依据上述检索结果回答问题。在引用具体事实、数据或观点时，必须在对应句子后方标注序号引用，例如 [1] 或 [1][2]。若检索结果未包含足够信息，请如实说明。`;
  }

  /**
   * 执行联网搜索主入口
   */
  async search(query: string): Promise<WebSearchResult> {
    const cleanQuery = query.trim();
    if (!cleanQuery) {
      return { query: '', sources: [], contextPrompt: '' };
    }

    const bochaKey = this.configService.get<string>('BOCHA_API_KEY');
    const tavilyKey = this.configService.get<string>('TAVILY_API_KEY');
    const preferredProvider =
      this.configService.get<string>('WEB_SEARCH_PROVIDER') || 'bocha';

    let sources: SearchSource[] = [];

    try {
      if (preferredProvider === 'bocha' && bochaKey) {
        this.logger.log(`使用博查 API 进行联网搜索: ${cleanQuery}`);
        sources = await this.searchViaBocha(cleanQuery, bochaKey);
      } else if (tavilyKey) {
        this.logger.log(`使用 Tavily API 进行联网搜索: ${cleanQuery}`);
        sources = await this.searchViaTavily(cleanQuery, tavilyKey);
      } else if (bochaKey) {
        this.logger.log(`使用博查 API 进行联网搜索: ${cleanQuery}`);
        sources = await this.searchViaBocha(cleanQuery, bochaKey);
      } else {
        this.logger.warn('未配置 BOCHA_API_KEY 或 TAVILY_API_KEY，跳过在线搜索');
      }
    } catch (error) {
      this.logger.error(`联网检索出现异常: ${error instanceof Error ? error.message : String(error)}`);
      sources = [];
    }

    return {
      query: cleanQuery,
      sources,
      contextPrompt: this.buildContextPrompt(sources),
    };
  }
}
