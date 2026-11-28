import { Logger } from '@nestjs/common';
import AiBot, { generateReqId } from '@wecom/aibot-node-sdk';
import type {
  MixedMessage,
  TextMessage,
  VoiceMessage,
  WSClient,
  WsFrame,
} from '@wecom/aibot-node-sdk';
import {
  ChannelStatusInfo,
  IChannelDriver,
  InboundMessageHandler,
} from './channel-driver.interface';
import { ChannelReconnector } from '../utils/channel-reconnector';

const WECOM_MAX_STREAM_BYTES = 20000;
const PROCESSED_MSG_LIMIT = 500;
const THINKING_PLACEHOLDER = '正在调用智能体协同思考，请稍候...';

/**
 * 企业微信智能机器人驱动 (官方 @wecom/aibot-node-sdk WebSocket 长连接 + 流式分段收敛回复)
 */
export class WecomDriver implements IChannelDriver {
  readonly channelType = 'wecom_bot';
  private readonly logger = new Logger(WecomDriver.name);

  private isRunning = false;
  private wsClient: WSClient | null = null;
  private botId = '';
  private secret = '';
  private boundModelId: string | null = null;
  private systemPrompt: string | null = null;
  private status: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected';
  private lastError: string | null = null;
  private connectedAt: string | null = null;
  private readonly processedMsgIds: string[] = [];
  private readonly processedMsgSet = new Set<string>();

