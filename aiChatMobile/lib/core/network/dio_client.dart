import 'package:dio/dio.dart';
import '../constants/api_constants.dart';
import '../storage/secure_storage_service.dart';

/// 统一网络请求客户端
class DioClient {
  final Dio dio;
  final SecureStorageService storageService;
  final void Function()? onUnauthorized;

  DioClient({
    required this.storageService,
    this.onUnauthorized,
    Dio? customDio,
  }) : dio = customDio ??
            Dio(
              BaseOptions(
                baseUrl: ApiConstants.baseUrl,
                connectTimeout: const Duration(seconds: 60),
                receiveTimeout: const Duration(seconds: 180),
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json',
                },
              ),
            ) {
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await storageService.getToken();
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
        onError: (DioException error, handler) async {
          if (error.response?.statusCode == 401) {
            await storageService.clearAuthCredentials();
            onUnauthorized?.call();
          }
          handler.next(error);
        },
      ),
    );
  }
}
