import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive/hive.dart';
import 'package:ai_chat_mobile/features/chat/domain/chat_message_model.dart';
import 'package:ai_chat_mobile/features/chat/domain/chat_session_model.dart';
import 'package:ai_chat_mobile/core/storage/hive_storage_service.dart';

void main() {
  group('Offline-First & SWR Caching Unit Tests', () {
    test('ChatSessionModel 支持完整序列化并在 JSON 互转中保留 knowledgeBaseIds', () {
      final now = DateTime.now();
      final session = ChatSessionModel(
        id: 'session-offline-1',
        title: '测试离线会话',
        lastMessagePreview: '这是最后一条离线消息预览',
        lastModel: 'GLM-4-Flash',
        messageCount: 5,
        knowledgeBaseIds: const ['kb-101', 'kb-102'],
        createdAt: now,
        updatedAt: now,
      );

      final json = session.toJson();
      final restored = ChatSessionModel.fromJson(json);

      expect(restored.id, 'session-offline-1');
      expect(restored.title, '测试离线会话');
      expect(restored.lastMessagePreview, '这是最后一条离线消息预览');
      expect(restored.lastModel, 'GLM-4-Flash');
      expect(restored.messageCount, 5);
      expect(restored.knowledgeBaseIds, ['kb-101', 'kb-102']);
    });

    test('ChatMessageModel 成功序列化与反序列化 failedOffline 状态', () {
      final now = DateTime.now();
      final msg = ChatMessageModel(
        id: 'msg-offline-1',
        sessionId: 'session-offline-1',
        role: 'user',
        content: '离线状态发送的消息',
        status: MessageStatus.failedOffline,
        createdAt: now,
      );

      final json = msg.toJson();
      expect(json['status'], 'failedOffline');

      final restored = ChatMessageModel.fromJson(json);
      expect(restored.id, 'msg-offline-1');
      expect(restored.status, MessageStatus.failedOffline);
      expect(restored.content, '离线状态发送的消息');
    });

    test('HiveStorageService 能够正确落盘与还原会话列表及离线队列', () async {
      final tempDir = Directory.systemTemp.createTempSync('hive_test_dir_');

      final service = HiveStorageService();
      await service.init(tempDir.path);

      final session = ChatSessionModel(
        id: 'session-hive-1',
        title: '本地持久化会话',
        knowledgeBaseIds: const ['kb-999'],
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );

      // 验证会话缓存
      await service.saveSessions([session]);
      final cachedSessions = service.getSessions();
      expect(cachedSessions.length, 1);
      expect(cachedSessions.first.id, 'session-hive-1');
      expect(cachedSessions.first.knowledgeBaseIds, ['kb-999']);

      // 验证离线队列排队与出队
      final offlineMsg = ChatMessageModel(
        id: 'offline-queued-msg',
        sessionId: 'session-hive-1',
        role: 'user',
        content: '排队中的离线消息',
        status: MessageStatus.failedOffline,
        createdAt: DateTime.now(),
      );

      await service.enqueueOfflineMessage(offlineMsg);
      final queueBefore = service.getOfflineQueue();
      expect(queueBefore.length, 1);
      expect(queueBefore.first.id, 'offline-queued-msg');

      await service.dequeueOfflineMessage('offline-queued-msg');
      final queueAfter = service.getOfflineQueue();
      expect(queueAfter.isEmpty, true);

      await Hive.close();
      tempDir.deleteSync(recursive: true);
    });
  });
}
