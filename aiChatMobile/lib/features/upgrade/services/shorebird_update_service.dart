import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:restart_app/restart_app.dart';
import 'package:shorebird_code_push/shorebird_code_push.dart';

final shorebirdUpdateServiceProvider = Provider<ShorebirdUpdateService>((ref) {
  return ShorebirdUpdateService(ShorebirdUpdater());
});

/// Shorebird 代码级热更新管理服务
class ShorebirdUpdateService {
  final ShorebirdUpdater _updater;

  ShorebirdUpdateService(this._updater);

  /// 当前运行环境是否支持 Shorebird 代码热补丁
  bool get isAvailable => _updater.isAvailable;

  /// 获取当前已生效的补丁编号
  Future<int?> getCurrentPatchNumber() async {
    if (!isAvailable) return null;
    try {
      final patch = await _updater.readCurrentPatch();
      return patch?.number;
    } catch (e) {
      debugPrint('[ShorebirdUpdateService] readCurrentPatch error: $e');
      return null;
    }
  }

  /// 检查是否有新补丁可供下载
  Future<UpdateStatus> checkUpdateStatus() async {
    if (!isAvailable) return UpdateStatus.unavailable;
    try {
      return await _updater.checkForUpdate();
    } catch (e) {
      debugPrint('[ShorebirdUpdateService] checkForUpdate error: $e');
      return UpdateStatus.unavailable;
    }
  }

  /// 执行补丁静默下载与安装
  Future<bool> downloadAndInstallPatch() async {
    if (!isAvailable) return false;
    try {
      await _updater.update();
      final nextPatch = await _updater.readNextPatch();
      return nextPatch != null;
    } catch (e) {
      debugPrint('[ShorebirdUpdateService] update error: $e');
      return false;
    }
  }

  /// 重启应用以使补丁即刻生效
  Future<bool> restartApp() async {
    final result = await Restart.restartApp();
    return result.success;
  }
}
