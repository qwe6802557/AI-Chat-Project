import { Controller, Get, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { ResponseDto } from '../../common/dto/response.dto';

@ApiTags('用户管理')
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * 创建用户
   */
  @Post('create')
  @ApiOperation({
    summary: '创建用户',
    description: '创建新用户，密码将自动加密存储。用户名、手机号、邮箱必须唯一。',
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

    // 返回时排除密码字段
    const { password, ...userWithoutPassword } = user;

    return userWithoutPassword;
  }

  /**
   * 获取所有用户
   */
  @Get('list')
  @ApiOperation({
    summary: '获取用户列表',
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
}

