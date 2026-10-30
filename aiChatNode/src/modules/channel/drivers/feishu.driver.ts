import { Logger } from '@nestjs/common';
import * as lark from '@larksuiteoapi/node-sdk';
import {
  ChannelStatusInfo,
  IChannelDriver,
  InboundMessageHandler,
} from './channel-driver.interface';

/**
 * 飞书机器人驱动 (官方 Lark WebSocket 长连接协议 + OpenAPI)
 */
export class FeishuDriver implements IChannelDriver {
  readonly channelType = 'feishu';
  private readonly logger = new Logger(FeishuDriver.name);

  private isRunning = false;
  private wsClient: lark.WSClient | null = null;
  private client: lark.Client | null = null;
  private appId = '';
  private appSecret = '';
  private boundModelId: string | null = null;
  private systemPrompt: string | null = null;
  private status: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected';
  private lastError: string | null = null;
  private connectedAt: string | null = null;

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
      this.lastError = '缺少 App ID 或 App Secret';
      return;
    }

    this.isRunning = true;
    this.status = 'connecting';
    this.lastError = null;

    try {
      this.client = new lark.Client({
        appId: this.appId,
        appSecret: this.appSecret,
      });

      this.wsClient = new lark.WSClient({
        appId: this.appId,
        appSecret: this.appSecret,
        loggerLevel: lark.LoggerLevel.warn,
      });

      const eventDispatcher = new lark.EventDispatcher({}).register({
        'im.message.receive_v1': async (data: any) => {
          try {
            await this.handleMessageReceive(data);
          } catch (err: any) {
            this.logger.error(`飞书消息处理异常: ${err.message}`, err.stack);
          }
        },
      });

      await this.wsClient.start({ eventDispatcher });
      this.status = 'connected';
      this.connectedAt = new Date().toISOString();
      this.logger.log(`飞书机器人长连接建立成功 [AppID: ${this.appId}]`);
    } catch (err: any) {
      this.status = 'error';
      this.lastError = err.message || '长连接建立失败';
      this.logger.error(`飞书机器人启动失败: ${err.message}`, err.stack);
      this.isRunning = false;
    }
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    if (this.wsClient) {
      try {
        // 关闭长连接
        (this.wsClient as any).close?.();
      } catch (e: any) {
        this.logger.warn(`关闭飞书 WS 异常: ${e.message}`);
      }
      this.wsClient = null;
    }
    this.client = null;
    this.status = 'disconnected';
    this.logger.log('飞书机器人已停止');
  }

  async getStatus(): Promise<ChannelStatusInfo> {
    return {
      channelType: this.channelType,
      name: '飞书 (官方 WebSocket)',
      isEnabled: this.isRunning,
      status: this.status,
      boundModelId: this.boundModelId,
      systemPrompt: this.systemPrompt,
      credentialsMasked: {
        appId: this.appId ? `${this.appId.slice(0, 4)}***` : '',
        appSecret: this.appSecret ? '********' : '',
      },
      lastError: this.lastError,
      connectedAt: this.connectedAt,
    };
  }

  /**
   * 发送飞书消息 (支持通过 open_id 或 chat_id 推送)
   */
  async sendMessage(to: string, content: string): Promise<boolean> {
    if (!this.client) {
      this.logger.error('飞书客户端未就绪，无法发送消息');
      return false;
    }

    try {
      // 判断接收者类型：oc_ 开头为群聊 chat_id，ou_ 开头为用户 open_id
      const isChat = to.startsWith('oc_');
      const receiveIdType = isChat ? 'chat_id' : 'open_id';

      const res = await this.client.im.message.create({
        params: {
          receive_id_type: receiveIdType as any,
        },
        data: {
          receive_id: to,
          msg_type: 'text',
          content: JSON.stringify({ text: content }),
        },
      });

      if (res.code !== 0) {
        this.logger.error(`飞书消息发送失败: code=${res.code}, msg=${res.msg}`);
        return false;
      }
      return true;
    } catch (err: any) {
      this.logger.error(`飞书消息发送异常: ${err.message}`);
      return false;
    }
  }

  /**
   * 解析并路由收到的飞书事件消息
   */
  private async handleMessageReceive(data: any): Promise<void> {
    const message = data?.message;
    if (!message) return;

    // 只处理文本类型消息
    if (message.message_type !== 'text') {
      this.logger.debug(`忽略非文本消息类型: ${message.message_type}`);
      return;
    }

    let parsedText = '';
    try {
      const parsedContent = JSON.parse(message.content || '{}');
      parsedText = (parsedContent.text || '').trim();
    } catch {
      parsedText = (message.content || '').trim();
    }

    if (!parsedText) return;

    // 清理可能包含的群聊 @ 机器人占位符 (如 @_user_1)
    const cleanText = parsedText.replace(/@_user_\d+\s*/g, '').trim();
    if (!cleanText) return;

    // 路由标识：单聊使用 sender open_id，群聊优先使用 chat_id 以保证回复在群内
    const senderOpenId = data?.sender?.sender_id?.open_id;
    const chatId = message?.chat_id;
    const isGroup = message?.chat_type === 'group';
    const targetId = isGroup && chatId ? chatId : senderOpenId;

    if (!targetId) {
      this.logger.warn('无法获取有效的目标会话 ID，跳过消息');
      return;
    }

    this.logger.log(`飞书收到用户消息 [${isGroup ? '群聊' : '单聊'} ${targetId}]: ${cleanText.slice(0, 50)}`);

    // 触发 ChannelManager 统一中枢 (校验积分、加载上下文、流式/全量调用大模型、扣除积分、回复)
    await this.inboundHandler(this.channelType, targetId, cleanText);
  }
}
