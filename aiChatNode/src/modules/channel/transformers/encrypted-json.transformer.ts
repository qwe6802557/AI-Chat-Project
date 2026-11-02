import { ValueTransformer } from 'typeorm';
import * as crypto from 'crypto';

/**
 * 敏感凭据对称加解密转换器 (AES-256-GCM)
 * 落盘时自动加密为 { _enc: 'aes-256-gcm', iv, tag, data }，出库时自动解密并平滑兼容历史明文
 */
export class EncryptedJsonTransformer implements ValueTransformer {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor() {
    const rawSecret =
      process.env.CHANNEL_ENCRYPTION_KEY ||
      process.env.JWT_SECRET ||
      'aichat-channel-secret-salt-2026';
    this.key = crypto.scryptSync(rawSecret, 'aichat-channel-salt', 32);
  }

  /**
   * 写入数据库前加密
   */
  to(value: Record<string, any> | null | undefined): Record<string, any> | null {
    if (!value || typeof value !== 'object') {
      return value ?? null;
    }

    if (value._enc === this.algorithm) {
      return value;
    }

    if (Object.keys(value).length === 0) {
      return {};
    }

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    const jsonStr = JSON.stringify(value);
    const encrypted = Buffer.concat([cipher.update(jsonStr, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return {
      _enc: this.algorithm,
      iv: iv.toString('hex'),
      tag: authTag.toString('hex'),
      data: encrypted.toString('hex'),
    };
  }

  /**
   * 从数据库读取后解密，兼容历史明文对象
   */
  from(value: any): Record<string, any> {
    if (!value || typeof value !== 'object') {
      return {};
    }

    if (value._enc !== this.algorithm) {
      return value;
    }

    try {
      const iv = Buffer.from(value.iv, 'hex');
      const authTag = Buffer.from(value.tag, 'hex');
      const encrypted = Buffer.from(value.data, 'hex');

      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      decipher.setAuthTag(authTag);
      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

      return JSON.parse(decrypted.toString('utf8'));
    } catch {
      return {};
    }
  }
}
