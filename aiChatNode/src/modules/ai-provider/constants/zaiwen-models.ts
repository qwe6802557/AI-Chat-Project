export interface ZaiwenChatModelSeed {
  modelId: string;
  inputMultiplier: number;
  outputMultiplier: number;
}

export const DEFAULT_ZAIWEN_CHAT_MODEL = 'GLM-5';

export const ZAIWEN_CHAT_MODEL_SEEDS: ZaiwenChatModelSeed[] = [
  { modelId: 'Claude-Opus-4', inputMultiplier: 6.25, outputMultiplier: 25 },
  { modelId: 'Claude-Opus-4.1', inputMultiplier: 6.25, outputMultiplier: 25 },
  { modelId: 'Claude-Opus-4.5', inputMultiplier: 2.08, outputMultiplier: 8.32 },
  { modelId: 'Claude-Sonnet-4.5', inputMultiplier: 1.25, outputMultiplier: 5 },
  { modelId: 'Claude-Sonnet-4.6', inputMultiplier: 6.25, outputMultiplier: 25 },
  { modelId: 'DeepSeek-V3.1', inputMultiplier: 0.5, outputMultiplier: 2 },
  { modelId: 'DeepSeek-V3.2', inputMultiplier: 0.125, outputMultiplier: 0.5 },
  { modelId: 'GLM-4.7', inputMultiplier: 0.585, outputMultiplier: 2.34 },
  { modelId: 'GLM-5', inputMultiplier: 0.915, outputMultiplier: 3.66 },
  { modelId: 'GPT-5.1', inputMultiplier: 0.415, outputMultiplier: 1.66 },
  { modelId: 'GPT-5.1-Codex', inputMultiplier: 0.415, outputMultiplier: 1.66 },
  { modelId: 'GPT-5.2-Pro', inputMultiplier: 42, outputMultiplier: 168 },
  { modelId: 'GPT-5.3-Codex', inputMultiplier: 0.585, outputMultiplier: 2.34 },
  { modelId: 'GPT-5.4', inputMultiplier: 2.5, outputMultiplier: 10 },
  { modelId: 'GPT-5.4-mini', inputMultiplier: 0.255, outputMultiplier: 1.02 },
  { modelId: 'GPT-5.4-nano', inputMultiplier: 0.045, outputMultiplier: 0.18 },
  { modelId: 'GPT-OSS-120B', inputMultiplier: 0.065, outputMultiplier: 0.26 },
  {
    modelId: 'Gemini-3.0-Flash',
    inputMultiplier: 0.125,
    outputMultiplier: 0.5,
  },
  {
    modelId: 'Gemini-3.1-Flash-Lite',
    inputMultiplier: 0.085,
    outputMultiplier: 0.34,
  },
  { modelId: 'Gemini-3.1-Pro', inputMultiplier: 0.5, outputMultiplier: 2 },
  {
    modelId: 'Grok-4-Fast-Reasoning',
    inputMultiplier: 0.035,
    outputMultiplier: 0.14,
  },
  {
    modelId: 'Grok-4.1-Fast-Non-Reasoning',
    inputMultiplier: 0.15,
    outputMultiplier: 0.6,
  },
  {
    modelId: 'Grok-4.1-Fast-Reasoning',
    inputMultiplier: 0.15,
    outputMultiplier: 0.6,
  },
  {
    modelId: 'Grok-4.20-Multi-Agent',
    inputMultiplier: 3,
    outputMultiplier: 12,
  },
  {
    modelId: 'Kimi-K2-Thinking',
    inputMultiplier: 0.465,
    outputMultiplier: 1.86,
  },
  {
    modelId: 'Nano-Banana-Pro',
    inputMultiplier: 61111,
    outputMultiplier: 244444,
  },
  {
    modelId: 'Nano-Banana-Pro-2k',
    inputMultiplier: 121111,
    outputMultiplier: 484444,
  },
  {
    modelId: 'Nano-Banana-Pro-4k',
    inputMultiplier: 241111,
    outputMultiplier: 964444,
  },
  { modelId: 'Qwen-3-Max', inputMultiplier: 0.73, outputMultiplier: 2.92 },
  {
    modelId: 'claude-haiku-4.5',
    inputMultiplier: 0.21,
    outputMultiplier: 0.84,
  },
  { modelId: 'claude-opus-4-6', inputMultiplier: 2.08, outputMultiplier: 8.32 },
  {
    modelId: 'claude-sonnet-4-reasoner',
    inputMultiplier: 1.25,
    outputMultiplier: 5,
  },
  {
    modelId: 'deepseek-reasoner',
    inputMultiplier: 0.465,
    outputMultiplier: 1.86,
  },
  { modelId: 'deepseekv3', inputMultiplier: 0.47, outputMultiplier: 1.88 },
  {
    modelId: 'gemini_2_5_flash',
    inputMultiplier: 0.105,
    outputMultiplier: 0.42,
  },
  { modelId: 'gemini_2_5_pro', inputMultiplier: 0.415, outputMultiplier: 1.66 },
  { modelId: 'gpt-4o', inputMultiplier: 0.415, outputMultiplier: 1.66 },
  { modelId: 'gpt-4o-mini', inputMultiplier: 0.025, outputMultiplier: 0.1 },
  { modelId: 'gpt-5-codex', inputMultiplier: 0.415, outputMultiplier: 1.66 },
  { modelId: 'gpt-5-nano', inputMultiplier: 0.015, outputMultiplier: 0.06 },
  { modelId: 'gpt-5-pro', inputMultiplier: 15, outputMultiplier: 60 },
  {
    modelId: 'gpt-5.2-chat-latest',
    inputMultiplier: 1.75,
    outputMultiplier: 7,
  },
  { modelId: 'gpt4_1', inputMultiplier: 0.165, outputMultiplier: 0.66 },
  { modelId: 'gpt_o4_mini', inputMultiplier: 0.025, outputMultiplier: 0.1 },
  { modelId: 'kimi-k2.5', inputMultiplier: 0.615, outputMultiplier: 2.46 },
  { modelId: 'minimax-m2.7', inputMultiplier: 0.24, outputMultiplier: 0.96 },
  { modelId: 'o3', inputMultiplier: 0.335, outputMultiplier: 1.34 },
  { modelId: 'qwen3.5-plus', inputMultiplier: 0.14, outputMultiplier: 0.56 },
];
