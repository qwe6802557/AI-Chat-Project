import {
  Injectable,
  Logger,
  OnModuleInit,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChannelConfig, ChannelType } from './entities/channel-config.entity';
import { AgentRole } from './entities/agent-role.entity';
import {
  IChannelDriver,
  ChannelStatusInfo,
} from './drivers/channel-driver.interface';
import { WeixinDriver } from './drivers/weixin.driver';
import { QqDriver } from './drivers/qq.driver';
import { FeishuDriver } from './drivers/feishu.driver';
import { DingtalkDriver } from './drivers/dingtalk.driver';
import { AIClientService } from '../chat/services/ai-client.service';
import { AiModelService } from '../ai-provider/ai-model.service';
import { CreditsService } from '../credits/credits.service';
import { CreditBusinessType } from '../credits/types/credits.types';
import { ChatMessage } from '../chat/types/completion.types';

export const INITIAL_CHANNELS: { channelType: ChannelType; name: string }[] = [
  { channelType: 'weixin', name: '微信 (iLink Bot)' },
  { channelType: 'feishu', name: '飞书机器人' },
  { channelType: 'dingtalk', name: '钉钉机器人' },
  { channelType: 'wecom_bot', name: '企微智能机器人' },
  { channelType: 'qq', name: 'QQ 机器人' },
];

/**
 * 智能助理多通道中枢管理服务 (多实例池化 + 角色解耦架构)
 */
@Injectable()
export class ChannelManagerService implements OnModuleInit {
  private readonly logger = new Logger(ChannelManagerService.name);
  // 驱动实例池: Map<instanceId, IChannelDriver>
  private readonly drivers = new Map<string, IChannelDriver>();
  // 会话记忆池: Map<userId:instanceId:fromId, ChatMessage[]>
  private readonly sessionMemories = new Map<string, ChatMessage[]>();

  constructor(
    @InjectRepository(ChannelConfig)
    private readonly channelRepo: Repository<ChannelConfig>,
    @InjectRepository(AgentRole)
    private readonly roleRepo: Repository<AgentRole>,
    private readonly aiClientService: AIClientService,
    private readonly aiModelService: AiModelService,
    private readonly creditsService: CreditsService,
  ) {}

  async onModuleInit() {
    await this.migrateSchemaIfNeeded();
    await this.restoreActiveDrivers();
  }

  /**
   * 获取或按需实例化通道实例专属驱动
   */
  private getOrCreateDriver(config: ChannelConfig): IChannelDriver | undefined {
    const key = config.id;
    if (this.drivers.has(key)) {
      return this.drivers.get(key);
    }

    let driver: IChannelDriver | undefined;

    if (config.channelType === 'weixin') {
      driver = new WeixinDriver(
        (_ch, fromId, content) => this.handleInboundMessage(config.id, 'weixin', fromId, content),
        async (creds) => {
          await this.updateInstanceSettings(config.userId, config.id, { credentials: creds });
          const updated = await this.channelRepo.findOne({ where: { id: config.id } });
          if (updated) {
            updated.isEnabled = true;
            updated.status = 'connected';
            await this.channelRepo.save(updated);
          }
        },
      );
    } else if (config.channelType === 'qq') {
      driver = new QqDriver(
        (_ch, fromId, content) => this.handleInboundMessage(config.id, 'qq', fromId, content),
        async (creds) => {
          await this.updateInstanceSettings(config.userId, config.id, { credentials: creds });
        },
      );
    } else if (config.channelType === 'feishu') {
      driver = new FeishuDriver(
        (_ch, fromId, content) => this.handleInboundMessage(config.id, 'feishu', fromId, content),
        async (creds) => {
          await this.updateInstanceSettings(config.userId, config.id, { credentials: creds });
        },
      );
    } else if (config.channelType === 'dingtalk') {
      driver = new DingtalkDriver(
        (_ch, fromId, content, contextToken) =>
          this.handleInboundMessage(config.id, 'dingtalk', fromId, content, contextToken),
        async (creds) => {
          await this.updateInstanceSettings(config.userId, config.id, { credentials: creds });
        },
      );
    }

    if (driver) {
      this.drivers.set(key, driver);
    }
    return driver;
  }

  // ================= 角色管理 (AgentRole CRUD) =================

