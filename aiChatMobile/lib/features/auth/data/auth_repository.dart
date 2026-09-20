import 'package:dio/dio.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/network/dio_client.dart';
import '../domain/user_model.dart';

/// 验证码接口响应实体
class CaptchaResponse {
  final String captchaId;
  final String captchaImage;

  const CaptchaResponse({
    required this.captchaId,
    required this.captchaImage,
  });

  factory CaptchaResponse.fromJson(Map<String, dynamic> json) {
    return CaptchaResponse(
      captchaId: json['captchaId'] as String,
      captchaImage: json['captchaImage'] as String,
    );
  }
}

/// 登录成功响应实体
class AuthResponse {
  final String token;
  final UserModel user;

  const AuthResponse({
    required this.token,
    required this.user,
  });

  factory AuthResponse.fromJson(Map<String, dynamic> json) {
    return AuthResponse(
      token: json['token'] as String,
      user: UserModel.fromJson(json['user'] as Map<String, dynamic>),
    );
  }
}

/// 认证仓储层实现
class AuthRepository {
  final DioClient _client;

  AuthRepository(this._client);

  Future<CaptchaResponse> getCaptcha() async {
    final response = await _client.dio.get(ApiConstants.authCaptcha);
    final data = response.data;
    if (data is Map<String, dynamic> && data['code'] == 0 && data['data'] != null) {
      return CaptchaResponse.fromJson(data['data'] as Map<String, dynamic>);
    }
    throw Exception(data['message'] ?? '获取验证码失败');
  }

  Future<AuthResponse> login({
    required String username,
    required String password,
    required String captcha,
    required String captchaId,
  }) async {
    try {
      final response = await _client.dio.post(
        ApiConstants.authLogin,
        data: {
          'username': username,
          'password': password,
          'captcha': captcha,
          'captchaId': captchaId,
        },
      );
      final data = response.data;
      if (data is Map<String, dynamic> && data['code'] == 0 && data['data'] != null) {
        return AuthResponse.fromJson(data['data'] as Map<String, dynamic>);
      }
      throw Exception(data['message'] ?? '登录失败');
    } on DioException catch (e) {
      final serverMsg = e.response?.data is Map
          ? (e.response?.data as Map)['message']
          : null;
      throw Exception(serverMsg ?? e.message ?? '网络请求异常');
    }
  }

  Future<UserModel> getUserProfile() async {
    final response = await _client.dio.get(ApiConstants.userAccount);
    final data = response.data;
    if (data is Map<String, dynamic> && data['code'] == 0 && data['data'] != null) {
      final payload = data['data'] as Map<String, dynamic>;
      final userMap = payload['user'] is Map<String, dynamic>
          ? payload['user'] as Map<String, dynamic>
          : payload;
      return UserModel.fromJson(userMap);
    }
    throw Exception(data['message'] ?? '获取用户信息失败');
  }
}
