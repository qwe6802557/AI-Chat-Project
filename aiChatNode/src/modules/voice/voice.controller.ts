import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { VoiceService } from './voice.service';
import { CreateTtsDto, CreateSttDto, QueryVoiceHistoryDto } from './dto/voice.dto';

@ApiTags('AI语音创作与识别')
@Controller('voice')
export class VoiceController {
  constructor(private readonly voiceService: VoiceService) {}

  /**
   * 获取可用音色列表
   */
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('voices')
  @ApiOperation({ summary: '获取可用的 TTS 音色列表' })
  async getVoices(@Query('model') model?: string) {
    return this.voiceService.getVoices(model);
  }

  /**
   * 提交 TTS 文本合成任务
   */
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('tts')
  @ApiOperation({ summary: '发起文本转语音合成任务' })
  @ApiResponse({ status: 200, description: '语音合成成功，返回音频文件信息' })
  async createTts(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateTtsDto,
  ) {
    return this.voiceService.createTts(userId, dto);
  }

  /**
   * 提交 STT 语音识别转文字任务
   */
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('stt')
  @ApiOperation({ summary: '上传音频文件进行语音转文字识别' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: '音频文件 (mp3/wav/m4a/webm)' },
        language: { type: 'string', example: 'zh', description: '识别语言代码' },
        model: { type: 'string', example: 'grok-stt', description: '识别模型' },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB
      },
    }),
  )
  async createStt(
    @CurrentUser('id') userId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: CreateSttDto,
  ) {
    return this.voiceService.createStt(
      userId,
      file,
      body.language,
      body.model,
    );
  }

  /**
   * 分页拉取个人语音创作/识别历史
   */
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('history')
  @ApiOperation({ summary: '获取当前用户的语音任务历史列表' })
  async getHistory(
    @CurrentUser('id') userId: string,
    @Query() query: QueryVoiceHistoryDto,
  ) {
    return this.voiceService.getHistory(userId, query);
  }

  /**
   * 读取本地持久化音频文件
   */
  @Get('media/:filename')
  @ApiOperation({ summary: '访问本地持久化存储的音频文件' })
  async getMedia(
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    const filePath = await this.voiceService.getMediaFilePath(filename);
    return res.sendFile(filePath);
  }
}
