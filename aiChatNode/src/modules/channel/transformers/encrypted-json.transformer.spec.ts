import { EncryptedJsonTransformer } from './encrypted-json.transformer';

describe('EncryptedJsonTransformer', () => {
  const transformer = new EncryptedJsonTransformer();

  it('正确加密与解密凭据对象', () => {
    const raw = {
      appId: '10203040',
      appSecret: 'test-secret-key-12345',
      token: 'bearer-token-abc',
    };

    const encrypted = transformer.to(raw) as any;
    expect(encrypted).toBeDefined();
    expect(encrypted._enc).toBe('aes-256-gcm');
    expect(encrypted.iv).toHaveLength(24);
    expect(encrypted.tag).toHaveLength(32);
    expect(encrypted.data).toBeDefined();

    const decrypted = transformer.from(encrypted);
    expect(decrypted).toEqual(raw);
  });

  it('平滑兼容历史未加密的明文对象', () => {
    const legacyPlain = {
      appId: 'legacy-app-id',
      appSecret: 'legacy-secret',
    };

    const result = transformer.from(legacyPlain);
    expect(result).toEqual(legacyPlain);
  });

  it('空对象与空输入安全处理', () => {
    expect(transformer.to({})).toEqual({});
    expect(transformer.to(null)).toBeNull();
    expect(transformer.from(null)).toEqual({});
    expect(transformer.from({})).toEqual({});
  });
});
