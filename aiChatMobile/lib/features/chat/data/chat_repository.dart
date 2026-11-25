import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/network/dio_client.dart';
import '../../../core/network/sse_parser.dart';
import '../domain/chat_message_model.dart';
import '../domain/chat_session_model.dart';
import '../domain/file_attachment_model.dart';
import '../domain/tool_model.dart';
import '../domain/knowledge_base_model.dart';
import '../presentation/widgets/model_switcher_bottom_sheet.dart';

import '../../../core/storage/hive_storage_service.dart';

/// 聊天领域仓储层
class ChatRepository {
  final DioClient _client;
  final HiveStorageService _hiveStorage;

  ChatRepository(this._client, this._hiveStorage);

  /// 快速读取本地缓存的会话列表
  List<ChatSessionModel> getCachedSessions() {
    return _hiveStorage.getSessions();
  }

  /// 快速读取本地缓存的会话消息
  List<ChatMessageModel> getCachedMessages(String sessionId) {
    return _hiveStorage.getMessages(sessionId);
  }

  Future<List<KnowledgeBaseModel>> getKnowledgeBases() async {
    final response = await _client.dio.get('/knowledge-bases');
    final data = response.data;
    if (data is Map<String, dynamic> && data['code'] == 0 && data['data'] != null) {
      final list = data['data'] as List;
      return list
          .map((item) => KnowledgeBaseModel.fromJson(item as Map<String, dynamic>))
          .toList();
    }
    return [];
  }

  Future<List<ChatSessionModel>> getSessions(String userId) async {
    try {
      final response = await _client.dio.get(
        '/chat/session/list',
        queryParameters: {'userId': userId},
      );
      final data = response.data;
      if (data is Map<String, dynamic> && data['code'] == 0 && data['data'] != null) {
        final list = data['data'] as List;
        final sessions = list
            .map((item) => ChatSessionModel.fromJson(item as Map<String, dynamic>))
            .toList();
        await _hiveStorage.saveSessions(sessions);
        return sessions;
      }
    } catch (_) {
      // 弱网或离线时平滑回退本地快照
      final cached = _hiveStorage.getSessions();
      if (cached.isNotEmpty) return cached;
    }
    return _hiveStorage.getSessions();
  }

  Future<ChatSessionModel> createSession({
    required String title,
    String? model,
  }) async {
    final response = await _client.dio.post(
      '/chat/session/create',
      data: {
        'title': title,
        if (model != null) 'model': model,
      },
    );
    final data = response.data;
    if (data is Map<String, dynamic> && data['code'] == 0 && data['data'] != null) {
      return ChatSessionModel.fromJson(data['data'] as Map<String, dynamic>);
    }
    throw Exception(data['message'] ?? '创建会话失败');
  }

