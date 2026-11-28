import { FeishuDriver } from './feishu.driver';
import { DingtalkDriver } from './dingtalk.driver';

describe('IM Drivers Inbound Reply Forwarding (Feishu & Dingtalk)', () => {
  it('FeishuDriver should send reply back via sendMessage when inboundHandler resolves non-empty text', async () => {
    const inboundHandler = jest.fn().mockResolvedValue('飞书智能体已回复');
    const driver = new FeishuDriver(inboundHandler, jest.fn());
    const sendSpy = jest.spyOn(driver, 'sendMessage').mockResolvedValue(true);

    await (driver as any).handleMessageReceive({
      sender: { sender_id: { open_id: 'ou_user_1' } },
      message: {
        message_type: 'text',
        chat_type: 'p2p',
        content: JSON.stringify({ text: '你好飞书' }),
      },
    });

    expect(inboundHandler).toHaveBeenCalledWith('feishu', 'ou_user_1', '你好飞书');
    expect(sendSpy).toHaveBeenCalledWith('ou_user_1', '飞书智能体已回复');
  });

  it('DingtalkDriver should send reply back via sendMessage when inboundHandler resolves non-empty text', async () => {
    const inboundHandler = jest.fn().mockResolvedValue('钉钉智能体已回复');
    const driver = new DingtalkDriver(inboundHandler, jest.fn());
    const sendSpy = jest.spyOn(driver, 'sendMessage').mockResolvedValue(true);

    await (driver as any).handleRobotMessage({
      senderStaffId: 'staff_007',
      conversationType: '1',
      text: { content: '你好钉钉' },
      sessionWebhook: 'https://oapi.dingtalk.com/robot/sendBySession?session=abc',
    });

    expect(inboundHandler).toHaveBeenCalledWith('dingtalk', 'staff_007', '你好钉钉');
    expect(sendSpy).toHaveBeenCalledWith('staff_007', '钉钉智能体已回复');
  });
});
