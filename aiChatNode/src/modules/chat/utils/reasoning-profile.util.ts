import type { AssistantReasoningMode } from './assistant-content.util';

export type ModelReasoningCapability = 'none' | 'summary' | 'raw';
export type ModelReasoningStrategy =
  | 'provider_preferred'
  | 'summary_preferred';
export type ModelReasoningIntegration =
  | 'responses_summary'
  | 'anthropic_blocks'
  | 'inline_tag'
  | 'none';

export interface ModelReasoningProfile {
  capability: ModelReasoningCapability;
  strategy: ModelReasoningStrategy;
  integration: ModelReasoningIntegration;
  modelId: string;
  providerName?: string | null;
  badgeLabel?: string;
}

const RAW_REASONING_MODEL_PATTERNS = [
  /^glm-5$/i,
  /reasoner/i,
  /thinking/i,
];

const SUMMARY_REASONING_MODEL_PATTERNS = [/^gpt-5/i, /^o3/i, /^o4/i];

const matchesAnyPattern = (value: string, patterns: RegExp[]): boolean => {
  return patterns.some((pattern) => pattern.test(value));
};

/**
 * 解析当前项目集成形态下的模型思考能力。
 * 注意：这里描述的是“当前接入方式实际可用的能力”，不是模型理论能力。
 */
export const resolveModelReasoningProfile = (params: {
  providerName?: string | null;
  modelId: string;
}): ModelReasoningProfile => {
  const providerName = params.providerName || null;
  const normalizedProviderName = providerName?.trim().toLowerCase() || '';
  const modelId = params.modelId;

  if (
    normalizedProviderName.includes('openai') ||
    matchesAnyPattern(modelId, SUMMARY_REASONING_MODEL_PATTERNS)
  ) {
    return {
      capability: 'summary',
      strategy: 'summary_preferred',
      integration: 'responses_summary',
      modelId,
      providerName,
      badgeLabel: '支持思考摘要',
    };
  }

  if (normalizedProviderName.includes('zaiwen')) {
    if (matchesAnyPattern(modelId, RAW_REASONING_MODEL_PATTERNS)) {
      return {
        capability: 'raw',
        strategy: 'provider_preferred',
        integration: 'inline_tag',
        modelId,
        providerName,
        badgeLabel: '支持思考过程',
      };
    }

    return {
      capability: 'none',
      strategy: 'summary_preferred',
      integration: 'none',
      modelId,
      providerName,
    };
  }

  if (normalizedProviderName.includes('claude')) {
    return {
      capability: 'none',
      strategy: 'summary_preferred',
      integration: 'none',
      modelId,
      providerName,
    };
  }

  return {
    capability: 'none',
    strategy: 'summary_preferred',
    integration: 'none',
    modelId,
    providerName,
  };
};

export const resolveReasoningPanelTitle = (
  mode: AssistantReasoningMode,
  strategy: ModelReasoningStrategy,
): string => {
  if (mode === 'summary') {
    return '已思考';
  }

  if (mode === 'raw') {
    return strategy === 'summary_preferred' ? '思考摘要' : '思考过程';
  }

  return '已思考';
};
