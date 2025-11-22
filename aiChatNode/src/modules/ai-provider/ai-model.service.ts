import {
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiModel } from './entities/ai-model.entity';
import { CreateModelDto } from './dto/create-model.dto';
import { UpdateModelDto } from './dto/update-model.dto';
import { AiProviderService } from './ai-provider.service';

@Injectable()
export class AiModelService {
  private readonly logger = new Logger(AiModelService.name);

  constructor(
    @InjectRepository(AiModel)
    private modelRepository: Repository<AiModel>,
    private providerService: AiProviderService,
  ) {}

  /**
   * 创建模型
   */
  async create(createModelDto: CreateModelDto): Promise<AiModel> {
    // 供应商是否存在
    await this.providerService.findOne(createModelDto.providerId);

    // 检查模型ID是否已存在
    const existingModel = await this.modelRepository.findOne({
      where: { modelId: createModelDto.modelId },
    });

    if (existingModel) {
      throw new ConflictException('模型ID已存在');
    }

    // 验证可用性范围
    if (
      createModelDto.availability !== undefined &&
      (createModelDto.availability < 0 || createModelDto.availability > 100)
    ) {
      throw new BadRequestException('可用性必须在0-100之间');
    }

    // 创建模型
    const model = this.modelRepository.create(createModelDto);
    const savedModel = await this.modelRepository.save(model);

    this.logger.log(`模型创建成功: ${savedModel.modelName} (${savedModel.id})`);

    return savedModel;
  }

  /**
   * 获取所有模型
   */
  async findAll(includeProvider = false): Promise<AiModel[]> {
    const query = this.modelRepository.createQueryBuilder('model');

    if (includeProvider) {
      query.leftJoinAndSelect('model.provider', 'provider');
    }

    return query.getMany();
  }

  /**
   * 根据供应商ID获取模型列表
   */
  async findByProviderId(providerId: string): Promise<AiModel[]> {
    return this.modelRepository.find({
      where: { providerId },
      relations: ['provider'],
    });
  }

  /**
   * 根据ID获取模型
   */
  async findOne(id: string, includeProvider = false): Promise<AiModel> {
    const query = this.modelRepository.createQueryBuilder('model');

    query.where('model.id = :id', { id });

    if (includeProvider) {
      query.leftJoinAndSelect('model.provider', 'provider');
    }

    const model = await query.getOne();

    if (!model) {
      throw new NotFoundException('模型不存在');
    }

    return model;
  }

  /**
   * 根据模型ID获取模型
   */
  async findByModelId(
    modelId: string,
    includeProvider = false,
  ): Promise<AiModel> {
    const query = this.modelRepository.createQueryBuilder('model');

    query.where('model.modelId = :modelId', { modelId });

    if (includeProvider) {
      query.leftJoinAndSelect('model.provider', 'provider');
    }

    const model = await query.getOne();

    if (!model) {
      throw new NotFoundException('模型不存在');
    }

    return model;
  }

  /**
   * 更新模型
   */
  async update(id: string, updateModelDto: UpdateModelDto): Promise<AiModel> {
    // 检查模型是否存在
    const model = await this.findOne(id);

    // 如果要更新供应商ID，检查新供应商是否存在
    if (updateModelDto.providerId) {
      await this.providerService.findOne(updateModelDto.providerId);
    }

    // 如果要更新模型ID，检查新模型ID是否已被其他模型使用
    if (updateModelDto.modelId && updateModelDto.modelId !== model.modelId) {
      const existingModel = await this.modelRepository.findOne({
        where: { modelId: updateModelDto.modelId },
      });

      if (existingModel) {
        throw new ConflictException('模型ID已存在');
      }
    }

    // 验证可用性范围
    if (
      updateModelDto.availability !== undefined &&
      (updateModelDto.availability < 0 || updateModelDto.availability > 100)
    ) {
      throw new BadRequestException('可用性必须在0-100之间');
    }

    // 更新模型
    await this.modelRepository.update(id, updateModelDto);

    this.logger.log(`模型更新成功: ${id}`);

    return this.findOne(id);
  }

  /**
   * 删除模型
   */
  async remove(id: string): Promise<void> {
    // 检查模型是否存在
    await this.findOne(id);

    // 删除模型
    await this.modelRepository.delete(id);

    this.logger.log(`模型删除成功: ${id}`);
  }

  /**
   * 批量删除供应商下的所有模型
   */
  async removeByProviderId(providerId: string): Promise<void> {
    await this.modelRepository.delete({ providerId });
    this.logger.log(`供应商 ${providerId} 的所有模型已删除`);
  }

  /**
   * 获取启用的模型列表
   */
  async findActiveModels(includeProvider = false): Promise<AiModel[]> {
    const query = this.modelRepository.createQueryBuilder('model');

    query.where('model.isActive = :isActive', { isActive: true });

    if (includeProvider) {
      query.leftJoinAndSelect('model.provider', 'provider');
    }

    return query.getMany();
  }
}
