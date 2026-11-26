import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/dio_client.dart';
import '../../auth/providers/auth_provider.dart';
import '../domain/knowledge_base_model.dart';
import '../domain/document_model.dart';
import '../domain/chunk_model.dart';

/// 分页切片响应容器
class PagedChunksResult {
  final List<ChunkModel> items;
  final int total;

  const PagedChunksResult({
    required this.items,
    required this.total,
  });
}

/// 知识库数据仓储层 (KnowledgeBaseRepository)
class KnowledgeBaseRepository {
  final DioClient _client;

  KnowledgeBaseRepository(this._client);

  /// 获取当前用户的所有知识库
  Future<List<KnowledgeBaseModel>> getKnowledgeBases() async {
    final response = await _client.dio.get('/knowledge-bases');
    final res = response.data;
    List? rawList;
    if (res is List) {
      rawList = res;
    } else if (res is Map<String, dynamic> && res['data'] is List) {
      rawList = res['data'] as List;
    }

    if (rawList != null) {
      return rawList
          .whereType<Map<String, dynamic>>()
          .map((item) => KnowledgeBaseModel.fromJson(item))
          .toList();
    }
    return [];
  }

  /// 获取指定知识库详情
  Future<KnowledgeBaseModel> getKnowledgeBaseById(String id) async {
    final response = await _client.dio.get('/knowledge-bases/$id');
    final res = response.data;
    final Map<String, dynamic> data = res is Map<String, dynamic> && res['data'] is Map<String, dynamic>
        ? res['data'] as Map<String, dynamic>
        : res as Map<String, dynamic>;
    return KnowledgeBaseModel.fromJson(data);
  }

  /// 创建新知识库
  Future<KnowledgeBaseModel> createKnowledgeBase({
    required String name,
    String description = '',
    String avatar = 'auto_stories',
  }) async {
    final response = await _client.dio.post(
      '/knowledge-bases',
      data: {
        'name': name.trim(),
        'description': description.trim(),
        'avatar': avatar,
      },
    );
    final res = response.data;
    final Map<String, dynamic> data = res is Map<String, dynamic> && res['data'] is Map<String, dynamic>
        ? res['data'] as Map<String, dynamic>
        : res as Map<String, dynamic>;
    return KnowledgeBaseModel.fromJson(data);
  }

  /// 更新知识库信息
  Future<KnowledgeBaseModel> updateKnowledgeBase(
    String id, {
    String? name,
    String? description,
    String? avatar,
  }) async {
    final payload = <String, dynamic>{};
    if (name != null) payload['name'] = name.trim();
    if (description != null) payload['description'] = description.trim();
    if (avatar != null) payload['avatar'] = avatar;

    final response = await _client.dio.put('/knowledge-bases/$id', data: payload);
    final res = response.data;
    final Map<String, dynamic> data = res is Map<String, dynamic> && res['data'] is Map<String, dynamic>
        ? res['data'] as Map<String, dynamic>
        : res as Map<String, dynamic>;
    return KnowledgeBaseModel.fromJson(data);
  }

  /// 删除知识库（级联清空文档与切片）
  Future<void> deleteKnowledgeBase(String id) async {
    await _client.dio.delete('/knowledge-bases/$id');
  }

  /// 获取知识库文档列表
  Future<List<DocumentModel>> getDocuments(String kbId) async {
    final response = await _client.dio.get('/knowledge-bases/$kbId/documents');
    final res = response.data;
    List? rawList;
    if (res is List) {
      rawList = res;
    } else if (res is Map<String, dynamic> && res['data'] is List) {
      rawList = res['data'] as List;
    }

    if (rawList != null) {
      return rawList
          .whereType<Map<String, dynamic>>()
          .map((item) => DocumentModel.fromJson(item))
          .toList();
    }
    return [];
  }

  /// 上传并解析入库文档 (PDF/DOCX/MD/TXT)
  Future<DocumentModel> uploadDocument(
    String kbId, {
    required String fileName,
    Uint8List? bytes,
    String? filePath,
    void Function(int sent, int total)? onProgress,
  }) async {
    final formData = FormData();
    if (bytes != null) {
      formData.files.add(
        MapEntry(
          'file',
          MultipartFile.fromBytes(bytes, filename: fileName),
        ),
      );
    } else if (!kIsWeb && filePath != null) {
      formData.files.add(
        MapEntry(
          'file',
          await MultipartFile.fromFile(filePath, filename: fileName),
        ),
      );
    } else {
      throw ArgumentError('必须提供文件字节或文件路径');
    }

    final response = await _client.dio.post(
      '/knowledge-bases/$kbId/documents',
      data: formData,
      options: Options(
        headers: {'Content-Type': 'multipart/form-data'},
      ),
      onSendProgress: onProgress,
    );

    final res = response.data;
    final Map<String, dynamic> data = res is Map<String, dynamic> && res['data'] is Map<String, dynamic>
        ? res['data'] as Map<String, dynamic>
        : res as Map<String, dynamic>;
    return DocumentModel.fromJson(data);
  }

  /// 失败文档重新入队解析
  Future<DocumentModel> retryDocument(String docId) async {
    final response = await _client.dio.post(
      '/knowledge-bases/documents/$docId/retry',
    );
    final res = response.data;
    final Map<String, dynamic> data =
        res is Map<String, dynamic> && res['data'] is Map<String, dynamic>
            ? res['data'] as Map<String, dynamic>
            : res as Map<String, dynamic>;
    return DocumentModel.fromJson(data);
  }

