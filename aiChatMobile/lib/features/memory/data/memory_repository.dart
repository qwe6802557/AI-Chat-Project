import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/network/dio_client.dart';
import '../../auth/providers/auth_provider.dart';
import '../domain/memory_models.dart';

/// 三层长短期记忆仓储层
class MemoryRepository {
  final DioClient _client;

  MemoryRepository(this._client);

  Map<String, dynamic> _unwrapMap(dynamic raw) {
    if (raw is Map<String, dynamic>) {
      if (raw['data'] is Map) {
        return Map<String, dynamic>.from(raw['data'] as Map);
      }
      return raw;
    }
    if (raw is Map) {
      final map = Map<String, dynamic>.from(raw);
      if (map['data'] is Map) {
        return Map<String, dynamic>.from(map['data'] as Map);
      }
      return map;
    }
    throw const FormatException('记忆接口返回格式异常');
  }

  /// 获取长期核心画像
  Future<AgentCoreProfileModel> getCoreProfile() async {
    final response = await _client.dio.get(ApiConstants.memoryProfile);
    return AgentCoreProfileModel.fromJson(_unwrapMap(response.data));
  }

  /// 就地纠偏并更新长期核心画像
  Future<AgentCoreProfileModel> updateCoreProfile({
    required String rawSummary,
  }) async {
    final response = await _client.dio.put(
      ApiConstants.memoryProfile,
      data: {'rawSummary': rawSummary},
    );
    return AgentCoreProfileModel.fromJson(_unwrapMap(response.data));
  }

  /// 分页查询或语义+词法混合检索日常情境记忆
  Future<DailyMemoryPageModel> getDailyMemories({
    String? category,
    String? keyword,
    int page = 1,
    int limit = 50,
  }) async {
    final queryParams = <String, dynamic>{
      'page': page,
      'limit': limit,
      if (category != null && category.isNotEmpty) 'category': category,
      if (keyword != null && keyword.trim().isNotEmpty) 'keyword': keyword.trim(),
    };
    final response = await _client.dio.get(
      ApiConstants.memoryDaily,
      queryParameters: queryParams,
    );
    return DailyMemoryPageModel.fromJson(_unwrapMap(response.data));
  }

  /// 手动录入单条日常记忆（自动向量化并执行语义去重）
  Future<UpsertDailyMemoryResult> createDailyMemory({
    required MemoryCategory category,
    required String content,
  }) async {
    final response = await _client.dio.post(
      ApiConstants.memoryDaily,
      data: {
        'category': category.code,
        'content': content.trim(),
      },
    );
    return UpsertDailyMemoryResult.fromJson(_unwrapMap(response.data));
  }

  /// 彻底遗忘单条日常记忆
  Future<void> deleteDailyMemory(String id) async {
    await _client.dio.delete('${ApiConstants.memoryDaily}/$id');
  }

  /// 手动触发日常记忆向核心画像增量蒸馏
  Future<AgentCoreProfileModel?> triggerDistill() async {
    final response = await _client.dio.post(ApiConstants.memoryDistill);
    final raw = response.data;
    if (raw is Map && raw['data'] == null && !raw.containsKey('id')) {
      return null;
    }
    return AgentCoreProfileModel.fromJson(_unwrapMap(raw));
  }
}

final memoryRepositoryProvider = Provider<MemoryRepository>((ref) {
  final client = ref.watch(dioClientProvider);
  return MemoryRepository(client);
});
