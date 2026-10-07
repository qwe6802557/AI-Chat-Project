import { ConfigService } from '@nestjs/config';
import { ZhipuAdapter } from './zhipu.adapter';

describe('ZhipuAdapter', () => {
  const createConfigService = (values: Record<string, string | undefined>) => {
    return {
      get: jest.fn((key: string) => values[key]),
    } as unknown as ConfigService;
  };

  it('启用配置：当提供 ZHIPU_API_KEY 时成功加载适配器', () => {
    const adapter = new ZhipuAdapter(
      createConfigService({
        ZHIPU_API_KEY: 'test-zhipu-key',
        ZHIPU_BASE_URL: 'https://open.bigmodel.cn/api/paas/v4/',
      }),
    );

    expect(adapter.isConfigured).toBe(true);
    expect(adapter.providerName).toBe('Zhipu');
  });

  it('默认 BaseURL：当未提供 ZHIPU_BASE_URL 时使用官方默认地址', () => {
    const adapter = new ZhipuAdapter(
      createConfigService({
        ZHIPU_API_KEY: 'test-zhipu-key',
      }),
    );

    expect(adapter.isConfigured).toBe(true);
  });

  it('优雅降级：缺少 API Key 时适配器标记为未启用且不抛出致命异常', () => {
    const adapter = new ZhipuAdapter(
      createConfigService({}),
    );

    expect(adapter.isConfigured).toBe(false);
  });
});