  /**
   * 获取用户的所有智能体角色列表
   */
  async getRoles(userId: string): Promise<AgentRole[]> {
    await this.initUserDefaultRoleIfNeeded(userId);
    return this.roleRepo.find({
      where: { userId },
      order: { isDefault: 'DESC', createdAt: 'ASC' },
    });
  }

  /**
   * 创建新智能体角色
   */
  async createRole(
    userId: string,
    dto: {
      name: string;
      description?: string | null;
      avatar?: string | null;
      boundModelId?: string | null;
      systemPrompt?: string | null;
      isDefault?: boolean;
    },
  ): Promise<AgentRole> {
    if (!dto.name || !dto.name.trim()) {
      throw new BadRequestException('角色名称不能为空');
    }

    const role = this.roleRepo.create({
      userId,
      name: dto.name.trim(),
      description: dto.description || null,
      avatar: dto.avatar || null,
      boundModelId: dto.boundModelId || null,
      systemPrompt: dto.systemPrompt || null,
      isDefault: !!dto.isDefault,
    });

    return this.roleRepo.save(role);
  }

  /**
   * 更新智能体角色
   */
  async updateRole(
    userId: string,
    roleId: string,
    dto: {
      name?: string;
      description?: string | null;
      avatar?: string | null;
      boundModelId?: string | null;
      systemPrompt?: string | null;
      isDefault?: boolean;
    },
  ): Promise<AgentRole> {
    const role = await this.roleRepo.findOne({ where: { id: roleId, userId } });
    if (!role) throw new NotFoundException(`角色 ${roleId} 不存在`);

    if (dto.name !== undefined) role.name = dto.name.trim();
    if (dto.description !== undefined) role.description = dto.description;
    if (dto.avatar !== undefined) role.avatar = dto.avatar;
    if (dto.boundModelId !== undefined) role.boundModelId = dto.boundModelId;
    if (dto.systemPrompt !== undefined) role.systemPrompt = dto.systemPrompt;
    if (dto.isDefault !== undefined) role.isDefault = dto.isDefault;

    const saved = await this.roleRepo.save(role);

    // 同步刷新已挂载此角色的活跃驱动配置
    await this.syncRoleToDrivers(saved);

    return saved;
  }

  /**
   * 删除智能体角色
   */
  async deleteRole(userId: string, roleId: string): Promise<void> {
    const role = await this.roleRepo.findOne({ where: { id: roleId, userId } });
    if (!role) throw new NotFoundException(`角色 ${roleId} 不存在`);

    // 将绑定到该角色的通道实例解除关联
    await this.channelRepo.update({ roleId }, { roleId: null });
    await this.roleRepo.delete(roleId);
  }

  /**
   * 角色更新后，同步刷新已加载驱动的配置
   */
  private async syncRoleToDrivers(role: AgentRole) {
    const boundConfigs = await this.channelRepo.find({
      where: { roleId: role.id, isEnabled: true },
    });
    for (const conf of boundConfigs) {
      const driver = this.drivers.get(conf.id);
      if (driver && 'configure' in driver) {
        (driver as any).configure({
          boundModelId: role.boundModelId || conf.boundModelId,
          systemPrompt: role.systemPrompt || conf.systemPrompt,
          credentials: conf.credentials,
        });
      }
    }
  }

  // ================= 通道多实例管理 (Channel Instances) =================

  /**
   * 获取指定用户的全部接入通道实例列表
   */
  async getAllInstances(userId: string): Promise<ChannelStatusInfo[]> {
    await this.initUserConfigs(userId);
    const configs = await this.channelRepo.find({
      where: { userId },
      relations: ['role'],
      order: { createdAt: 'ASC' },
    });

    const results: ChannelStatusInfo[] = [];

    for (const conf of configs) {
      const driver = this.getOrCreateDriver(conf);
      const effectiveModelId = conf.role?.boundModelId || conf.boundModelId || null;
      const effectiveSystemPrompt = conf.role?.systemPrompt || conf.systemPrompt || null;

      if (driver) {
        const liveStatus = await driver.getStatus();
        const isConnected = conf.isEnabled && liveStatus.status === 'connected';
        results.push({
          ...liveStatus,
          id: conf.id,
          channelType: conf.channelType,
          name: conf.name,
          instanceName: conf.instanceName || conf.name,
          roleId: conf.roleId || null,
          roleName: conf.role?.name || null,
          isEnabled: conf.isEnabled,
          status: isConnected ? 'connected' : conf.isEnabled ? liveStatus.status : 'disconnected',
          boundModelId: effectiveModelId,
          systemPrompt: effectiveSystemPrompt,
        });
      } else {
        results.push({
          id: conf.id,
          channelType: conf.channelType,
          name: conf.name,
          instanceName: conf.instanceName || conf.name,
          roleId: conf.roleId || null,
          roleName: conf.role?.name || null,
          isEnabled: conf.isEnabled,
          status: conf.isEnabled ? 'connecting' : 'disconnected',
          loginStatus: 'idle',
          boundModelId: effectiveModelId,
          systemPrompt: effectiveSystemPrompt,
        });
      }
    }

    return results;
  }

