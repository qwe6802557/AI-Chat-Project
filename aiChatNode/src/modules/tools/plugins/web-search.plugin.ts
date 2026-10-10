import { Injectable } from '@nestjs/common';
import { WebSearchService } from '../../web-search/web-search.service';
import type { IToolPlugin, ToolExecutionResult, ToolMetadata } from '../types/tools.types';

@Injectable()
export class WebSearchPlugin implements IToolPlugin {
  readonly metadata: ToolMetadata = {
    id: 'web_search_v2',
    name: 'web_search_v2',
    title: '网络搜索',
    description: '通过博查或 Tavily 高速搜索引擎检索互联网实时信息、新闻资讯与学术技术资料',
    icon: 'search',
    category: 'network',
    supportsPresetMode: true,
    supportsFunctionCall: true,
    parametersSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '搜索关键词或问题描述',
        },
      },
      required: ['query'],
    },
  };

  constructor(private readonly webSearchService: WebSearchService) {}

  /**
   * 执行联网搜索
   */
  async execute(args: Record<string, any>): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    const query = typeof args.query === 'string' ? args.query.trim() : '';

    if (!query) {
      return {
        status: 'error',
        output: null,
        error: '搜索查询词不能为空',
        durationMs: Date.now() - startTime,
      };
    }

    try {
      const searchResult = await this.webSearchService.search(query);
      const durationMs = Date.now() - startTime;

      return {
        status: 'success',
        output: {
          query: searchResult.query,
          sources: searchResult.sources,
          count: searchResult.sources.length,
          contextPrompt: searchResult.contextPrompt,
        },
        rawOutput: searchResult.contextPrompt,
        durationMs,
      };
    } catch (error: any) {
      return {
        status: 'error',
        output: null,
        error: error.message || '网络搜索执行失败',
        durationMs: Date.now() - startTime,
      };
    }
  }
}
