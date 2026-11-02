export interface ReconnectOptions {
  initialDelayMs?: number;
  maxDelayMs?: number;
  maxAttempts?: number;
  factor?: number;
  jitter?: boolean;
}

/**
 * 渠道长连接指数退避自愈状态机
 * 发生断线或网络异常时，按指数退避与随机抖动进行重连，超限后转入 error 状态
 */
export class ChannelReconnector {
  private attempt = 0;
  private timer: NodeJS.Timeout | null = null;
  private isDestroyed = false;

  constructor(
    private readonly action: () => Promise<void>,
    private readonly onStateChange: (state: {
      status: 'connecting' | 'error';
      attempt: number;
      errorMsg?: string;
    }) => void,
    private readonly options: ReconnectOptions = {},
  ) {}

  schedule(err?: any) {
    if (this.isDestroyed) return;
    this.attempt++;
    const maxAttempts = this.options.maxAttempts ?? 10;

    if (this.attempt > maxAttempts) {
      this.onStateChange({
        status: 'error',
        attempt: this.attempt,
        errorMsg: `重连已达上限 (${maxAttempts}次): ${err?.message || '连接失败'}`,
      });
      return;
    }

    const initial = this.options.initialDelayMs ?? 2000;
    const maxDelay = this.options.maxDelayMs ?? 60000;
    const factor = this.options.factor ?? 2;
    let delay = Math.min(maxDelay, initial * Math.pow(factor, this.attempt - 1));
    if (this.options.jitter !== false) {
      delay += Math.floor(Math.random() * 1000);
    }

    this.onStateChange({
      status: 'connecting',
      attempt: this.attempt,
      errorMsg: `连接已断开，将在 ${(delay / 1000).toFixed(1)}s 后尝试第 ${this.attempt}/${maxAttempts} 次重连...`,
    });

    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(async () => {
      if (this.isDestroyed) return;
      try {
        await this.action();
        this.reset();
      } catch (e: any) {
        this.schedule(e);
      }
    }, delay);
  }

  reset() {
    this.attempt = 0;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  destroy() {
    this.isDestroyed = true;
    this.reset();
  }
}
