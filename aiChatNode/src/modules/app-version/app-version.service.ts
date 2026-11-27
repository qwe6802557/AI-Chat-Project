import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * 应用版本元数据接口
 */
export interface AppVersionInfo {
  latestVersion: string;
  latestVersionCode: number;
  minSupportedVersion: string;
  downloadUrl: string;
  packageSize: string;
  releaseNotes: string[];
  forceUpdate: boolean;
  publishedAt: string;
}

/**
 * 版本检查结果响应结构
 */
export interface VersionCheckResult extends AppVersionInfo {
  hasUpdate: boolean;
  currentVersion: string;
}

/**
 * 移动端/跨端应用版本升级服务
 */
@Injectable()
export class AppVersionService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * 获取最新版本信息与配置
   */
  getLatestVersionInfo(platform = 'android'): AppVersionInfo {
    const isAndroid = platform.toLowerCase() === 'android';
    const baseUrl = this.configService.get<string>(
      'APP_URL',
      'https://aichat.yanggenbwebsite.site',
    );

    return {
      latestVersion: '1.3.1',
      latestVersionCode: 15,
      minSupportedVersion: '1.0.0',
      downloadUrl: isAndroid
        ? `${baseUrl}/downloads/aichat-latest.apk`
        : `${baseUrl}/downloads/aichat-latest.apk`,
      packageSize: '21.7 MB',
      releaseNotes: [
        '下架官方即将淘汰的 Gemini 3.8 Flash 与 Gemini 4 Argon 模型，默认对话模型平滑切换为 Spark-X2.6-4B，并保留通用 Gemini 动态分组能力',
        '知识库升级支持多模态图文分片预览、PDF 图表异步视觉解析进度展示与点击灯箱放大查看',
        '加固知识库视觉资产相对路径解析、图片加载失败降级与 320px 窄屏防溢出排版体验',
      ],
      forceUpdate: false,
      publishedAt: '2026-11-27T16:55:00.000Z',
    };
  }

  /**
   * 对比客户端版本并下发升级策略
   */
  checkVersion(
    currentVersion = '1.0.0',
    platform = 'android',
  ): VersionCheckResult {
    const latestInfo = this.getLatestVersionInfo(platform);
    const hasUpdate =
      this.compareSemver(latestInfo.latestVersion, currentVersion) > 0;

    return {
      ...latestInfo,
      hasUpdate,
      currentVersion,
    };
  }

  /**
   * 语义化版本号对比工具
   * @returns 1: v1 > v2, -1: v1 < v2, 0: v1 == v2
   */
  private compareSemver(v1: string, v2: string): number {
    const clean1 = v1
      .replace(/^v/, '')
      .split('.')
      .map((n) => Number.parseInt(n, 10) || 0);
    const clean2 = v2
      .replace(/^v/, '')
      .split('.')
      .map((n) => Number.parseInt(n, 10) || 0);

    const maxLength = Math.max(clean1.length, clean2.length);
    for (let i = 0; i < maxLength; i++) {
      const num1 = clean1[i] ?? 0;
      const num2 = clean2[i] ?? 0;
      if (num1 > num2) return 1;
      if (num1 < num2) return -1;
    }
    return 0;
  }
}
