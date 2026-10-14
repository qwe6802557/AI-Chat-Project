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
      latestVersion: '1.1.4',
      latestVersionCode: 6,
      minSupportedVersion: '1.0.0',
      downloadUrl: isAndroid
        ? `${baseUrl}/downloads/aichat-latest.apk`
        : `${baseUrl}/downloads/aichat-latest.apk`,
      packageSize: '19.5 MB',
      releaseNotes: [
        '彻底修复插件工具中心与知识库底部抽屉被悬浮底栏（FloatingNavBar）遮挡的层级缺陷',
        '全局模态底栏升级为根导航器挂载（useRootNavigator），确保弹窗完全置顶于毛玻璃底栏之上',
        '优化抽屉高度约束与底部安全距离（SafeArea + 24px），彻底杜绝尾部选项被裁切截断',
        '底栏架构保活（Keep-Alive）与 150ms 优雅淡入过渡持续生效，秒开无白屏',
        '延续超轻量 ARM64 混淆优化构建，安装包严格保持 ~19.5 MB',
      ],
      forceUpdate: false,
      publishedAt: '2026-10-14T08:55:00.000Z',
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
