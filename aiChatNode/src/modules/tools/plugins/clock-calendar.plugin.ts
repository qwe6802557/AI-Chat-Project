import { Injectable } from '@nestjs/common';
import type { IToolPlugin, ToolExecutionResult, ToolMetadata } from '../types/tools.types';

@Injectable()
export class ClockCalendarPlugin implements IToolPlugin {
  readonly metadata: ToolMetadata = {
    id: 'clock_calendar',
    name: 'clock_calendar',
    title: '时钟日历',
    description: '获取精准的当前服务器实时时间、日期、星期几、时区信息与时间差计算',
    icon: 'clock',
    category: 'system',
    supportsPresetMode: true,
    supportsFunctionCall: true,
    parametersSchema: {
      type: 'object',
      properties: {
        timezone: {
          type: 'string',
          description: '指定时区，默认 Asia/Shanghai，例如: UTC, America/New_York, Europe/London',
        },
      },
      required: [],
    },
  };

  /**
   * 获取当前精准时钟与日历数据
   */
  async execute(args: Record<string, any>): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    const tz = typeof args.timezone === 'string' && args.timezone.trim() ? args.timezone.trim() : 'Asia/Shanghai';

    try {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('zh-CN', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        weekday: 'long',
        hour12: false,
      });

      const formattedString = formatter.format(now);
      const isoString = now.toISOString();
      const timestamp = now.getTime();

      const timeInfo = {
        timezone: tz,
        formatted: formattedString,
        iso: isoString,
        timestamp,
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        date: now.getDate(),
        dayOfWeek: ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][now.getDay()],
      };

      const durationMs = Date.now() - startTime;
      return {
        status: 'success',
        output: timeInfo,
        rawOutput: `当前精准时间: ${formattedString} (${tz})\nISO时间: ${isoString}\n时间戳: ${timestamp}`,
        durationMs,
      };
    } catch (error: any) {
      return {
        status: 'error',
        output: null,
        error: error.message || '时钟日历计算异常',
        durationMs: Date.now() - startTime,
      };
    }
  }
}
