import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/network/dio_client.dart';
import '../../auth/providers/auth_provider.dart';

/// 待上传文件载荷（兼容内存字节与磁盘路径）
class UploadFileInput {
  final String name;
  final Uint8List? bytes;
  final String? filePath;

  const UploadFileInput({
    required this.name,
    this.bytes,
    this.filePath,
  });
}

/// 上传图片服务端返回实体
class UploadedImageResult {
  final String id;
  final String url;
  final String name;
  final String mime;
  final int sizeBytes;

  const UploadedImageResult({
    required this.id,
    required this.url,
    required this.name,
    required this.mime,
    required this.sizeBytes,
  });

  factory UploadedImageResult.fromJson(Map<String, dynamic> json) {
    final rawUrl = json['url'] as String? ?? '';
    final fullUrl = rawUrl.startsWith('http')
        ? rawUrl
        : '${ApiConstants.baseUrl}$rawUrl';

    return UploadedImageResult(
      id: json['id'] as String? ?? '',
      url: fullUrl,
      name: json['name'] as String? ?? '',
      mime: json['mime'] as String? ?? '',
      sizeBytes: (json['sizeBytes'] as num?)?.toInt() ?? 0,
    );
  }
}

/// 聊天文件与图片上传仓储
class FileUploadRepository {
  final DioClient _client;

  FileUploadRepository(this._client);

  Future<List<UploadedImageResult>> uploadImages(List<UploadFileInput> files) async {
    final formData = FormData();
    for (final file in files) {
      if (file.bytes != null) {
        formData.files.add(
          MapEntry(
            'files',
            MultipartFile.fromBytes(file.bytes!, filename: file.name),
          ),
        );
      } else if (!kIsWeb && file.filePath != null) {
        formData.files.add(
          MapEntry(
            'files',
            await MultipartFile.fromFile(file.filePath!, filename: file.name),
          ),
        );
      }
    }

    final response = await _client.dio.post(
      '/files/upload',
      data: formData,
      options: Options(
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      ),
    );

    final res = response.data;
    List? rawList;
    if (res is List) {
      rawList = res;
    } else if (res is Map<String, dynamic>) {
      if (res['data'] is List) {
        rawList = res['data'] as List;
      }
    }

    if (rawList != null) {
      return rawList
          .whereType<Map<String, dynamic>>()
          .map((item) => UploadedImageResult.fromJson(item))
          .toList();
    }
    return [];
  }
}

final fileUploadRepositoryProvider = Provider<FileUploadRepository>((ref) {
  final client = ref.watch(dioClientProvider);
  return FileUploadRepository(client);
});
