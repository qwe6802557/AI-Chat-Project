import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiProvider } from './entities/ai-provider.entity';
import { AiModel } from './entities/ai-model.entity';
import { AiProviderService } from './ai-provider.service';
import { AiModelService } from './ai-model.service';
import { AiProviderController } from './ai-provider.controller';
import { AiModelController } from './ai-model.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AiProvider, AiModel])],
  controllers: [AiProviderController, AiModelController],
  providers: [AiProviderService, AiModelService],
  exports: [AiProviderService, AiModelService], // 导出服务
})
export class AiProviderModule {}
