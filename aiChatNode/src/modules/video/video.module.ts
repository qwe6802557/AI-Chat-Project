import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VideoGeneration } from './entities/video-generation.entity';
import { VideoService } from './video.service';
import { VideoController } from './video.controller';
import { CreditsModule } from '../credits/credits.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([VideoGeneration]),
    CreditsModule,
    UserModule,
  ],
  controllers: [VideoController],
  providers: [VideoService],
  exports: [VideoService],
})
export class VideoModule {}
