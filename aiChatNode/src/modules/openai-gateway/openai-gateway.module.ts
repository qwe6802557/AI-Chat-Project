import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OpenaiGatewayController } from './openai-gateway.controller';
import { OpenaiGatewayService } from './openai-gateway.service';
import { GatewayAuthGuard } from './guards/gateway-auth.guard';
import { ChatModule } from '../chat/chat.module';
import { AiProviderModule } from '../ai-provider/ai-provider.module';

@Module({
  imports: [ConfigModule, ChatModule, AiProviderModule],
  controllers: [OpenaiGatewayController],
  providers: [OpenaiGatewayService, GatewayAuthGuard],
  exports: [OpenaiGatewayService],
})
export class OpenaiGatewayModule {}
