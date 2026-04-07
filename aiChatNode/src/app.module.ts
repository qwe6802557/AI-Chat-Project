import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ChatModule } from './modules/chat/chat.module';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { AiProviderModule } from './modules/ai-provider/ai-provider.module';
import { FilesModule } from './modules/files/files.module';
import { CreditsModule } from './modules/credits/credits.module';
import { DatabaseSeederService } from './common/services/database-seeder.service';
import { RedisModule } from './common/redis/redis.module';
import databaseConfig from './config/database.config';
import { buildDatabaseCoreOptions } from './config/database-options';

@Module({
  imports: [
    // 配置模块
    ConfigModule.forRoot({
      isGlobal: true, // ConfigModule 全局可用
      envFilePath: '.env', // 指定 .env 文件路径
      load: [databaseConfig], // 加载数据库配置
    }),
    // TypeORM 模块
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const isProduction = configService.get('NODE_ENV') === 'production';
        const enableSynchronize =
          configService.get('DB_SYNCHRONIZE') === 'true' && !isProduction;

        return {
          ...buildDatabaseCoreOptions(configService),
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
          synchronize: enableSynchronize,
        };
      },
    }),
    RedisModule,
    UserModule,
    AuthModule,
    CreditsModule,
    ChatModule,
    FilesModule,
    AiProviderModule,
  ],
  controllers: [AppController],
  providers: [AppService, DatabaseSeederService],
})
export class AppModule {}
