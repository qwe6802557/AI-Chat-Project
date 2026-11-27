import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { KnowledgeAssetService } from './services/knowledge-asset.service';

@ApiTags('知识库视觉资产')
@Controller('knowledge-bases/assets')
export class KnowledgeAssetsController {
  constructor(private readonly assetService: KnowledgeAssetService) {}

  @Get(':assetId')
  @ApiOperation({
    summary: '获取签名授权的知识库视觉图像资产',
    description:
      '通过 HMAC-SHA256 签名 URL 读取知识库视觉切片关联的 WebP 图像，供浏览器与移动端原生组件无障碍加载。',
  })
  @ApiQuery({ name: 'expires', required: true, description: 'Unix 秒级过期时间' })
  @ApiQuery({ name: 'signature', required: true, description: 'HMAC-SHA256 签名' })
  @ApiResponse({ status: 200, description: '返回 WebP 图像流' })
  @ApiResponse({ status: 403, description: '签名无效或已过期' })
  @ApiResponse({ status: 404, description: '资产不存在' })
  async getAsset(
    @Param('assetId') assetId: string,
    @Query('expires') expires: string | undefined,
    @Query('signature') signature: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    await this.assetService.streamAssetById(assetId, res, {
      expires,
      signature,
    });
  }
}
