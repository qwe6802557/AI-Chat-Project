import { Logger } from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import {
  ChannelStatusInfo,
  IChannelDriver,
  InboundMessageHandler,
} from './channel-driver.interface';

const DEFAULT_BASE_URL = 'https://ilinkai.weixin.qq.com';
const CHANNEL_VERSION = '2.0.0';
const CLIENT_VERSION = '131072';

export class WeixinDriver implements IChannelDriver {
  readonly channelType = 'weixin';
  private readonly logger = new Logger(WeixinDriver.name);

  private isRunning = false;
  private abortController: AbortController | null = null;
  private baseUrl = DEFAULT_BASE_URL;
  private botToken = '';
  private botId = '';
  private currentQrCode = '';
  private currentQrUrl = '';
  private loginStatus: 'idle' | 'waiting_scan' | 'scanned' | 'logged_in' | 'error' = 'idle';
  private lastError: string | null = null;
  private connectedAt: string | null = null;
  private updatesBuf = '';
  private boundModelId: string | null = null;
  private systemPrompt: string | null = null;

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
    if (config.credentials?.token) {
      this.botToken = config.credentials.token;
      this.baseUrl = config.credentials.baseUrl || DEFAULT_BASE_URL;
      this.botId = config.credentials.botId || '';
      this.loginStatus = 'logged_in';
      this.connectedAt = config.credentials.connectedAt || new Date().toISOString();
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    this.abortController = new AbortController();

    if (this.botToken) {
      this.loginStatus = 'logged_in';
      this.runMessagePollingLoop();
    } else {
      this.loginStatus = 'idle';
    }
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.currentQrCode = '';
    this.currentQrUrl = '';
    this.botToken = '';
    this.botId = '';
    this.loginStatus = 'idle';
    this.connectedAt = null;
    this.updatesBuf = '';
  }

  async getStatus(): Promise<ChannelStatusInfo> {
    return {
      channelType: this.channelType,
      name: '微信 (iLink Bot)',
      isEnabled: this.isRunning && !!this.botToken,
      status: this.loginStatus === 'logged_in' ? 'connected' : (this.loginStatus === 'waiting_scan' || this.loginStatus === 'scanned' ? 'connecting' : (this.isRunning ? 'connecting' : 'disconnected')),
      loginStatus: this.loginStatus,
      qrCodeUrl: this.currentQrUrl || null,
      boundModelId: this.boundModelId,
      systemPrompt: this.systemPrompt,
      lastError: this.lastError,
      connectedAt: this.connectedAt,
    };
  }

