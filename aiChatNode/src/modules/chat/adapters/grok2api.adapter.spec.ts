import { ConfigService } from '@nestjs/config';
import { Grok2APIAdapter } from './grok2api.adapter';

describe('Grok2APIAdapter', () => {
  const createConfigService = (values: Record<string, string | undefined>) => {
    return {
      get: jest.fn((key: string) => values[key]),
    } as unknown as ConfigService;
  };

  it('uses the standard API key configuration', () => {
    const adapter = new Grok2APIAdapter(
      createConfigService({
        GROK2API_API_KEY: 'test-key',
        GROK2API_BASE_URL: 'http://127.0.0.1:18000/v1',
      }),
    );

    expect(adapter.isConfigured).toBe(true);
  });

  it('supports the existing GROK2API_KEY configuration', () => {
    const adapter = new Grok2APIAdapter(
      createConfigService({
        GROK2API_KEY: 'legacy-test-key',
        GROK2API_BASE_URL: 'http://127.0.0.1:18000/v1',
      }),
    );

    expect(adapter.isConfigured).toBe(true);
  });

  it('stays disabled without a base URL', () => {
    const adapter = new Grok2APIAdapter(
      createConfigService({ GROK2API_KEY: 'legacy-test-key' }),
    );

    expect(adapter.isConfigured).toBe(false);
  });
});
