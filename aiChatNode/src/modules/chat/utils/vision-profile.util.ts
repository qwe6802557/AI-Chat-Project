export type ModelVisionCapability = 'supported' | 'unsupported';

/**
 * 模型视觉理解能力画像
 */
export interface ModelVisionProfile {
  capability: ModelVisionCapability;
  reason?: string;
}

const MULTIMODAL_ID_FALLBACK_PATTERN =
  /^gemini-|^glm-4(\.\d+)?v|^claude-[34]|^(gpt-(4o|4\.1|4\.5|4-turbo|4-vision|5)|o[134])|(^|[/-])vl([/-]|$)|vision|multimodal/i;

const PROVIDER_VISION_RULES: Array<{
  matchesProvider: (normalizedProvider: string) => boolean;
  matchesModel: (modelId: string) => boolean;
  unsupportedReason: string;
}> = [
  {
    matchesProvider: (p) => p.includes('gemini') || p.includes('google'),
    matchesModel: (id) => /^gemini-/i.test(id),
    unsupportedReason: '当前模型并非多模态 Gemini 对话版本，不支持图像输入',
  },
  {
    matchesProvider: (p) => p.includes('zhipu') || p.includes('智谱'),
    matchesModel: (id) => /^glm-4(\.\d+)?v/i.test(id),
    unsupportedReason: '该智谱纯文本模型不支持视觉图像输入',
  },
  {
    matchesProvider: (p) =>
      p.includes('siliconflow') ||
      p.includes('silicon') ||
      p.includes('硅基流动'),
    matchesModel: (id) =>
      /(^|[/-])vl([/-]|$)|vision|qwen2\.5-vl|qwen3-vl|glm-4v/i.test(id),
    unsupportedReason: '该硅基流动文本/推理模型不支持视觉图像输入',
  },
  {
    matchesProvider: (p) =>
      p.includes('xfyun') ||
      p.includes('iflytek') ||
      p.includes('科大讯飞') ||
      p.includes('讯飞'),
    matchesModel: () => false,
    unsupportedReason: '讯飞星火当前为纯文本语言通道，不支持视觉图像输入',
  },
  {
    matchesProvider: (p) => p.includes('grok2api') || p.includes('grok'),
    matchesModel: () => false,
    unsupportedReason: 'Grok2API 当前接入为纯文本对话通道，不支持视觉图像输入',
  },
  {
    matchesProvider: (p) =>
      p.includes('ourfreemodel') || p.includes('ofm') || p.includes('dsh'),
    matchesModel: (id) =>
      /(^|[/-])vl([/-]|$)|vision|gemini|gpt-4o|gpt-5|claude-[34]/i.test(id),
    unsupportedReason: '当前免费聚合通道纯文本模型不支持视觉图像输入',
  },
  {
    matchesProvider: (p) => p.includes('claude') || p.includes('anthropic'),
    matchesModel: (id) => /^claude-(3|4)/i.test(id),
    unsupportedReason: '当前 Claude 模型版本不支持视觉图像输入',
  },
  {
    matchesProvider: (p) => p.includes('openai'),
    matchesModel: (id) =>
      /^(gpt-(4o|4\.1|4\.5|4-turbo|4-vision|5)|o[134])/i.test(id),
    unsupportedReason: '该 OpenAI 纯文本模型不支持视觉图像输入',
  },
  {
    matchesProvider: (p) => p.includes('zaiwen') || p.includes('在问'),
    matchesModel: (id) => MULTIMODAL_ID_FALLBACK_PATTERN.test(id),
    unsupportedReason: '当前在问文本模型不支持视觉图像输入',
  },
];

/**
 * 解析当前项目接入形态下模型客观是否支持视觉图像输入
 */
export const resolveModelVisionProfile = (params: {
  providerName?: string | null;
  modelId: string;
  category?: string | null;
}): ModelVisionProfile => {
  const category = params.category || 'chat';
  if (category !== 'chat') {
    return {
      capability: 'unsupported',
      reason: '非对话补全类模型不支持多模态看图对话',
    };
  }

  const normalizedProvider = params.providerName?.trim().toLowerCase() || '';
  const modelId = params.modelId.trim();

  if (normalizedProvider) {
    const matchedRule = PROVIDER_VISION_RULES.find((rule) =>
      rule.matchesProvider(normalizedProvider),
    );
    if (matchedRule) {
      return matchedRule.matchesModel(modelId)
        ? { capability: 'supported' }
        : { capability: 'unsupported', reason: matchedRule.unsupportedReason };
    }
  }

  return MULTIMODAL_ID_FALLBACK_PATTERN.test(modelId)
    ? { capability: 'supported' }
    : {
        capability: 'unsupported',
        reason: '当前模型为纯文本语言模型，不支持视觉图像输入',
      };
};

/**
 * 结合客观视觉能力与后台手动开关，得出模型运行时实际可用的视觉权限
 */
export const resolveEffectiveSupportsVision = (params: {
  providerName?: string | null;
  modelId: string;
  category?: string | null;
  supportsVision?: boolean | null;
}): boolean => {
  return (
    Boolean(params.supportsVision) &&
    resolveModelVisionProfile(params).capability === 'supported'
  );
};
