import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChannelConfig } from './entities/channel-config.entity';
import { ChannelManagerService } from './channel-manager.service';
import { ChannelController } from './channel.controller';
import { ChatModule } from '../chat/chat.module';
import { AiProviderModule } from '../ai-provider/ai-provider.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChannelConfig]),
    forwardRef(() => ChatModule),
    AiProviderModule,
  ],
  controllers: [ChannelController],
  providers: [ChannelManagerService],
  exports: [ChannelManagerService],
})
export class ChannelModule {}
