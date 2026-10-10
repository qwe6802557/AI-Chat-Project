import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ToolRegistryService } from './tools.registry.service';
import type { ToolMetadata, ToolExecutionRecord } from './types/tools.types';

@ApiTags('插件工具中心')
@Controller('tools')
export class ToolsController {
  constructor(private readonly toolRegistryService: ToolRegistryService) {}

  /**
   * 获取所有可用工具插件列表
   */
  @Get('list')
  @ApiOperation({ summary: '获取所有可用工具插件列表' })
  @ApiResponse({ status: 200, description: '获取成功' })
  listTools(): ToolMetadata[] {
    return this.toolRegistryService.listTools();
  }

  /**
   * 单独执行工具
   */
  @Post('execute')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '执行指定工具插件' })
  @ApiResponse({ status: 200, description: '执行完成' })
  async executeTool(
    @Body() body: { name: string; args: Record<string, any> },
  ): Promise<ToolExecutionRecord> {
    return this.toolRegistryService.executeTool(body.name, body.args || {});
  }
}
