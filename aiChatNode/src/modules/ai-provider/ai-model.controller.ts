import { Controller, Get, Post, Body, Query, UseGuards, Inject, forwardRef } from '@nestjs/common';
import { AIClientService } from '../chat/services/ai-client.service';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AiModelService } from './ai-model.service';
import { CreateModelDto } from './dto/create-model.dto';
import { UpdateModelDto } from './dto/update-model.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../user/entities/user.entity';
import type { AiModel } from './entities/ai-model.entity';
import { resolveModelReasoningProfile } from '../chat/utils/reasoning-profile.util';

@ApiTags('AI模型管理')
@ApiBearerAuth() // Swagger中显示需要Bearer Token
@Controller('ai-model')
@UseGuards(JwtAuthGuard) // 接口需要登录验证
export class AiModelController {
  constructor(
    private readonly modelService: AiModelService,
    @Inject(forwardRef(() => AIClientService))
    private readonly aiClientService: AIClientService,
  ) {}

  private serializeModel(model: AiModel) {
    const reasoningProfile = resolveModelReasoningProfile({
      providerName: model.provider?.name,
      modelId: model.modelId,
    });

    return {
      ...model,
      reasoningCapability: reasoningProfile.capability,
      reasoningStrategy: reasoningProfile.strategy,
      reasoningIntegration: reasoningProfile.integration,
      reasoningBadgeLabel: reasoningProfile.badgeLabel,
    };
  }

