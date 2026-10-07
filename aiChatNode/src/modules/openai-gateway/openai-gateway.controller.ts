import {
  Controller,
  Get,
  Post,
  Body,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import type { Response } from 'express';
import { GatewayAuthGuard } from './guards/gateway-auth.guard';
import { OpenaiGatewayService } from './openai-gateway.service';
import { OpenAiChatCompletionDto } from './dto/openai-chat-completion.dto';

@ApiTags('OpenAI 兼容统一网关')
@ApiBearerAuth()
@UseGuards(GatewayAuthGuard)
@Controller('v1')
export class OpenaiGatewayController {
  constructor(private readonly gatewayService: OpenaiGatewayService) {}

  @Get('models')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '获取已激活的模型列表（兼容 OpenAI 规范）' })
  async getModels() {
    return this.gatewayService.getModelsList();
  }

  @Post('chat/completions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '创建聊天补全（兼容 OpenAI 规范，支持流式与非流式）' })
  async createChatCompletion(
    @Body() dto: OpenAiChatCompletionDto,
    @Res() res: Response,
  ) {
    if (dto.stream) {
      return this.gatewayService.handleStream(dto, res);
    }

    const result = await this.gatewayService.handleNonStream(dto);
    return res.json(result);
  }
}
