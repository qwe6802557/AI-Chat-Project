/**
 * 工具插件类型定义
 */

export interface ToolMetadata {
  id: string;
  name: string;
  title: string;
  description: string;
  icon: string;
  category: 'system' | 'data' | 'utility' | 'network';
  supportsPresetMode: boolean;
  supportsFunctionCall: boolean;
  parametersSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface ToolExecutionResult {
  status: 'success' | 'error';
  output: any;
  durationMs: number;
  error?: string;
  rawOutput?: string;
}

export interface ToolExecutionContext {
  userId?: string;
  sessionId?: string;
  userMessage?: string;
}

export interface IToolPlugin {
  readonly metadata: ToolMetadata;
  execute(args: Record<string, any>, context?: ToolExecutionContext): Promise<ToolExecutionResult>;
}

export interface ToolExecutionRecord {
  id: string;
  name: string;
  title: string;
  callType: 'user_preset' | 'model_function_call';
  args: Record<string, any>;
  result: ToolExecutionResult;
  createdAt: string;
}
