import 'dart:async';
import 'package:dio/dio.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/network/dio_client.dart';
import '../../../core/network/sse_parser.dart';
import '../domain/chat_message_model.dart';
import '../domain/chat_session_model.dart';
import '../domain/file_attachment_model.dart';
import '../domain/tool_model.dart';

/// 聊天领域仓储层
class ChatRepository {
  final DioClient _client;

  ChatRepository(this._client);

  Future<List<ChatSessionModel>> getSessions(String userId) async {
    final response = await _client.dio.get(
      '/chat/session/list',
      queryParameters: {'userId': userId},
    );
    final data = response.data;
    if (data is Map<String, dynamic> && data['code'] == 0 && data['data'] != null) {
      final list = data['data'] as List;
      return list
          .map((item) => ChatSessionModel.fromJson(item as Map<String, dynamic>))
          .toList();
    }
    return [];
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
      return result;
    }
    return [];
  }

  Future<Stream<SseChunk>> sendStreamMessage({
    required String message,
    required String model,
    required String clientRequestId,
    String? sessionId,
    List<String>? fileIds,
    bool webSearch = false,
    List<String>? enabledTools,
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
}