  Future<List<ChatMessageModel>> getSessionMessages(String sessionId) async {
    try {
      final response = await _client.dio.get(
        '/chat/session/messages',
        queryParameters: {
          'sessionId': sessionId,
          'pageSize': 50,
          'order': 'asc',
        },
      );
      final data = response.data;
      if (data is Map<String, dynamic> && data['code'] == 0 && data['data'] != null) {
        final messagesMap = data['data'] as Map<String, dynamic>;
        final rawList = messagesMap['messages'] as List? ?? [];
        final List<ChatMessageModel> result = [];

        for (final item in rawList) {
          final m = item as Map<String, dynamic>;
          final createdAt = DateTime.tryParse(m['createdAt'] as String? ?? '') ?? DateTime.now();

          // 映射关联附件
          final rawAttachments = m['attachments'] as List? ?? [];
          final attachments = rawAttachments.map((att) {
            final a = att as Map<String, dynamic>;
            final rawUrl = a['url'] as String? ?? '';
            final fullUrl = rawUrl.startsWith('http')
                ? rawUrl
                : '${ApiConstants.baseUrl}$rawUrl';
            return AttachmentItem(
              id: a['id'] as String? ?? '',
              serverFileId: a['id'] as String?,
              name: a['name'] as String? ?? 'attachment',
              sizeBytes: (a['sizeBytes'] as num?)?.toInt() ?? 0,
              isImage: (a['type'] as String? ?? '').startsWith('image'),
              mimeType: a['type'] as String?,
              serverUrl: fullUrl,
              charCount: (a['charCount'] as num?)?.toInt(),
              textContent: a['extractedText'] as String?,
              status: AttachmentUploadStatus.success,
            );
          }).toList();

          // 映射用户端原消息
          if (m['userMessage'] != null && (m['userMessage'] as String).isNotEmpty) {
            result.add(
              ChatMessageModel(
                id: '${m['id']}_user',
                sessionId: sessionId,
                role: 'user',
                content: m['userMessage'] as String,
                createdAt: createdAt,
                attachments: attachments,
              ),
            );
          }

          // 映射助手回复与联网搜索来源及工具调用
          if (m['aiMessage'] != null && (m['aiMessage'] as String).isNotEmpty) {
            final rawSources = m['sources'] as List? ?? [];
            final sources = rawSources
                .whereType<Map<String, dynamic>>()
                .map((s) => SearchSourceModel.fromJson(s))
                .toList();

            final rawToolCalls = m['toolCalls'] as List? ?? [];
            final toolCalls = rawToolCalls
                .whereType<Map<String, dynamic>>()
                .map((t) => ToolExecutionRecordModel.fromJson(t))
                .toList();

            result.add(
              ChatMessageModel(
                id: '${m['id']}_assistant',
                sessionId: sessionId,
                role: 'assistant',
                content: m['aiMessage'] as String,
                model: m['model'] as String?,
                createdAt: createdAt,
                sources: sources,
                searchStatus: sources.isNotEmpty ? 'done' : null,
                toolCalls: toolCalls,
              ),
            );
          }
        }
        await _hiveStorage.saveMessages(sessionId, result);
        return result;
      }
    } catch (_) {
      final cached = _hiveStorage.getMessages(sessionId);
      if (cached.isNotEmpty) return cached;
    }
    return _hiveStorage.getMessages(sessionId);
  }

  Future<Stream<SseChunk>> sendStreamMessage({
    required String message,
    required String model,
    required String clientRequestId,
    String? sessionId,
    List<String>? fileIds,
    bool webSearch = false,
    List<String>? enabledTools,
    List<String>? knowledgeBaseIds,
    CancelToken? cancelToken,
  }) async {
    final response = await _client.dio.post<ResponseBody>(
      ApiConstants.chatStream,
      data: {
        'message': message,
        'model': model,
        'clientRequestId': clientRequestId,
        if (sessionId != null && sessionId.isNotEmpty) 'sessionId': sessionId,
        if (fileIds != null && fileIds.isNotEmpty) 'fileIds': fileIds,
        if (webSearch) 'webSearch': true,
        if (enabledTools != null && enabledTools.isNotEmpty)
          'enabledTools': enabledTools,
        if (knowledgeBaseIds != null && knowledgeBaseIds.isNotEmpty)
          'knowledgeBaseIds': knowledgeBaseIds,
      },
      options: Options(
        responseType: ResponseType.stream,
        receiveTimeout: const Duration(minutes: 5),
        headers: {
          'Accept': 'text/event-stream',
        },
      ),
      cancelToken: cancelToken,
    );

    final stream = response.data?.stream;
    if (stream == null) {
      throw Exception('未收到流式数据响应');
    }

    return stream.cast<List<int>>().transform(const SseStreamTransformer());
  }

  Future<void> deleteSession(String sessionId) async {
    await _client.dio.post(
      '/chat/session/delete',
      data: {'id': sessionId},
    );
  }

  Future<void> clearAllSessions() async {
    await _client.dio.post('/chat/session/clear-all');
  }

