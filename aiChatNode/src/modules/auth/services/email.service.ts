import {
  Injectable,
  BadRequestException,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Dm20151123, * as $Dm20151123 from '@alicloud/dm20151123';
import * as $OpenApi from '@alicloud/openapi-client';
import {
  getEmailVerificationTemplate,
  getEmailVerificationTextTemplate,
} from '../templates/email-verification.template';

/**
 * 邮件验证码数据接口
 */
interface EmailCodeData {
  code: string; // 验证码
  expiresAt: number; // 过期时间戳
  sentAt: number; // 发送时间戳
}

/**
 * 阿里云邮件推送服务
 * @description
 * 完整的错误处理和日志记录
 * 性能优化和资源复用
 * 安全的验证码管理
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private dmClient: Dm20151123;
  private enabled = true; // 服务是否启用

  // 使用Map存储邮件验证码
  private emailCodeStore = new Map<string, EmailCodeData>();

  // 验证码有效期-5分钟
  private readonly EMAIL_CODE_EXPIRE_TIME = 5 * 60 * 1000;

  // 发送间隔-1分钟
  private readonly EMAIL_SEND_INTERVAL = 1 * 60 * 1000;

  // 阿里云配置
  private readonly accessKeyId: string;
  private readonly accessKeySecret: string;
  private readonly region: string;
  private readonly fromEmail: string;
  private readonly fromName: string;
  private readonly replyEmail: string;

  constructor(private readonly configService: ConfigService) {
    // 加载阿里云配置
    this.accessKeyId =
      this.configService.get<string>('ALIYUN_ACCESS_KEY_ID') || '';
    this.accessKeySecret =
      this.configService.get<string>('ALIYUN_ACCESS_KEY_SECRET') || '';
    this.region =
      this.configService.get<string>('ALIYUN_REGION') || 'cn-hangzhou';
    this.fromEmail = this.configService.get<string>('ALIYUN_FROM_EMAIL') || '';
    this.fromName =
      this.configService.get<string>('ALIYUN_FROM_NAME') || 'ERJCHAT';
    this.replyEmail =
      this.configService.get<string>('ALIYUN_REPLY_EMAIL') || '';

    // 校验配置
    if (!this.accessKeyId || !this.accessKeySecret || !this.fromEmail) {
      this.logger.warn('阿里云邮件推送配置缺失，邮件服务已禁用');
      this.logger.warn('如需启用邮件服务，请配置以下环境变量：');
      this.logger.warn('- ALIYUN_ACCESS_KEY_ID');
      this.logger.warn('- ALIYUN_ACCESS_KEY_SECRET');
      this.logger.warn('- ALIYUN_FROM_EMAIL');
      this.enabled = false;
      return;
    }

    // 初始化
    this.initializeClient();

    this.logger.log('邮件服务初始化成功');
    this.logger.log(`发信地址: ${this.fromEmail}`);
    this.logger.log(`区域: ${this.region}`);
  }

  /**
   * 初始化阿里云 DirectMail 客户端
   */
  private initializeClient(): void {
    try {
      const config = new $OpenApi.Config({
        accessKeyId: this.accessKeyId,
        accessKeySecret: this.accessKeySecret,
        // 邮件推送服务-Endpoint (公网访问点)
        endpoint: 'dm.aliyuncs.com',
      });

      this.dmClient = new Dm20151123(config);

      this.logger.log('DirectMail客户端初始化成功');
    } catch (error) {
      this.logger.error('DirectMail客户端初始化失败', error);
      throw new InternalServerErrorException('邮件服务初始化失败');
    }
  }

  /**
   * 发送邮件验证码
   *
   * @param email 邮箱地址
   * @returns 验证码-仅在开发环境返回
   */
  async sendEmailCode(
    email: string,
  ): Promise<{ code?: string; message: string }> {
    // 检查服务是否启用
    if (!this.enabled) {
      throw new BadRequestException('邮件服务未配置，无法发送验证码');
    }

    // 检查是否在间隔内
    const existingData = this.emailCodeStore.get(email);
    if (
      existingData &&
      Date.now() - existingData.sentAt < this.EMAIL_SEND_INTERVAL
    ) {
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

    try {
      // 调用阿里云邮件推送API发送验证码
      await this.sendVerificationEmail(email, code);

      this.logger.log(`验证码邮件发送成功: ${email}`);

      // 定时清理过期验证码
      this.cleanExpiredEmailCodes();

      // 开发环境返回验证码-生产环境不返回
      const isDevelopment = process.env.NODE_ENV !== 'production';
      return {
        message: '验证码已发送到您的邮箱',
        ...(isDevelopment && { code }),
      };
    } catch (error) {
      // 发送失败-删除验证码
      this.emailCodeStore.delete(email);

      this.logger.error(`验证码邮件发送失败: ${email}`, error);

      throw new InternalServerErrorException('邮件发送失败，请稍后重试');
    }
  }

  /**
   * 发送验证码邮件
   * @param email 收件人邮箱
   * @param code 验证码
   */
  private async sendVerificationEmail(
    email: string,
    code: string,
  ): Promise<void> {
    const expiresIn = this.EMAIL_CODE_EXPIRE_TIME / 60 / 1000; // 分钟

    // 生成邮件HTML内容
    const htmlBody = getEmailVerificationTemplate({ code, expiresIn });

    // 生成纯文本内容-备用
    const textBody = getEmailVerificationTextTemplate({ code, expiresIn });

    // 构建邮件发送请求
    const sendMailRequest = new $Dm20151123.SingleSendMailRequest({
      accountName: this.fromEmail, // 发信地址
      addressType: 1, // 0: 随机账号 1: 发信地址
      replyToAddress: true, // 使用管理控制台中配置的回信地址
      toAddress: email, // 收件人地址-单个
      fromAlias: this.fromName, // 发件人名称
      subject: `【ERJCHAT】邮箱验证码`, // 邮件主题
      htmlBody, // HTML邮件正文
      textBody, // 纯文本邮件正文-备用
    });

    try {
      // 调用阿里云API
      const response = await this.dmClient.singleSendMail(sendMailRequest);

      this.logger.debug(`阿里云API响应: ${JSON.stringify(response.body)}`);

      // 检查响应状态
      if (response.statusCode !== 200) {
        throw new Error(`阿里云API返回异常状态码: ${response.statusCode}`);
      }
    } catch (error) {
      this.logger.error('阿里云邮件发送API调用失败', error);
      throw error;
    }
  }

  /**
   * 验证邮件验证码
   *
   * @param email 邮箱地址
   * @param code 验证码
   * @returns 是否验证成功
   */
  verifyEmailCode(email: string, code: string): boolean {
    const emailData = this.emailCodeStore.get(email);

    // 验证码不存在
    if (!emailData) {
      this.logger.warn(`验证失败: 验证码不存在 - ${email}`);
      return false;
    }

    // 验证码已过期
    if (Date.now() > emailData.expiresAt) {
      this.emailCodeStore.delete(email);
      this.logger.warn(`验证失败: 验证码已过期 - ${email}`);
      return false;
    }

    // 验证码验证后立即删除
    this.emailCodeStore.delete(email);

    // 验证码比较
    const isValid = emailData.code === code;

    if (isValid) {
      this.logger.log(`验证码验证成功: ${email}`);
    } else {
      this.logger.warn(`验证码验证失败: ${email} (验证码不匹配)`);
    }

    return isValid;
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
    let cleanedCount = 0;

    for (const [email, data] of this.emailCodeStore.entries()) {
      if (now > data.expiresAt) {
        this.emailCodeStore.delete(email);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug(`🧹 清理过期验证码: ${cleanedCount} 条`);
    }
  }

  /**
   * 获取验证码存储数量
   */
  getEmailCodeCount(): number {
    return this.emailCodeStore.size;
  }
}
