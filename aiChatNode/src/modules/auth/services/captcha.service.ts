import { Injectable } from '@nestjs/common';
import * as svgCaptcha from 'svg-captcha';
import { randomUUID } from 'crypto';
import { RedisService } from '../../../common/redis/redis.service';

/**
 * 图片验证码服务
 */
@Injectable()
export class CaptchaService {
  // 验证码有效期（5分钟）
  private readonly CAPTCHA_EXPIRE_SECONDS = 5 * 60;

  constructor(private readonly redisService: RedisService) {}

  private buildCaptchaKey(captchaId: string): string {
    return `auth:captcha:code:${captchaId}`;
  }

  /**
   * 生成图片验证码
   */
  async generateCaptcha(): Promise<{
    captchaId: string;
    captchaImage: string;
  }> {
    const captcha = svgCaptcha.create({
      size: 4,
      noise: 2,
      color: true,
      background: '#f0f0f0',
      width: 100,
      height: 40,
      fontSize: 50,
      charPreset:
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
    });

    const captchaId = randomUUID();
    await this.redisService.set(
      this.buildCaptchaKey(captchaId),
      captcha.text.toLowerCase(),
      { EX: this.CAPTCHA_EXPIRE_SECONDS },
    );

    const captchaImage = `data:image/svg+xml;base64,${Buffer.from(captcha.data).toString('base64')}`;

    return {
      captchaId,
      captchaImage,
    };
  }

  /**
   * 验证图片验证码
   */
  async verifyCaptcha(captchaId: string, code: string): Promise<boolean> {
    const savedCode = await this.redisService.getDel(
      this.buildCaptchaKey(captchaId),
    );
    if (!savedCode) {
      return false;
    }

    return savedCode === code.toLowerCase();
  }
}