  /// 从后端实时拉取已启用的对话模型列表，与 PC 端保持同源筛选与排序
  Future<List<ModelInfo>> getActiveChatModels() async {
    final response = await _client.dio.get(
      ApiConstants.aiModels,
      queryParameters: {'includeProvider': 'true'},
    );
    final data = response.data;
    if (data is! Map<String, dynamic> || data['code'] != 0 || data['data'] is! List) {
      return [];
    }

    final rawList = (data['data'] as List).whereType<Map<String, dynamic>>().where((m) {
      final isActive = m['isActive'] != false;
      final provider = m['provider'];
      final providerActive = provider is! Map<String, dynamic> || provider['isActive'] != false;
      final category = m['category'] as String?;
      final modelId = (m['modelId'] as String? ?? '').toLowerCase();
      final isChatCategory = category == null || category == 'chat';
      final isPureImageModel = modelId.contains('imagine-image') ||
          modelId.contains('image-lite') ||
          modelId.contains('image-2.0');
      return isActive && providerActive && isChatCategory && modelId.isNotEmpty && !isPureImageModel;
    }).toList();

    rawList.sort((a, b) {
      final defA = a['isDefault'] == true ? 0 : 1;
      final defB = b['isDefault'] == true ? 0 : 1;
      if (defA != defB) return defA.compareTo(defB);
      final sortA = (a['sortOrder'] as num?)?.toInt() ?? 999;
      final sortB = (b['sortOrder'] as num?)?.toInt() ?? 999;
      if (sortA != sortB) return sortA.compareTo(sortB);
      return (a['modelId'] as String? ?? '').compareTo(b['modelId'] as String? ?? '');
    });

    return rawList.map(_mapBackendModelToInfo).toList();
  }

  ModelInfo _mapBackendModelToInfo(Map<String, dynamic> raw) {
    final modelId = raw['modelId'] as String? ?? '';
    final modelName = (raw['modelName'] as String?)?.trim();
    final description = (raw['description'] as String?)?.trim();
    final creditCost = (raw['creditCost'] as num?)?.toInt() ?? ApiConstants.chatMessageCost;
    final contextLen = (raw['contextLength'] as num?)?.toInt() ?? 0;
    final isDefault = raw['isDefault'] == true;
    final lower = modelId.toLowerCase();

    final preset = kAvailableChatModels.where((item) => item.id == modelId);
    final base = preset.isNotEmpty ? preset.first : null;

    String category = base?.category ?? '通用全能';
    String tag = base?.tag ?? '在线可用';
    IconData icon = base?.icon ?? Icons.auto_awesome_rounded;

    if (base == null) {
      if (lower.contains('r1') || lower.contains('x2.6') || lower.contains('reason')) {
        category = '深度推理 (Reasoning)';
        tag = creditCost == 0 ? '免费推理' : '深度思考';
        icon = Icons.psychology_alt_rounded;
      } else if (lower.contains('coder') || lower.contains('code')) {
        category = '代码极速';
        tag = '代码专家';
        icon = Icons.terminal_rounded;
      } else if (lower.contains('flash') || lower.contains('fast') || lower.contains('4b')) {
        category = '代码极速';
        tag = creditCost == 0 ? '限时免费' : '高速响应';
        icon = Icons.bolt_rounded;
      }
    }

    final contextWindow = base?.contextWindow ??
        (contextLen >= 1000000
            ? '${(contextLen / 1000000).round()}M'
            : (contextLen >= 1000 ? '${(contextLen / 1000).round()}k' : '128k'));

    return ModelInfo(
      id: modelId,
      name: (modelName != null && modelName.isNotEmpty) ? modelName : (base?.name ?? modelId),
      category: category,
      tag: isDefault ? '默认推荐' : tag,
      description: (description != null && description.isNotEmpty)
          ? description
          : (base?.description ?? '服务端已启用对话模型'),
      latency: base?.latency ?? '50ms',
      contextWindow: contextWindow,
      cost: creditCost,
      icon: icon,
      isDefault: isDefault,
    );
  }
}
