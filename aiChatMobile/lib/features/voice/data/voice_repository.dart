import 'dart:typed_data';
import 'package:dio/dio.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/network/dio_client.dart';
import '../domain/voice_task_model.dart';

/// 语音服务仓储层
class VoiceRepository {
  final DioClient _client;

  VoiceRepository(this._client);

  /// 获取可用的 TTS 音色列表
  Future<List<VoiceInfoModel>> getVoices({String? model}) async {
    final response = await _client.dio.get(
      ApiConstants.voiceVoices,
      queryParameters: model != null ? {'model': model} : null,
    );

    final data = response.data;
    if (data is Map<String, dynamic> && data['code'] == 0 && data['data'] != null) {
      final payload = data['data'];
      final list = payload is Map && payload['voices'] is List
          ? payload['voices'] as List
          : (payload is List ? payload : []);
      return list
          .map((item) => VoiceInfoModel.fromJson(item as Map<String, dynamic>))
          .toList();
    }
    return [];
  }

  /// 发起 TTS 文本转语音合成任务
  Future<VoiceTaskModel> generateTts({
    required String text,
    required String voiceId,
    String? model,
    String? language,
    double? speed,
    CancelToken? cancelToken,
  }) async {
    final response = await _client.dio.post(
      ApiConstants.voiceTts,
      data: {
        'text': text,
        'voiceId': voiceId,
        if (model != null) 'model': model,
        if (language != null) 'language': language,
        if (speed != null) 'speed': speed,
      },
      cancelToken: cancelToken,
      options: Options(
        sendTimeout: const Duration(seconds: 60),
        receiveTimeout: const Duration(seconds: 120),
      ),
    );

    final data = response.data;
    if (data is Map<String, dynamic> && data['code'] == 0 && data['data'] != null) {
      return VoiceTaskModel.fromJson(data['data'] as Map<String, dynamic>);
    }
    throw Exception(data['message'] ?? '语音合成失败');
  }

  /// 上传音频发起 STT 语音识别转文字
  Future<VoiceTaskModel> transcribeStt({
    Uint8List? fileBytes,
    String? filePath,
    required String filename,
    String? language,
    CancelToken? cancelToken,
  }) async {
    MultipartFile multipartFile;
    if (fileBytes != null) {
      multipartFile = MultipartFile.fromBytes(fileBytes, filename: filename);
    } else if (filePath != null) {
      multipartFile = await MultipartFile.fromFile(filePath, filename: filename);
    } else {
      throw ArgumentError('必须提供音频文件数据或文件路径');
    }

    final formData = FormData.fromMap({
      'file': multipartFile,
      if (language != null) 'language': language,
    });

    final response = await _client.dio.post(
      ApiConstants.voiceStt,
      data: formData,
      cancelToken: cancelToken,
      options: Options(
        headers: {'Content-Type': 'multipart/form-data'},
        sendTimeout: const Duration(seconds: 60),
        receiveTimeout: const Duration(seconds: 180),
      ),
    );

    final data = response.data;
    if (data is Map<String, dynamic> && data['code'] == 0 && data['data'] != null) {
      return VoiceTaskModel.fromJson(data['data'] as Map<String, dynamic>);
    }
    throw Exception(data['message'] ?? '语音识别失败');
  }

  /// 分页拉取个人语音任务历史记录
  Future<List<VoiceTaskModel>> getVoiceHistory({
    int page = 1,
    int pageSize = 50,
    String type = 'all',
  }) async {
    final response = await _client.dio.get(
      ApiConstants.voiceHistory,
      queryParameters: {
        'page': page,
        'pageSize': pageSize,
        if (type != 'all') 'type': type,
      },
    );

    final data = response.data;
    if (data is Map<String, dynamic> && data['code'] == 0 && data['data'] != null) {
      final payload = data['data'];
      final list = payload is List
          ? payload
          : (payload is Map && payload['items'] is List ? payload['items'] as List : []);
      return list
          .map((item) => VoiceTaskModel.fromJson(item as Map<String, dynamic>))
          .toList();
    }
    return [];
  }
}
