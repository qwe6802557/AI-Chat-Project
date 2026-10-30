import { Injectable, Logger, OnModuleInit, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChannelConfig, ChannelType } from './entities/channel-config.entity';
import { WeixinDriver } from './drivers/weixin.driver';
import { QqDriver } from './drivers/qq.driver';
import { FeishuDriver } from './drivers/feishu.driver';
import { IChannelDriver, ChannelStatusInfo } from './drivers/channel-driver.interface';
import { AIClientService } from '../chat/services/ai-client.service';
import { AiModelService } from '../ai-provider/ai-model.service';
import { CreditsService } from '../credits/credits.service';
import { CreditBusinessType } from '../credits/types/credits.types';
import { ChatMessage } from '../chat/types/completion.types';

const INITIAL_CHANNELS: Array<{ channelType: ChannelType; name: string }> = [
  { channelType: 'weixin', name: '微信' },
  { channelType: 'feishu', name: '飞书' },
  { channelType: 'dingtalk', name: '钉钉' },
  { channelType: 'wecom_bot', name: '企微智能机器人' },
  { channelType: 'qq', name: 'QQ 机器人' },
];

/**
 * 智能助理多通道中枢管理服务 (多租户独立架构)
 */
@Injectable()
export class ChannelManagerService implements OnModuleInit {
  private readonly logger = new Logger(ChannelManagerService.name);
  // 驱动实例池: Map<userId:channelType, IChannelDriver>
  private readonly drivers = new Map<string, IChannelDriver>();
  // 会话记忆池: Map<userId:channelType:fromId, ChatMessage[]>
  private readonly sessionMemories = new Map<string, ChatMessage[]>();

  constructor(
    @InjectRepository(ChannelConfig)
    private readonly channelRepo: Repository<ChannelConfig>,
    private readonly aiClientService: AIClientService,
    private readonly aiModelService: AiModelService,
    private readonly creditsService: CreditsService,
  ) {}

  async onModuleInit() {
    await this.migrateSchemaIfNeeded();
    await this.restoreActiveDrivers();
  }

  /**
   * 获取或按需实例化用户专属驱动实例
   */
  private getOrCreateDriver(userId: string, channelType: ChannelType): IChannelDriver | undefined {
    const key = `${userId}:${channelType}`;
    if (this.drivers.has(key)) {
      return this.drivers.get(key);
    }

    if (channelType === 'weixin') {
      const driver = new WeixinDriver(
        (_ch, fromId, content) => this.handleInboundMessage(userId, 'weixin', fromId, content),
        async (creds) => {
          await this.updateSettings(userId, 'weixin', { credentials: creds });
          const config = await this.channelRepo.findOne({ where: { userId, channelType: 'weixin' } });
          if (config) {
            config.isEnabled = true;
            config.status = 'connected';
            await this.channelRepo.save(config);
          }
        },
      );
      this.drivers.set(key, driver);
      return driver;
    }

    if (channelType === 'qq') {
      const driver = new QqDriver(
        (_ch, fromId, content) => this.handleInboundMessage(userId, 'qq', fromId, content),
        async (creds) => {
          await this.updateSettings(userId, 'qq', { credentials: creds });
        },
      );
      this.drivers.set(key, driver);
      return driver;
    }

    if (channelType === 'feishu') {
      const driver = new FeishuDriver(
        (_ch, fromId, content) => this.handleInboundMessage(userId, 'feishu', fromId, content),
        async (creds) => {
          await this.updateSettings(userId, 'feishu', { credentials: creds });
        },
      );
      this.drivers.set(key, driver);
      return driver;
    }

    return undefined;
  }

