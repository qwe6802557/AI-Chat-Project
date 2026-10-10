import { Injectable, Logger } from '@nestjs/common';
import { CodeInterpreterPlugin } from './plugins/code-interpreter.plugin';
import { WebSearchPlugin } from './plugins/web-search.plugin';
import { UrlFetcherPlugin } from './plugins/url-fetcher.plugin';
import { CalculatorPlugin } from './plugins/calculator.plugin';
import { WeatherPlugin } from './plugins/weather.plugin';
import { ClockCalendarPlugin } from './plugins/clock-calendar.plugin';
import type {
  IToolPlugin,
  ToolExecutionContext,
  ToolExecutionRecord,
  ToolExecutionResult,
  ToolMetadata,
} from './types/tools.types';
import { randomUUID } from 'crypto';

@Injectable()
export class ToolRegistryService {
  private readonly logger = new Logger(ToolRegistryService.name);
  private readonly pluginMap = new Map<string, IToolPlugin>();

  constructor(
    private readonly codeInterpreter: CodeInterpreterPlugin,
    private readonly webSearch: WebSearchPlugin,
    private readonly urlFetcher: UrlFetcherPlugin,
    private readonly calculator: CalculatorPlugin,
    private readonly weather: WeatherPlugin,
    private readonly clockCalendar: ClockCalendarPlugin,
  ) {
    this.registerPlugin(this.codeInterpreter);
    this.registerPlugin(this.webSearch);
    this.registerPlugin(this.urlFetcher);
    this.registerPlugin(this.calculator);
    this.registerPlugin(this.weather);
    this.registerPlugin(this.clockCalendar);
  }

  /**
   * 注册插件
   */
  private registerPlugin(plugin: IToolPlugin): void {
    this.pluginMap.set(plugin.metadata.name, plugin);
  }

  /**
   * 获取所有可用工具元数据列表
   */
  listTools(): ToolMetadata[] {
    return Array.from(this.pluginMap.values()).map((p) => p.metadata);
  }

  /**
   * 按名称获取插件实例
   */
  getPlugin(name: string): IToolPlugin | undefined {
    return this.pluginMap.get(name);
  }

  /**
   * 执行指定插件
   */
  async executeTool(
    name: string,
    args: Record<string, any>,
    context?: ToolExecutionContext,
  ): Promise<ToolExecutionRecord> {
    const plugin = this.getPlugin(name);
    if (!plugin) {
      const durationMs = 0;
      return {
        id: randomUUID(),
        name,
        title: name,
        callType: 'user_preset',
        args,
        result: {
          status: 'error',
          output: null,
          durationMs,
          error: `未找到插件: ${name}`,
        },
        createdAt: new Date().toISOString(),
      };
    }

    this.logger.log(`开始执行工具: ${name}, 入参: ${JSON.stringify(args).slice(0, 150)}`);
    const result: ToolExecutionResult = await plugin.execute(args, context);
    this.logger.log(`工具执行完成: ${name}, 状态: ${result.status}, 耗时: ${result.durationMs}ms`);

    return {
      id: randomUUID(),
      name,
      title: plugin.metadata.title,
      callType: 'user_preset',
      args,
      result,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * 将启用的工具列表转换为 OpenAI 标准 tools 规范数组
   */
  toOpenAITools(
    enabledToolNames?: string[],
  ): Array<{ type: 'function'; function: { name: string; description: string; parameters: any } }> {
    const list = enabledToolNames?.length
      ? enabledToolNames.map((n) => this.getPlugin(n)).filter(Boolean) as IToolPlugin[]
      : Array.from(this.pluginMap.values());

    return list.map((plugin) => ({
      type: 'function',
      function: {
        name: plugin.metadata.name,
        description: plugin.metadata.description,
        parameters: plugin.metadata.parametersSchema,
      },
    }));
  }

  /**
   * 自动探测并执行适用的预置工具 (Preset Mode)
   */
  async autoExecutePresetTools(
    message: string,
    enabledToolNames?: string[],
    context?: ToolExecutionContext,
  ): Promise<ToolExecutionRecord[]> {
    if (!enabledToolNames?.length) {
      return [];
    }

    const records: ToolExecutionRecord[] = [];
    const lowerMessage = message.toLowerCase();

    // 1. 时钟日历
    if (enabledToolNames.includes('clock_calendar')) {
      const timeKeywords = ['几号', '星期几', '周几', '现在时间', '今天几点', '当前时间', '今天日期', '时区', '几月几日'];
      if (timeKeywords.some((k) => message.includes(k))) {
        const record = await this.executeTool('clock_calendar', { timezone: 'Asia/Shanghai' }, context);
        records.push(record);
      }
    }

    // 2. 网页阅读器（当输入中包含 URL）
    if (enabledToolNames.includes('url_fetcher')) {
      const urlMatch = message.match(/https?:\/\/[^\s，。]+/i);
      if (urlMatch) {
        const record = await this.executeTool('url_fetcher', { url: urlMatch[0] }, context);
        records.push(record);
      }
    }

    // 3. 实时天气
    if (enabledToolNames.includes('weather')) {
      const weatherKeywords = ['天气', '气温', '下雨', '降雨', '温度', '预报'];
      if (weatherKeywords.some((k) => message.includes(k))) {
        const cityMatch = message.match(/([\u4e00-\u9fa5]{2,6})(市|县|区)?(的)?(天气|气温|温度)/);
        const city = cityMatch ? cityMatch[1] : '北京';
        const record = await this.executeTool('weather', { city }, context);
        records.push(record);
      }
    }

    // 4. 数学计算器
    if (enabledToolNames.includes('calculator')) {
      const calcMatch = message.match(/(计算|求值|等于多少|算一下)?\s*[:：]?\s*([\d\s+\-*/%().^sqrt]+)/i);
      if (calcMatch && /[\d+\-*/]/.test(calcMatch[2]) && calcMatch[2].length > 2) {
        const record = await this.executeTool('calculator', { expression: calcMatch[2].trim() }, context);
        if (record.result.status === 'success') {
          records.push(record);
        }
      }
    }

    // 5. 代码解释器
    if (enabledToolNames.includes('code_interpreter')) {
      const codeBlockMatch = message.match(/```(python|javascript|js|py)?\s*([\s\S]+?)```/i);
      if (codeBlockMatch) {
        const lang = codeBlockMatch[1]?.toLowerCase().includes('js') ? 'javascript' : 'python';
        const code = codeBlockMatch[2].trim();
        const record = await this.executeTool('code_interpreter', { language: lang, code }, context);
        records.push(record);
      }
    }

    return records;
  }
}