  /**
   * 为指定渠道新建一个机器人实例 (如飞书客服Bot、飞书研发Bot)
   */
  async createInstance(
    userId: string,
    dto: {
      channelType: ChannelType;
      instanceName?: string;
      roleId?: string | null;
      credentials?: Record<string, any>;
    },
  ): Promise<ChannelStatusInfo> {
    const meta = INITIAL_CHANNELS.find((c) => c.channelType === dto.channelType);
    const channelName = meta?.name || dto.channelType;
    const instanceName = dto.instanceName?.trim() || `${channelName} (实例)`;

    const config = this.channelRepo.create({
      userId,
      channelType: dto.channelType,
      name: channelName,
      instanceName,
      roleId: dto.roleId || null,
      isEnabled: false,
      status: 'disconnected',
      credentials: dto.credentials || {},
      metadata: {},
    });

    const saved = await this.channelRepo.save(config);
    return this.getInstanceStatus(userId, saved.id);
  }

  /**
   * 删除指定的通道实例 (同时停用驱动并释放连接)
   */
  async deleteInstance(userId: string, instanceId: string): Promise<void> {
    const config = await this.channelRepo.findOne({ where: { id: instanceId, userId } });
    if (!config) throw new NotFoundException(`实例 ${instanceId} 不存在`);

    // 停用并移除驱动
    const driver = this.drivers.get(instanceId);
    if (driver) {
      try {
        await driver.stop();
      } catch (err: any) {
        this.logger.warn(`停止待销毁实例[${instanceId}]驱动失败: ${err.message}`);
      }
      this.drivers.delete(instanceId);
    }

    await this.channelRepo.delete(instanceId);
  }

  /**
   * 切换指定通道实例的启停状态
   */
  async toggleInstance(userId: string, instanceId: string, enabled: boolean): Promise<ChannelStatusInfo> {
    const config = await this.channelRepo.findOne({
      where: { id: instanceId, userId },
      relations: ['role'],
    });
    if (!config) throw new NotFoundException(`通道实例 ${instanceId} 不存在`);

    config.isEnabled = enabled;
    config.status = enabled ? 'connecting' : 'disconnected';
    if (!enabled && config.credentials) {
      delete config.credentials.token;
      delete config.credentials.botId;
      delete config.credentials.connectedAt;
    }
    await this.channelRepo.save(config);

    const driver = this.getOrCreateDriver(config);
    if (driver) {
      if (enabled) {
        if ('configure' in driver) {
          (driver as any).configure({
            boundModelId: config.role?.boundModelId || config.boundModelId,
            systemPrompt: config.role?.systemPrompt || config.systemPrompt,
            credentials: config.credentials,
          });
        }
        await driver.start();
      } else {
        await driver.stop();
      }
    }

    return this.getInstanceStatus(userId, instanceId);
  }

  /**
   * 更新通道实例配置 (名称、绑定角色、凭证等)
   */
  async updateInstanceSettings(
    userId: string,
    instanceId: string,
    payload: {
      instanceName?: string;
      roleId?: string | null;
      boundModelId?: string | null;
      systemPrompt?: string | null;
      credentials?: Record<string, any>;
    },
  ): Promise<ChannelStatusInfo> {
    const config = await this.channelRepo.findOne({
      where: { id: instanceId, userId },
      relations: ['role'],
    });
    if (!config) throw new NotFoundException(`通道实例 ${instanceId} 不存在`);

    if (payload.instanceName !== undefined) config.instanceName = payload.instanceName.trim();
    if (payload.roleId !== undefined) config.roleId = payload.roleId;
    if (payload.boundModelId !== undefined) config.boundModelId = payload.boundModelId;
    if (payload.systemPrompt !== undefined) config.systemPrompt = payload.systemPrompt;
    if (payload.credentials !== undefined) {
      config.credentials = { ...(config.credentials || {}), ...payload.credentials };
    }

    await this.channelRepo.save(config);

    // 重新拉取带新角色的实体
    const fresh = await this.channelRepo.findOne({
      where: { id: instanceId },
      relations: ['role'],
    });

    const driver = this.getOrCreateDriver(fresh || config);
    if (driver && 'configure' in driver) {
      (driver as any).configure({
        boundModelId: fresh?.role?.boundModelId || fresh?.boundModelId,
        systemPrompt: fresh?.role?.systemPrompt || fresh?.systemPrompt,
        credentials: fresh?.credentials,
      });
    }

    return this.getInstanceStatus(userId, instanceId);
  }

