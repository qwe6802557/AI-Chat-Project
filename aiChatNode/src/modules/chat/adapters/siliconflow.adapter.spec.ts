import { ConfigService } from '@nestjs/config';
import { SiliconFlowAdapter } from './siliconflow.adapter';

describe('SiliconFlowAdapter', () => {
  const createConfigService = (values: Record<string, string | undefined>) => {
    return {
      get: jest.fn((key: string) => values[key]),
    } as unknown as ConfigService;
  };

  it('启用配置：当提供 SILICONFLOW_API_KEY 时成功加载适配器', () => {
    const adapter = new SiliconFlowAdapter(
      createConfigService({
        SILICONFLOW_API_KEY: 'test-silicon-key',
        SILICONFLOW_BASE_URL: 'https://api.siliconflow.cn/v1',
      }),
    );

    expect(adapter.isConfigured).toBe(true);
    expect(adapter.providerName).toBe('SiliconFlow');
  });

  it('默认 BaseURL：当未提供 SILICONFLOW_BASE_URL 时使用官方默认地址', () => {
    const adapter = new SiliconFlowAdapter(
      createConfigService({
        SILICONFLOW_API_KEY: 'test-silicon-key',
      }),
    );

    expect(adapter.isConfigured).toBe(true);
  });

  it('优雅降级：缺少 API Key 时适配器标记为未启用且不抛出致命异常', () => {
    const adapter = new SiliconFlowAdapter(
      createConfigService({}),
    );

    expect(adapter.isConfigured).toBe(false);
  });
});
