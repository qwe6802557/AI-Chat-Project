import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { User } from './entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    ConfigModule, // 导入 ConfigModule 以便使用 ConfigService
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService], // 导出 UserService 供其他模块使用
})
export class UserModule {}
