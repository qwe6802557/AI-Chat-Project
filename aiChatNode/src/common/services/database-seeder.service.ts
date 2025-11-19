import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { UserService } from '../../modules/user/user.service';

/**
 * 数据库初始化服务
 * 应用启动时自动执行数据初始化
 */
@Injectable()
export class DatabaseSeederService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseSeederService.name);

  constructor(private readonly userService: UserService) {}

  /**
   * 模块初始化时执行
   */
  async onModuleInit() {
    this.logger.log('开始执行数据库初始化...');

    try {
      // 初始化超级管理员
      await this.userService.initSuperAdmin();

      this.logger.log('数据库初始化完成！');
    } catch (error) {
      this.logger.error('数据库初始化失败:', error);
    }
  }
}
