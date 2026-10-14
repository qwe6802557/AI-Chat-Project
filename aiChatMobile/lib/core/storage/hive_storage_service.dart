import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';
import '../../features/chat/domain/chat_message_model.dart';
import '../../features/chat/domain/chat_session_model.dart';

/// 嵌入式 Hive 离线存储服务
class HiveStorageService {
  static const String _sessionsBoxName = 'chat_sessions_box';
  static const String _messagesBoxName = 'chat_messages_box';
  static const String _offlineQueueBoxName = 'offline_queue_box';

  Box? _sessionsBox;
  Box? _messagesBox;
  Box? _offlineQueueBox;

  /// 初始化并挂载本地盒子
  Future<void> init([String? subDir]) async {
    if (subDir != null) {
      Hive.init(subDir);
    } else {
      await Hive.initFlutter();
    }
    _sessionsBox = await Hive.openBox(_sessionsBoxName);
    _messagesBox = await Hive.openBox(_messagesBoxName);
    _offlineQueueBox = await Hive.openBox(_offlineQueueBoxName);
  }

  /// 批量缓存会话列表
  Future<void> saveSessions(List<ChatSessionModel> sessions) async {
    if (_sessionsBox == null) return;
    final jsonList = sessions.map((s) => s.toJson()).toList();
    await _sessionsBox!.put('cached_sessions', jsonEncode(jsonList));
  }

  /// 获取本地缓存的会话列表
  List<ChatSessionModel> getSessions() {
    if (_sessionsBox == null) return [];
    final raw = _sessionsBox!.get('cached_sessions');
    if (raw is! String || raw.isEmpty) return [];
    try {
      final decoded = jsonDecode(raw) as List;
      return decoded
          .whereType<Map<String, dynamic>>()
          .map((m) => ChatSessionModel.fromJson(m))
          .toList();
    } catch (_) {
      return [];
    }
  }

  /// 缓存单个会话的消息流
  Future<void> saveMessages(String sessionId, List<ChatMessageModel> messages) async {
    if (_messagesBox == null || sessionId.isEmpty) return;
    final jsonList = messages.map((m) => m.toJson()).toList();
    await _messagesBox!.put('messages_$sessionId', jsonEncode(jsonList));
  }

  /// 获取单个会话的本地历史消息
  List<ChatMessageModel> getMessages(String sessionId) {
    if (_messagesBox == null || sessionId.isEmpty) return [];
    final raw = _messagesBox!.get('messages_$sessionId');
    if (raw is! String || raw.isEmpty) return [];
    try {
      final decoded = jsonDecode(raw) as List;
      return decoded
          .whereType<Map<String, dynamic>>()
          .map((m) => ChatMessageModel.fromJson(m))
          .toList();
    } catch (_) {
      return [];
    }
  }

  /// 添加离线待发消息到队列
  Future<void> enqueueOfflineMessage(ChatMessageModel message) async {
    if (_offlineQueueBox == null) return;
    await _offlineQueueBox!.put(message.id, jsonEncode(message.toJson()));
  }

  /// 获取离线待发队列中的所有消息
  List<ChatMessageModel> getOfflineQueue() {
    if (_offlineQueueBox == null) return [];
    final List<ChatMessageModel> list = [];
    for (final key in _offlineQueueBox!.keys) {
      final raw = _offlineQueueBox!.get(key);
      if (raw is String) {
        try {
          final map = jsonDecode(raw) as Map<String, dynamic>;
          list.add(ChatMessageModel.fromJson(map));
        } catch (_) {}
      }
    }
    list.sort((a, b) => a.createdAt.compareTo(b.createdAt));
    return list;
  }

  /// 从离线队列中移除消息
  Future<void> dequeueOfflineMessage(String messageId) async {
    if (_offlineQueueBox == null) return;
    await _offlineQueueBox!.delete(messageId);
  }
}

final hiveStorageServiceProvider = Provider<HiveStorageService>((ref) {
  return HiveStorageService();
});
