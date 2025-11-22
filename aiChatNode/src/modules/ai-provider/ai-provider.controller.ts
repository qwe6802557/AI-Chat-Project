import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AiProviderService } from './ai-provider.service';
import { CreateProviderDto } from './dto/create-provider.dto';
import { UpdateProviderDto } from './dto/update-provider.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../user/entities/user.entity';

@ApiTags('AI供应商管理')
@ApiBearerAuth() // Swagger中显示需要Bearer Token
@Controller('ai-provider')
@UseGuards(JwtAuthGuard) // 所有接口都需要登录验证
export class AiProviderController {
  constructor(private readonly providerService: AiProviderService) {}

  /**
   * 创建供应商
   */
  @Post('create')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: '创建AI供应商',
    description: '创建新的AI供应商，供应商名称必须唯一。',
  })
  @ApiBody({ type: CreateProviderDto })
  @ApiResponse({
    status: 200,
    description: '创建成功',
    schema: {
      example: {
        code: 0,
        data: {
          id: '627d8c93-877d-486d-9bd1-9c1a3e9141e8',
          name: 'OpenAI',
          accessCount: 0,
          description: '智能研究公司',
          website: 'https://openai.com',
          isActive: true,
          createdAt: '2025-11-21T00:00:00.000Z',
          updatedAt: '2025-11-21T00:00:00.000Z',
        },
        message: '操作成功',
      },
    },
  })
  @ApiResponse({ status: 400, description: '参数错误或供应商名称已存在' })
  @ApiResponse({ status: 401, description: '未授权，请先登录' })
  @ApiResponse({ status: 403, description: '无权限操作' })
  async create(@Body() createProviderDto: CreateProviderDto) {
    return this.providerService.create(createProviderDto);
  }

  /**
   * 获取所有供应商
   */
  @Get('list')
  @ApiOperation({
    summary: '获取供应商列表',
    description: '获取所有AI供应商列表，可选择是否包含关联的模型。',
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
            name: 'OpenAI',
            accessCount: 100,
            description: '智能研究公司',
            website: 'https://openai.com',
            isActive: true,
            createdAt: '2025-11-21T00:00:00.000Z',
            updatedAt: '2025-11-21T00:00:00.000Z',
          },
        ],
        message: '操作成功',
      },
    },
  })
  @ApiResponse({ status: 401, description: '未授权，请先登录' })
  async findAll(@Query('includeModels') includeModels?: string) {
    return this.providerService.findAll(includeModels === 'true');
  }

  /**
   * 获取单个供应商（已登录用户）
   */
  @Get('detail')
  @ApiOperation({
    summary: '获取供应商详情',
    description: '根据ID获取AI供应商详情，可选择是否包含关联的模型。',
  })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 401, description: '未授权，请先登录' })
  @ApiResponse({ status: 404, description: '供应商不存在' })
  async findOne(
    @Query('id') id: string,
    @Query('includeModels') includeModels?: string,
  ) {
    return this.providerService.findOne(id, includeModels === 'true');
  }

  /**
   * 更新供应商
   */
  @Post('update')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: '更新供应商',
    description: '根据ID更新AI供应商信息。【仅管理员】',
  })
  @ApiBody({ type: UpdateProviderDto })
  @ApiResponse({ status: 200, description: '更新成功' })
  @ApiResponse({ status: 401, description: '未授权，请先登录' })
  @ApiResponse({ status: 403, description: '无权限操作' })
  @ApiResponse({ status: 404, description: '供应商不存在' })
  async update(
    @Query('id') id: string,
    @Body() updateProviderDto: UpdateProviderDto,
  ) {
    return this.providerService.update(id, updateProviderDto);
  }

  /**
   * 删除供应商
   */
  @Post('delete')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: '删除供应商',
    description: '根据ID删除AI供应商（会级联删除关联的所有模型）。【仅管理员】',
  })
  @ApiResponse({ status: 200, description: '删除成功' })
  @ApiResponse({ status: 401, description: '未授权，请先登录' })
  @ApiResponse({ status: 403, description: '无权限操作' })
  @ApiResponse({ status: 404, description: '供应商不存在' })
  async remove(@Query('id') id: string) {
    await this.providerService.remove(id);
    return { message: '删除成功' };
  }

  /**
   * 增加访问量
   */
  @Post('increment-access')
  @ApiOperation({
    summary: '增加供应商访问量',
    description: '供应商访问量计数器+1。【需登录】',
  })
  @ApiResponse({ status: 200, description: '访问量增加成功' })
  @ApiResponse({ status: 401, description: '未授权，请先登录' })
  async incrementAccessCount(@Query('id') id: string) {
    await this.providerService.incrementAccessCount(id);
    return { message: '访问量增加成功' };
  }
}
