import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { OpenaiGatewayController } from './openai-gateway.controller';
import { OpenaiGatewayService } from './openai-gateway.service';
import { GatewayAuthGuard } from './guards/gateway-auth.guard';
import { AIClientService } from '../chat/services/ai-client.service';
import { AiModelService } from '../ai-provider/ai-model.service';
import { UnauthorizedException } from '@nestjs/common';

describe('OpenaiGatewayController & GatewayAuthGuard', () => {
  let controller: OpenaiGatewayController;
  let service: OpenaiGatewayService;
  let guard: GatewayAuthGuard;
  let aiClientService: Partial<AIClientService>;
  let aiModelService: Partial<AiModelService>;
  let configService: Partial<ConfigService>;

  beforeEach(async () => {
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'GATEWAY_API_KEY') return 'sk-test-gateway-key';
        return undefined;
      }),
    };

    aiClientService = {
      createChatCompletion: jest.fn().mockResolvedValue({
        content: '这是测试生成的纯净正文',
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      }),
      createStreamChatCompletion: jest.fn().mockImplementation(async function* () {
        yield { type: 'answer_delta', delta: { content: '这是' } };
        yield { type: 'answer_delta', delta: { content: '流式' } };
        yield { type: 'answer_delta', delta: { content: '文本' } };
      }),
    };

    aiModelService = {
      findActiveModels: jest.fn().mockResolvedValue([
        { modelId: 'glm-4-flash', provider: { name: 'zhipu' } },
        { modelId: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-7B', provider: { name: 'siliconflow' } },
      ]),
      findByModelIdOrNull: jest.fn().mockImplementation(async (id: string) => {
        if (id === 'glm-4-flash') return { modelId: 'glm-4-flash', isActive: true };
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OpenaiGatewayController],
      providers: [
        OpenaiGatewayService,
        GatewayAuthGuard,
        { provide: ConfigService, useValue: configService },
        { provide: AIClientService, useValue: aiClientService },
        { provide: AiModelService, useValue: aiModelService },
      ],
    }).compile();

    controller = module.get<OpenaiGatewayController>(OpenaiGatewayController);
    service = module.get<OpenaiGatewayService>(OpenaiGatewayService);
    guard = module.get<GatewayAuthGuard>(GatewayAuthGuard);
  });

  describe('GatewayAuthGuard', () => {
    it('缺少 Authorization 头时应抛出 UnauthorizedException', () => {
      const mockContext: any = {
        switchToHttp: () => ({
          getRequest: () => ({ headers: {} }),
        }),
      };
      expect(() => guard.canActivate(mockContext)).toThrow(UnauthorizedException);
    });

    it('提供的 Key 不匹配时应抛出 UnauthorizedException', () => {
      const mockContext: any = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: { authorization: 'Bearer wrong-key' },
          }),
        }),
      };
      expect(() => guard.canActivate(mockContext)).toThrow(UnauthorizedException);
    });

    it('提供正确的 Key 时应放行并注入管理员身份', () => {
      const req: any = {
        headers: { authorization: 'Bearer sk-test-gateway-key' },
      };
      const mockContext: any = {
        switchToHttp: () => ({
          getRequest: () => req,
        }),
      };
      const result = guard.canActivate(mockContext);
      expect(result).toBe(true);
      expect(req.user.username).toBe('admin');
      expect(req.user.role).toBe('admin');
    });
  });

  describe('OpenaiGatewayController.getModels', () => {
    it('返回兼容 OpenAI 标准格式的模型列表', async () => {
      const result = await controller.getModels();
      expect(result.object).toBe('list');
      expect(result.data.length).toBeGreaterThanOrEqual(2);
      expect(result.data.some((m) => m.id === 'glm-4-flash')).toBe(true);
      expect(result.data.some((m) => m.id === 'deepseek-chat')).toBe(true);
    });
  });

  describe('OpenaiGatewayController.createChatCompletion', () => {
    it('非流式请求应返回标准 choices 与 usage 结构', async () => {
      const mockRes: any = {
        json: jest.fn((data) => data),
      };

      const dto = {
        model: 'deepseek-chat', // 别名应智能回退至 glm-4-flash
        messages: [{ role: 'user', content: '测试问题' }],
        stream: false,
      };

      const result = await controller.createChatCompletion(dto as any, mockRes);
      expect(aiClientService.createChatCompletion).toHaveBeenCalledWith(
        'glm-4-flash',
        [{ role: 'user', content: '测试问题' }],
        expect.any(Object),
      );
      expect(mockRes.json).toHaveBeenCalled();
      const payload = mockRes.json.mock.calls[0][0];
      expect(payload.object).toBe('chat.completion');
      expect(payload.choices[0].message.content).toBe('这是测试生成的纯净正文');
      expect(payload.usage.total_tokens).toBe(30);
    });

    it('流式请求应通过 SSE 分块推送并以 [DONE] 结束', async () => {
      const writtenChunks: string[] = [];
      const mockRes: any = {
        setHeader: jest.fn(),
        write: jest.fn((chunk: string) => writtenChunks.push(chunk)),
        end: jest.fn(),
      };

      const dto = {
        model: 'deepseek-reasoner', // 别名应智能映射至 R1
        messages: [{ role: 'user', content: '测试流式' }],
        stream: true,
      };

      await controller.createChatCompletion(dto as any, mockRes);
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/event-stream; charset=utf-8',
      );
      expect(aiClientService.createStreamChatCompletion).toHaveBeenCalledWith(
        'deepseek-ai/DeepSeek-R1-Distill-Qwen-7B',
        [{ role: 'user', content: '测试流式' }],
        expect.any(Object),
      );
      expect(writtenChunks.some((c) => c.includes('这是'))).toBe(true);
      expect(writtenChunks.some((c) => c.includes('[DONE]'))).toBe(true);
      expect(mockRes.end).toHaveBeenCalled();
    });
  });
});