  /**
   * 获取指定用户的全部接入通道列表 (若未初始化则惰性补全)
   */
  async getAllChannels(userId: string): Promise<ChannelStatusInfo[]> {
    await this.initUserConfigs(userId);
    const configs = await this.channelRepo.find({
      where: { userId },
      order: { createdAt: 'ASC' },
    });
    const results: ChannelStatusInfo[] = [];

    for (const conf of configs) {
      const driver = this.getOrCreateDriver(userId, conf.channelType);
      if (driver) {
        const liveStatus = await driver.getStatus();
        const isConnected = conf.isEnabled && liveStatus.status === 'connected';
        results.push({
          ...liveStatus,
          isEnabled: conf.isEnabled,
          status: isConnected ? 'connected' : (conf.isEnabled ? liveStatus.status : 'disconnected'),
          boundModelId: conf.boundModelId,
          systemPrompt: conf.systemPrompt,
        });
      } else {
        results.push({
          channelType: conf.channelType,
          name: conf.name,
          isEnabled: conf.isEnabled,
          status: conf.isEnabled ? 'connecting' : 'disconnected',
          loginStatus: 'idle',
          boundModelId: conf.boundModelId,
          systemPrompt: conf.systemPrompt,
        });
      }
    }

    return results;
  }

  /**
   * 切换指定用户通道启用状态
   */
  async toggleChannel(userId: string, channelType: string, enabled: boolean): Promise<ChannelStatusInfo> {
    const config = await this.channelRepo.findOne({
      where: { userId, channelType: channelType as ChannelType },
    });
    if (!config) throw new NotFoundException(`通道 ${channelType} 不存在`);

    config.isEnabled = enabled;
    config.status = enabled ? 'connecting' : 'disconnected';
    if (!enabled && config.credentials) {
      delete config.credentials.token;
      delete config.credentials.botId;
      delete config.credentials.connectedAt;
    }
    await this.channelRepo.save(config);

    const driver = this.getOrCreateDriver(userId, channelType as ChannelType);
    if (driver) {
      if (enabled) {
        if ('configure' in driver) {
          (driver as any).configure({
            boundModelId: config.boundModelId,
            systemPrompt: config.systemPrompt,
            credentials: config.credentials,
          });
        }
        await driver.start();
      } else {
        await driver.stop();
      }
      return driver.getStatus();
    }

    return {
      channelType: config.channelType,
      name: config.name,
      isEnabled: config.isEnabled,
      status: config.status,
    };
  }

  /**
   * 更新用户通道绑定的模型和配置
   */
  async updateSettings(
    userId: string,
    channelType: string,
    payload: { boundModelId?: string | null; systemPrompt?: string | null; credentials?: Record<string, any> },
  ): Promise<ChannelStatusInfo> {
    const config = await this.channelRepo.findOne({
      where: { userId, channelType: channelType as ChannelType },
    });
    if (!config) throw new NotFoundException(`通道 ${channelType} 不存在`);

    if (payload.boundModelId !== undefined) config.boundModelId = payload.boundModelId;
    if (payload.systemPrompt !== undefined) config.systemPrompt = payload.systemPrompt;
    if (payload.credentials !== undefined) {
      config.credentials = { ...(config.credentials || {}), ...payload.credentials };
    }

    await this.channelRepo.save(config);

    const driver = this.getOrCreateDriver(userId, channelType as ChannelType);
    if (driver && 'configure' in driver) {
      (driver as any).configure({
        boundModelId: config.boundModelId,
        systemPrompt: config.systemPrompt,
        credentials: config.credentials,
      });
      return driver.getStatus();
    }

    return {
      channelType: config.channelType,
      name: config.name,
      isEnabled: config.isEnabled,
      status: config.status,
      boundModelId: config.boundModelId,
      systemPrompt: config.systemPrompt,
    };
  }

  /**
   * 获取指定用户的微信扫码授权二维码
   */
  async getWeixinQrCode(userId: string): Promise<{ qrCodeUrl: string; status: string }> {
    const driver = this.getOrCreateDriver(userId, 'weixin');
    if (!driver || !(driver instanceof WeixinDriver)) {
      throw new NotFoundException('微信通道驱动未就绪');
    }
    return driver.getQrCode();
  }

