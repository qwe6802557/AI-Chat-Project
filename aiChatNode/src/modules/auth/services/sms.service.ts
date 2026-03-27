import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { RedisService } from '../../../common/redis/redis.service';

/**
 * 短信服务（暂时 Mock）
 * TODO: 稍后对接第三方短信平台（如阿里云、腾讯云）
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  // 验证码有效期（5分钟）
  private readonly SMS_CODE_EXPIRE_SECONDS = 5 * 60;

  // 发送间隔（1分钟）
  private readonly SMS_SEND_INTERVAL_SECONDS = 1 * 60;

  constructor(private readonly redisService: RedisService) {}

  private buildSmsCodeKey(phone: string): string {
    return `auth:sms:code:${phone}`;
  }

  private buildSmsRateLimitKey(phone: string): string {
    return `auth:sms:rate:${phone}`;
  }

  private maskPhone(phone: string): string {
    if (phone.length < 7) {
      return '***';
    }

    return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
  }

  /**
   * 发送短信验证码
   * @param phone 手机号
   * @returns 验证码（仅开发环境返回）
   */
  async sendSmsCode(
    phone: string,
  ): Promise<{ code?: string; message: string }> {
    const rateLimitKey = this.buildSmsRateLimitKey(phone);
    const codeKey = this.buildSmsCodeKey(phone);

    const rateLimitResult = await this.redisService.set(rateLimitKey, '1', {
      NX: true,
      EX: this.SMS_SEND_INTERVAL_SECONDS,
    });

    if (!rateLimitResult) {
      const ttl = await this.redisService.ttl(rateLimitKey);
      const remainingSeconds = ttl > 0 ? ttl : this.SMS_SEND_INTERVAL_SECONDS;
      throw new BadRequestException(`请${remainingSeconds}秒后再试`);
    }

    const code = this.generateSmsCode();

    try {
      await this.redisService.set(codeKey, code, {
        EX: this.SMS_CODE_EXPIRE_SECONDS,
      });
    } catch (error) {
      await this.redisService.del([rateLimitKey, codeKey]);
      throw error;
    }

    // TODO: 对接第三方短信平台发送验证码

    const isDevelopment = process.env.NODE_ENV !== 'production';
    this.logger.debug(`短信验证码已生成: phone=${this.maskPhone(phone)}`);

    return {
      message: '验证码已发送',
      ...(isDevelopment && { code }),
    };
  }

  /**
   * 验证短信验证码
   * @param phone 手机号
   * @param code 验证码
   * @returns 是否验证成功
   */
  async verifySmsCode(phone: string, code: string): Promise<boolean> {
    const savedCode = await this.redisService.getDel(
      this.buildSmsCodeKey(phone),
    );
    if (!savedCode) {
      return false;
    }

    return savedCode === code;
  }

  /**
   * 生成6位随机数字验证码
   */
  private generateSmsCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}
