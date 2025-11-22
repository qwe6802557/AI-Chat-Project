import {
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiProvider } from './entities/ai-provider.entity';
import { CreateProviderDto } from './dto/create-provider.dto';
import { UpdateProviderDto } from './dto/update-provider.dto';

@Injectable()
export class AiProviderService {
  private readonly logger = new Logger(AiProviderService.name);

  constructor(
    @InjectRepository(AiProvider)
    private providerRepository: Repository<AiProvider>,
  ) {}

  /**
   * 创建供应商
   */
  async create(createProviderDto: CreateProviderDto): Promise<AiProvider> {
    // 检查供应商名称是否已存在
    const existingProvider = await this.providerRepository.findOne({
      where: { name: createProviderDto.name },
    });

    if (existingProvider) {
      throw new ConflictException('供应商名称已存在');
    }

    // 创建供应商
    const provider = this.providerRepository.create(createProviderDto);
    const savedProvider = await this.providerRepository.save(provider);

    this.logger.log(
      `供应商创建成功: ${savedProvider.name} (${savedProvider.id})`,
    );

    return savedProvider;
  }

  /**
   * 获取所有供应商
   */
  async findAll(includeModels = false): Promise<AiProvider[]> {
    const query = this.providerRepository.createQueryBuilder('provider');

    if (includeModels) {
      query.leftJoinAndSelect('provider.models', 'model');
    }

    return query.getMany();
  }

  /**
   * 根据ID获取供应商
   */
  async findOne(id: string, includeModels = false): Promise<AiProvider> {
    const query = this.providerRepository.createQueryBuilder('provider');

    query.where('provider.id = :id', { id });

    if (includeModels) {
      query.leftJoinAndSelect('provider.models', 'model');
    }

    const provider = await query.getOne();

    if (!provider) {
      throw new NotFoundException('供应商不存在');
    }

    return provider;
  }

  /**
   * 更新供应商
   */
  async update(
    id: string,
    updateProviderDto: UpdateProviderDto,
  ): Promise<AiProvider> {
    // 供应商是否存在
    const provider = await this.findOne(id);

    // 如果要更新名称，检查新名称是否已被其他供应商使用
    if (updateProviderDto.name && updateProviderDto.name !== provider.name) {
      const existingProvider = await this.providerRepository.findOne({
        where: { name: updateProviderDto.name },
      });

      if (existingProvider) {
        throw new ConflictException('供应商名称已存在');
      }
    }

    // 更新供应商
    await this.providerRepository.update(id, updateProviderDto);

    this.logger.log(`供应商更新成功: ${id}`);

    return this.findOne(id);
  }

  /**
   * 删除供应商
   */
  async remove(id: string): Promise<void> {
    // 检查供应商是否存在
    await this.findOne(id);

    // 删除供应商（级联删除关联的模型）
    await this.providerRepository.delete(id);

    this.logger.log(`供应商删除成功: ${id}`);
  }

  /**
   * 增加访问量
   */
  async incrementAccessCount(id: string): Promise<void> {
    await this.providerRepository.increment({ id }, 'accessCount', 1);
    this.logger.log(`供应商访问量+1: ${id}`);
  }

  /**
   * 根据名称查找供应商
   */
  async findByName(name: string): Promise<AiProvider | null> {
    return this.providerRepository.findOne({ where: { name } });
  }
}
