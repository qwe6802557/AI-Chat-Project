import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { toAuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from './entities/user.entity';
import { CreditsService } from '../credits/credits.service';

@ApiTags('用户管理')
@Controller('user')
@UseGuards(JwtAuthGuard, RolesGuard) // JWT认证 和 角色检查
@ApiBearerAuth() // Swagger 文档标记
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly creditsService: CreditsService,
  ) {}

  /**
   * 创建用户（管理员）
   */
  @Post('create')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: '创建用户（管理员）',
    description:
      '管理员创建用户，无需验证码。密码将自动加密存储。用户名、手机号、邮箱必须唯一。',
  })
  @ApiBody({ type: CreateUserDto })
  @ApiResponse({
    status: 200,
    description: '创建成功',
    schema: {
      example: {
        code: 0,
        data: {
          id: '627d8c93-877d-486d-9bd1-9c1a3e9141e8',
          username: 'testuser',
          phone: '13900139000',
          email: 'test@example.com',
          role: 'user',
          preferences: {
            theme: 'light',
            language: 'zh-CN',
            defaultModel: 'gpt-4o',
          },
          isActive: true,
          createdAt: '2025-11-16T21:10:53.000Z',
          updatedAt: '2025-11-16T21:10:53.000Z',
        },
        message: '操作成功',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: '参数错误或用户名/手机号/邮箱已存在',
    schema: {
      example: {
        code: 1,
        data: null,
        message: '用户名已存在',
      },
    },
  })
  async create(@Body() createUserDto: CreateUserDto) {
    const user = await this.userService.create(createUserDto);
    return toAuthenticatedUser(user);
  }

  /**
   * 获取所有用户（管理员）
   */
  @Get('list')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: '获取用户列表（管理员）',
    description: '获取所有用户列表（不包含密码字段）',
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
            username: 'admin',
            phone: '13800138000',
            email: 'admin@example.com',
            role: 'admin',
            preferences: {
              theme: 'dark',
              language: 'zh-CN',
              defaultModel: 'gpt-4o',
            },
            isActive: true,
            createdAt: '2025-11-16T21:10:53.000Z',
            updatedAt: '2025-11-16T21:10:53.000Z',
          },
        ],
        message: '操作成功',
      },
    },
  })
  async findAll() {
    return this.userService.findAll();
  }

  /**
   * 获取当前用户账户详情
   */
  @Get('account')
  @ApiOperation({
    summary: '获取当前用户账户详情',
    description: '返回当前登录用户的基础资料、积分快照和最近积分流水分页。',
  })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    schema: {
      example: {
        code: 0,
        data: {
          user: {
            id: '627d8c93-877d-486d-9bd1-9c1a3e9141e8',
            username: 'tester',
            email: 'tester@example.com',
            role: 'user',
            isActive: true,
            createdAt: '2025-11-16T21:10:53.000Z',
            updatedAt: '2025-11-16T21:10:53.000Z',
            credits: {
              total: 2000,
              consumed: 100,
              remaining: 1900,
              reserved: 0,
            },
          },
          recentLedger: {
            items: [
              {
                id: 'ledger-1',
                type: 'grant',
                title: '注册赠送积分',
                description: '新用户注册赠送积分',
                amount: 2000,
                balanceAfter: 2000,
                createdAt: '2025-11-16T21:10:53.000Z',
              },
              {
                id: 'ledger-2',
                type: 'reserve',
                title: '模型消息扣费',
                description: '模型：GLM-5',
                amount: -100,
                balanceAfter: 1900,
                createdAt: '2025-11-16T21:20:53.000Z',
              },
            ],
            total: 12,
            page: 1,
            pageSize: 10,
            hasMore: true,
          },
        },
        message: '操作成功',
      },
    },
  })
  async getAccount(
    @CurrentUser('id') currentUserId?: string,
    @Query('ledgerPage') ledgerPage?: string,
    @Query('ledgerPageSize') ledgerPageSize?: string,
  ) {
    if (!currentUserId) {
      throw new ForbiddenException('未授权，请先登录');
    }

    const user = await this.userService.findById(currentUserId);
    if (!user) {
      throw new ForbiddenException('当前用户不存在');
    }

    const page = ledgerPage ? Number.parseInt(ledgerPage, 10) : 1;
    const pageSize = ledgerPageSize ? Number.parseInt(ledgerPageSize, 10) : 10;
    const credits = await this.creditsService.getSnapshotForUser(currentUserId);
    const recentLedger = await this.creditsService.getRecentLedgerForUser(
      currentUserId,
      page,
      pageSize,
    );

    return {
      user: {
        ...toAuthenticatedUser(user),
        credits,
      },
      recentLedger,
    };
  }
}
