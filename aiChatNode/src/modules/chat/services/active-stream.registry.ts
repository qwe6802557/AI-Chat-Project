import { Injectable, Logger } from '@nestjs/common';

/**
 * 即时干预项数据契约
 */
export interface SteerItem {
  id: string;
  message: string;
  type: string;
  timestamp: number;
}

/**
 * 活跃流式执行句柄
 */
export interface ActiveStreamHandle {
  sessionId: string;
  userId: string;
  abortController: AbortController;
  steerQueue: SteerItem[];
}

/**
 * 活跃会话流运行时注册表 (管理流式生命周期、硬中断与即时干预注入)
 */
@Injectable()
export class ActiveStreamRegistry {
  private readonly logger = new Logger(ActiveStreamRegistry.name);
  private readonly activeStreams = new Map<string, ActiveStreamHandle>();

  /**
   * 注册正在运行的会话流
   */
  register(handle: ActiveStreamHandle): void {
    this.activeStreams.set(handle.sessionId, handle);
    this.logger.debug(`会话流已注册: sessionId=${handle.sessionId}, 当前活跃总数=${this.activeStreams.size}`);
  }

  /**
   * 注销会话流 (必须在 stream 结束或异常时调用)
   */
  unregister(sessionId: string): void {
    if (this.activeStreams.delete(sessionId)) {
      this.logger.debug(`会话流已注销: sessionId=${sessionId}, 剩余活跃数=${this.activeStreams.size}`);
    }
  }

  /**
   * 检查指定会话是否正在流式生成
   */
  has(sessionId: string): boolean {
    return this.activeStreams.has(sessionId);
  }

  /**
   * 获取会话流句柄
   */
  get(sessionId: string): ActiveStreamHandle | undefined {
    return this.activeStreams.get(sessionId);
  }

  /**
   * 向指定活跃会话压入即时干预指令
   */
  steer(sessionId: string, message: string, type = 'guide'): boolean {
    const handle = this.activeStreams.get(sessionId);
    if (!handle) {
      return false;
    }
    const item: SteerItem = {
      id: `steer_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      message,
      type,
      timestamp: Date.now(),
    };
    handle.steerQueue.push(item);
    this.logger.log(`即时干预指令已入队: sessionId=${sessionId}, steerId=${item.id}`);
    return true;
  }

  /**
   * 消费并清空指定会话的未决干预指令队列
   */
  consumeSteerQueue(sessionId: string): SteerItem[] {
    const handle = this.activeStreams.get(sessionId);
    if (!handle || handle.steerQueue.length === 0) {
      return [];
    }
    const items = [...handle.steerQueue];
    handle.steerQueue = [];
    return items;
  }

  /**
   * 中断指定会话的流式运行
   */
  abort(sessionId: string): boolean {
    const handle = this.activeStreams.get(sessionId);
    if (!handle) {
      return false;
    }
    handle.abortController.abort();
    this.unregister(sessionId);
    return true;
  }
}
