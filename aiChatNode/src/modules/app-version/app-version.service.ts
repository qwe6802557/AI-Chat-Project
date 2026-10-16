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
      latestVersion: '1.1.6',
      latestVersionCode: 8,
      minSupportedVersion: '1.0.0',
      downloadUrl: isAndroid
        ? `${baseUrl}/downloads/aichat-latest.apk`
        : `${baseUrl}/downloads/aichat-latest.apk`,
      packageSize: '21.0 MB',
      releaseNotes: [
        '全新上线移动端 RAG 知识库检索与证据溯源体系：支持行内切片角标 [n] 触感交互胶囊',
        '全新原生切片证据抽屉（CitationBottomSheet）：支持置信度徽章高对比展示、切片正文排版与一键复制',
        '升级高质感 StitchMarkdownView 渲染引擎：内置 AtomOneDark 极客黑代码高亮与红黄绿视窗工具栏',
        '知识库参考切片画廊与消息气泡全链路打通，统一证据溯源体验',
        '优化 Flutter 跨端持久化存储通道与用户数据兼容性',
      ],
      forceUpdate: false,
      publishedAt: '2026-10-16T02:00:00.000Z',
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
