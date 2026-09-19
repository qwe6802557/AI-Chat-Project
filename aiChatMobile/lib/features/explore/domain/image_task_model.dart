import '../../../core/constants/api_constants.dart';

/// 生图任务领域实体
class ImageTaskModel {
  final String id;
  final String prompt;
  final String model;
  final String aspectRatio;
  final String resolution;
  final List<String> imageUrls;
  final String status;
  final DateTime createdAt;

  const ImageTaskModel({
    required this.id,
    required this.prompt,
    required this.model,
    required this.aspectRatio,
    required this.resolution,
    required this.imageUrls,
    required this.status,
    required this.createdAt,
  });

  factory ImageTaskModel.fromJson(Map<String, dynamic> json) {
    List<String> rawUrls = [];
    if (json['imageUrls'] is List) {
      rawUrls = (json['imageUrls'] as List).map((e) => e.toString()).toList();
    } else if (json['images'] is List) {
      rawUrls = (json['images'] as List).map((e) {
        if (e is Map) return (e['url'] ?? e['path'] ?? '').toString();
        return e.toString();
      }).toList();
    } else if (json['url'] != null) {
      rawUrls = [json['url'].toString()];
    }

    final urls = rawUrls.map((u) {
      if (u.isEmpty) return u;
      if (u.startsWith('http://') || u.startsWith('https://')) {
        return u;
      }
      final path = u.startsWith('/') ? u : '/$u';
      return '${ApiConstants.baseUrl}$path';
    }).toList();

    return ImageTaskModel(
      id: (json['id'] ?? '').toString(),
      prompt: (json['prompt'] ?? '') as String,
      model: (json['model'] ?? 'grok-imagine-image-2.0') as String,
      aspectRatio: (json['aspect_ratio'] ?? json['aspectRatio'] ?? '1:1') as String,
      resolution: (json['resolution'] ?? '1k') as String,
      imageUrls: urls,
      status: (json['status'] ?? 'completed') as String,
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '') ?? DateTime.now(),
    );
  }
}
