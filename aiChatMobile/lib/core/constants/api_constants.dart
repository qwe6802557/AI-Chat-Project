import 'package:flutter/foundation.dart';
 
/// 全局 API 契约与服务常量
class ApiConstants {
  ApiConstants._();

  // API 服务基址（支持通过 --dart-define=API_BASE_URL 覆盖本地调试地址）
  static String get baseUrl {
    const envUrl = String.fromEnvironment('API_BASE_URL');
    if (envUrl.isNotEmpty) return envUrl;
    if (kIsWeb) {
      final host = Uri.base.host;
      if (host == 'localhost' || host == '127.0.0.1') {
        return 'http://localhost:3000';
      }
    }
    return 'https://aichat.yanggenbwebsite.site';
  }

  // 认证链路端点
  static const String authLogin = '/auth/login';
  static const String authRegister = '/auth/register';
  static const String authCaptcha = '/auth/captcha';
  static const String authLogout = '/auth/logout';
  static const String userAccount = '/user/account';
  static const String userProfile = '/user/account';

  // 对话与流式链路
  static const String chatCreate = '/chat/create';
  static const String chatStream = '/chat/stream';
  static const String chatSessions = '/chat-session';
  static const String chatHistory = '/chat-session/history';

  // 积分账本与模型配置
  static const String creditsBalance = '/credits/balance';
  static const String creditsRecords = '/credits/records';
  static const String aiModels = '/ai-provider/models';

  // 语音服务链路
  static const String voiceVoices = '/voice/voices';
  static const String voiceTts = '/voice/tts';
  static const String voiceStt = '/voice/stt';
  static const String voiceHistory = '/voice/history';
  static const int voiceUnitCost = 20;

  // 视频服务链路
  static const String videoGenerations = '/videos/generations';
  static const String videoHistory = '/videos/history';
  static const String videoStatusPrefix = '/videos/status';
  static const String videoDeletePrefix = '/videos';
  static const int videoGenerationCost = 200;

  // 业务默认值与阈值
  static const String appVersion = '1.1.4';
  static const String defaultChatModel = 'grok-chat-fast';
  static const int chatMessageCost = 10;
  static const int imageGenerationCost = 100;

  // 合规备案信息
  static const String icpLicenseNumber = '蜀ICP备2026054363号-1';
  static const String icpOfficialUrl = 'https://beian.miit.gov.cn/';
}