  /**
   * 创建模型
   */
  @Post('create')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: '创建AI模型',
    description: '创建新的AI模型，模型ID必须唯一。',
  })
  @ApiBody({ type: CreateModelDto })
  @ApiResponse({
    status: 200,
    description: '创建成功',
    schema: {
      example: {
        code: 0,
        data: {
          id: '627d8c93-877d-486d-9bd1-9c1a3e9141e8',
          modelName: 'GPT-4 Turbo',
          modelId: 'gpt-4-turbo',
          inputPrice: 0.01,
          outputPrice: 0.03,
          contextLength: 128000,
          maxOutput: 4096,
          availability: 99.9,
          tps: 1000,
          description: '大语言模型',
          isActive: true,
          providerId: '627d8c93-877d-486d-9bd1-9c1a3e9141e8',
          createdAt: '2025-11-21T00:00:00.000Z',
          updatedAt: '2025-11-21T00:00:00.000Z',
        },
        message: '操作成功',
      },
    },
  })
  @ApiResponse({ status: 400, description: '参数错误或模型ID已存在' })
  @ApiResponse({ status: 401, description: '未授权，请先登录' })
  @ApiResponse({ status: 403, description: '无权限操作' })
  async create(@Body() createModelDto: CreateModelDto) {
    return this.modelService.create(createModelDto);
  }

  /**
   * 获取所有模型
   */
  @Get('list')
  @ApiOperation({
    summary: '获取模型列表',
    description: '获取所有AI模型列表，可选择是否包含关联的供应商信息。',
  })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    schema: {
      example: {
        code: 0,
        data: [
          {
            id: '627d8c93-877d-486d-9bd1-9c1a3e9141e8',
            modelName: 'GPT-4 Turbo',
            modelId: 'gpt-4-turbo',
            inputPrice: 0.01,
            outputPrice: 0.03,
            contextLength: 128000,
            maxOutput: 4096,
            availability: 99.9,
            tps: 1000,
            isActive: true,
            providerId: '627d8c93-877d-486d-9bd1-9c1a3e9141e8',
            createdAt: '2025-11-21T00:00:00.000Z',
            updatedAt: '2025-11-21T00:00:00.000Z',
          },
        ],
        message: '操作成功',
      },
    },
  })
  @ApiResponse({ status: 401, description: '未授权，请先登录' })
  async findAll(@Query('includeProvider') includeProvider?: string) {
    const models = await this.modelService.findAll(includeProvider === 'true');
    return models.map((model) => this.serializeModel(model));
  }

  /**
   * 获取单个模型详情
   */
  @Get('detail')
  @ApiOperation({
    summary: '获取模型详情',
    description: '根据ID获取AI模型详情，可选择是否包含关联的供应商信息。',
  })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 401, description: '未授权，请先登录' })
  @ApiResponse({ status: 404, description: '模型不存在' })
  async findOne(
    @Query('id') id: string,
    @Query('includeProvider') includeProvider?: string,
  ) {
    const model = await this.modelService.findOne(id, includeProvider === 'true');
    return this.serializeModel(model);
  }

  /**
   * 根据模型ID获取模型
   */
  @Get('detail-by-model-id')
  @ApiOperation({
    summary: '根据模型ID获取模型',
    description: '根据modelId获取模型详情，可选择是否包含关联的供应商信息。',
  })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 401, description: '未授权，请先登录' })
  @ApiResponse({ status: 404, description: '模型不存在' })
  async findByModelId(
    @Query('modelId') modelId: string,
    @Query('includeProvider') includeProvider?: string,
  ) {
    const model = await this.modelService.findByModelId(
      modelId,
      includeProvider === 'true',
    );
    return this.serializeModel(model);
  }

  /**
   * 根据供应商ID获取模型列表（已登录用户）
   */
  @Get('list-by-provider')
  @ApiOperation({
    summary: '根据供应商ID获取模型列表',
    description: '获取指定供应商下的所有模型。【需登录】',
  })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 401, description: '未授权，请先登录' })
  async findByProviderId(@Query('providerId') providerId: string) {
    const models = await this.modelService.findByProviderId(providerId);
    return models.map((model) => this.serializeModel(model));
  }

  /**
   * 获取启用的模型列表
   */
  @Get('list-active')
  @ApiOperation({
    summary: '获取启用的模型列表',
    description: '获取所有已启用的AI模型列表。',
  })
  @ApiQuery({
    name: 'includeProvider',
    required: false,
    description: '是否包含供应商信息',
  })
  @ApiQuery({
    name: 'category',
    required: false,
    enum: ['chat', 'image', 'video', 'voice'],
    description: '按模型分类筛选（chat/image/video/voice）',
  })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 401, description: '未授权，请先登录' })
  async findActiveModels(
    @Query('includeProvider') includeProvider?: string,
    @Query('category') category?: 'chat' | 'image' | 'video' | 'voice',
  ) {
    const models = await this.modelService.findActiveModels(
      includeProvider === 'true',
      category,
    );
    return models.map((model) => this.serializeModel(model));
  }

  /**
   * 更新模型
   */
  @Post('update')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: '更新模型',
    description: '根据ID更新AI模型信息。',
  })
  @ApiBody({ type: UpdateModelDto })
  @ApiResponse({ status: 200, description: '更新成功' })
  @ApiResponse({ status: 401, description: '未授权，请先登录' })
  @ApiResponse({ status: 403, description: '无权限操作' })
  @ApiResponse({ status: 404, description: '模型不存在' })
  async update(
    @Query('id') id: string,
    @Body() updateModelDto: UpdateModelDto,
  ) {
    const model = await this.modelService.update(id, updateModelDto);
    return this.serializeModel(model);
  }

  /**
   * 删除模型
   */
  @Post('delete')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: '删除模型',
    description: '根据ID删除AI模型。',
  })
  @ApiResponse({ status: 200, description: '删除成功' })
  @ApiResponse({ status: 401, description: '未授权，请先登录' })
  @ApiResponse({ status: 403, description: '无权限操作' })
  @ApiResponse({ status: 404, description: '模型不存在' })
  async remove(@Query('id') id: string) {
    await this.modelService.remove(id);
    return { message: '删除成功' };
  }

  /**
   * 测试模型响应速度（超管专享）
   */
  @Post('test-latency')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: '测试模型响应速度',
    description: '通过发送微型流式探针测试指定模型的端到端首字与往返延迟（超管权限）。',
  })
  @ApiQuery({
    name: 'id',
    required: true,
    description: '模型主键ID或modelId',
  })
  @ApiResponse({ status: 200, description: '测速完成' })
  @ApiResponse({ status: 401, description: '未授权，请先登录' })
  @ApiResponse({ status: 403, description: '无权限操作' })
  async testLatency(@Query('id') id: string) {
    return this.aiClientService.testModelLatency(id);
  }

  /**
   * 设为系统默认模型（超管）
   */
  @Post('set-default')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: '设为系统默认模型',
    description: '将指定模型设为分类默认模型，自动取消同分类其他默认标记（超管权限）。',
  })
  @ApiQuery({
    name: 'id',
    required: true,
    description: '模型主键ID或modelId',
  })
  @ApiResponse({ status: 200, description: '设置成功' })
  @ApiResponse({ status: 401, description: '未授权，请先登录' })
  @ApiResponse({ status: 403, description: '无权限操作' })
  async setDefault(@Query('id') id: string) {
    const model = await this.modelService.setDefaultModel(id);
    return this.serializeModel(model);
  }
}
