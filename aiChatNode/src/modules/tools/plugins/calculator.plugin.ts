import { Injectable } from '@nestjs/common';
import type { IToolPlugin, ToolExecutionResult, ToolMetadata } from '../types/tools.types';

@Injectable()
export class CalculatorPlugin implements IToolPlugin {
  readonly metadata: ToolMetadata = {
    id: 'calculator',
    name: 'calculator',
    title: '数学计算器',
    description: '执行高精度算术表达式、代数、对数、三角函数及统计学公式精确计算',
    icon: 'calculator',
    category: 'utility',
    supportsPresetMode: true,
    supportsFunctionCall: true,
    parametersSchema: {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description: '数学计算表达式，例如: (128 * 45) + sqrt(144) 或 2^10',
        },
      },
      required: ['expression'],
    },
  };

  /**
   * 安全执行数学表达式求值
   */
  async execute(args: Record<string, any>): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    const expression = typeof args.expression === 'string' ? args.expression.trim() : '';

    if (!expression) {
      return {
        status: 'error',
        output: null,
        error: '计算表达式不能为空',
        durationMs: Date.now() - startTime,
      };
    }

    try {
      const sanitized = expression
        .replace(/\^/g, '**')
        .replace(/\bsqrt\b/gi, 'Math.sqrt')
        .replace(/\bsin\b/gi, 'Math.sin')
        .replace(/\bcos\b/gi, 'Math.cos')
        .replace(/\btan\b/gi, 'Math.tan')
        .replace(/\blog\b/gi, 'Math.log')
        .replace(/\babs\b/gi, 'Math.abs')
        .replace(/\bround\b/gi, 'Math.round')
        .replace(/\bfloor\b/gi, 'Math.floor')
        .replace(/\bceil\b/gi, 'Math.ceil')
        .replace(/\bpi\b/gi, 'Math.PI')
        .replace(/\be\b/gi, 'Math.E');

      // 安全校验：只允许数字、常见数学标识符与符号
      if (!/^[\d\s+\-*/%(),.MathsincotaqlbfrdegpijE_**]+$/.test(sanitized)) {
        throw new Error('表达式包含非法字符或潜在不安全符号');
      }

      // 在闭包中执行纯数学求值
      const fn = new Function(`"use strict"; return (${sanitized});`);
      const result = fn();

      if (typeof result !== 'number' || Number.isNaN(result)) {
        throw new Error('计算结果非有效数值');
      }

      const durationMs = Date.now() - startTime;
      return {
        status: 'success',
        output: {
          expression,
          result,
          formatted: Number.isInteger(result) ? result.toString() : result.toFixed(6).replace(/\.?0+$/, ''),
        },
        rawOutput: `${expression} = ${result}`,
        durationMs,
      };
    } catch (error: any) {
      return {
        status: 'error',
        output: null,
        error: error.message || '数学表达式计算失败',
        durationMs: Date.now() - startTime,
      };
    }
  }
}
