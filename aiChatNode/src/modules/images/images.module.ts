import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ImageGeneration } from './entities/image-generation.entity';
import { ImagesService } from './images.service';
import { ImagesController } from './images.controller';
import { CreditsModule } from '../credits/credits.module';
import { AiProviderModule } from '../ai-provider/ai-provider.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ImageGeneration]),
    CreditsModule,
    AiProviderModule,
    UserModule,
  ],
  controllers: [ImagesController],
  providers: [ImagesService],
  exports: [ImagesService],
})
export class ImagesModule {}
