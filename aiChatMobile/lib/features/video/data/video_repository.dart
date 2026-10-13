import 'package:dio/dio.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/network/dio_client.dart';
import '../domain/video_task_model.dart';

/// 视频创作领域仓储层
class VideoRepository {
  final DioClient _client;

  VideoRepository(this._client);

  /// 发起异步视频生成任务
  Future<VideoTaskModel> generateVideo({
    required String prompt,
    String? model,
    String? image,
    String aspectRatio = '16:9',
  }) async {
    final response = await _client.dio.post(
      ApiConstants.videoGenerations,
      data: {
        'prompt': prompt,
        if (model != null && model.isNotEmpty) 'model': model,
        if (image != null && image.isNotEmpty) 'image': image,
        'aspect_ratio': aspectRatio,
      },
      options: Options(
        sendTimeout: const Duration(seconds: 60),
        receiveTimeout: const Duration(seconds: 60),
      ),
    );

    final data = response.data;
    if (data is Map<String, dynamic> && (data['code'] == 0 || data['code'] == 200) && data['data'] != null) {
      return VideoTaskModel.fromJson(data['data'] as Map<String, dynamic>);
    }
    throw Exception(data is Map ? (data['message'] ?? '视频任务提交失败') : '视频任务提交失败');
  }

  /// 分页获取视频生成历史记录
  Future<List<VideoTaskModel>> getVideoHistory({
    int page = 1,
    int pageSize = 30,
  }) async {
    final response = await _client.dio.get(
      ApiConstants.videoHistory,
      queryParameters: {
        'page': page,
        'pageSize': pageSize,
      },
    );

    final data = response.data;
    if (data is Map<String, dynamic> && (data['code'] == 0 || data['code'] == 200) && data['data'] != null) {
      final payload = data['data'];
      final list = payload is List
          ? payload
          : (payload is Map && payload['list'] is List
              ? payload['list'] as List
              : (payload is Map && payload['items'] is List ? payload['items'] as List : []));
      return list
          .map((item) => VideoTaskModel.fromJson(item as Map<String, dynamic>))
          .toList();
    }
    return [];
  }

  /// 轮询查询单个视频任务最新生成状态
  Future<VideoStatusPayload> getVideoStatus(String taskId) async {
    final response = await _client.dio.get(
      '${ApiConstants.videoStatusPrefix}/$taskId',
    );

    final data = response.data;
    if (data is Map<String, dynamic> && (data['code'] == 0 || data['code'] == 200) && data['data'] != null) {
      return VideoStatusPayload.fromJson(data['data'] as Map<String, dynamic>);
    }
    throw Exception(data is Map ? (data['message'] ?? '查询视频状态失败') : '查询视频状态失败');
  }

  /// 删除指定视频历史记录及媒体文件
  Future<bool> deleteVideoTask(String taskId) async {
    final response = await _client.dio.delete(
      '${ApiConstants.videoDeletePrefix}/$taskId',
    );

    final data = response.data;
    if (data is Map<String, dynamic> && (data['code'] == 0 || data['code'] == 200)) {
      return true;
    }
    throw Exception(data is Map ? (data['message'] ?? '删除视频记录失败') : '删除视频记录失败');
  }
}
