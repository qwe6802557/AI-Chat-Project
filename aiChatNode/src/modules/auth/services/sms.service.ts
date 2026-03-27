import { Injectable, BadRequestException } from '@nestjs/common';

/**
 * 短信验证码数据接口
 */
interface SmsCodeData {
  code: string; // 验证码
  expiresAt: number; // 过期时间戳
  sentAt: number; // 发送时间戳
}

/**
 * 短信服务（暂时 Mock）
 * TODO: 稍后对接第三方短信平台（如阿里云、腾讯云）
 */
@Injectable()
export class SmsService {
  // 使用 Map 存储短信验证码（生产环境建议使用 Redis）
  private smsCodeStore = new Map<string, SmsCodeData>();

  // 验证码有效期（5分钟）
  private readonly SMS_CODE_EXPIRE_TIME = 5 * 60 * 1000;

  // 发送间隔（1分钟）
  private readonly SMS_SEND_INTERVAL = 1 * 60 * 1000;

  /**
   * 发送短信验证码
   * @param phone 手机号
   * @returns 验证码（仅开发环境返回）
   */
  sendSmsCode(phone: string): { code?: string; message: string } {
    // 检查是否在发送间隔内
    const existingData = this.smsCodeStore.get(phone);
    if (
      existingData &&
      Date.now() - existingData.sentAt < this.SMS_SEND_INTERVAL
    ) {
      const remainingSeconds = Math.ceil(
        (this.SMS_SEND_INTERVAL - (Date.now() - existingData.sentAt)) / 1000,
      );
      throw new BadRequestException(`请${remainingSeconds}秒后再试`);
    }

    // 生成6位随机数字验证码
    const code = this.generateSmsCode();

    // 存储验证码
    this.smsCodeStore.set(phone, {
      code,
      expiresAt: Date.now() + this.SMS_CODE_EXPIRE_TIME,
      sentAt: Date.now(),
    });

    // TODO: 对接第三方短信平台发送验证码
    // 示例：
    // await this.aliyunSmsClient.send({
    //   phone,
    //   templateCode: 'SMS_123456789',
    //   templateParam: { code },
    // });

    const isDevelopment = process.env.NODE_ENV !== 'production';
    if (isDevelopment) {
      console.log(
        `\n📱 [短信验证码] 手机号: ${phone}, 验证码: ${code}, 有效期: 5分钟\n`,
      );
    }

    // 定时清理过期验证码
    this.cleanExpiredSmsCodes();

    // 仅开发环境返回验证码（生产环境不应返回）
    return {
      message: '验证码已发送',
      ...(isDevelopment && { code }), // 仅开发环境返回验证码
    };
  }

  /**
   * 验证短信验证码
   * @param phone 手机号
   * @param code 验证码
   * @returns 是否验证成功
   */
  verifySmsCode(phone: string, code: string): boolean {
    const smsData = this.smsCodeStore.get(phone);

    // 验证码不存在
    if (!smsData) {
      return false;
    }

    // 验证码已过期
    if (Date.now() > smsData.expiresAt) {
      this.smsCodeStore.delete(phone);
      return false;
    }

    // 验证码验证后立即删除（无论成功或失败）
    this.smsCodeStore.delete(phone);

    // 验证码比较
    return smsData.code === code;
  }

  /**
   * 生成6位随机数字验证码
   */
  private generateSmsCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * 清理过期验证码
   */
  private cleanExpiredSmsCodes(): void {
    const now = Date.now();
    for (const [phone, data] of this.smsCodeStore.entries()) {
      if (now > data.expiresAt) {
        this.smsCodeStore.delete(phone);
      }
    }
  }

  /**
   * 获取验证码存储数量（用于调试）
   */
  getSmsCodeCount(): number {
    return this.smsCodeStore.size;
  }
}
