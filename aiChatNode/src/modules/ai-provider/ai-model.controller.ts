import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AiModelService } from './ai-model.service';
import { CreateModelDto } from './dto/create-model.dto';
import { UpdateModelDto } from './dto/update-model.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../user/entities/user.entity';

@ApiTags('AI模型管理')
@ApiBearerAuth() // Swagger中显示需要Bearer Token
@Controller('ai-model')
@UseGuards(JwtAuthGuard) // 接口需要登录验证
export class AiModelController {
  constructor(private readonly modelService: AiModelService) {}

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
    return this.modelService.findAll(includeProvider === 'true');
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
    return this.modelService.findOne(id, includeProvider === 'true');
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
    return this.modelService.findByModelId(modelId, includeProvider === 'true');
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
    return this.modelService.findByProviderId(providerId);
  }

  /**
   * 获取启用的模型列表
   */
  @Get('list-active')
  @ApiOperation({
    summary: '获取启用的模型列表',
    description: '获取所有已启用的AI模型列表。',
  })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 401, description: '未授权，请先登录' })
  async findActiveModels(@Query('includeProvider') includeProvider?: string) {
    return this.modelService.findActiveModels(includeProvider === 'true');
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
    return this.modelService.update(id, updateModelDto);
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
}
