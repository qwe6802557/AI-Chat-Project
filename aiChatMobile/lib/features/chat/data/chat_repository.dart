import 'dart:async';
import 'package:dio/dio.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/network/dio_client.dart';
import '../../../core/network/sse_parser.dart';
import '../domain/chat_message_model.dart';
import '../domain/chat_session_model.dart';

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

        // 映射用户端原消息
        if (m['userMessage'] != null && (m['userMessage'] as String).isNotEmpty) {
          result.add(
            ChatMessageModel(
              id: '${m['id']}_user',
              sessionId: sessionId,
              role: 'user',
              content: m['userMessage'] as String,
              createdAt: createdAt,
            ),
          );
        }

        // 映射助手回复
        if (m['aiMessage'] != null && (m['aiMessage'] as String).isNotEmpty) {
          result.add(
            ChatMessageModel(
              id: '${m['id']}_assistant',
              sessionId: sessionId,
              role: 'assistant',
              content: m['aiMessage'] as String,
              model: m['model'] as String?,
              createdAt: createdAt,
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
    CancelToken? cancelToken,
  }) async {
    final response = await _client.dio.post<ResponseBody>(
      ApiConstants.chatStream,
      data: {
        'message': message,
        'model': model,
        'clientRequestId': clientRequestId,
        if (sessionId != null && sessionId.isNotEmpty) 'sessionId': sessionId,
      },
      options: Options(
        responseType: ResponseType.stream,
        headers: {
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
      ),
      cancelToken: cancelToken,
    );

    final stream = response.data?.stream;
    if (stream == null) {
      throw Exception('未收到流式数据响应');
    }

    return stream.transform(const SseStreamTransformer());
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
