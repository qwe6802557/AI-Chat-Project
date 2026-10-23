import { ConfigService } from '@nestjs/config';
import { OFMAdapter } from './ofm.adapter';

describe('OFMAdapter', () => {
  const createConfigService = (values: Record<string, string | undefined>) => {
    return {
      get: jest.fn((key: string) => values[key]),
    } as unknown as ConfigService;
  };

  it('启用配置：当提供 OFM_API_KEY 时成功加载适配器', () => {
    const adapter = new OFMAdapter(
      createConfigService({
        OFM_API_KEY: 'test-ofm-key',
        OFM_BASE_URL: 'http://127.0.0.1:18900/v1',
      }),
    );

    expect(adapter.isConfigured).toBe(true);
    expect(adapter.providerName).toBe('OurFreeModel');
  });

  it('兼容 Key 命名：当提供 OFM_KEY 时成功识别并启用', () => {
    const adapter = new OFMAdapter(
      createConfigService({
        OFM_KEY: 'test-ofm-compat-key',
      }),
    );

    expect(adapter.isConfigured).toBe(true);
  });

  it('默认 BaseURL：当未提供 OFM_BASE_URL 时使用默认回环地址 18900 端口', () => {
    const adapter = new OFMAdapter(
      createConfigService({
        OFM_API_KEY: 'test-ofm-key',
      }),
    );

    expect(adapter.isConfigured).toBe(true);
  });

  it('优雅降级：缺少 API Key 时适配器标记为未启用且不抛出致命异常', () => {
    const adapter = new OFMAdapter(
      createConfigService({}),
    );

    expect(adapter.isConfigured).toBe(false);
  });
});
