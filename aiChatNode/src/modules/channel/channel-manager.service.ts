import { Injectable, Logger, OnModuleInit, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChannelConfig, ChannelType } from './entities/channel-config.entity';
import { WeixinDriver } from './drivers/weixin.driver';
import { QqDriver } from './drivers/qq.driver';
import { IChannelDriver, ChannelStatusInfo } from './drivers/channel-driver.interface';
import { AIClientService } from '../chat/services/ai-client.service';
import { AiModelService } from '../ai-provider/ai-model.service';
import { ChatMessage } from '../chat/types/completion.types';

const INITIAL_CHANNELS: Array<{ channelType: ChannelType; name: string }> = [
  { channelType: 'weixin', name: '微信' },
  { channelType: 'feishu', name: '飞书' },
  { channelType: 'dingtalk', name: '钉钉' },
  { channelType: 'wecom_bot', name: '企微智能机器人' },
  { channelType: 'qq', name: 'QQ 机器人' },
];

@Injectable()
export class ChannelManagerService implements OnModuleInit {
  private readonly logger = new Logger(ChannelManagerService.name);
  private readonly drivers = new Map<string, IChannelDriver>();
  private readonly sessionMemories = new Map<string, ChatMessage[]>();

  constructor(
    @InjectRepository(ChannelConfig)
    private readonly channelRepo: Repository<ChannelConfig>,
    private readonly aiClientService: AIClientService,
    private readonly aiModelService: AiModelService,
  ) {}

  async onModuleInit() {
    await this.initDefaultConfigs();
    this.registerDrivers();
    await this.restoreActiveDrivers();
  }

  async getAllChannels(): Promise<ChannelStatusInfo[]> {
    const configs = await this.channelRepo.find({ order: { createdAt: 'ASC' } });
    const results: ChannelStatusInfo[] = [];

    for (const conf of configs) {
      const driver = this.drivers.get(conf.channelType);
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

  async toggleChannel(channelType: string, enabled: boolean): Promise<ChannelStatusInfo> {
    const config = await this.channelRepo.findOne({ where: { channelType: channelType as ChannelType } });
    if (!config) throw new NotFoundException(`通道 ${channelType} 不存在`);

    config.isEnabled = enabled;
    config.status = enabled ? 'connecting' : 'disconnected';
    if (!enabled && config.credentials) {
      delete config.credentials.token;
      delete config.credentials.botId;
      delete config.credentials.connectedAt;
    }
    await this.channelRepo.save(config);

    const driver = this.drivers.get(channelType);
    if (driver) {
      if (enabled) {
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

  async updateSettings(
    channelType: string,
    payload: { boundModelId?: string | null; systemPrompt?: string | null; credentials?: Record<string, any> },
  ): Promise<ChannelConfig> {
    const config = await this.channelRepo.findOne({ where: { channelType: channelType as ChannelType } });
    if (!config) throw new NotFoundException(`通道 ${channelType} 不存在`);

    if (payload.boundModelId !== undefined) config.boundModelId = payload.boundModelId;
    if (payload.systemPrompt !== undefined) config.systemPrompt = payload.systemPrompt;
    if (payload.credentials) {
      config.credentials = { ...config.credentials, ...payload.credentials };
    }

    const saved = await this.channelRepo.save(config);
    const driver = this.drivers.get(channelType);
    if (driver && 'configure' in driver) {
      (driver as any).configure({
        boundModelId: saved.boundModelId,
        systemPrompt: saved.systemPrompt,
        credentials: saved.credentials,
      });
    }

    return saved;
  }

  async getWeixinQrCode(): Promise<{ qrCodeUrl: string; status: string }> {
    const driver = this.drivers.get('weixin');
    if (!driver || !driver.getQrCode) {
      throw new NotFoundException('微信驱动未初始化或不支持扫码');
    }
    return driver.getQrCode();
  }

  private registerDrivers() {
    const weixinDriver = new WeixinDriver(
      this.handleInboundMessage.bind(this),
      async (creds) => {
        await this.updateSettings('weixin', { credentials: creds });
        const config = await this.channelRepo.findOne({ where: { channelType: 'weixin' } });
        if (config) {
          config.isEnabled = true;
          config.status = 'connected';
          await this.channelRepo.save(config);
        }
      },
    );

    const qqDriver = new QqDriver(
      this.handleInboundMessage.bind(this),
      async (creds) => {
        await this.updateSettings('qq', { credentials: creds });
      },
    );

    this.drivers.set('weixin', weixinDriver);
    this.drivers.set('qq', qqDriver);
  }

  private async restoreActiveDrivers() {
    const configs = await this.channelRepo.find();
    for (const conf of configs) {
      const driver = this.drivers.get(conf.channelType);
      if (driver && 'configure' in driver) {
        (driver as any).configure({
          boundModelId: conf.boundModelId,
          systemPrompt: conf.systemPrompt,
          credentials: conf.credentials,
        });

        if (conf.isEnabled) {
          driver.start().catch((err) => this.logger.error(`自启动通道 ${conf.channelType} 异常: ${err.message}`));
        }
      }
    }
  }

  private async handleInboundMessage(
    channelType: string,
    fromId: string,
    content: string,
  ): Promise<string | null> {
    const config = await this.channelRepo.findOne({ where: { channelType: channelType as ChannelType } });
    if (!config) return null;

    let targetModelId = config.boundModelId;
    if (!targetModelId) {
      const allModels = await this.aiModelService.findAll(true);
      const defaultModel = allModels.find((m) => m.isDefault && m.isActive) || allModels.find((m) => m.isActive);
      targetModelId = defaultModel?.modelId || 'spark-x2.6';
    }

    const sessionKey = `${channelType}:${fromId}`;
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

      return answer;
    } catch (err: any) {
      this.logger.error(`[通道分发] 处理 ${channelType} 外部消息失败: ${err.message}`);
      return '抱歉，当前助理处理消息遇到了临时问题，请稍后重试。';
    }
  }

  private async initDefaultConfigs() {
    for (const item of INITIAL_CHANNELS) {
      const exists = await this.channelRepo.findOne({ where: { channelType: item.channelType } });
      if (!exists) {
        await this.channelRepo.save(
          this.channelRepo.create({
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
  }
}
