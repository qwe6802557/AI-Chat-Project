import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false, // 禁用默认body解析器
  });

  // 增加body大小限制（支持base64图片上传，单张 5MB × 4 张 × 1.33 膨胀 ≈ 28MB）
  app.useBodyParser('json', { limit: '30mb' });
  app.useBodyParser('urlencoded', { limit: '30mb', extended: true });

  // 跨域处理
  app.enableCors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'], // 允许的地址
    credentials: true, // 允许携带凭证
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // 允许的请求方法
    allowedHeaders: ['Content-Type', 'Authorization'], // 允许的请求头
  });

  // 注册全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // 自动删除非白名单属性
      forbidNonWhitelisted: false, // 不抛出错误
      transform: true, // 自动转换类型
      transformOptions: {
        enableImplicitConversion: true, // 启用隐式类型转换
      },
    }),
  );

  // 注册全局响应拦截器
  app.useGlobalInterceptors(new TransformInterceptor());

  // 注册全局异常过滤器
  app.useGlobalFilters(new HttpExceptionFilter());

  // 配置 Swagger 文档
  const config = new DocumentBuilder()
    .setTitle('AI Chat API 文档')
    .setDescription(
      '基于 NestJS 的 AI 聊天系统 API 文档\n\n' +
        '## 设计规范\n' +
        '- **仅使用 POST 和 GET 方法**\n' +
        '- **统一响应格式**: `{ code: number, data: any, message: string }`\n' +
        '- **code = 0 表示成功，code != 0 表示失败**\n' +
        '- **POST 请求参数放在 Body 中（JSON 格式）**\n' +
        '- **GET 请求参数放在 Query 中（URL 参数）**\n\n' +
        '## 超级管理员\n' +
        '- 用户名: `admin`\n',
    )
    .setVersion('1.0')
    .addTag('用户认证', '用户认证相关接口（登录、注册、验证码）')
    .addTag('用户管理', '用户相关接口')
    .addTag('聊天会话', '聊天会话管理接口')
    .addTag('聊天消息', '聊天消息相关接口')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document, {
    customSiteTitle: 'AI Chat API 文档',
    customCss: '.swagger-ui .topbar { display: none }',
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'list',
      filter: true,
      showRequestDuration: true,
    },
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`\n 应用已启动: http://localhost:${port}`);
  console.log(`API 文档地址: http://localhost:${port}/api-docs\n`);
}
bootstrap();
