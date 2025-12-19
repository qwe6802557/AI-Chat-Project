import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatSession } from './entities/chat-session.entity';
import { CreateSessionDto, UpdateSessionDto } from './dto';
import { UserService } from '../user/user.service';

/**
 * 聊天会话服务
 */
@Injectable()
export class ChatSessionService {
  private readonly logger = new Logger(ChatSessionService.name);

  constructor(
    @InjectRepository(ChatSession)
    private chatSessionRepository: Repository<ChatSession>,
    private readonly userService: UserService,
  ) {}

  /**
   * 创建新会话
   */
  async create(createSessionDto: CreateSessionDto): Promise<ChatSession> {
    this.logger.log(`创建新会话: userId=${createSessionDto.userId}, dto=${JSON.stringify(createSessionDto)}`);

    // 验证 userId 是否有效
    if (!createSessionDto.userId) {
      this.logger.error('创建会话失败: userId 为空');
      throw new NotFoundException('用户 ID 不能为空');
    }

    // 验证用户是否存在
    const user = await this.userService.findById(createSessionDto.userId);
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const session = this.chatSessionRepository.create({
      userId: createSessionDto.userId,
      title: createSessionDto.title || '新对话',
      lastActiveAt: new Date(),
    });

    this.logger.log(`准备保存会话: ${JSON.stringify(session)}`);

    const savedSession = await this.chatSessionRepository.save(session);
    this.logger.log(`会话创建成功: ${savedSession.id}`);

    return savedSession;
  }

  /**
   * 获取用户的所有会话列表
   */
  async findByUserId(
    userId: string,
    includeArchived: boolean = false,
  ): Promise<ChatSession[]> {
    this.logger.log(`获取用户会话列表: userId=${userId}`);

    const queryBuilder = this.chatSessionRepository
      .createQueryBuilder('session')
      .loadRelationCountAndMap('session.messageCount', 'session.chatMessages')
      .where('session.userId = :userId', { userId })
      .andWhere('session.isDeleted = :isDeleted', { isDeleted: false });

    if (!includeArchived) {
      queryBuilder.andWhere('session.isArchived = :isArchived', {
        isArchived: false,
      });
    }

    const sessions = await queryBuilder
      .orderBy('session.lastActiveAt', 'DESC')
      .addOrderBy('session.createdAt', 'DESC')
      .getMany();

    return sessions;
  }

  /**
   * 根据 ID 获取会话详情
   */
  async findById(sessionId: string): Promise<ChatSession> {
    const session = await this.chatSessionRepository.findOne({
      where: { id: sessionId, isDeleted: false },
      relations: ['chatMessages'],
    });

    if (!session) {
      throw new NotFoundException('会话不存在');
    }

    session.messageCount = session.chatMessages?.length || 0;
    return session;
  }

  /**
   * 更新会话
   */
  async update(
    sessionId: string,
    updateSessionDto: UpdateSessionDto,
  ): Promise<ChatSession> {
    this.logger.log(`更新会话: sessionId=${sessionId}, dto=${JSON.stringify(updateSessionDto)}`);

    // 查询会话（不加载 chatMessages 关联，节省性能）
    const session = await this.chatSessionRepository.findOne({
      where: { id: sessionId, isDeleted: false },
    });

    if (!session) {
      throw new NotFoundException('会话不存在');
    }

    // 更新字段
    if (updateSessionDto.title !== undefined) {
      session.title = updateSessionDto.title;
    }
    if (updateSessionDto.isArchived !== undefined) {
      session.isArchived = updateSessionDto.isArchived;
    }
    if (updateSessionDto.isDeleted !== undefined) {
      session.isDeleted = updateSessionDto.isDeleted;
    }

    const savedSession = await this.chatSessionRepository.save(session);
    this.logger.log(`会话更新成功: ${savedSession.id}, title=${savedSession.title}`);

    return savedSession;
  }

  /**
   * 更新会话的最后活跃时间和消息预览
   */
  async updateLastActivity(
    sessionId: string,
    messagePreview: string,
  ): Promise<void> {
    await this.chatSessionRepository.update(sessionId, {
      lastActiveAt: new Date(),
      lastMessagePreview: messagePreview,
    });
  }

  /**
   * 删除会话-软删除
   */
  async delete(sessionId: string): Promise<void> {
    this.logger.log(`删除会话: sessionId=${sessionId}`);
    await this.update(sessionId, { isDeleted: true });
  }

  /**
   * 清空用户的所有会话（批量软删除）
   *
   * 实现说明：
   * - 这是软删除操作，只将 isDeleted 标记为 true，数据仍保留在数据库中
   * - 会话关联的消息（ChatMessage）和附件文件（ChatAttachment）不会被删除
   * - 如需释放存储空间，需要配合定时任务进行硬删除清理
   *
   * 建议的定期清理策略（可后续实现）：
   * - 条件：isDeleted = true 且 updatedAt < 30天前
   * - 操作：DELETE 会话及关联的消息和附件文件
   *
   * @param userId 用户 ID
   * @returns 被删除的会话数量
   */
  async clearAllByUserId(userId: string): Promise<{ deletedCount: number }> {
    this.logger.log(`清空用户所有会话: userId=${userId}`);

    // 验证用户是否存在
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    // 批量软删除：将该用户所有未删除的会话标记为已删除
    const result = await this.chatSessionRepository
      .createQueryBuilder()
      .update(ChatSession)
      .set({ isDeleted: true })
      .where('userId = :userId', { userId })
      .andWhere('isDeleted = :isDeleted', { isDeleted: false })
      .execute();

    const deletedCount = result.affected || 0;
    this.logger.log(`已清空 ${deletedCount} 个会话`);

    return { deletedCount };
  }

  /**
   * 归档会话
   */
  async archive(sessionId: string): Promise<ChatSession> {
    this.logger.log(`归档会话: sessionId=${sessionId}`);
    return this.update(sessionId, { isArchived: true });
  }

  /**
   * 取消归档会话
   */
  async unarchive(sessionId: string): Promise<ChatSession> {
    this.logger.log(`取消归档会话: sessionId=${sessionId}`);
    return this.update(sessionId, { isArchived: false });
  }
}

