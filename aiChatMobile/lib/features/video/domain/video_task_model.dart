import '../../../core/constants/api_constants.dart';

/// 视频生成任务状态枚举
enum VideoTaskStatus {
  pending,
  processing,
  success,
  failed;

  static VideoTaskStatus fromString(String? value) {
    switch (value) {
      case 'pending':
        return VideoTaskStatus.pending;
      case 'processing':
        return VideoTaskStatus.processing;
      case 'success':
        return VideoTaskStatus.success;
      case 'failed':
        return VideoTaskStatus.failed;
      default:
        return VideoTaskStatus.pending;
    }
  }

  bool get isRunning => this == VideoTaskStatus.pending || this == VideoTaskStatus.processing;
}

/// 视频生成任务领域实体
class VideoTaskModel {
  final String id;
  final String userId;
  final String prompt;
  final String modelId;
  final String? imageUrl;
  final String aspectRatio;
  final int duration;
  final String? videoUrl;
  final String? upstreamTaskId;
  final int costCredits;
  final VideoTaskStatus status;
  final String? errorMessage;
  final DateTime createdAt;
  final DateTime updatedAt;

  const VideoTaskModel({
    required this.id,
    this.userId = '',
    required this.prompt,
    required this.modelId,
    this.imageUrl,
    this.aspectRatio = '16:9',
    this.duration = 5,
    this.videoUrl,
    this.upstreamTaskId,
    this.costCredits = ApiConstants.videoGenerationCost,
    required this.status,
    this.errorMessage,
    required this.createdAt,
    required this.updatedAt,
  });

  /// 解析完整视频流媒体地址
  String? get resolvedVideoUrl => resolveMediaUrl(videoUrl);

  /// 解析完整首帧参考图地址
  String? get resolvedImageUrl => resolveMediaUrl(imageUrl);

  /// 统一媒体资源地址补全
  static String? resolveMediaUrl(String? rawUrl) {
    if (rawUrl == null || rawUrl.isEmpty) return null;
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://') || rawUrl.startsWith('data:')) {
      return rawUrl;
    }
    final normalizedPath = rawUrl.startsWith('/') ? rawUrl : '/$rawUrl';
    return '${ApiConstants.baseUrl}$normalizedPath';
  }

  /// 画幅宽高比浮点数值
  double get aspectRatioValue {
    switch (aspectRatio) {
      case '9:16':
        return 9.0 / 16.0;
      case '1:1':
        return 1.0;
      case '16:9':
      default:
        return 16.0 / 9.0;
    }
  }

  factory VideoTaskModel.fromJson(Map<String, dynamic> json) {
    final now = DateTime.now();
    return VideoTaskModel(
      id: (json['id'] ?? '').toString(),
      userId: (json['userId'] ?? '').toString(),
      prompt: (json['prompt'] ?? '').toString(),
      modelId: (json['modelId'] ?? json['model'] ?? 'Wan-AI/Wan2.2-T2V-A14B').toString(),
      imageUrl: json['imageUrl'] as String?,
      aspectRatio: (json['aspectRatio'] ?? json['aspect_ratio'] ?? '16:9').toString(),
      duration: json['duration'] is int
          ? json['duration'] as int
          : int.tryParse(json['duration']?.toString() ?? '5') ?? 5,
      videoUrl: json['videoUrl'] as String?,
      upstreamTaskId: json['upstreamTaskId'] as String?,
      costCredits: json['costCredits'] is int
          ? json['costCredits'] as int
          : int.tryParse(json['costCredits']?.toString() ?? '200') ?? ApiConstants.videoGenerationCost,
      status: VideoTaskStatus.fromString(json['status'] as String?),
      errorMessage: json['errorMessage'] as String?,
      createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? '') ?? now,
      updatedAt: DateTime.tryParse(json['updatedAt']?.toString() ?? '') ?? now,
    );
  }

  VideoTaskModel copyWith({
    String? id,
    String? userId,
    String? prompt,
    String? modelId,
    String? imageUrl,
    String? aspectRatio,
    int? duration,
    String? videoUrl,
    String? upstreamTaskId,
    int? costCredits,
    VideoTaskStatus? status,
    String? errorMessage,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return VideoTaskModel(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      prompt: prompt ?? this.prompt,
      modelId: modelId ?? this.modelId,
      imageUrl: imageUrl ?? this.imageUrl,
      aspectRatio: aspectRatio ?? this.aspectRatio,
      duration: duration ?? this.duration,
      videoUrl: videoUrl ?? this.videoUrl,
      upstreamTaskId: upstreamTaskId ?? this.upstreamTaskId,
      costCredits: costCredits ?? this.costCredits,
      status: status ?? this.status,
      errorMessage: errorMessage ?? this.errorMessage,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}

/// 视频单任务轮询响应载体
class VideoStatusPayload {
  final String id;
  final VideoTaskStatus status;
  final String? videoUrl;
  final String? errorMessage;
  final DateTime updatedAt;

  const VideoStatusPayload({
    required this.id,
    required this.status,
    this.videoUrl,
    this.errorMessage,
    required this.updatedAt,
  });

  factory VideoStatusPayload.fromJson(Map<String, dynamic> json) {
    return VideoStatusPayload(
      id: (json['id'] ?? '').toString(),
      status: VideoTaskStatus.fromString(json['status'] as String?),
      videoUrl: json['videoUrl'] as String?,
      errorMessage: json['errorMessage'] as String?,
      updatedAt: DateTime.tryParse(json['updatedAt']?.toString() ?? '') ?? DateTime.now(),
    );
  }
}
