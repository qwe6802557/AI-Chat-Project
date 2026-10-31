import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ChannelManagerService } from './channel-manager.service';
import { ChannelType } from './entities/channel-config.entity';

/**
 * 智能助理通道与角色控制器 (支持多实例与角色解耦)
 */
@ApiTags('智能助理-通道与角色')
@ApiBearerAuth()
@Controller('channels')
@UseGuards(JwtAuthGuard)
export class ChannelController {
  constructor(private readonly channelManager: ChannelManagerService) {}

  // ================= 智能体角色管理 (Roles) =================

  @Get('roles')
  @ApiOperation({ summary: '获取当前用户的所有智能体角色列表' })
  async getRoles(@Request() req: any) {
    return this.channelManager.getRoles(req.user.id);
  }

  @Post('roles')
  @ApiOperation({ summary: '创建新的智能体角色' })
  async createRole(
    @Request() req: any,
    @Body()
    body: {
      name: string;
      description?: string | null;
      avatar?: string | null;
      boundModelId?: string | null;
      systemPrompt?: string | null;
      knowledgeBaseIds?: string[] | null;
      isDefault?: boolean;
    },
  ) {
    return this.channelManager.createRole(req.user.id, body);
  }

  @Put('roles/:id')
  @ApiOperation({ summary: '修改指定智能体角色配置' })
  async updateRole(
    @Request() req: any,
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      description?: string | null;
      avatar?: string | null;
      boundModelId?: string | null;
      systemPrompt?: string | null;
      knowledgeBaseIds?: string[] | null;
      isDefault?: boolean;
    },
  ) {
    return this.channelManager.updateRole(req.user.id, id, body);
  }

  @Delete('roles/:id')
  @ApiOperation({ summary: '删除指定的智能体角色' })
  async deleteRole(@Request() req: any, @Param('id') id: string) {
    await this.channelManager.deleteRole(req.user.id, id);
    return { success: true, message: '角色删除成功' };
  }

  // ================= 通道多实例管理 (Instances) =================

  @Get('instances')
  @ApiOperation({ summary: '获取当前用户的所有接入通道实例列表' })
  async getInstances(@Request() req: any) {
    return this.channelManager.getAllInstances(req.user.id);
  }

  @Post('instances')
  @ApiOperation({ summary: '为指定渠道创建新的机器人实例' })
  async createInstance(
    @Request() req: any,
    @Body()
    body: {
      channelType: ChannelType;
      instanceName?: string;
      roleId?: string | null;
      credentials?: Record<string, any>;
    },
  ) {
    return this.channelManager.createInstance(req.user.id, body);
  }

  @Delete('instances/:id')
  @ApiOperation({ summary: '删除指定的通道实例' })
  async deleteInstance(@Request() req: any, @Param('id') id: string) {
    await this.channelManager.deleteInstance(req.user.id, id);
    return { success: true, message: '通道实例删除成功' };
  }

  @Patch('instances/:id/settings')
  @ApiOperation({ summary: '更新通道实例配置 (名称、绑定角色、凭证)' })
  async updateInstanceSettings(
    @Request() req: any,
    @Param('id') id: string,
    @Body()
    payload: {
      instanceName?: string;
      roleId?: string | null;
      boundModelId?: string | null;
      systemPrompt?: string | null;
      credentials?: Record<string, any>;
    },
  ) {
    return this.channelManager.updateInstanceSettings(req.user.id, id, payload);
  }

  @Post('instances/:id/toggle')
  @ApiOperation({ summary: '启用或停用指定的通道实例' })
  async toggleInstance(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { enabled: boolean },
  ) {
    return this.channelManager.toggleInstance(req.user.id, id, body.enabled);
  }

  // ================= 对话审计与会话记忆 (Sessions & Audit) =================

  @Get('instances/:id/sessions')
  @ApiOperation({ summary: '获取指定通道实例下的外部会话联系人列表' })
  async getInstanceSessions(
    @Request() req: any,
    @Param('id') id: string,
    @Query('search') search?: string,
    @Query('limit') limit?: number,
  ) {
    return this.channelManager.getInstanceSessions(req.user.id, id, {
      search,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('instances/:id/sessions/:fromId/messages')
  @ApiOperation({ summary: '获取指定通道实例与外部联系人的对话历史消息流水' })
  async getSessionMessages(
    @Request() req: any,
    @Param('id') id: string,
    @Param('fromId') fromId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.channelManager.getSessionMessages(req.user.id, id, fromId, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Delete('instances/:id/sessions/:fromId/memory')
  @ApiOperation({ summary: '重置清除指定联系人的上下文记忆缓存' })
  async clearSessionMemory(
    @Request() req: any,
    @Param('id') id: string,
    @Param('fromId') fromId: string,
  ) {
    return this.channelManager.clearSessionMemory(req.user.id, id, fromId);
  }

  // ================= 向后兼容接口 (Legacy Compat) =================

  @Get('list')
  @ApiOperation({ summary: '[兼容] 获取当前用户的接入通道列表' })
  async getChannels(@Request() req: any) {
    return this.channelManager.getAllChannels(req.user.id);
  }

  @Post('toggle')
  @ApiOperation({ summary: '[兼容] 启用或停用指定渠道的默认通道' })
  async toggleChannel(
    @Request() req: any,
    @Body() body: { channelType: string; enabled: boolean },
  ) {
    return this.channelManager.toggleChannel(req.user.id, body.channelType, body.enabled);
  }

  @Patch(':type/settings')
  @ApiOperation({ summary: '[兼容] 更新通道绑定的底座模型与配置' })
  async updateSettings(
    @Request() req: any,
    @Param('type') type: string,
    @Body()
    payload: {
      boundModelId?: string | null;
      systemPrompt?: string | null;
      credentials?: Record<string, any>;
    },
  ) {
    return this.channelManager.updateSettings(req.user.id, type, payload);
  }

  @Get('weixin/qrcode')
  @ApiOperation({ summary: '获取当前用户微信扫码授权二维码' })
  async getWeixinQrCode(@Request() req: any) {
    return this.channelManager.getWeixinQrCode(req.user.id);
  }
}