  /**
   * 获取单个实例的即时状态对象
   */
  async getInstanceStatus(userId: string, instanceId: string): Promise<ChannelStatusInfo> {
    const conf = await this.channelRepo.findOne({
      where: { id: instanceId, userId },
      relations: ['role'],
    });
    if (!conf) throw new NotFoundException(`通道实例 ${instanceId} 不存在`);

    const driver = this.getOrCreateDriver(conf);
    const effectiveModelId = conf.role?.boundModelId || conf.boundModelId || null;
    const effectiveSystemPrompt = conf.role?.systemPrompt || conf.systemPrompt || null;

    if (driver) {
      const liveStatus = await driver.getStatus();
      const isConnected = conf.isEnabled && liveStatus.status === 'connected';
      return {
        ...liveStatus,
        id: conf.id,
        channelType: conf.channelType,
        name: conf.name,
        instanceName: conf.instanceName || conf.name,
        roleId: conf.roleId || null,
        roleName: conf.role?.name || null,
        isEnabled: conf.isEnabled,
        status: isConnected ? 'connected' : conf.isEnabled ? liveStatus.status : 'disconnected',
        boundModelId: effectiveModelId,
        systemPrompt: effectiveSystemPrompt,
      };
    }

    return {
      id: conf.id,
      channelType: conf.channelType,
      name: conf.name,
      instanceName: conf.instanceName || conf.name,
      roleId: conf.roleId || null,
      roleName: conf.role?.name || null,
      isEnabled: conf.isEnabled,
      status: conf.status,
      boundModelId: effectiveModelId,
      systemPrompt: effectiveSystemPrompt,
    };
  }

  /**
   * 获取指定用户的微信扫码授权二维码 (可指定实例，默认第一个微信实例)
   */
  async getWeixinQrCode(userId: string, instanceId?: string): Promise<{ qrCodeUrl: string; status: string }> {
    let conf: ChannelConfig | null = null;
    if (instanceId) {
      conf = await this.channelRepo.findOne({ where: { id: instanceId, userId } });
    } else {
      conf = await this.channelRepo.findOne({ where: { userId, channelType: 'weixin' } });
    }

    if (!conf) throw new NotFoundException('未找到可用的微信通道实例');

    const driver = this.getOrCreateDriver(conf);
    if (!driver || !(driver instanceof WeixinDriver)) {
      throw new NotFoundException('微信通道驱动未就绪');
    }
    return driver.getQrCode();
  }

  // ================= 向后兼容兼容方法 =================

  async getAllChannels(userId: string): Promise<ChannelStatusInfo[]> {
    return this.getAllInstances(userId);
  }

  async toggleChannel(userId: string, channelType: string, enabled: boolean): Promise<ChannelStatusInfo> {
    const config = await this.channelRepo.findOne({
      where: { userId, channelType: channelType as ChannelType },
    });
    if (!config) throw new NotFoundException(`通道 ${channelType} 不存在`);
    return this.toggleInstance(userId, config.id, enabled);
  }

  async updateSettings(
    userId: string,
    channelType: string,
    payload: { boundModelId?: string | null; systemPrompt?: string | null; credentials?: Record<string, any> },
  ): Promise<ChannelStatusInfo> {
    const config = await this.channelRepo.findOne({
      where: { userId, channelType: channelType as ChannelType },
    });
    if (!config) throw new NotFoundException(`通道 ${channelType} 不存在`);
    return this.updateInstanceSettings(userId, config.id, payload);
  }

  // ================= 核心长连接恢复与入站分发 =================

