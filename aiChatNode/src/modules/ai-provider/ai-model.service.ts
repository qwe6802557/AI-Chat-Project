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
import { resolveModelVisionProfile } from '../chat/utils/vision-profile.util';

@Injectable()
export class AiModelService {
  private readonly logger = new Logger(AiModelService.name);

  constructor(
    @InjectRepository(AiModel)
    private modelRepository: Repository<AiModel>,
    private providerService: AiProviderService,
  ) {}

  /**
   * 校验模型视觉能力配置，禁止对不支持视觉的纯文本或非对话模型开启视觉开关
   */
  private assertVisionSettingAllowed(params: {
    providerName?: string | null;
    modelId: string;
    category?: string | null;
    requestedSupportsVision?: boolean;
  }) {
    const visionProfile = resolveModelVisionProfile({
      providerName: params.providerName,
      modelId: params.modelId,
      category: params.category,
    });

    if (
      params.requestedSupportsVision === true &&
      visionProfile.capability === 'unsupported'
    ) {
      throw new BadRequestException(
        visionProfile.reason || '当前模型不支持视觉图像输入，无法开启视觉开关',
      );
    }

    return visionProfile;
  }

  /**
   * 创建模型
   */
  async create(createModelDto: CreateModelDto): Promise<AiModel> {
    // 供应商是否存在
    const provider = await this.providerService.findOne(createModelDto.providerId);

    this.assertVisionSettingAllowed({
      providerName: provider.name,
      modelId: createModelDto.modelId,
      category: createModelDto.category ?? 'chat',
      requestedSupportsVision: createModelDto.supportsVision,
    });

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
    const model = this.modelRepository.create({
      ...createModelDto,
      supportsVision: Boolean(createModelDto.supportsVision),
    });
    const savedModel = await this.modelRepository.save(model);
    savedModel.provider = provider;

    this.logger.log(`模型创建成功: ${savedModel.modelName} (${savedModel.id})`);

    return savedModel;
  }

  /**
   * 获取所有模型
   */
  async findAll(includeProvider = false): Promise<AiModel[]> {
    const query = this.modelRepository.createQueryBuilder('model');

    if (includeProvider) {
      query
        .leftJoinAndSelect('model.provider', 'provider')
        .andWhere('(provider.id IS NULL OR provider.isActive = :providerActive)', {
          providerActive: true,
        });
    }

    query
      .orderBy('model.isDefault', 'DESC')
      .addOrderBy('model.sortOrder', 'ASC')
      .addOrderBy('model.createdAt', 'ASC');

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
   * 根据模型ID获取模型-不存在时返回 null
   */
  async findByModelIdOrNull(
    modelId: string,
    includeProvider = false,
  ): Promise<AiModel | null> {
    const query = this.modelRepository.createQueryBuilder('model');

    query.where('model.modelId = :modelId', { modelId });

    if (includeProvider) {
      query.leftJoinAndSelect('model.provider', 'provider');
    }

    return query.getOne();
  }

  /**
   * 更新模型
   */
  async update(id: string, updateModelDto: UpdateModelDto): Promise<AiModel> {
    // 检查模型是否存在并加载所属供应商用于能力校验
    const model = await this.findOne(id, true);

    let targetProviderName = model.provider?.name;
    // 如果要更新供应商ID，检查新供应商是否存在
    if (updateModelDto.providerId) {
      const targetProvider = await this.providerService.findOne(
        updateModelDto.providerId,
      );
      targetProviderName = targetProvider.name;
    }

    const visionProfile = this.assertVisionSettingAllowed({
      providerName: targetProviderName,
      modelId: updateModelDto.modelId ?? model.modelId,
      category: updateModelDto.category ?? model.category,
      requestedSupportsVision: updateModelDto.supportsVision,
    });

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

    const payload: UpdateModelDto =
      visionProfile.capability === 'unsupported' && model.supportsVision
        ? { ...updateModelDto, supportsVision: false }
        : updateModelDto;

    // 更新模型
    await this.modelRepository.update(id, payload);

    this.logger.log(`模型更新成功: ${id}`);

    return this.findOne(id, true);
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
  async findActiveModels(
    includeProvider = false,
    category?: 'chat' | 'image' | 'video' | 'voice',
  ): Promise<AiModel[]> {
    const query = this.modelRepository.createQueryBuilder('model');

    query
      .where('model.isActive = :isActive', { isActive: true })
      .orderBy('model.isDefault', 'DESC')
      .addOrderBy('model.sortOrder', 'ASC')
      .addOrderBy('model.createdAt', 'ASC');

    if (category) {
      query.andWhere('model.category = :category', { category });
    }

    if (includeProvider) {
      query.leftJoinAndSelect('model.provider', 'provider');
    }

    return query.getMany();
  }

  /**
   * 将指定模型设为系统默认模型（超管）
   */
  async setDefaultModel(id: string): Promise<AiModel> {
    let targetModel: AiModel | null = null;
    try {
      targetModel = await this.findOne(id);
    } catch {
      targetModel = await this.findByModelId(id);
    }

    if (!targetModel) {
      throw new NotFoundException(`模型 ${id} 不存在`);
    }

    // 1. 取消同类已有默认标记
    await this.modelRepository.update(
      { category: targetModel.category },
      { isDefault: false },
    );

    // 2. 将目标模型设为默认，同时确保其启用且 sortOrder 设为 0
    await this.modelRepository.update(targetModel.id, {
      isDefault: true,
      isActive: true,
      sortOrder: 0,
    });

    this.logger.log(
      `已将模型 ${targetModel.modelName} (${targetModel.modelId}) 设为系统默认模型`,
    );

    return this.findOne(targetModel.id, true);
  }
}
