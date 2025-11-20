import { Injectable, BadRequestException } from '@nestjs/common';

/**
 * 邮件验证码数据接口
 */
interface EmailCodeData {
  code: string; // 验证码
  expiresAt: number; // 过期时间戳
  sentAt: number; // 发送时间戳
}

/**
 * 邮件服务
 * TODO: 稍后对接邮件服务提供商（如 Nodemailer + SMTP）
 */
@Injectable()
export class EmailService {
  // 使用 Map 存储邮件验证码（生产环境建议使用 Redis）
  private emailCodeStore = new Map<string, EmailCodeData>();

  // 验证码有效期（5分钟）
  private readonly EMAIL_CODE_EXPIRE_TIME = 5 * 60 * 1000;

  // 发送间隔（1分钟）
  private readonly EMAIL_SEND_INTERVAL = 1 * 60 * 1000;

  /**
   * 发送邮件验证码
   * @param email 邮箱地址
   * @returns 验证码（仅开发环境返回）
   */
  async sendEmailCode(email: string): Promise<{ code?: string; message: string }> {
    // 检查是否在发送间隔内
    const existingData = this.emailCodeStore.get(email);
    if (existingData && Date.now() - existingData.sentAt < this.EMAIL_SEND_INTERVAL) {
      const remainingSeconds = Math.ceil(
        (this.EMAIL_SEND_INTERVAL - (Date.now() - existingData.sentAt)) / 1000,
      );
      throw new BadRequestException(`请${remainingSeconds}秒后再试`);
    }

    // 生成6位随机数字验证码
    const code = this.generateEmailCode();

    // 存储验证码
    this.emailCodeStore.set(email, {
      code,
      expiresAt: Date.now() + this.EMAIL_CODE_EXPIRE_TIME,
      sentAt: Date.now(),
    });

    // TODO: 对接邮件服务提供商发送验证码
    // 示例（使用 Nodemailer）：
    // await this.mailerService.sendMail({
    //   to: email,
    //   subject: 'AI Chat - 验证码',
    //   html: `
    //     <h1>您的验证码</h1>
    //     <p>验证码：<strong>${code}</strong></p>
    //     <p>有效期：5分钟</p>
    //   `,
    // });

    // 暂时打印到控制台（仅开发环境）
    console.log(`\n📧 [邮件验证码] 邮箱: ${email}, 验证码: ${code}, 有效期: 5分钟\n`);

    // 定时清理过期验证码
    this.cleanExpiredEmailCodes();

    // 仅开发环境返回验证码（生产环境不应返回）
    const isDevelopment = process.env.NODE_ENV !== 'production';
    return {
      message: '验证码已发送到您的邮箱',
      ...(isDevelopment && { code }), // 仅开发环境返回验证码
    };
  }

  /**
   * 验证邮件验证码
   * @param email 邮箱地址
   * @param code 验证码
   * @returns 是否验证成功
   */
  verifyEmailCode(email: string, code: string): boolean {
    const emailData = this.emailCodeStore.get(email);

    // 验证码不存在
    if (!emailData) {
      return false;
    }

    // 验证码已过期
    if (Date.now() > emailData.expiresAt) {
      this.emailCodeStore.delete(email);
      return false;
    }

    // 验证码验证后立即删除（无论成功或失败）
    this.emailCodeStore.delete(email);

    // 验证码比较
    return emailData.code === code;
  }

  /**
   * 生成6位随机数字验证码
   */
  private generateEmailCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * 清理过期验证码
   */
  private cleanExpiredEmailCodes(): void {
    const now = Date.now();
    for (const [email, data] of this.emailCodeStore.entries()) {
      if (now > data.expiresAt) {
        this.emailCodeStore.delete(email);
      }
    }
  }

  /**
   * 获取验证码存储数量（用于调试）
   */
  getEmailCodeCount(): number {
    return this.emailCodeStore.size;
  }
}
