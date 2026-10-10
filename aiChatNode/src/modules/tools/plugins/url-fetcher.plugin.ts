import { Injectable } from '@nestjs/common';
import type { IToolPlugin, ToolExecutionResult, ToolMetadata } from '../types/tools.types';

@Injectable()
export class UrlFetcherPlugin implements IToolPlugin {
  private readonly maxTextLength = 40000;
  private readonly timeoutMs = 8000;

  readonly metadata: ToolMetadata = {
    id: 'url_fetcher',
    name: 'url_fetcher',
    title: '网页阅读器',
    description: '抓取指定 HTTP/HTTPS 网页内容，提取正文文字、标题与结构化排版内容',
    icon: 'link',
    category: 'network',
    supportsPresetMode: true,
    supportsFunctionCall: true,
    parametersSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: '待抓取的网页完整 URL 地址，以 http:// 或 https:// 开头',
        },
      },
      required: ['url'],
    },
  };

  /**
   * 抓取网页并提取正文
   */
  async execute(args: Record<string, any>): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    const rawUrl = typeof args.url === 'string' ? args.url.trim() : '';

    if (!rawUrl || !/^https?:\/\//i.test(rawUrl)) {
      return {
        status: 'error',
        output: null,
        error: '请提供有效的 HTTP/HTTPS 网页地址',
        durationMs: Date.now() - startTime,
      };
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      const response = await fetch(rawUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
        },
      });
      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(`网页抓取失败: HTTP ${response.status} ${response.statusText}`);
      }

      const html = await response.text();
      const extractedText = this.cleanHtml(html);
      const title = this.extractTitle(html) || rawUrl;
      const durationMs = Date.now() - startTime;

      return {
        status: 'success',
        output: {
          url: rawUrl,
          title,
          content: extractedText.slice(0, this.maxTextLength),
          length: extractedText.length,
        },
        rawOutput: `# ${title}\n\n${extractedText.slice(0, this.maxTextLength)}`,
        durationMs,
      };
    } catch (error: any) {
      return {
        status: 'error',
        output: null,
        error: error.message || '网页抓取超时或网络阻断',
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * 清理 HTML 提取纯文本正文
   */
  private cleanHtml(html: string): string {
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
      .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&amp;/gi, '&')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * 提取网页标题
   */
  private extractTitle(html: string): string {
    const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return match ? match[1].trim() : '';
  }
}
