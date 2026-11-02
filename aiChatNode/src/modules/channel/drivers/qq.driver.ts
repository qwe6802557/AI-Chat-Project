import { Logger } from '@nestjs/common';
import {
  ChannelStatusInfo,
  IChannelDriver,
  InboundMessageHandler,
} from './channel-driver.interface';
import { ChannelReconnector } from '../utils/channel-reconnector';

const QQ_AUTH_URL = 'https://bots.qq.com/app/getAppAccessToken';
const QQ_API_BASE = 'https://api.sgroup.qq.com';

/**
 * 腾讯 QQ 官方开放平台机器人驱动 (WebSocket Gateway + REST 回复，支持指数退避自愈)
 */
export class QqDriver implements IChannelDriver {
  readonly channelType = 'qq';
  private readonly logger = new Logger(QqDriver.name);

  private isRunning = false;
  private ws: WebSocket | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private appId = '';
  private appSecret = '';
  private accessToken = '';
  private tokenExpiresAt = 0;
  private sessionId = '';
  private lastSeq: number | null = null;
  private boundModelId: string | null = null;
  private systemPrompt: string | null = null;
  private status: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected';
  private lastError: string | null = null;
  private connectedAt: string | null = null;

  private readonly reconnector = new ChannelReconnector(
    async () => {
      if (!this.isRunning) return;
      await this.connectGateway();
    },
    (state) => {
      this.status = state.status;
      if (state.errorMsg) {
        this.lastError = state.errorMsg;
      }
    },
    { initialDelayMs: 2000, maxDelayMs: 60000, maxAttempts: 10, jitter: true },
  );

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
    this.appId = config.credentials?.appId || '';
    this.appSecret = config.credentials?.appSecret || '';
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    if (!this.appId || !this.appSecret) {
      this.status = 'disconnected';
      this.lastError = '缺少 AppID 或 AppSecret';
      return;
    }

    this.isRunning = true;
    this.status = 'connecting';
    this.lastError = null;
    this.reconnector.reset();

    try {
      await this.connectGateway();
    } catch (err: any) {
      this.logger.error(`QQ 机器人初次连接网关异常: ${err.message}`);
      this.reconnector.schedule(err);
    }
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    this.reconnector.destroy();
    this.cleanupSocket();
    this.status = 'disconnected';
  }

  async getStatus(): Promise<ChannelStatusInfo> {
    return {
      channelType: this.channelType,
      name: 'QQ 机器人 (官方开放平台)',
      isEnabled: this.isRunning,
      status: this.status,
      boundModelId: this.boundModelId,
      systemPrompt: this.systemPrompt,
      credentialsMasked: {
        appId: this.appId ? `${this.appId.slice(0, 3)}***` : '',
        appSecret: this.appSecret ? '********' : '',
      },
      lastError: this.lastError,
      connectedAt: this.connectedAt,
    };
  }

  /**
   * 发送 QQ 机器人消息（支持单聊与群聊、优先携带 msg_id 走被动回复通道）
   */
  async sendMessage(
    to: string,
    content: string,
    msgId?: string,
    isGroup?: boolean,
  ): Promise<boolean> {
    if (!this.accessToken) return false;
    try {
      const url = isGroup
        ? `${QQ_API_BASE}/v2/groups/${encodeURIComponent(to)}/messages`
        : `${QQ_API_BASE}/v2/users/${encodeURIComponent(to)}/messages`;

      const bodyPayload: Record<string, any> = {
        content,
        msg_type: 0,
      };

      if (msgId) {
        bodyPayload.msg_id = msgId;
      }

      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `QQBot ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bodyPayload),
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        this.logger.error(`QQ 消息发送失败 HTTP ${resp.status}: ${errText}`);
        return false;
      }
      return true;
    } catch (err: any) {
      this.logger.error(`QQ 消息发送异常: ${err.message}`);
      return false;
    }
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 60000) {
      return this.accessToken;
    }

    const resp = await fetch(QQ_AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appId: this.appId,
        clientSecret: this.appSecret,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error(`获取 QQ AccessToken 失败: HTTP ${resp.status} - ${errText}`);
    }

    const data = await resp.json();
    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + (data.expires_in || 7200) * 1000;
    return this.accessToken;
  }

  private async connectGateway(): Promise<void> {
    const token = await this.getAccessToken();
    const gatewayResp = await fetch(`${QQ_API_BASE}/gateway/bot`, {
      headers: {
        Authorization: `QQBot ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!gatewayResp.ok) {
      const errText = await gatewayResp.text().catch(() => '');
      throw new Error(`获取 QQ Gateway 失败: HTTP ${gatewayResp.status} - ${errText}`);
    }

    const gatewayData = await gatewayResp.json();
    const wsUrl = gatewayData.url;

    this.cleanupSocket();
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.logger.log('QQ Gateway WebSocket 连接已建立，发送鉴权');
      const payload = {
        op: 2,
        d: {
          token: `QQBot ${this.accessToken}`,
          intents: (1 << 25) | (1 << 30),
          shard: [0, 1],
        },
      };
      this.ws?.send(JSON.stringify(payload));
    };

    this.ws.onmessage = (event) => {
      try {
        const raw = JSON.parse(event.data.toString());
        const { op, d, s, t } = raw;
        if (s) this.lastSeq = s;

        if (op === 10) {
          const interval = d.heartbeat_interval || 30000;
          this.startHeartbeat(interval);
        } else if (op === 0) {
          if (t === 'READY') {
            this.status = 'connected';
            this.connectedAt = new Date().toISOString();
            this.sessionId = d.session_id;
            this.lastError = null;
            this.reconnector.reset();
            this.logger.log(`QQ 机器人鉴权成功，Bot: ${d.user?.username || ''}`);
          } else if (t === 'C2C_MESSAGE_CREATE' || t === 'GROUP_AT_MESSAGE_CREATE') {
            this.handleEventMessage(t, d);
          }
        }
      } catch (e: any) {
        this.logger.error(`解析 QQ 消息帧异常: ${e.message}`);
      }
    };

    this.ws.onerror = (err: any) => {
      this.logger.error(`QQ WebSocket 错误: ${err.message || 'unknown'}`);
      this.lastError = '连接断开或网络异常';
    };

    this.ws.onclose = () => {
      this.cleanupSocket();
      if (this.isRunning) {
        this.reconnector.schedule(new Error('QQ Gateway 连接已关闭'));
      } else {
        this.status = 'disconnected';
      }
    };
  }

  private handleEventMessage(eventType: string, d: any) {
    const rawContent = (d.content || '').trim();
    const cleanContent = rawContent.replace(/<@!\d+>/g, '').trim();
    const isGroup = eventType === 'GROUP_AT_MESSAGE_CREATE';
    const targetId = isGroup
      ? (d.group_openid || '')
      : (d.author?.user_openid || d.author?.id || '');
    const contextFromId = isGroup
      ? `${d.group_openid}:${d.author?.member_openid || d.author?.id || ''}`
      : targetId;
    const msgId = d.id;

    if (!cleanContent || !targetId) return;

    this.inboundHandler('qq', contextFromId, cleanContent)
      .then((reply) => {
        if (reply) {
          this.sendMessage(targetId, reply, msgId, isGroup);
        }
      })
      .catch((e) => this.logger.error(`QQ 回复生成失败: ${e.message}`));
  }

  private startHeartbeat(interval: number) {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ op: 1, d: this.lastSeq }));
      }
    }, interval);
  }

  private cleanupSocket() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
