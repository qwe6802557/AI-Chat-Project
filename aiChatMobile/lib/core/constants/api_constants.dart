/// 全局 API 契约与服务常量
class ApiConstants {
  ApiConstants._();

  // 生产环境 API 服务基址
  static const String baseUrl = 'https://aichat.yanggenbwebsite.site';

  // 认证链路端点
  static const String authLogin = '/auth/login';
  static const String authRegister = '/auth/register';
  static const String authCaptcha = '/auth/captcha';
  static const String authLogout = '/auth/logout';
  static const String userProfile = '/user/profile';

  // 对话与流式链路
  static const String chatCreate = '/chat/create';
  static const String chatStream = '/chat/stream';
  static const String chatSessions = '/chat-session';
  static const String chatHistory = '/chat-session/history';

  // 积分账本与模型配置
  static const String creditsBalance = '/credits/balance';
  static const String creditsRecords = '/credits/records';
  static const String aiModels = '/ai-provider/models';

  // 业务默认值与阈值
  static const String defaultChatModel = 'grok-chat-fast';
  static const int chatMessageCost = 10;
  static const int imageGenerationCost = 100;

  // 合规备案信息
  static const String icpLicenseNumber = '蜀ICP备2026054363号-1';
  static const String icpOfficialUrl = 'https://beian.miit.gov.cn/';
}
