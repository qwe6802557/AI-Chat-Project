import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Param,
  UseGuards,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ImagesService } from './images.service';
import { CreateImageGenerationDto } from './dto/create-image-generation.dto';

@ApiTags('AI图片生成')
@Controller('images')
export class ImagesController {
  constructor(private readonly imagesService: ImagesService) {}

  /**
   * 提交生图任务
   */
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('generations')
  @ApiOperation({
    summary: '发起图片生成任务',
    description: '提交 prompt 及生图参数，按张数扣除对应模型积分并转存图片',
  })
  @ApiResponse({ status: 200, description: '生图成功，返回图片记录与访问地址' })
  async generateImages(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateImageGenerationDto,
  ) {
    return this.imagesService.generateImages(userId, dto);
  }

  /**
   * 分页拉取个人生图历史
   */
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('history')
  @ApiOperation({ summary: '获取当前用户的生图历史列表' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, example: 20 })
  async getHistory(
    @CurrentUser('id') userId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const p = page ? parseInt(page, 10) : 1;
    const ps = pageSize ? parseInt(pageSize, 10) : 20;
    return this.imagesService.getHistory(userId, p, ps);
  }

  /**
   * 读取本地持久化生图资源
   */
  @Get('media/:filename')
  @ApiOperation({ summary: '访问本地持久化存储的生图文件' })
  async getMedia(
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    const filePath = await this.imagesService.getMediaFilePath(filename);
    return res.sendFile(filePath);
  }
}
