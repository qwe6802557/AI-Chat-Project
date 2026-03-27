import {
  Injectable,
  BadRequestException,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Dm20151123, * as $Dm20151123 from '@alicloud/dm20151123';
import * as $OpenApi from '@alicloud/openapi-client';
import * as $Dara from '@darabonba/typescript';
import { RedisService } from '../../../common/redis/redis.service';
import {
  getEmailVerificationTemplate,
  getEmailVerificationTextTemplate,
} from '../templates/email-verification.template';

/**
 * 阿里云邮件推送服务
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private dmClient: Dm20151123;
  private enabled = true;

  // 验证码有效期（5分钟）
  private readonly EMAIL_CODE_EXPIRE_SECONDS = 5 * 60;

  // 发送间隔（1分钟）
  private readonly EMAIL_SEND_INTERVAL_SECONDS = 1 * 60;

  private readonly accessKeyId: string;
  private readonly accessKeySecret: string;
  private readonly region: string;
  private readonly fromEmail: string;
  private readonly fromName: string;
  private readonly replyEmail: string;
  private readonly readTimeoutMs: number;
  private readonly connectTimeoutMs: number;
  private readonly maxAttempts: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
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
    this.readTimeoutMs = this.parsePositiveInteger(
      this.configService.get<string>('ALIYUN_DM_READ_TIMEOUT_MS'),
      15000,
    );
    this.connectTimeoutMs = this.parsePositiveInteger(
      this.configService.get<string>('ALIYUN_DM_CONNECT_TIMEOUT_MS'),
      5000,
    );
    this.maxAttempts = this.parsePositiveInteger(
      this.configService.get<string>('ALIYUN_DM_MAX_ATTEMPTS'),
      2,
    );

    if (!this.accessKeyId || !this.accessKeySecret || !this.fromEmail) {
      this.logger.warn('阿里云邮件推送配置缺失，邮件服务已禁用');
      this.logger.warn('如需启用邮件服务，请配置以下环境变量：');
      this.logger.warn('- ALIYUN_ACCESS_KEY_ID');
      this.logger.warn('- ALIYUN_ACCESS_KEY_SECRET');
      this.logger.warn('- ALIYUN_FROM_EMAIL');
      this.enabled = false;
      return;
    }

    this.initializeClient();

    this.logger.log('邮件服务初始化成功');
    this.logger.log(`发信地址: ${this.maskEmail(this.fromEmail)}`);
    this.logger.log(`区域: ${this.region}`);
    this.logger.log(
      `邮件超时配置: connect=${this.connectTimeoutMs}ms, read=${this.readTimeoutMs}ms, attempts=${this.maxAttempts}`,
    );
  }

  private parsePositiveInteger(
    rawValue: string | undefined,
    fallback: number,
  ): number {
    if (!rawValue) {
      return fallback;
    }

    const parsedValue = Number.parseInt(rawValue, 10);
    if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
      return fallback;
    }

    return parsedValue;
  }

  private buildEmailCodeKey(email: string): string {
    return `auth:email:code:${email}`;
  }

  private buildEmailRateLimitKey(email: string): string {
    return `auth:email:rate:${email}`;
  }

  private maskEmail(email: string): string {
    const [localPart, domain] = email.split('@');
    if (!localPart || !domain) {
      return '***';
    }

    if (localPart.length <= 2) {
      return `${localPart[0] || '*'}***@${domain}`;
    }

    return `${localPart.slice(0, 2)}***@${domain}`;
  }

  /**
   * 初始化阿里云 DirectMail 客户端
   */
  private initializeClient(): void {
    try {
      const config = new $OpenApi.Config({
        accessKeyId: this.accessKeyId,
        accessKeySecret: this.accessKeySecret,
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
   */
  async sendEmailCode(
    email: string,
  ): Promise<{ code?: string; message: string }> {
    if (!this.enabled) {
      throw new BadRequestException('邮件服务未配置，无法发送验证码');
    }

    const rateLimitKey = this.buildEmailRateLimitKey(email);
    const codeKey = this.buildEmailCodeKey(email);
    const rateLimitResult = await this.redisService.set(rateLimitKey, '1', {
      NX: true,
      EX: this.EMAIL_SEND_INTERVAL_SECONDS,
    });

    if (!rateLimitResult) {
      const ttl = await this.redisService.ttl(rateLimitKey);
      const remainingSeconds = ttl > 0 ? ttl : this.EMAIL_SEND_INTERVAL_SECONDS;
      throw new BadRequestException(`请${remainingSeconds}秒后再试`);
    }

    try {
      const code = this.generateEmailCode();
      await this.redisService.set(codeKey, code, {
        EX: this.EMAIL_CODE_EXPIRE_SECONDS,
      });
      await this.sendVerificationEmail(email, code);

      this.logger.log(`验证码邮件发送成功: ${this.maskEmail(email)}`);

      const isDevelopment = process.env.NODE_ENV !== 'production';
      return {
        message: '验证码已发送到您的邮箱',
        ...(isDevelopment && { code }),
      };
    } catch (error) {
      await this.redisService.del([codeKey, rateLimitKey]);

      this.logger.error(`验证码邮件发送失败: ${this.maskEmail(email)}`, error);
      throw this.toEmailSendException(error);
    }
  }

  /**
   * 发送验证码邮件
   */
  private async sendVerificationEmail(
    email: string,
    code: string,
  ): Promise<void> {
    const expiresIn = this.EMAIL_CODE_EXPIRE_SECONDS / 60;
    const htmlBody = getEmailVerificationTemplate({ code, expiresIn });
    const textBody = getEmailVerificationTextTemplate({ code, expiresIn });

    const sendMailRequest = new $Dm20151123.SingleSendMailRequest({
      accountName: this.fromEmail,
      addressType: 1,
      replyToAddress: true,
      toAddress: email,
      fromAlias: this.fromName,
      subject: `【ERJCHAT】邮箱验证码`,
      htmlBody,
      textBody,
    });

    try {
      const runtime = new $Dara.RuntimeOptions({
        autoretry: true,
        maxAttempts: this.maxAttempts,
        readTimeout: this.readTimeoutMs,
        connectTimeout: this.connectTimeoutMs,
      });
      const response = await this.dmClient.singleSendMailWithOptions(
        sendMailRequest,
        runtime,
      );

      this.logger.debug(`阿里云API响应: ${JSON.stringify(response.body)}`);

      if (response.statusCode !== 200) {
        throw new Error(`阿里云API返回异常状态码: ${response.statusCode}`);
      }
    } catch (error) {
      this.logger.error('阿里云邮件发送API调用失败', error);
      throw error;
    }
  }

  private toEmailSendException(error: unknown): InternalServerErrorException {
    const errorCode = this.extractAliyunErrorCode(error);
    if (error instanceof Error && error.name === 'RequestTimeoutError') {
      return new InternalServerErrorException(
        `邮件服务请求超时，请稍后重试（connect=${this.connectTimeoutMs}ms, read=${this.readTimeoutMs}ms）`,
      );
    }

    if (errorCode === 'InvalidMailAddress.NotFound') {
      return new InternalServerErrorException(
        '邮件发信地址不存在或未验证，请检查 ALIYUN_FROM_EMAIL 与阿里云邮件推送发信地址配置',
      );
    }

    return new InternalServerErrorException('邮件发送失败，请稍后重试');
  }

  private extractAliyunErrorCode(error: unknown): string | undefined {
    if (typeof error !== 'object' || error === null) {
      return undefined;
    }

    const codeValue: unknown = Reflect.get(error, 'code');
    return typeof codeValue === 'string' ? codeValue : undefined;
  }

  /**
   * 验证邮件验证码
   */
  async verifyEmailCode(email: string, code: string): Promise<boolean> {
    const savedCode = await this.redisService.getDel(
      this.buildEmailCodeKey(email),
    );

    if (!savedCode) {
      this.logger.warn(`验证失败: 验证码不存在 - ${this.maskEmail(email)}`);
      return false;
    }

    const isValid = savedCode === code;

    if (isValid) {
      this.logger.log(`验证码验证成功: ${this.maskEmail(email)}`);
    } else {
      this.logger.warn(
        `验证码验证失败: ${this.maskEmail(email)} (验证码不匹配)`,
      );
    }

    return isValid;
  }

  /**
   * 生成6位随机数字验证码
   */
  private generateEmailCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}
