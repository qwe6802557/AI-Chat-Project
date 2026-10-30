import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChannelConfig } from './entities/channel-config.entity';
import { ChannelManagerService } from './channel-manager.service';
import { ChannelController } from './channel.controller';
import { ChatModule } from '../chat/chat.module';
import { AiProviderModule } from '../ai-provider/ai-provider.module';
import { CreditsModule } from '../credits/credits.module';
import { UserModule } from '../user/user.module';

/**
 * 智能助理通道模块
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([ChannelConfig]),
    forwardRef(() => ChatModule),
    AiProviderModule,
    CreditsModule,
    UserModule,
  ],
  controllers: [ChannelController],
  providers: [ChannelManagerService],
  exports: [ChannelManagerService],
})
export class ChannelModule {}
