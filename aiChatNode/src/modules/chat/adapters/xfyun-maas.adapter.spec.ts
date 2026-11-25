import { ConfigService } from '@nestjs/config';
import { XfyunMaaSAdapter } from './xfyun-maas.adapter';

describe('XfyunMaaSAdapter', () => {
  const createConfigService = (values: Record<string, string | undefined>) => {
    return {
      get: jest.fn((key: string) => values[key]),
    } as unknown as ConfigService;
  };

  it('未配置 XFYUN_MAAS_API_KEY 时保持未启用状态（不使用硬编码默认 Key）', () => {
    const adapter = new XfyunMaaSAdapter(createConfigService({}));

    expect(adapter.isConfigured).toBe(false);
    expect(adapter.providerName).toBe('iFLYTEK');
  });

  it('配置 XFYUN_MAAS_API_KEY 时成功加载适配器', () => {
    const adapter = new XfyunMaaSAdapter(
      createConfigService({
        XFYUN_MAAS_API_KEY: 'ak-test-key',
      }),
    );

    expect(adapter.isConfigured).toBe(true);
  });

  it('healthCheck 默认探测 spark-x2.6-4b 并支持环境变量覆盖探测模型', async () => {
    const adapter = new XfyunMaaSAdapter(
      createConfigService({
        XFYUN_MAAS_API_KEY: 'ak-test-key',
        XFYUN_MAAS_HEALTHCHECK_MODEL: 'spark-x2.6',
      }),
    );
    const defaultAdapter = new XfyunMaaSAdapter(
      createConfigService({
        XFYUN_MAAS_API_KEY: 'ak-test-key',
      }),
    );

    const customCreateMock = jest.fn().mockResolvedValue({ model: 'spark-x2.6' });
    const defaultCreateMock = jest.fn().mockResolvedValue({ model: 'spark-x2.6-4b' });

    (adapter as unknown as { client: { chat: { completions: { create: jest.Mock } } } }).client = {
      chat: { completions: { create: customCreateMock } },
    };
    (
      defaultAdapter as unknown as {
        client: { chat: { completions: { create: jest.Mock } } };
      }
    ).client = {
      chat: { completions: { create: defaultCreateMock } },
    };

    const defaultRes = await defaultAdapter.healthCheck();
    expect(defaultCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'spark-x2.6-4b' }),
      expect.any(Object),
    );
    expect(defaultRes.sampleModelId).toBe('spark-x2.6-4b');

    const customRes = await adapter.healthCheck();
    expect(customCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'spark-x2.6' }),
      expect.any(Object),
    );
    expect(customRes.sampleModelId).toBe('spark-x2.6');
  });

  it('上游返回 403 授权/额度异常时保留 status=403 并转换为中文提示', async () => {
    const adapter = new XfyunMaaSAdapter(
      createConfigService({
        XFYUN_MAAS_API_KEY: 'ak-test-key',
      }),
    );

    const apiError = Object.assign(
      new Error(
        '403 no valid authorization: the account lacks an active order, has insufficient quota, or the order is invalid',
      ),
      { status: 403 },
    );

    (adapter as unknown as { client: { chat: { completions: { create: jest.Mock } } } }).client = {
      chat: { completions: { create: jest.fn().mockRejectedValue(apiError) } },
    };

    await expect(
      adapter.createChatCompletion([{ role: 'user', content: 'hi' }], 'spark-x2.6'),
    ).rejects.toMatchObject({
      status: 403,
      message: expect.stringContaining('科大讯飞星辰 MaaS 授权失败（403）'),
    });
  });
});
