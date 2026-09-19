import '../../../core/constants/api_constants.dart';

/// 语音任务类型
enum VoiceTaskType {
  tts,
  stt;

  static VoiceTaskType fromString(String? type) {
    if (type?.toLowerCase() == 'stt') {
      return VoiceTaskType.stt;
    }
    return VoiceTaskType.tts;
  }

  String toValue() => name;
}

/// 语音任务状态
enum VoiceTaskStatus {
  pending,
  success,
  failed;

  static VoiceTaskStatus fromString(String? status) {
    switch (status?.toLowerCase()) {
      case 'success':
      case 'completed':
        return VoiceTaskStatus.success;
      case 'failed':
      case 'error':
        return VoiceTaskStatus.failed;
      default:
        return VoiceTaskStatus.pending;
    }
  }

  String toValue() => name;
}

/// 语音任务领域实体
class VoiceTaskModel {
  final String id;
  final String userId;
  final VoiceTaskType type;
  final String model;
  final String? voiceId;
  final String language;
  final double speed;
  final String text;
  final String? audioUrl;
  final int costCredits;
  final double? duration;
  final VoiceTaskStatus status;
  final String? errorMessage;
  final DateTime createdAt;
  final DateTime updatedAt;

  const VoiceTaskModel({
    required this.id,
    required this.userId,
    required this.type,
    required this.model,
    this.voiceId,
    required this.language,
    required this.speed,
    required this.text,
    this.audioUrl,
    required this.costCredits,
    this.duration,
    required this.status,
    this.errorMessage,
    required this.createdAt,
    required this.updatedAt,
  });

  factory VoiceTaskModel.fromJson(Map<String, dynamic> json) {
    final rawAudioUrl = (json['audioUrl'] ?? json['audio_url']) as String?;
    String? resolvedAudioUrl;
    if (rawAudioUrl != null && rawAudioUrl.isNotEmpty) {
      if (rawAudioUrl.startsWith('http://') || rawAudioUrl.startsWith('https://')) {
        resolvedAudioUrl = rawAudioUrl;
      } else {
        final path = rawAudioUrl.startsWith('/') ? rawAudioUrl : '/$rawAudioUrl';
        resolvedAudioUrl = '${ApiConstants.baseUrl}$path';
      }
    }

    final rawDuration = json['duration'];
    double? duration;
    if (rawDuration is num) {
      duration = rawDuration.toDouble();
    } else if (rawDuration is String) {
      duration = double.tryParse(rawDuration);
    }

    final rawSpeed = json['speed'];
    double speed = 1.0;
    if (rawSpeed is num) {
      speed = rawSpeed.toDouble();
    } else if (rawSpeed is String) {
      speed = double.tryParse(rawSpeed) ?? 1.0;
    }

    final rawCost = json['costCredits'] ?? json['cost_credits'];
    int costCredits = ApiConstants.voiceUnitCost;
    if (rawCost is num) {
      costCredits = rawCost.toInt();
    } else if (rawCost is String) {
      costCredits = int.tryParse(rawCost) ?? ApiConstants.voiceUnitCost;
    }

    return VoiceTaskModel(
      id: (json['id'] ?? '').toString(),
      userId: (json['userId'] ?? json['user_id'] ?? '').toString(),
      type: VoiceTaskType.fromString(json['type']?.toString()),
      model: (json['model'] ?? (json['type'] == 'stt' ? 'grok-stt' : 'grok-voice-think-fast-1.0')).toString(),
      voiceId: (json['voiceId'] ?? json['voice_id'])?.toString(),
      language: (json['language'] ?? 'zh').toString(),
      speed: speed,
      text: (json['text'] ?? '').toString(),
      audioUrl: resolvedAudioUrl,
      costCredits: costCredits,
      duration: duration,
      status: VoiceTaskStatus.fromString(json['status']?.toString()),
      errorMessage: (json['errorMessage'] ?? json['error_message'])?.toString(),
      createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? '') ?? DateTime.now(),
      updatedAt: DateTime.tryParse(json['updatedAt']?.toString() ?? '') ?? DateTime.now(),
    );
  }
}

/// 音色实体模型
class VoiceInfoModel {
  final String voiceId;
  final String name;
  final String language;

  const VoiceInfoModel({
    required this.voiceId,
    required this.name,
    required this.language,
  });

  factory VoiceInfoModel.fromJson(Map<String, dynamic> json) {
    return VoiceInfoModel(
      voiceId: (json['voice_id'] ?? json['voiceId'] ?? '').toString(),
      name: (json['name'] ?? '').toString(),
      language: (json['language'] ?? 'zh').toString(),
    );
  }
}