  async getQrCode(): Promise<{ qrCodeUrl: string; status: string }> {
    try {
      this.lastError = null;
      const headers = this.buildHeaders();
      const resp = await fetch(`${DEFAULT_BASE_URL}/ilink/bot/get_bot_qrcode?bot_type=3`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          local_token_list: [],
          base_info: { channel_version: CHANNEL_VERSION },
        }),
      });

      if (!resp.ok) {
        throw new Error(`获取二维码失败: HTTP ${resp.status}`);
      }

      const data = await resp.json();
      this.currentQrCode = data.qrcode || '';
      this.currentQrUrl = data.qrcode_img_content || '';
      this.loginStatus = 'waiting_scan';

      this.pollQrStatusWorker(this.currentQrCode);

      return {
        qrCodeUrl: this.currentQrUrl,
        status: this.loginStatus,
      };
    } catch (err: any) {
      this.loginStatus = 'error';
      this.lastError = err.message;
      this.logger.error(`微信二维码生成异常: ${err.message}`);
      throw err;
    }
  }

  async sendMessage(to: string, content: string, contextToken?: string): Promise<boolean> {
    if (!this.botToken) {
      this.logger.warn('微信未就绪或未授权 Token，取消发送');
      return false;
    }

    try {
      const resp = await fetch(`${this.baseUrl}/ilink/bot/sendmessage`, {
        method: 'POST',
        headers: this.buildHeaders(this.botToken),
        body: JSON.stringify({
          msg: {
            from_user_id: '',
            to_user_id: to,
            client_id: randomUUID().replace(/-/g, '').slice(0, 16),
            message_type: 2,
            message_state: 2,
            item_list: [{ type: 1, text_item: { text: content } }],
            context_token: contextToken || '',
          },
          base_info: { channel_version: CHANNEL_VERSION },
        }),
      });

      return resp.ok;
    } catch (err: any) {
      this.logger.error(`微信发送消息失败: ${err.message}`);
      return false;
    }
  }

  private async pollQrStatusWorker(qrcode: string) {
    const deadline = Date.now() + 480 * 1000;
    while (this.currentQrCode === qrcode && Date.now() < deadline) {
      try {
        const url = `${this.baseUrl}/ilink/bot/get_qrcode_status?qrcode=${encodeURIComponent(qrcode)}`;
        const resp = await fetch(url, {
          headers: {
            'iLink-App-Id': 'bot',
            'iLink-App-ClientVersion': CLIENT_VERSION,
          },
        });

        if (resp.ok) {
          const res = await resp.json();
          const status = res.status;

          if (status === 'scaned') {
            this.loginStatus = 'scanned';
          } else if (status === 'confirmed') {
            this.botToken = res.bot_token || '';
            this.botId = res.ilink_bot_id || '';
            this.baseUrl = res.baseurl ? (res.baseurl.startsWith('http') ? res.baseurl : `https://${res.baseurl}`) : this.baseUrl;
            this.loginStatus = 'logged_in';
            this.connectedAt = new Date().toISOString();
            this.currentQrCode = '';
            this.currentQrUrl = '';

            // 激活长轮询状态并准备中断控制器
            this.isRunning = true;
            if (!this.abortController) {
              this.abortController = new AbortController();
            }

            await this.onCredentialsUpdate({
              token: this.botToken,
              botId: this.botId,
              baseUrl: this.baseUrl,
              connectedAt: this.connectedAt,
            });

            this.runMessagePollingLoop();
            break;
          } else if (status === 'expired') {
            this.loginStatus = 'idle';
            this.currentQrCode = '';
            this.currentQrUrl = '';
            break;
          }
        }
      } catch (e) {
        this.logger.debug(`扫码状态轮询心跳: ${e}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  private async runMessagePollingLoop() {
    this.logger.log('微信消息接收长轮询循环启动');
    while (this.isRunning && this.botToken) {
      try {
        const resp = await fetch(`${this.baseUrl}/ilink/bot/getupdates`, {
          method: 'POST',
          headers: this.buildHeaders(this.botToken),
          body: JSON.stringify({
            get_updates_buf: this.updatesBuf,
            base_info: { channel_version: CHANNEL_VERSION },
          }),
          signal: this.abortController?.signal,
        });

        if (resp.ok) {
          const data = await resp.json();
          if (data.ret === -14 || data.errcode === -14) {
            this.logger.warn('微信凭证已过期 (-14)，需重新扫码');
            this.loginStatus = 'idle';
            this.botToken = '';
            this.isRunning = false;
            break;
          }

          if (data.get_updates_buf) {
            this.updatesBuf = data.get_updates_buf;
          }

          const msgs: any[] = data.msgs || [];
          for (const msg of msgs) {
            if (!msg.item_list || !Array.isArray(msg.item_list)) continue;
            for (const item of msg.item_list) {
              if (item.type === 1 && item.text_item?.text) {
                const userText = item.text_item.text.trim();
                const fromUser = msg.from_user_id;
                const ctxToken = msg.context_token;

                this.inboundHandler('weixin', fromUser, userText, ctxToken)
                  .then((reply) => {
                    if (reply) {
                      this.sendMessage(fromUser, reply, ctxToken);
                    }
                  })
                  .catch((e) => this.logger.error(`微信回复生成异常: ${e.message}`));
              }
            }
          }
        }
      } catch (err: any) {
        if (err.name === 'AbortError') break;
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  }

  private buildHeaders(token?: string): Record<string, string> {
    const randomUin = randomBytes(4).readUInt32BE(0).toString();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      AuthorizationType: 'ilink_bot_token',
      'X-WECHAT-UIN': Buffer.from(randomUin).toString('base64'),
      'iLink-App-Id': 'bot',
      'iLink-App-ClientVersion': CLIENT_VERSION,
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }
}