  /**
   * 服务启动时恢复所有用户的已激活驱动
   */
  private async restoreActiveDrivers() {
    try {
      const configs = await this.channelRepo.find({
        where: { isEnabled: true },
        relations: ['role'],
      });
      for (const conf of configs) {
        const driver = this.getOrCreateDriver(conf);
        if (driver && 'configure' in driver) {
          (driver as any).configure({
            boundModelId: conf.role?.boundModelId || conf.boundModelId,
            systemPrompt: conf.role?.systemPrompt || conf.systemPrompt,
            credentials: conf.credentials,
          });

          driver.start().catch((err) =>
            this.logger.error(`自启动实例[${conf.id}] 通道[${conf.channelType}]异常: ${err.message}`),
          );
        }
      }
    } catch (err: any) {
      this.logger.warn(`恢复已激活通道驱动失败: ${err.message}`);
    }
  }

  /**
   * 外部消息处理分发：校验并扣除通道所有者积分，基于角色设定生成回复
   */
  private async handleInboundMessage(
    instanceId: string,
    channelType: string,
    fromId: string,
    content: string,
    contextToken?: string,
  ): Promise<string | null> {
    const config = await this.channelRepo.findOne({
      where: { id: instanceId },
      relations: ['role'],
    });
    if (!config) return null;

    const userId = config.userId;
    let targetModelId: string = config.role?.boundModelId || config.boundModelId || '';
    if (!targetModelId) {
      const allModels = await this.aiModelService.findAll(true);
      const defaultModel = allModels.find((m) => m.isDefault && m.isActive) || allModels.find((m) => m.isActive);
      targetModelId = defaultModel?.modelId || 'spark-x2.6';
    }

    const effectivePrompt = config.role?.systemPrompt || config.systemPrompt || null;
    const roleTag = config.role ? `[角色:${config.role.name}]` : '[默认人设]';

    this.logger.log(
      `[通道入站] 用户[${userId}] 实例[${config.instanceName || config.name}] ${roleTag} 来源[${fromId}] 消息="${content}" 目标模型[${targetModelId}]`,
    );

    // 1. 积分余额校验：通道所有者可用积分不足时阻断并友好回复
    const model = await this.aiModelService.findByModelId(targetModelId);
    const costCredits = Math.max(1, model?.creditCost || 1);
    const snapshot = await this.creditsService.getSnapshotForUser(userId);

    if (!snapshot || snapshot.remaining < costCredits) {
      this.logger.warn(
        `用户[${userId}]智能助理[${config.instanceName || channelType}]可用积分不足 (剩余: ${snapshot?.remaining || 0}, 所需: ${costCredits})`,
      );
      return '可用积分已耗尽, 请联系管理员';
    }

    const sessionKey = `${userId}:${instanceId}:${fromId}`;
    const history = this.sessionMemories.get(sessionKey) || [];

    const messages: ChatMessage[] = [];
    if (effectivePrompt) {
      messages.push({ role: 'system', content: effectivePrompt });
    }

    messages.push(...history.slice(-6));
    messages.push({ role: 'user', content });

    try {
      const completion = await this.aiClientService.createChatCompletion(targetModelId, messages);
      const answer = completion.content || '';

      history.push({ role: 'user', content });
      history.push({ role: 'assistant', content: answer });
      this.sessionMemories.set(sessionKey, history.slice(-10));

      // 2. 对话完成，扣除通道所有者积分
      await this.creditsService.deductDirectCredits({
        userId,
        amount: costCredits,
        businessType: CreditBusinessType.CHAT_MESSAGE,
        modelId: targetModelId,
        remark: `智能助理[${config.instanceName || channelType}]对话消耗`,
      }).catch((err) => {
        this.logger.error(`扣除用户[${userId}]智能助理积分异常: ${err.message}`);
      });

      return answer;
    } catch (err: any) {
      this.logger.error(`[通道分发] 处理用户[${userId}]实例[${instanceId}]消息失败: ${err.message}`);
      return '抱歉，当前助理处理消息遇到了临时问题，请稍后重试。';
    }
  }

