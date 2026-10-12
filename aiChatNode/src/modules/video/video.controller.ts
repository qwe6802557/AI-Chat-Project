import {
  Controller,
  Post,
  Get,
  Delete,
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
import { VideoService } from './video.service';
import { CreateVideoGenerationDto } from './dto/create-video-generation.dto';

@ApiTags('AI视频生成')
@Controller('videos')
export class VideoController {
  constructor(private readonly videoService: VideoService) {}

  /**
   * 提交视频生成任务
   */
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('generations')
  @ApiOperation({
    summary: '发起视频生成任务',
    description: '提交 prompt 及可选参考图，扣除 200 积分并提交上游异步生成',
  })
  @ApiResponse({ status: 200, description: '任务提交成功，返回任务信息' })
  async generateVideo(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateVideoGenerationDto,
  ) {
    return this.videoService.generateVideo(userId, dto);
  }

  /**
   * 分页拉取个人视频历史
   */
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('history')
  @ApiOperation({ summary: '获取当前用户的视频生成历史列表' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, example: 20 })
  async getHistory(
    @CurrentUser('id') userId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const p = page ? parseInt(page, 10) : 1;
    const ps = pageSize ? parseInt(pageSize, 10) : 20;
    return this.videoService.getHistory(userId, p, ps);
  }

  /**
   * 单独轮询任务状态
   */
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('status/:id')
  @ApiOperation({ summary: '查询特定视频生成任务的状态' })
  async getTaskStatus(
    @CurrentUser('id') userId: string,
    @Param('id') taskId: string,
  ) {
    return this.videoService.getTaskStatus(userId, taskId);
  }

  /**
   * 读取本地持久化视频文件流
   */
  @Get('media/:filename')
  @ApiOperation({ summary: '访问本地持久化存储的视频文件' })
  async getMedia(
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    const filePath = await this.videoService.getMediaFilePath(filename);
    return res.sendFile(filePath);
  }

  /**
   * 删除视频记录及本地文件
   */
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Delete(':id')
  @ApiOperation({ summary: '删除指定的视频记录及对应本地视频文件' })
  @ApiResponse({ status: 200, description: '删除成功' })
  async deleteVideoTask(
    @CurrentUser('id') userId: string,
    @Param('id') taskId: string,
  ) {
    return this.videoService.deleteVideoTask(userId, taskId);
  }
}
