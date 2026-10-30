import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ChannelManagerService } from './channel-manager.service';

/**
 * 智能助理通道控制器 (多租户独立接口)
 */
@ApiTags('智能助理-接入通道')
@ApiBearerAuth()
@Controller('channels')
@UseGuards(JwtAuthGuard)
export class ChannelController {
  constructor(private readonly channelManager: ChannelManagerService) {}

  @Get('list')
  @ApiOperation({ summary: '获取当前用户的接入通道列表' })
  async getChannels(@Request() req: any) {
    return this.channelManager.getAllChannels(req.user.id);
  }

  @Post('toggle')
  @ApiOperation({ summary: '启用或停用当前用户的指定通道' })
  async toggleChannel(
    @Request() req: any,
    @Body() body: { channelType: string; enabled: boolean },
  ) {
    return this.channelManager.toggleChannel(req.user.id, body.channelType, body.enabled);
  }

  @Patch(':type/settings')
  @ApiOperation({ summary: '更新当前用户通道绑定的底座模型与配置' })
  async updateSettings(
    @Request() req: any,
    @Param('type') type: string,
    @Body() payload: { boundModelId?: string | null; systemPrompt?: string | null; credentials?: Record<string, any> },
  ) {
    return this.channelManager.updateSettings(req.user.id, type, payload);
  }

  @Get('weixin/qrcode')
  @ApiOperation({ summary: '获取当前用户微信扫码授权二维码' })
  async getWeixinQrCode(@Request() req: any) {
    return this.channelManager.getWeixinQrCode(req.user.id);
  }
}
