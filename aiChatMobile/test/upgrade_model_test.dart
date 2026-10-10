import 'package:flutter_test/flutter_test.dart';
import 'package:ai_chat_mobile/features/upgrade/domain/app_version_model.dart';

void main() {
  group('AppVersionInfo Model Tests', () {
    test('正确解析后端下发的升级信息与更新日志', () {
      final json = {
        'latestVersion': '1.0.1',
        'latestVersionCode': 2,
        'minSupportedVersion': '1.0.0',
        'downloadUrl': 'https://aichat.yanggenbwebsite.site/downloads/aichat-latest.apk',
        'packageSize': '45.2 MB',
        'releaseNotes': [
          '移动端全链路打通联网搜索功能',
          '优化深色玻璃态UI',
        ],
        'forceUpdate': false,
        'hasUpdate': true,
        'currentVersion': '1.0.0',
        'publishedAt': '2026-10-09T08:00:00.000Z',
      };

      final info = AppVersionInfo.fromJson(json);

      expect(info.latestVersion, equals('1.0.1'));
      expect(info.latestVersionCode, equals(2));
      expect(info.downloadUrl, contains('aichat-latest.apk'));
      expect(info.hasUpdate, isTrue);
      expect(info.forceUpdate, isFalse);
      expect(info.releaseNotes.length, equals(2));
      expect(info.releaseNotes.first, contains('联网搜索'));
    });

    test('正确解析嵌套在 data 字段中的升级信息', () {
      final wrappedJson = {
        'code': 0,
        'message': '操作成功',
        'data': {
          'latestVersion': '1.1.0',
          'latestVersionCode': 2,
          'hasUpdate': true,
          'downloadUrl': 'https://aichat.yanggenbwebsite.site/downloads/aichat-latest.apk',
        },
      };

      final info = AppVersionInfo.fromJson(wrappedJson);

      expect(info.latestVersion, equals('1.1.0'));
      expect(info.hasUpdate, isTrue);
    });
  });
}
