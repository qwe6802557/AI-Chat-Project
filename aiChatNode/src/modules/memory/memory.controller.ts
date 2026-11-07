import {
  Controller,
  Get,
  Put,
  Delete,
  Post,
  Body,
  Query,
  Param,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AgentCoreProfile } from './entities/agent-core-profile.entity';
import { AgentDailyMemory } from './entities/agent-daily-memory.entity';
import { UpdateCoreProfileDto, QueryDailyMemoryDto } from './dto';
import { MemoryDistillerService } from './services/memory-distiller.service';
import { MemoryContextService } from './services/memory-context.service';

/**
 * 三层长短期记忆引擎控制器
 */
@ApiTags('智能体三层记忆引擎')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller('memory')
export class MemoryController {
  constructor(
    @InjectRepository(AgentCoreProfile)
    private readonly coreProfileRepo: Repository<AgentCoreProfile>,
    @InjectRepository(AgentDailyMemory)
    private readonly dailyMemoryRepo: Repository<AgentDailyMemory>,
    private readonly distillerService: MemoryDistillerService,
    private readonly contextService: MemoryContextService,
  ) {}

  /**
   * 获取用户当前核心画像（Layer 3）
   */
  @ApiOperation({ summary: '获取当前用户长期核心画像' })
  @Get('profile')
  async getProfile(@CurrentUser('id') userId: string) {
    let profile = await this.coreProfileRepo.findOne({ where: { userId } });
    if (!profile) {
      profile = this.coreProfileRepo.create({
        userId,
        preferences: {},
        facts: {},
        rawSummary: '',
        version: 1,
      });
      profile = await this.coreProfileRepo.save(profile);
    }
    return profile;
  }

  /**
   * 用户就地编辑与纠偏核心画像（Layer 3）
   */
  @ApiOperation({ summary: '用户手动纠偏并更新核心画像' })
  @Put('profile')
  async updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateCoreProfileDto,
  ) {
    let profile = await this.coreProfileRepo.findOne({ where: { userId } });
    if (!profile) {
      profile = this.coreProfileRepo.create({
        userId,
        preferences: dto.preferences || {},
        facts: dto.facts || {},
        rawSummary: dto.rawSummary || '',
        version: 1,
      });
    } else {
      if (dto.preferences !== undefined) profile.preferences = dto.preferences;
      if (dto.facts !== undefined) profile.facts = dto.facts;
      if (dto.rawSummary !== undefined) profile.rawSummary = dto.rawSummary;
      profile.version += 1;
    }

    return this.coreProfileRepo.save(profile);
  }

  /**
   * 分页查询日常情境记忆时间线（Layer 2）
   */
  @ApiOperation({ summary: '分页查询日常工作记忆列表' })
  @Get('daily')
  async getDailyMemories(
    @CurrentUser('id') userId: string,
    @Query() query: QueryDailyMemoryDto,
  ) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (query.dateKey) {
      where.dateKey = query.dateKey;
    }
    if (query.category) {
      where.category = query.category;
    }
    if (query.keyword && query.keyword.trim()) {
      where.content = Like(`%${query.keyword.trim()}%`);
    }

    const [items, total] = await this.dailyMemoryRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
      select: [
        'id',
        'userId',
        'sessionId',
        'dateKey',
        'category',
        'content',
        'isArchived',
        'createdAt',
        'updatedAt',
      ],
    });

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 一键遗忘/彻底删除单条记忆（符合隐私与记忆可控要求）
   */
  @ApiOperation({ summary: '彻底删除单条日常记忆' })
  @Delete('daily/:id')
  async deleteDailyMemory(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    const memory = await this.dailyMemoryRepo.findOne({ where: { id, userId } });
    if (!memory) {
      throw new NotFoundException('指定记忆条目不存在');
    }

    await this.dailyMemoryRepo.delete(id);
    return {
      success: true,
      message: '记忆条目已彻底删除',
    };
  }

  /**
   * 手动触发长期画像增量蒸馏
   */
  @ApiOperation({ summary: '手动触发日常记忆向核心画像深度蒸馏' })
  @Post('distill')
  async triggerDistill(@CurrentUser('id') userId: string) {
    return this.distillerService.distillCoreProfile(userId, true);
  }
}
