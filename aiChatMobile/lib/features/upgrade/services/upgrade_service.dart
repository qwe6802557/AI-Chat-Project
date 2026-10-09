import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/constants/api_constants.dart';
import '../domain/app_version_model.dart';

/// 移动端 OTA 升级与安装服务
class UpgradeService {
  final Dio _dio = Dio(BaseOptions(
    connectTimeout: const Duration(seconds: 10),
    receiveTimeout: const Duration(seconds: 10),
  ));

  /// 检查服务端最新发布版本
  Future<AppVersionInfo?> checkUpdate({String currentVersion = '1.0.0'}) async {
    try {
      final response = await _dio.get(
        '${ApiConstants.baseUrl}/app/version/check',
        queryParameters: {
          'version': currentVersion,
          'platform': Platform.isAndroid ? 'android' : 'ios',
        },
      );
      if (response.statusCode == 200 && response.data != null) {
        return AppVersionInfo.fromJson(response.data as Map<String, dynamic>);
      }
    } catch (e) {
      debugPrint('[UpgradeService] checkUpdate failed: $e');
    }
    return null;
  }

  /// 调起外部浏览器直链下载（免设置未知来源安装权限最佳路径）
  Future<bool> launchBrowserDownload(String url) async {
    final targetUrl = url.isNotEmpty
        ? url
        : '${ApiConstants.baseUrl}/downloads/aichat-latest.apk';
    final uri = Uri.parse(targetUrl);
    if (await canLaunchUrl(uri)) {
      return await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
    return false;
  }

  /// 应用内流式下载 APK 安装包并保存至本地缓存
  Future<String?> downloadApk(
    String url, {
    required void Function(int received, int total) onProgress,
    CancelToken? cancelToken,
  }) async {
    try {
      final targetUrl = url.isNotEmpty
          ? url
          : '${ApiConstants.baseUrl}/downloads/aichat-latest.apk';
      final dir = await getTemporaryDirectory();
      final savePath = '${dir.path}/aichat_update.apk';

      final file = File(savePath);
      if (await file.exists()) {
        await file.delete();
      }

      final response = await _dio.download(
        targetUrl,
        savePath,
        onReceiveProgress: onProgress,
        cancelToken: cancelToken,
      );

      if (response.statusCode == 200) {
        return savePath;
      }
    } catch (e) {
      debugPrint('[UpgradeService] downloadApk error: $e');
    }
    return null;
  }
}