  /**
   * 为用户惰性初始化默认的初始通道记录
   */
  private async initUserConfigs(userId: string) {
    const existing = await this.channelRepo.find({ where: { userId } });
    if (existing.length >= INITIAL_CHANNELS.length) {
      return;
    }

    const existingTypes = new Set(existing.map((c) => c.channelType));
    const toCreate: ChannelConfig[] = [];

    for (const item of INITIAL_CHANNELS) {
      if (!existingTypes.has(item.channelType)) {
        toCreate.push(
          this.channelRepo.create({
            userId,
            channelType: item.channelType,
            name: item.name,
            instanceName: item.name,
            isEnabled: false,
            status: 'disconnected',
            credentials: {},
            metadata: {},
          }),
        );
      }
    }

    if (toCreate.length > 0) {
      await this.channelRepo.save(toCreate);
    }
  }

  /**
   * 为用户惰性初始化一个默认角色
   */
  private async initUserDefaultRoleIfNeeded(userId: string): Promise<AgentRole> {
    const existingDefault = await this.roleRepo.findOne({ where: { userId, isDefault: true } });
    if (existingDefault) return existingDefault;

    const anyRole = await this.roleRepo.findOne({ where: { userId } });
    if (anyRole) return anyRole;

    const defaultRole = this.roleRepo.create({
      userId,
      name: '通用智能助理',
      description: '全能日常助手，回答专业详实',
      boundModelId: null,
      systemPrompt: '你是一名专业的全能AI智能助理，具备严谨的逻辑分析能力，能够条理清晰地解答用户的各类问题。',
      isDefault: true,
    });
    return this.roleRepo.save(defaultRole);
  }

  /**
   * 数据库结构平滑检查与自动迁移：创建 agent_roles 表、改写 channel_config 索引与字段
   */
  private async migrateSchemaIfNeeded() {
    try {
      // 1. 创建 agent_roles 表与索引
      await this.channelRepo.query(`
        CREATE TABLE IF NOT EXISTS agent_roles (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "userId" uuid NOT NULL,
          name varchar(100) NOT NULL,
          description varchar(255),
          avatar varchar(255),
          "boundModelId" varchar(100),
          "systemPrompt" text,
          "isDefault" boolean DEFAULT false,
          "createdAt" timestamp DEFAULT now(),
          "updatedAt" timestamp DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS "idx_agent_roles_user_id" ON agent_roles ("userId");
      `);

      // 2. 扩展 channel_config 字段
      await this.channelRepo.query(`
        ALTER TABLE channel_config ADD COLUMN IF NOT EXISTS "userId" uuid;
        ALTER TABLE channel_config ADD COLUMN IF NOT EXISTS "instanceName" varchar(100);
        ALTER TABLE channel_config ADD COLUMN IF NOT EXISTS "roleId" uuid;
        
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM users WHERE role = 'admin') THEN
            UPDATE channel_config SET "userId" = (SELECT id FROM users WHERE role = 'admin' LIMIT 1) WHERE "userId" IS NULL;
          END IF;
        END $$;

        -- 移除限制单一实例的唯一约束
        ALTER TABLE channel_config DROP CONSTRAINT IF EXISTS "UQ_48a7cf5559d70fd21c1d506b8e5";
        DROP INDEX IF EXISTS "idx_channel_config_user_type";
        CREATE INDEX IF NOT EXISTS "idx_channel_config_user_id" ON channel_config ("userId");
      `);

      // 3. 数据平滑自动聚合：扫描存量通道配置，自动创建对应角色并关联
      const unlinkedConfigs = await this.channelRepo.find({
        where: { roleId: null as any },
      });

      for (const conf of unlinkedConfigs) {
        if (!conf.instanceName) {
          conf.instanceName = conf.name;
        }

        if (conf.systemPrompt || conf.boundModelId) {
          // 创建专属角色
          const role = this.roleRepo.create({
            userId: conf.userId,
            name: `${conf.name}专属角色`,
            description: `从旧通道[${conf.name}]自动迁移的角色设定`,
            boundModelId: conf.boundModelId || null,
            systemPrompt: conf.systemPrompt || null,
            isDefault: false,
          });
          const savedRole = await this.roleRepo.save(role);
          conf.roleId = savedRole.id;
        } else {
          // 关联到该用户的默认角色
          const defaultRole = await this.initUserDefaultRoleIfNeeded(conf.userId);
          conf.roleId = defaultRole.id;
        }
        await this.channelRepo.save(conf);
      }

      this.logger.log('多实例与角色解耦数据库表结构及存量数据迁移成功就绪');
    } catch (err: any) {
      this.logger.warn(`ChannelConfig/AgentRole 自动迁移检测: ${err.message}`);
    }
  }
}
