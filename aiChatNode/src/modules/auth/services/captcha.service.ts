import { Injectable } from '@nestjs/common';
import * as svgCaptcha from 'svg-captcha';
import { v4 as uuidv4 } from 'uuid';

/**
 * 验证码数据接口
 */
interface CaptchaData {
  code: string; // 验证码文本
  expiresAt: number; // 过期时间戳
}

/**
 * 图片验证码服务
 */
@Injectable()
export class CaptchaService {
  // 使用 Map 存储验证码（生产环境建议使用 Redis）
  private captchaStore = new Map<string, CaptchaData>();

  // 验证码有效期（5分钟）
  private readonly CAPTCHA_EXPIRE_TIME = 5 * 60 * 1000;

  /**
   * 生成图片验证码
   */
  generateCaptcha(): { captchaId: string; captchaImage: string } {
    // 生成验证码
    const captcha = svgCaptcha.create({
      size: 4, // 验证码长度
      noise: 2, // 干扰线条数
      color: true, // 验证码字符是否有颜色
      background: '#f0f0f0', // 背景颜色
      width: 100,
      height: 40,
      fontSize: 50,
      charPreset: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
    });

    // 生成唯一 ID
    const captchaId = uuidv4();

    // 存储验证码（不区分大小写）
    this.captchaStore.set(captchaId, {
      code: captcha.text.toLowerCase(),
      expiresAt: Date.now() + this.CAPTCHA_EXPIRE_TIME,
    });

    // 转换为 base64
    const captchaImage = `data:image/svg+xml;base64,${Buffer.from(captcha.data).toString('base64')}`;

    // 定时清理过期验证码
    this.cleanExpiredCaptchas();

    return {
      captchaId,
      captchaImage,
    };
  }

  /**
   * 验证图片验证码
   */
  verifyCaptcha(captchaId: string, code: string): boolean {
    const captchaData = this.captchaStore.get(captchaId);

    // 验证码不存在
    if (!captchaData) {
      return false;
    }

    // 验证码已过期
    if (Date.now() > captchaData.expiresAt) {
      this.captchaStore.delete(captchaId);
      return false;
    }

    // 验证码验证后立即删除（无论成功或失败）
    this.captchaStore.delete(captchaId);

    // 不区分大小写比较
    return captchaData.code === code.toLowerCase();
  }

  /**
   * 清理过期验证码
   */
  private cleanExpiredCaptchas(): void {
    const now = Date.now();
    for (const [id, data] of this.captchaStore.entries()) {
      if (now > data.expiresAt) {
        this.captchaStore.delete(id);
      }
    }
  }

  /**
   * 获取验证码存储数量（用于调试）
   */
  getCaptchaCount(): number {
    return this.captchaStore.size;
  }
}

