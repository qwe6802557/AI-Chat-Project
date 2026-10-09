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

    test('SearchSourceModel 正确序列化与反序列化 JSON', () {
      final json = {
        'id': 1,
        'title': '测试来源标题',
        'url': 'https://example.com/test',
        'sitename': '示例网站',
        'snippet': '测试摘要内容',
        'icon': 'https://example.com/favicon.ico',
      };

      final model = SearchSourceModel.fromJson(json);
      expect(model.id, 1);
      expect(model.title, '测试来源标题');
      expect(model.url, 'https://example.com/test');
      expect(model.sitename, '示例网站');
      expect(model.snippet, '测试摘要内容');
      expect(model.icon, 'https://example.com/favicon.ico');

      final serialized = model.toJson();
      expect(serialized['id'], 1);
      expect(serialized['title'], '测试来源标题');
      expect(serialized['url'], 'https://example.com/test');
    });

    test('ChatMessageModel 支持携带 searchStatus 与 sources 并在 copyWith 中保留', () {
      final source = SearchSourceModel(
        id: 1,
        title: '新闻网',
        url: 'https://news.example.com',
      );

      final msg = ChatMessageModel(
        id: 'msg-search',
        sessionId: 'sess-1',
        role: 'assistant',
        content: '检索结果回复',
        createdAt: DateTime.now(),
        searchStatus: 'done',
        sources: [source],
      );

      expect(msg.searchStatus, 'done');
      expect(msg.sources.length, 1);
      expect(msg.sources.first.title, '新闻网');

      final updated = msg.copyWith(content: '更新回复');
      expect(updated.searchStatus, 'done');
      expect(updated.sources.length, 1);
    });
  });
}
