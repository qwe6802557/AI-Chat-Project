import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { randomUUID } from 'crypto';
import type { IToolPlugin, ToolExecutionResult, ToolMetadata } from '../types/tools.types';

@Injectable()
export class CodeInterpreterPlugin implements IToolPlugin {
  private readonly logger = new Logger(CodeInterpreterPlugin.name);
  private readonly timeoutMs = 10000;
  private readonly maxOutputChars = 50000;

  readonly metadata: ToolMetadata = {
    id: 'code_interpreter',
    name: 'code_interpreter',
    title: '代码解释器',
    description: '在安全受限沙箱中运行 Python 或 JavaScript 代码，返回执行输出、计算结果或数据分析日志',
    icon: 'code',
    category: 'data',
    supportsPresetMode: true,
    supportsFunctionCall: true,
    parametersSchema: {
      type: 'object',
      properties: {
        language: {
          type: 'string',
          enum: ['python', 'javascript'],
          description: '执行语言，支持 python 或 javascript',
        },
        code: {
          type: 'string',
          description: '待运行的完整代码脚本',
        },
      },
      required: ['language', 'code'],
    },
  };

  /**
   * 执行沙箱代码
   */
  async execute(args: Record<string, any>): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    const language = (args.language || 'python').toLowerCase();
    const code = typeof args.code === 'string' ? args.code : '';

    if (!code.trim()) {
      return {
        status: 'error',
        output: null,
        error: '执行代码不能为空',
        durationMs: Date.now() - startTime,
      };
    }

    const sandboxDir = path.join(os.tmpdir(), 'aichat_sandbox', randomUUID());
    try {
      fs.mkdirSync(sandboxDir, { recursive: true });
      const filename = language === 'javascript' ? 'script.js' : 'script.py';
      const scriptPath = path.join(sandboxDir, filename);
      fs.writeFileSync(scriptPath, code, 'utf-8');

      const isJs = language === 'javascript';
      const executable = isJs ? process.execPath : (process.platform === 'win32' ? 'python' : 'python3');
      const execArgs = [scriptPath];

      const runResult = await this.runProcess(executable, execArgs, sandboxDir);
      const durationMs = Date.now() - startTime;

      return {
        status: runResult.exitCode === 0 ? 'success' : 'error',
        output: {
          language,
          stdout: runResult.stdout.slice(0, this.maxOutputChars),
          stderr: runResult.stderr.slice(0, this.maxOutputChars),
          exitCode: runResult.exitCode,
        },
        rawOutput: runResult.stdout || runResult.stderr,
        error: runResult.exitCode === 0 ? undefined : (runResult.stderr || `进程异常退出 (code: ${runResult.exitCode})`),
        durationMs,
      };
    } catch (error: any) {
      return {
        status: 'error',
        output: null,
        error: error.message || '代码沙箱运行异常',
        durationMs: Date.now() - startTime,
      };
    } finally {
      try {
        fs.rmSync(sandboxDir, { recursive: true, force: true });
      } catch (e) {
        this.logger.warn(`清理临时沙箱目录失败: ${sandboxDir}`);
      }
    }
  }

  /**
   * 子进程运行与超时控制
   */
  private runProcess(
    executable: string,
    args: string[],
    cwd: string,
  ): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const child = spawn(executable, args, {
        cwd,
        windowsHide: true,
        env: {
          ...process.env,
          PYTHONUNBUFFERED: '1',
          NODE_OPTIONS: '--max-old-space-size=128',
        },
      });

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
      }, this.timeoutMs);

      child.stdout.on('data', (chunk) => {
        if (stdout.length < this.maxOutputChars) {
          stdout += chunk.toString();
        }
      });

      child.stderr.on('data', (chunk) => {
        if (stderr.length < this.maxOutputChars) {
          stderr += chunk.toString();
        }
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        if (timedOut) {
          resolve({
            stdout,
            stderr: stderr + `\n[运行超时] 执行时间超过 ${this.timeoutMs / 1000} 秒，已被终止`,
            exitCode: -1,
          });
        } else {
          resolve({ stdout, stderr, exitCode: code });
        }
      });
    });
  }
}
