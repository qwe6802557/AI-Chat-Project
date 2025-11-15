import { Controller, Get, Post, Body } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * 创建用户
   */
  @Post('create')
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
  async findAll() {
    return this.userService.findAll();
  }
}