  /// 订阅知识库文档后台解析进度 SSE 流
  Stream<DocumentProgressEvent> watchDocumentEvents(
    String kbId, {
    CancelToken? cancelToken,
  }) async* {
    final response = await _client.dio.get<ResponseBody>(
      '/knowledge-bases/$kbId/documents/events',
      options: Options(
        responseType: ResponseType.stream,
        headers: const {'Accept': 'text/event-stream'},
        receiveTimeout: const Duration(minutes: 15),
      ),
      cancelToken: cancelToken,
    );

    final bodyStream = response.data?.stream;
    if (bodyStream == null) return;

    final lines = bodyStream
        .cast<List<int>>()
        .transform(utf8.decoder)
        .transform(const LineSplitter());

    await for (final line in lines) {
      final trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      final rawPayload = trimmed.substring(5).trim();
      if (rawPayload.isEmpty) continue;

      try {
        final decoded = jsonDecode(rawPayload);
        if (decoded is Map<String, dynamic>) {
          yield DocumentProgressEvent.fromJson(decoded);
        }
      } catch (_) {
        // 忽略心跳或非 JSON 注释片段
      }
    }
  }

  /// 删除文档
  Future<void> deleteDocument(String docId) async {
    await _client.dio.delete('/knowledge-bases/documents/$docId');
  }

  /// 获取文档切片分页列表（含总数与关键词筛选）
  Future<PagedChunksResult> getChunksPaged(
    String docId, {
    int page = 1,
    int pageSize = 20,
    String? keyword,
    bool enabledOnly = false,
  }) async {
    final response = await _client.dio.get(
      '/knowledge-bases/documents/$docId/chunks',
      queryParameters: {
        'page': page,
        'pageSize': pageSize,
        if (keyword != null && keyword.trim().isNotEmpty) 'keyword': keyword.trim(),
        if (enabledOnly) 'enabledOnly': 'true',
      },
    );
    final res = response.data;
    Map<String, dynamic>? payload;
    List? rawList;
    if (res is Map<String, dynamic> && res['items'] is List) {
      payload = res;
      rawList = res['items'] as List;
    } else if (res is List) {
      rawList = res;
    } else if (res is Map<String, dynamic> && res['data'] is Map<String, dynamic>) {
      final inner = res['data'] as Map<String, dynamic>;
      if (inner['items'] is List) {
        payload = inner;
        rawList = inner['items'] as List;
      }
    }

    final items = rawList != null
        ? rawList.whereType<Map<String, dynamic>>().map(ChunkModel.fromJson).toList()
        : <ChunkModel>[];
    final total = (payload?['total'] as num?)?.toInt() ?? items.length;
    return PagedChunksResult(items: items, total: total);
  }

  /// 获取文档切片详情列表（向后兼容接口）
  Future<List<ChunkModel>> getChunks(
    String docId, {
    int page = 1,
    int pageSize = 20,
  }) async {
    final paged = await getChunksPaged(docId, page: page, pageSize: pageSize);
    return paged.items;
  }

  /// 获取命中切片及其前后邻接上下文窗口
  Future<ChunkContextModel> getChunkContext(
    String chunkId, {
    int window = 1,
  }) async {
    final response = await _client.dio.get(
      '/knowledge-bases/chunks/$chunkId/context',
      queryParameters: {'window': window},
    );
    final res = response.data;
    final Map<String, dynamic> data = res is Map<String, dynamic> && res['data'] is Map<String, dynamic>
        ? res['data'] as Map<String, dynamic>
        : res as Map<String, dynamic>;
    return ChunkContextModel.fromJson(data);
  }

  /// 更新单条切片正文（自动重算向量）或启停状态
  Future<ChunkModel> updateChunk(
    String chunkId, {
    String? content,
    bool? isEnabled,
  }) async {
    final payload = <String, dynamic>{};
    if (content != null) payload['content'] = content;
    if (isEnabled != null) payload['isEnabled'] = isEnabled;

    final response = await _client.dio.patch(
      '/knowledge-bases/chunks/$chunkId',
      data: payload,
    );
    final res = response.data;
    final Map<String, dynamic> data = res is Map<String, dynamic> && res['data'] is Map<String, dynamic>
        ? res['data'] as Map<String, dynamic>
        : res as Map<String, dynamic>;
    return ChunkModel.fromJson(data);
  }

  /// 知识库混合 RAG 检索测试
  Future<List<ChunkModel>> searchKnowledgeBase({
    required String query,
    required List<String> knowledgeBaseIds,
    int limit = 5,
    String mode = 'hybrid',
    double? minScore,
    bool enableRerank = true,
  }) async {
    final response = await _client.dio.post(
      '/knowledge-bases/search',
      data: {
        'query': query,
        'knowledgeBaseIds': knowledgeBaseIds,
        'limit': limit,
        'mode': mode,
        if (minScore != null && minScore > 0) 'minScore': minScore,
        'enableRerank': enableRerank,
      },
    );
    final res = response.data;
    List? rawList;
    if (res is List) {
      rawList = res;
    } else if (res is Map<String, dynamic> && res['data'] is List) {
      rawList = res['data'] as List;
    }

    if (rawList != null) {
      return rawList
          .whereType<Map<String, dynamic>>()
          .map((item) => ChunkModel.fromJson(item))
          .toList();
    }
    return [];
  }
}

/// 全局仓储 Provider
final knowledgeBaseRepositoryProvider = Provider<KnowledgeBaseRepository>((ref) {
  final client = ref.watch(dioClientProvider);
  return KnowledgeBaseRepository(client);
});