  /**
   * 服务启动时恢复所有用户的已激活驱动
   */
  private async restoreActiveDrivers() {
    try {
      const configs = await this.channelRepo.find({ where: { isEnabled: true } });
      for (const conf of configs) {
        const driver = this.getOrCreateDriver(conf.userId, conf.channelType);
        if (driver && 'configure' in driver) {
          (driver as any).configure({
            boundModelId: conf.boundModelId,
            systemPrompt: conf.systemPrompt,
            credentials: conf.credentials,
          });

          driver.start().catch((err) =>
            this.logger.error(`自启动用户[${conf.userId}]通道[${conf.channelType}]异常: ${err.message}`),
          );
        }
      }
    } catch (err: any) {
      this.logger.warn(`恢复已激活通道驱动失败: ${err.message}`);
    }
  }

  /**
   * 外部消息处理分发：校验并扣除通道所有者积分，积分耗尽时阻断
   */
  private async handleInboundMessage(
    userId: string,
    channelType: string,
    fromId: string,
    content: string,
  ): Promise<string | null> {
    const config = await this.channelRepo.findOne({
      where: { userId, channelType: channelType as ChannelType },
    });
    if (!config) return null;

    let targetModelId = config.boundModelId;
    if (!targetModelId) {
      const allModels = await this.aiModelService.findAll(true);
      const defaultModel = allModels.find((m) => m.isDefault && m.isActive) || allModels.find((m) => m.isActive);
      targetModelId = defaultModel?.modelId || 'spark-x2.6';
    }

    this.logger.log(
      `[通道入站] 用户[${userId}] 通道[${channelType}] 来源[${fromId}] 消息="${content}" 目标模型[${targetModelId}]`,
    );

    // 1. 积分余额校验：通道所有者可用积分不足时阻断并友好回复
    const model = await this.aiModelService.findByModelId(targetModelId);
    const costCredits = Math.max(1, model?.creditCost || 1);
    const snapshot = await this.creditsService.getSnapshotForUser(userId);

    if (!snapshot || snapshot.remaining < costCredits) {
      this.logger.warn(
        `用户[${userId}]智能助理[${channelType}]可用积分不足 (剩余: ${snapshot?.remaining || 0}, 所需: ${costCredits})`,
      );
      return '可用积分已耗尽, 请联系管理员';
    }

    const sessionKey = `${userId}:${channelType}:${fromId}`;
    const history = this.sessionMemories.get(sessionKey) || [];

    const messages: ChatMessage[] = [];
    if (config.systemPrompt) {
      messages.push({ role: 'system', content: config.systemPrompt });
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
        remark: `智能助理[${channelType}]对话消耗`,
      }).catch((err) => {
        this.logger.error(`扣除用户[${userId}]智能助理积分异常: ${err.message}`);
      });

      return answer;
    } catch (err: any) {
      this.logger.error(`[通道分发] 处理用户[${userId}]通道[${channelType}]外部消息失败: ${err.message}`);
      return '抱歉，当前助理处理消息遇到了临时问题，请稍后重试。';
    }
  }

  /**
   * 为指定用户惰性初始化专属的初始通道记录
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
   * 数据库结构平滑检查与迁移：增加 userId 字段、存量归属超管、索引改造
   */
  private async migrateSchemaIfNeeded() {
    try {
      await this.channelRepo.query(`
        ALTER TABLE channel_config ADD COLUMN IF NOT EXISTS "userId" uuid;
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM users WHERE role = 'admin') THEN
            UPDATE channel_config SET "userId" = (SELECT id FROM users WHERE role = 'admin' LIMIT 1) WHERE "userId" IS NULL;
          END IF;
        END $$;
        ALTER TABLE channel_config DROP CONSTRAINT IF EXISTS "UQ_48a7cf5559d70fd21c1d506b8e5";
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_channel_config_user_type" ON channel_config ("userId", "channelType");
      `);
      this.logger.log('多租户 ChannelConfig 数据表结构校验与迁移就绪');
    } catch (err: any) {
      this.logger.warn(`ChannelConfig 自动迁移检测: ${err.message}`);
    }
  }
}
