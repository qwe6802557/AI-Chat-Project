import { ChannelReconnector } from './channel-reconnector';

describe('ChannelReconnector', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('按照指数退避调度重连并触发状态变更', () => {
    const action = jest.fn().mockResolvedValue(undefined);
    const onStateChange = jest.fn();

    const reconnector = new ChannelReconnector(action, onStateChange, {
      initialDelayMs: 100,
      factor: 2,
      jitter: false,
      maxAttempts: 3,
    });

    reconnector.schedule(new Error('网络中断'));

    expect(onStateChange).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'connecting',
        attempt: 1,
      }),
    );

    jest.advanceTimersByTime(100);
    expect(action).toHaveBeenCalledTimes(1);

    reconnector.destroy();
  });

  it('超过最大重试次数时切换至 error 状态', () => {
    const action = jest.fn();
    const onStateChange = jest.fn();

    const reconnector = new ChannelReconnector(action, onStateChange, {
      maxAttempts: 1,
      jitter: false,
    });

    reconnector.schedule(); // 第 1 次 schedule
    reconnector.schedule(new Error('超限测试')); // 第 2 次，超限

    expect(onStateChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: 'error',
        attempt: 2,
      }),
    );

    reconnector.destroy();
  });
});
