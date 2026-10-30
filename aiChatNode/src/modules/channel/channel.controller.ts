import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../user/entities/user.entity';
import { ChannelManagerService } from './channel-manager.service';

@ApiTags('智能助理-接入通道')
@ApiBearerAuth()
@Controller('channels')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class ChannelController {
  constructor(private readonly channelManager: ChannelManagerService) {}

  @Get('list')
  @ApiOperation({ summary: '获取全部接入通道列表' })
  async getChannels() {
    return this.channelManager.getAllChannels();
  }

  @Post('toggle')
  @ApiOperation({ summary: '启用或停用指定通道' })
  async toggleChannel(@Body() body: { channelType: string; enabled: boolean }) {
    return this.channelManager.toggleChannel(body.channelType, body.enabled);
  }

  @Patch(':type/settings')
  @ApiOperation({ summary: '更新通道绑定的底座模型与配置' })
  async updateSettings(
    @Param('type') type: string,
    @Body() payload: { boundModelId?: string | null; systemPrompt?: string | null; credentials?: Record<string, any> },
  ) {
    return this.channelManager.updateSettings(type, payload);
  }

  @Get('weixin/qrcode')
  @ApiOperation({ summary: '获取微信扫码授权二维码' })
  async getWeixinQrCode() {
    return this.channelManager.getWeixinQrCode();
  }
}
