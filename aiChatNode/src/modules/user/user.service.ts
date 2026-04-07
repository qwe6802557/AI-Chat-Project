import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { User, UserRole } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private configService: ConfigService,
  ) {}

  /**
   * 创建用户
   */
  async create(
    createUserDto: CreateUserDto,
    manager?: EntityManager,
  ): Promise<User> {
    const userRepository = manager
      ? manager.getRepository(User)
      : this.userRepository;

    // 检查用户名是否已存在
    const existingUser = await userRepository.findOne({
      where: { username: createUserDto.username },
    });

    if (existingUser) {
      throw new ConflictException('用户名已存在');
    }

    // 检查邮箱是否已存在
    const existingEmail = await userRepository.findOne({
      where: { email: createUserDto.email },
    });

    if (existingEmail) {
      throw new ConflictException('邮箱已存在');
    }

    // 检查手机号是否已存在（可选-留做后续发短信注册）
    // if (createUserDto.phone) {
    //   const existingPhone = await this.userRepository.findOne({
    //     where: { phone: createUserDto.phone },
    //   });
    //
    //   if (existingPhone) {
    //     throw new ConflictException('手机号已存在');
    //   }
    // }

    // 创建用户
    const user = userRepository.create(createUserDto);
    const savedUser = await userRepository.save(user);

    this.logger.log(`用户创建成功: ${savedUser.username} (${savedUser.id})`);

    return savedUser;
  }

  /**
   * 根据用户名查找用户
   */
  async findByUsername(username: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { username } });
  }

  /**
   * 根据 ID 查找用户
   */
  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  /**
   * 根据手机号查找用户
   */
  async findByPhone(phone: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { phone } });
  }

  /**
   * 根据邮箱查找用户
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  /**
   * 更新用户密码
   */
  async updatePassword(userId: string, hashedPassword: string): Promise<void> {
    await this.userRepository.update(userId, { password: hashedPassword });
    this.logger.log(`用户密码更新成功: ${userId}`);
  }

  /**
   * 查找所有用户
   */
  async findAll(): Promise<User[]> {
    return this.userRepository.find({
      select: [
        'id',
        'username',
        'phone',
        'email',
        'role',
        'isActive',
        'createdAt',
      ],
    });
  }

  /**
   * 初始化超级管理员
   */
  async initSuperAdmin(): Promise<User> {
    const adminUsername = 'admin';

    // 是否已存在管理员
    const existingAdmin = await this.findByUsername(adminUsername);

    if (existingAdmin) {
      this.logger.log('超级管理员已存在，跳过初始化');
      return existingAdmin;
    }

    // 从环境变量读取密码-未配置则生成随机密码
    let adminPassword = this.configService.get<string>('ADMIN_INIT_PASSWORD');
    let isRandomPassword = false;

    if (!adminPassword) {
      // 生成 16 位随机强密码
      adminPassword = this.generateSecurePassword(16);
      isRandomPassword = true;
    }

    // 创建超级管理员
    const admin = this.userRepository.create({
      username: adminUsername,
      password: adminPassword, // BeforeInsert 钩子中自动加密
      email:
        this.configService.get<string>('ADMIN_EMAIL') || 'admin@example.com',
      phone: '13800138000', // 可选
      role: UserRole.ADMIN,
      preferences: {
        theme: 'dark',
        language: 'zh-CN',
        defaultModel: 'gpt-4o',
      },
    });

    const savedAdmin = await this.userRepository.save(admin);

    if (isRandomPassword) {
      this.logger.warn('========================================');
      this.logger.warn('超级管理员已创建，请立即修改密码！');
      this.logger.warn(`用户名: ${adminUsername}`);
      this.logger.warn(`初始密码: ${adminPassword}`);
      this.logger.warn('========================================');
    } else {
      this.logger.log(
        `超级管理员创建成功: ${savedAdmin.username} (${savedAdmin.id})`,
      );
    }

    return savedAdmin;
  }

  /**
   * 生成安全的随机密码
   */
  private generateSecurePassword(length: number): string {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@$!%*#?&';
    const randomBytesBuffer = randomBytes(length);
    return Array.from(
      randomBytesBuffer,
      (byte) => chars[byte % chars.length],
    ).join('');
  }
}
