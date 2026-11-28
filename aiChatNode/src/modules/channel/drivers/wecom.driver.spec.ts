import { WecomDriver } from './wecom.driver';

const mockClients: any[] = [];

jest.mock('@wecom/aibot-node-sdk', () => {
  const { EventEmitter } = require('events');

  class MockWSClient extends EventEmitter {
    connect = jest.fn(() => this);
    disconnect = jest.fn();
    replyStream = jest.fn().mockResolvedValue({ headers: { req_id: 'req-1' } });
    sendMessage = jest.fn().mockResolvedValue({ headers: { req_id: 'req-2' } });

    constructor(public readonly options: Record<string, any>) {
      super();
      mockClients.push(this);
    }
  }

  return {
    __esModule: true,
    default: { WSClient: MockWSClient },
    WSClient: MockWSClient,
    generateReqId: jest.fn((prefix: string) => `${prefix}_mock_1`),
  };
});

describe('WecomDriver', () => {
  beforeEach(() => {
    mockClients.length = 0;
  });

  it('should stay disconnected with error hint when credentials are missing', async () => {
    const driver = new WecomDriver(jest.fn(), jest.fn());
    driver.configure({ credentials: {} });
    await driver.start();

    const status = await driver.getStatus();
    expect(status.status).toBe('disconnected');
    expect(status.lastError).toContain('Bot ID');
    expect(mockClients).toHaveLength(0);
  });

  it('should connect via WSClient, authenticate, and stream reply in two stages', async () => {
    const inboundHandler = jest.fn().mockResolvedValue('**已完成**多智能体分析结果');
    const driver = new WecomDriver(inboundHandler, jest.fn());

    driver.configure({
      credentials: { botId: 'aib_12345678', secret: 'sec_abcdefg' },
    });
    await driver.start();

    const wsClient = mockClients[mockClients.length - 1];
    expect(wsClient).toBeTruthy();
    expect(wsClient.connect).toHaveBeenCalledTimes(1);

    wsClient.emit('authenticated');
    const connectedStatus = await driver.getStatus();
    expect(connectedStatus.status).toBe('connected');
    expect(connectedStatus.credentialsMasked?.botId).toBe('aib***78');
    expect(connectedStatus.credentialsMasked?.secret).toBe('********');

    const incomingFrame = {
      headers: { req_id: 'req_100' },
      body: {
        msgid: 'msg_001',
        aibotid: 'aib_12345678',
        chattype: 'group' as const,
        chatid: 'wr_group_1',
        from: { userid: 'zhangsan' },
        msgtype: 'text',
        text: { content: '@研发助手 请巡检服务状态' },
      },
    };

    wsClient.emit('message.text', incomingFrame);
    await new Promise((resolve) => setTimeout(resolve, 20));

    // 同一 msgid 重放应自动排重
    wsClient.emit('message.text', incomingFrame);
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(inboundHandler).toHaveBeenCalledTimes(1);
    expect(inboundHandler).toHaveBeenCalledWith(
      'wecom_bot',
      'wr_group_1:zhangsan',
      '请巡检服务状态',
    );
    expect(wsClient.replyStream).toHaveBeenNthCalledWith(
      1,
      incomingFrame,
      'stream_mock_1',
      '正在调用智能体协同思考，请稍候...',
      false,
    );
    expect(wsClient.replyStream).toHaveBeenNthCalledWith(
      2,
      incomingFrame,
      'stream_mock_1',
      '**已完成**多智能体分析结果',
      true,
    );

    const pushed = await driver.sendMessage('wr_group_1', '主动巡检通知');
    expect(pushed).toBe(true);
    expect(wsClient.sendMessage).toHaveBeenCalledWith('wr_group_1', {
      msgtype: 'markdown',
      markdown: { content: '主动巡检通知' },
    });

    await driver.stop();
    const stoppedStatus = await driver.getStatus();
    expect(stoppedStatus.status).toBe('disconnected');
  });
});