  private readonly reconnector = new ChannelReconnector(
    async () => {
      if (!this.isRunning) return;
      await this.connectClient();
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
    this.botId = (config.credentials?.botId || config.credentials?.appId || '').trim();
    this.secret = (config.credentials?.secret || config.credentials?.appSecret || '').trim();
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    if (!this.botId || !this.secret) {
      this.status = 'disconnected';
      this.lastError = '缺少企微 Bot ID 或 Secret';
      return;
    }

    this.isRunning = true;
    this.status = 'connecting';
    this.lastError = null;
    this.reconnector.reset();

    try {
      await this.connectClient();
    } catch (err: any) {
      this.logger.error(`企微机器人初次长连接建立异常: ${err.message}`);
      this.reconnector.schedule(err);
    }
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    this.reconnector.destroy();
    this.teardownClient();
    this.status = 'disconnected';
    this.logger.log('企微智能机器人已停止');
  }

  async getStatus(): Promise<ChannelStatusInfo> {
    return {
      channelType: this.channelType,
      name: '企微智能机器人 (WebSocket)',
      isEnabled: this.isRunning,
      status: this.status,
      boundModelId: this.boundModelId,
      systemPrompt: this.systemPrompt,
      credentialsMasked: {
        botId: this.maskIdentifier(this.botId),
        secret: this.secret ? '********' : '',
      },
      lastError: this.lastError,
      connectedAt: this.connectedAt,
    };
  }

  /**
   * 主动向指定单聊 userid 或群聊 chatid 发送 Markdown 消息
   */
  async sendMessage(to: string, content: string): Promise<boolean> {
    if (!this.wsClient || !to) {
      this.logger.warn('企微长连接客户端未就绪或缺少目标 ID，无法主动推送消息');
      return false;
    }
    try {
      await this.wsClient.sendMessage(to, {
        msgtype: 'markdown',
        markdown: {
          content: this.truncateUtf8(content, WECOM_MAX_STREAM_BYTES),
        },
      });
      return true;
    } catch (err: any) {
      this.logger.error(`企微主动发送消息失败 [${to}]: ${err.message}`);
      return false;
    }
  }

  private async connectClient(): Promise<void> {
    this.teardownClient();

    const ClientCtor = (AiBot as any)?.WSClient || (AiBot as any)?.default?.WSClient;
    if (!ClientCtor) {
      throw new Error('未能加载 @wecom/aibot-node-sdk WSClient');
    }

    const client: WSClient = new ClientCtor({
      botId: this.botId,
      secret: this.secret,
      heartbeatInterval: 30000,
      maxReconnectAttempts: 0,
      maxAuthFailureAttempts: 2,
      logger: {
        debug: () => {},
        info: (msg: string) => this.logger.debug(msg),
        warn: (msg: string) => this.logger.warn(msg),
        error: (msg: string) => this.logger.error(msg),
      },
    });

    client.on('connected', () => {
      if (!this.isRunning) return;
      this.status = 'connecting';
    });

    client.on('authenticated', () => {
      if (!this.isRunning) return;
      this.status = 'connected';
      this.connectedAt = new Date().toISOString();
      this.lastError = null;
      this.reconnector.reset();
      this.logger.log(`企微智能机器人长连接认证成功 [BotID: ${this.maskIdentifier(this.botId)}]`);
    });

    client.on('disconnected', (reason: string) => {
      if (!this.isRunning) {
        this.status = 'disconnected';
        return;
      }
      this.logger.warn(`企微长连接断开: ${reason || '未知原因'}`);
      this.reconnector.schedule(new Error(reason || '企微长连接已断开'));
    });

    client.on('event.disconnected_event', () => {
      if (!this.isRunning) return;
      this.status = 'error';
      this.lastError = '检测到同一 BotID 在另一节点建立长连接，当前连接已被服务端踢下线';
      this.isRunning = false;
      this.reconnector.destroy();
    });

    client.on('error', (error: Error & { code?: string }) => {
      const errMsg = error?.message || '企微长连接异常';
      this.logger.error(`企微 WSClient 错误: ${errMsg}`);
      if (error?.code === 'WS_AUTH_FAILURE_EXHAUSTED') {
        this.status = 'error';
        this.lastError = '企微 BotID 或 Secret 鉴权失败，请检查凭据配置';
        this.isRunning = false;
        this.reconnector.destroy();
        return;
      }
      if (this.isRunning) {
        this.reconnector.schedule(error);
      } else {
        this.status = 'error';
        this.lastError = errMsg;
      }
    });

    client.on('message.text', (frame: WsFrame<TextMessage>) => {
      void this.handleIncomingFrame(frame);
    });

    client.on('message.mixed', (frame: WsFrame<MixedMessage>) => {
      void this.handleIncomingFrame(frame);
    });

    client.on('message.voice', (frame: WsFrame<VoiceMessage>) => {
      void this.handleIncomingFrame(frame);
    });

    this.wsClient = client;
    client.connect();
  }

  private async handleIncomingFrame(frame: WsFrame<any>): Promise<void> {
    const body = frame?.body;
    if (!body) return;

    const msgId = body.msgid;
    if (msgId && this.isDuplicateMessage(msgId)) {
      return;
    }

    const rawText = this.extractFrameText(body);
    if (!rawText) return;

    const isGroup = body.chattype === 'group';
    const cleanText = isGroup ? rawText.replace(/^\s*(?:@[^\s]+\s+)+/, '').trim() : rawText.trim();
    if (!cleanText) return;

    const userId = body.from?.userid || '';
    const chatId = body.chatid || '';
    const fromId = isGroup && chatId ? `${chatId}:${userId}` : userId;
    if (!fromId) {
      this.logger.warn('无法识别企微发送方 userid，跳过消息');
      return;
    }

    this.logger.log(
      `企微收到用户消息 [${isGroup ? '群聊' : '单聊'} ${fromId}]: ${cleanText.slice(0, 50)}`,
    );

    const streamId = generateReqId('stream');
    if (this.wsClient) {
      await this.wsClient
        .replyStream(frame, streamId, THINKING_PLACEHOLDER, false)
        .catch((err: any) =>
          this.logger.warn(`企微发送思考保活包失败 [${streamId}]: ${err?.message}`),
        );
    }

    let finalReply: string | null = null;
    try {
      finalReply = await this.inboundHandler(this.channelType, fromId, cleanText);
    } catch (err: any) {
      this.logger.error(`企微入站调度异常: ${err?.message}`, err?.stack);
      finalReply = '抱歉，当前智能助理处理请求时遇到临时异常，请稍后再试。';
    }

    const outputText = this.truncateUtf8(
      finalReply?.trim() || '抱歉，暂未生成有效回复内容，请稍后重试。',
      WECOM_MAX_STREAM_BYTES,
    );

    if (this.wsClient) {
      await this.wsClient
        .replyStream(frame, streamId, outputText, true)
        .catch((err: any) =>
          this.logger.error(`企微发送终稿回复失败 [${streamId}]: ${err?.message}`),
        );
    }
  }

  private extractFrameText(body: any): string {
    if (body.msgtype === 'text' && body.text?.content) {
      return String(body.text.content);
    }
    if (body.msgtype === 'voice' && body.voice?.content) {
      return String(body.voice.content);
    }
    if (body.msgtype === 'mixed' && Array.isArray(body.mixed?.msg_item)) {
      return body.mixed.msg_item
        .filter((item: any) => item?.msgtype === 'text' && item?.text?.content)
        .map((item: any) => String(item.text.content).trim())
        .filter(Boolean)
        .join('\n');
    }
    return '';
  }

  private isDuplicateMessage(msgId: string): boolean {
    if (this.processedMsgSet.has(msgId)) return true;
    this.processedMsgSet.add(msgId);
    this.processedMsgIds.push(msgId);
    if (this.processedMsgIds.length > PROCESSED_MSG_LIMIT) {
      const oldest = this.processedMsgIds.shift();
      if (oldest) this.processedMsgSet.delete(oldest);
    }
    return false;
  }

  private truncateUtf8(content: string, maxBytes: number): string {
    if (Buffer.byteLength(content, 'utf8') <= maxBytes) return content;
    let end = content.length;
    while (end > 0 && Buffer.byteLength(content.slice(0, end), 'utf8') > maxBytes - 16) {
      end = Math.floor(end * 0.9);
    }
    return `${content.slice(0, end)}\n...(内容过长已截断)`;
  }

  private maskIdentifier(val: string): string {
    if (!val) return '';
    return val.length > 6 ? `${val.slice(0, 3)}***${val.slice(-2)}` : `${val.slice(0, 2)}***`;
  }

  private teardownClient() {
    if (this.wsClient) {
      try {
        this.wsClient.removeAllListeners();
        this.wsClient.disconnect();
      } catch (e: any) {
        this.logger.warn(`关闭企微 WSClient 异常: ${e?.message}`);
      }
      this.wsClient = null;
    }
  }
}
