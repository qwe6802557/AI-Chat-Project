import { Controller, Get, Query } from '@nestjs/common';
import { AppVersionService } from './app-version.service';
import type { AppVersionInfo, VersionCheckResult } from './app-version.service';
import { CheckVersionDto } from './dto/check-version.dto';

/**
 * 客户端版本与OTA升级控制器
 */
@Controller('app/version')
export class AppVersionController {
  constructor(private readonly appVersionService: AppVersionService) {}

  /**
   * 检查应用版本并返回更新状态
   */
  @Get('check')
  checkVersion(@Query() query: CheckVersionDto): VersionCheckResult {
    return this.appVersionService.checkVersion(query.version, query.platform);
  }

  /**
   * 获取最新发布的客户端版本信息
   */
  @Get('latest')
  getLatest(@Query('platform') platform?: string): AppVersionInfo {
    return this.appVersionService.getLatestVersionInfo(platform);
  }
}
