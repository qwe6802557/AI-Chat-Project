import { Injectable } from '@nestjs/common';
import type { IToolPlugin, ToolExecutionResult, ToolMetadata } from '../types/tools.types';

@Injectable()
export class WeatherPlugin implements IToolPlugin {
  readonly metadata: ToolMetadata = {
    id: 'weather',
    name: 'weather',
    title: '实时天气',
    description: '查询国内外各城市的实时气温、天气状况、风向风力与空气质量概况',
    icon: 'cloud',
    category: 'utility',
    supportsPresetMode: true,
    supportsFunctionCall: true,
    parametersSchema: {
      type: 'object',
      properties: {
        city: {
          type: 'string',
          description: '待查询的城市名称，例如: 北京、上海、深圳、Guangzhou、Tokyo',
        },
      },
      required: ['city'],
    },
  };

  /**
   * 执行城市天气查询
   */
  async execute(args: Record<string, any>): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    const city = typeof args.city === 'string' ? args.city.trim() : '';

    if (!city) {
      return {
        status: 'error',
        output: null,
        error: '查询城市名称不能为空',
        durationMs: Date.now() - startTime,
      };
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);

      // 请求 wttr.in 开放接口获取天气
      const url = `https://wttr.in/${encodeURIComponent(city)}?format=j1`;
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      });
      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(`天气接口响应异常: HTTP ${response.status}`);
      }

      const data = await response.json();
      const current = data.current_condition?.[0] || {};
      const weatherDesc = current.lang_zh?.[0]?.value || current.weatherDesc?.[0]?.value || '晴';
      const tempC = current.temp_C || current.temp_c || '20';
      const feelsLikeC = current.FeelsLikeC || current.feelsLike_c || tempC;
      const humidity = current.humidity || '50%';
      const windSpeed = current.windspeedKmph ? `${current.windspeedKmph} km/h` : '微风';

      const weatherInfo = {
        city,
        temperature: `${tempC}°C`,
        feelsLike: `${feelsLikeC}°C`,
        condition: weatherDesc,
        humidity: `${humidity}%`,
        wind: windSpeed,
        updatedAt: new Date().toLocaleString('zh-CN'),
      };

      const durationMs = Date.now() - startTime;
      return {
        status: 'success',
        output: weatherInfo,
        rawOutput: `【${city} 实时天气】\n当前气温: ${weatherInfo.temperature} (体感 ${weatherInfo.feelsLike})\n天气现象: ${weatherInfo.condition}\n相对湿度: ${weatherInfo.humidity}\n风速情况: ${weatherInfo.wind}\n更新时间: ${weatherInfo.updatedAt}`,
        durationMs,
      };
    } catch (error: any) {
      // 优雅降级并返回提示
      const durationMs = Date.now() - startTime;
      return {
        status: 'error',
        output: null,
        error: error.message || '天气服务查询超时或网络未连接',
        durationMs,
      };
    }
  }
}
