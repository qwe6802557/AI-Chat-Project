import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * OpenAI 兼容网关专属服务鉴权守卫
 * 校验请求头中的 Authorization: Bearer <apiKey> 是否匹配配置的 GATEWAY_API_KEY
 */
@Injectable()
export class GatewayAuthGuard implements CanActivate {
  private readonly defaultGatewayKey = 'sk-aichat-internal-gateway-2026';

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader =
      request.headers['authorization'] || request.headers['Authorization'];

    if (!authHeader || typeof authHeader !== 'string') {
      throw new UnauthorizedException({
        error: {
          message:
            'You didn\'t provide an API key. You need to provide your API key in an Authorization header using Bearer auth (i.e. Authorization: Bearer YOUR_KEY).',
          type: 'invalid_request_error',
          code: 'missing_api_key',
        },
      });
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const configuredKey =
      this.configService.get<string>('GATEWAY_API_KEY') ||
      this.defaultGatewayKey;

    if (!token || token !== configuredKey) {
      throw new UnauthorizedException({
        error: {
          message:
            'Incorrect API key provided: ' +
            (token ? `${token.slice(0, 7)}***` : 'empty') +
            '. You can find or configure your API key in GATEWAY_API_KEY.',
          type: 'invalid_request_error',
          code: 'invalid_api_key',
        },
      });
    }

    // 绑定管理员凭证，方便后续日志记录与安全审计
    request.user = {
      username: 'admin',
      role: 'admin',
      isGatewayClient: true,
    };

    return true;
  }
}
