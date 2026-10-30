import { Logger } from '@nestjs/common';
import { DWClient, TOPIC_ROBOT } from 'dingtalk-stream';
import {
  ChannelStatusInfo,
  IChannelDriver,
  InboundMessageHandler,
} from './channel-driver.interface';

/**
 * 钉钉机器人驱动 (官方 Stream 模式长连接 + sessionWebhook / OpenAPI 回复)
 */
export class DingtalkDriver implements IChannelDriver {
  readonly channelType = 'dingtalk';
  private readonly logger = new Logger(DingtalkDriver.name);

  private isRunning = false;
  private client: DWClient | null = null;
  private clientId = '';
  private clientSecret = '';
  private boundModelId: string | null = null;
  private systemPrompt: string | null = null;
  private status: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected';
  private lastError: string | null = null;
  private connectedAt: string | null = null;
  // 会话缓存: targetId -> sessionWebhook
  private readonly sessionWebhooks = new Map<string, { url: string; expiresAt: number }>();

  constructor(
    private readonly inboundHandler: InboundMessageHandler,
    private readonly onCredentialsUpdate: (credentials: Record<string, any>) => Promise<void>,
  ) {}

  configure(config: {
    boundModelId?: string | null;
    systemPrompt?: string | null;
    credentials?: Record<string, any>;
  }) {
    this.boundModelId = config.boundModelId || null;
    this.systemPrompt = config.systemPrompt || null;
    this.clientId = config.credentials?.appId || config.credentials?.clientId || '';
    this.clientSecret = config.credentials?.appSecret || config.credentials?.clientSecret || '';
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    if (!this.clientId || !this.clientSecret) {
      this.status = 'disconnected';
      this.lastError = '缺少 Client ID 或 Client Secret';
      return;
    }

    this.isRunning = true;
    this.status = 'connecting';
    this.lastError = null;

    try {
      this.client = new DWClient({
        clientId: this.clientId,
        clientSecret: this.clientSecret,
        debug: false,
      });

      this.client.registerCallbackListener(TOPIC_ROBOT, async (res: any) => {
        try {
          const messageId = res?.headers?.messageId;
          if (messageId && this.client) {
            this.client.socketCallBackResponse(messageId, { status: 200 });
          }
          await this.handleRobotMessage(res?.data);
        } catch (err: any) {
          this.logger.error(`钉钉消息处理异常: ${err.message}`, err.stack);
        }
      });

      await this.client.connect();
      this.status = 'connected';
      this.connectedAt = new Date().toISOString();
      this.logger.log(`钉钉机器人 Stream 长连接建立成功 [ClientId: ${this.clientId}]`);
    } catch (err: any) {
      this.status = 'error';
      this.lastError = err.message || '钉钉 Stream 连接失败';
      this.logger.error(`钉钉机器人启动失败: ${err.message}`, err.stack);
      this.isRunning = false;
    }
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    if (this.client) {
      try {
        this.client.disconnect();
      } catch (e: any) {
        this.logger.warn(`关闭钉钉连接异常: ${e.message}`);
      }
      this.client = null;
    }
    this.status = 'disconnected';
    this.logger.log('钉钉机器人已停止');
  }

  async getStatus(): Promise<ChannelStatusInfo> {
    return {
      channelType: this.channelType,
      name: '钉钉 (Stream 模式)',
      isEnabled: this.isRunning,
      status: this.status,
      boundModelId: this.boundModelId,
      systemPrompt: this.systemPrompt,
      credentialsMasked: {
        appId: this.clientId ? `${this.clientId.slice(0, 4)}***` : '',
        appSecret: this.clientSecret ? '********' : '',
      },
      lastError: this.lastError,
      connectedAt: this.connectedAt,
    };
  }

  /**
   * 发送钉钉机器人消息 (优先通过 sessionWebhook 极速响应，支持单聊与群聊)
   */
  async sendMessage(to: string, content: string): Promise<boolean> {
    const session = this.sessionWebhooks.get(to);
    if (session && Date.now() < session.expiresAt) {
      try {
        const resp = await fetch(session.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            msgtype: 'text',
            text: { content },
          }),
        });
        if (resp.ok) return true;
        const errText = await resp.text().catch(() => '');
        this.logger.warn(`钉钉 sessionWebhook 发送失败: ${errText}`);
      } catch (err: any) {
        this.logger.warn(`钉钉 sessionWebhook 调用异常: ${err.message}`);
      }
    }

    // 备用：若无 sessionWebhook 或已过期，则通过 DingTalk OpenAPI 发送
    return this.sendViaOpenApi(to, content);
  }

  private async sendViaOpenApi(userId: string, content: string): Promise<boolean> {
    if (!this.client) return false;
    try {
      const accessToken = await this.client.getAccessToken();
      const resp = await fetch('https://api.dingtalk.com/v1.0/robot/oToMessages/batchSend', {
        method: 'POST',
        headers: {
          'x-acs-dingtalk-access-token': accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          robotCode: this.clientId,
          userIds: [userId],
          msgKey: 'sampleText',
          msgParam: JSON.stringify({ content }),
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        this.logger.error(`钉钉 OpenAPI 发送消息失败: ${errText}`);
        return false;
      }
      return true;
    } catch (err: any) {
      this.logger.error(`钉钉 OpenAPI 发送异常: ${err.message}`);
      return false;
    }
  }

  private async handleRobotMessage(raw: any): Promise<void> {
    let payload = raw;
    if (typeof raw === 'string') {
      try {
        payload = JSON.parse(raw);
      } catch {
        return;
      }
    }

    if (!payload) return;

    const rawText = payload?.text?.content || '';
    const cleanText = rawText.trim();
    if (!cleanText) return;

    const senderStaffId = payload?.senderStaffId || payload?.senderId;
    const conversationId = payload?.conversationId;
    const conversationType = payload?.conversationType; // '1' 单聊, '2' 群聊
    const isGroup = conversationType === '2';
    const targetId = isGroup && conversationId ? conversationId : senderStaffId;

    if (!targetId) {
      this.logger.warn('无法解析钉钉消息发送方 ID，跳过');
      return;
    }

    // 缓存 sessionWebhook (有效期 90 分钟，留 5 分钟缓冲)
    if (payload.sessionWebhook) {
      this.sessionWebhooks.set(targetId, {
        url: payload.sessionWebhook,
        expiresAt: Date.now() + 85 * 60 * 1000,
      });
    }

    this.logger.log(`钉钉收到用户消息 [${isGroup ? '群聊' : '单聊'} ${targetId}]: ${cleanText.slice(0, 50)}`);

    // 统一交由 ChannelManagerService 调度
    await this.inboundHandler(this.channelType, targetId, cleanText);
  }
}
