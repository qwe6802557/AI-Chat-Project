import { Test, TestingModule } from '@nestjs/testing';
import { ToolRegistryService } from './tools.registry.service';
import { CodeInterpreterPlugin } from './plugins/code-interpreter.plugin';
import { WebSearchPlugin } from './plugins/web-search.plugin';
import { UrlFetcherPlugin } from './plugins/url-fetcher.plugin';
import { CalculatorPlugin } from './plugins/calculator.plugin';
import { WeatherPlugin } from './plugins/weather.plugin';
import { ClockCalendarPlugin } from './plugins/clock-calendar.plugin';
import { WebSearchService } from '../web-search/web-search.service';

describe('ToolRegistryService & Plugins', () => {
  let service: ToolRegistryService;
  let calculator: CalculatorPlugin;
  let clockCalendar: ClockCalendarPlugin;
  let codeInterpreter: CodeInterpreterPlugin;

  const mockWebSearchService = {
    search: jest.fn().mockResolvedValue({
      query: '人工智能',
      sources: [
        { id: 1, title: 'AI 资讯', url: 'https://example.com/ai', snippet: 'AI 进展' },
      ],
      contextPrompt: '【联网搜索参考信息】：AI 进展',
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ToolRegistryService,
        CodeInterpreterPlugin,
        WebSearchPlugin,
        UrlFetcherPlugin,
        CalculatorPlugin,
        WeatherPlugin,
        ClockCalendarPlugin,
        {
          provide: WebSearchService,
          useValue: mockWebSearchService,
        },
      ],
    }).compile();

    service = module.get<ToolRegistryService>(ToolRegistryService);
    calculator = module.get<CalculatorPlugin>(CalculatorPlugin);
    clockCalendar = module.get<ClockCalendarPlugin>(ClockCalendarPlugin);
    codeInterpreter = module.get<CodeInterpreterPlugin>(CodeInterpreterPlugin);
  });

  it('应该成功注册并列出 6 大内置插件', () => {
    const tools = service.listTools();
    expect(tools.length).toBe(6);
    const ids = tools.map((t) => t.id);
    expect(ids).toContain('code_interpreter');
    expect(ids).toContain('web_search_v2');
    expect(ids).toContain('url_fetcher');
    expect(ids).toContain('calculator');
    expect(ids).toContain('weather');
    expect(ids).toContain('clock_calendar');
  });

  it('数学计算器插件能准确计算复合表达式', async () => {
    const res = await calculator.execute({ expression: 'sqrt(144) + 2^4 - 6 / 2' });
    expect(res.status).toBe('success');
    expect(res.output.result).toBe(12 + 16 - 3); // 25
  });

  it('时钟日历插件能返回有效实时时间与星期', async () => {
    const res = await clockCalendar.execute({ timezone: 'Asia/Shanghai' });
    expect(res.status).toBe('success');
    expect(res.output.timezone).toBe('Asia/Shanghai');
    expect(res.output.timestamp).toBeGreaterThan(0);
    expect(res.output.dayOfWeek).toBeDefined();
  });

  it('代码解释器能在沙箱中执行 JavaScript 代码并捕获输出', async () => {
    const res = await codeInterpreter.execute({
      language: 'javascript',
      code: 'console.log("HELLO_SANDBOX_OUTPUT_" + (40 + 2));',
    });
    expect(res.status).toBe('success');
    expect(res.output.stdout).toContain('HELLO_SANDBOX_OUTPUT_42');
  });

  it('toOpenAITools 能输出符合 OpenAI 格式的 Function 工具定义', () => {
    const openAiTools = service.toOpenAITools(['calculator', 'clock_calendar']);
    expect(openAiTools.length).toBe(2);
    expect(openAiTools[0].type).toBe('function');
    expect(openAiTools[0].function.name).toBe('calculator');
    expect(openAiTools[0].function.parameters).toBeDefined();
  });

  it('autoExecutePresetTools 能根据用户问题意图自动触发对应预置工具', async () => {
    const records = await service.autoExecutePresetTools('请问现在几点了？今天几号？', ['clock_calendar']);
    expect(records.length).toBe(1);
    expect(records[0].name).toBe('clock_calendar');
    expect(records[0].result.status).toBe('success');
  });
});
