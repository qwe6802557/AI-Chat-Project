import 'package:flutter_test/flutter_test.dart';
import 'package:ai_chat_mobile/features/chat/domain/chat_message_model.dart';

void main() {
  group('ChatMessageModel', () {
    test('copyWith 正确保留并覆盖字段', () {
      final now = DateTime.now();
      final msg = ChatMessageModel(
        id: 'msg-1',
        sessionId: 'session-1',
        role: 'assistant',
        content: '初始内容',
        status: MessageStatus.streaming,
        createdAt: now,
      );

      final updated = msg.copyWith(
        content: '增量新内容',
        reasoningContent: '思考过程...',
        reasoningDurationSeconds: 4,
        status: MessageStatus.done,
      );

      expect(updated.id, 'msg-1');
      expect(updated.sessionId, 'session-1');
      expect(updated.role, 'assistant');
      expect(updated.content, '增量新内容');
      expect(updated.reasoningContent, '思考过程...');
      expect(updated.reasoningDurationSeconds, 4);
      expect(updated.status, MessageStatus.done);
      expect(updated.createdAt, now);
    });
  });
}
