import {
  resolveEffectiveSupportsVision,
  resolveModelVisionProfile,
} from './vision-profile.util';

describe('vision-profile.util', () => {
  it('将 Gemini 对话模型判定为支持视觉', () => {
    expect(
      resolveModelVisionProfile({
        providerName: 'Gemini',
        modelId: 'gemini-3.8-flash-medium',
        category: 'chat',
      }),
    ).toEqual({ capability: 'supported' });
  });

  it('精确区分智谱视觉模型与纯文本模型', () => {
    expect(
      resolveModelVisionProfile({
        providerName: 'Zhipu',
        modelId: 'glm-4v-flash',
        category: 'chat',
      }),
    ).toEqual({ capability: 'supported' });

    expect(
      resolveModelVisionProfile({
        providerName: 'Zhipu',
        modelId: 'glm-4-flash',
        category: 'chat',
      }),
    ).toMatchObject({ capability: 'unsupported' });
  });

  it('精确区分硅基流动 VL 模型与纯文本/推理模型', () => {
    expect(
      resolveModelVisionProfile({
        providerName: 'SiliconFlow',
        modelId: 'Qwen/Qwen2.5-VL-72B-Instruct',
        category: 'chat',
      }),
    ).toEqual({ capability: 'supported' });

    expect(
      resolveModelVisionProfile({
        providerName: 'SiliconFlow',
        modelId: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-7B',
        category: 'chat',
      }),
    ).toMatchObject({ capability: 'unsupported' });

    expect(
      resolveModelVisionProfile({
        providerName: 'SiliconFlow',
        modelId: 'Qwen/Qwen2.5-Coder-7B-Instruct',
        category: 'chat',
      }),
    ).toMatchObject({ capability: 'unsupported' });
  });

  it('将讯飞星火、Grok2API 与纯文本 OFM 模型判定为不支持视觉', () => {
    expect(
      resolveModelVisionProfile({
        providerName: 'iFLYTEK',
        modelId: 'spark-x2.6-4b',
        category: 'chat',
      }).capability,
    ).toBe('unsupported');

    expect(
      resolveModelVisionProfile({
        providerName: 'Grok2API',
        modelId: 'grok-chat-fast',
        category: 'chat',
      }).capability,
    ).toBe('unsupported');

    expect(
      resolveModelVisionProfile({
        providerName: 'OurFreeModel',
        modelId: 'deepseek-ai/DeepSeek-V4.1-Flash',
        category: 'chat',
      }).capability,
    ).toBe('unsupported');
  });

  it('将非对话类模型（image/video/voice）统一判定为不支持视觉对话', () => {
    for (const category of ['image', 'video', 'voice'] as const) {
      expect(
        resolveModelVisionProfile({
          providerName: 'Gemini',
          modelId: 'gemini-3.8-flash-medium',
          category,
        }).capability,
      ).toBe('unsupported');
    }
  });

  it('resolveEffectiveSupportsVision 同时受客观能力与后台开关门控', () => {
    expect(
      resolveEffectiveSupportsVision({
        providerName: 'iFLYTEK',
        modelId: 'spark-x2.6-4b',
        category: 'chat',
        supportsVision: true,
      }),
    ).toBe(false);

    expect(
      resolveEffectiveSupportsVision({
        providerName: 'Zhipu',
        modelId: 'glm-4v-flash',
        category: 'chat',
        supportsVision: true,
      }),
    ).toBe(true);

    expect(
      resolveEffectiveSupportsVision({
        providerName: 'Zhipu',
        modelId: 'glm-4v-flash',
        category: 'chat',
        supportsVision: false,
      }),
    ).toBe(false);
  });
});
