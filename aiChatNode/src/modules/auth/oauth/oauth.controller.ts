import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { OAuthService } from './oauth.service';
import { OAuthCallbackDto } from './oauth.types';

@ApiTags('第三方 OAuth 认证')
@Controller('auth/oauth')
export class OAuthController {
  constructor(private readonly oauthService: OAuthService) {}

  /**
   * 获取第三方授权登录跳转 URL
   */
  @Get(':platform/authorize-url')
  @ApiOperation({
    summary: '获取第三方授权登录跳转 URL',
    description: '返回指定平台的登录授权跳转链接，并生成安全防伪 state',
  })
  @ApiResponse({
    status: 200,
    description: '获取成功',
  })
  async getAuthorizeUrl(@Param('platform') platform: string) {
    const data = await this.oauthService.getAuthorizeUrl(platform);
    return {
      code: 0,
      data,
      message: '获取授权链接成功',
    };
  }

  /**
   * 第三方登录授权回调交换
   */
  @Post('callback')
  @ApiOperation({
    summary: '第三方登录授权回调交换',
    description: '使用授权 code 和安全 state 换取系统登录凭据 JWT，首次授权自动静默建号',
  })
  @ApiBody({ type: OAuthCallbackDto })
  @ApiResponse({
    status: 200,
    description: '登录成功',
  })
  async handleCallback(@Body(ValidationPipe) dto: OAuthCallbackDto) {
    const session = await this.oauthService.handleCallback(dto);
    return {
      code: 0,
      data: session,
      message: '登录成功',
    };
  }
}
