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
      latestVersion: '1.1.5',
      latestVersionCode: 7,
      minSupportedVersion: '1.0.0',
      downloadUrl: isAndroid
        ? `${baseUrl}/downloads/aichat-latest.apk`
        : `${baseUrl}/downloads/aichat-latest.apk`,
      packageSize: '21.0 MB',
      releaseNotes: [
        '全新上线 Artifacts 3.0：沙箱微 IDE 运行时控制台（实时捕获报错/警告/日志），SVG 支持 2x Retina 高清图片与矢量源码导出',
        '移动端升级产物多版本药丸快速回溯切换（支持一键回溯旧版与最新版）',
        '移动端新增系统级文件原生分享（支持直接分享代码与产物文件至微信/QQ/系统文件）',
        '多版本视口模拟与安全沙箱渲染环境升级',
        '延续极简 ARM64 单架构混淆与符号剥离深度优化，保持轻量体积',
      ],
      forceUpdate: false,
      publishedAt: '2026-10-15T06:30:00.000Z',
    };
  }

  /**
   * 对比客户端版本并下发升级策略
   */
  checkVersion(currentVersion = '1.0.0', platform = 'android'): VersionCheckResult {
    const latestInfo = this.getLatestVersionInfo(platform);
    const hasUpdate = this.compareSemver(latestInfo.latestVersion, currentVersion) > 0;

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
    const clean1 = v1.replace(/^v/, '').split('.').map((n) => Number.parseInt(n, 10) || 0);
    const clean2 = v2.replace(/^v/, '').split('.').map((n) => Number.parseInt(n, 10) || 0);

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
