import '../../../core/network/dio_client.dart';
import '../domain/image_task_model.dart';

/// 生图领域仓储层
class ImageRepository {
  final DioClient _client;

  ImageRepository(this._client);

  Future<ImageTaskModel> createImageGeneration({
    required String prompt,
    String model = 'grok-imagine-image-2.0',
    int n = 1,
    String aspectRatio = '1:1',
    String resolution = '1k',
    String quality = 'medium',
  }) async {
    final response = await _client.dio.post(
      '/images/generations',
      data: {
        'prompt': prompt,
        'model': model,
        'n': n,
        'aspect_ratio': aspectRatio,
        'resolution': resolution,
        'quality': quality,
      },
    );

    final data = response.data;
    if (data is Map<String, dynamic> && data['code'] == 0 && data['data'] != null) {
      return ImageTaskModel.fromJson(data['data'] as Map<String, dynamic>);
    }
    throw Exception(data['message'] ?? '发起生图任务失败');
  }

  Future<List<ImageTaskModel>> getImageHistory({
    int page = 1,
    int pageSize = 20,
  }) async {
    final response = await _client.dio.get(
      '/images/history',
      queryParameters: {
        'page': page,
        'pageSize': pageSize,
      },
    );

    final data = response.data;
    if (data is Map<String, dynamic> && data['code'] == 0 && data['data'] != null) {
      final list = data['data'] is List
          ? data['data'] as List
          : (data['data']['items'] as List? ?? []);
      return list
          .map((item) => ImageTaskModel.fromJson(item as Map<String, dynamic>))
          .toList();
    }
    return [];
  }
}
