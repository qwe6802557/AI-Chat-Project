/**
 * 前端插件工具中心类型定义
 */

export interface ToolMetadata {
  id: string
  name: string
  title: string
  description: string
  icon: string
  category: 'system' | 'data' | 'utility' | 'network'
  supportsPresetMode: boolean
  supportsFunctionCall: boolean
  parametersSchema?: Record<string, any>
}

export interface ToolExecutionResult {
  status: 'success' | 'error'
  output: any
  durationMs: number
  error?: string
  rawOutput?: string
}

export interface ToolExecutionRecord {
  id: string
  name: string
  title: string
  callType: 'user_preset' | 'model_function_call'
  args: Record<string, any>
  result: ToolExecutionResult
  createdAt: string
}
