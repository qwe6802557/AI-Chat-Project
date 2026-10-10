import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shorebird_code_push/shorebird_code_push.dart';
import '../../../core/router/app_router.dart';
import '../presentation/patch_ready_dialog.dart';
import '../presentation/upgrade_dialog.dart';
import 'shorebird_update_service.dart';
import 'upgrade_service.dart';

final updateCoordinatorProvider = Provider<UpdateCoordinator>((ref) {
  final shorebirdService = ref.watch(shorebirdUpdateServiceProvider);
  final fullUpgradeService = UpgradeService();
  return UpdateCoordinator(shorebirdService, fullUpgradeService, rootNavigatorKey);
});

/// 双轨更新协同管理器 (Shorebird 代码级热补丁 + 全量 APK 升级)
class UpdateCoordinator {
  final ShorebirdUpdateService _shorebirdService;
  final UpgradeService _fullUpgradeService;
  final GlobalKey<NavigatorState> _navigatorKey;

  UpdateCoordinator(
    this._shorebirdService,
    this._fullUpgradeService,
    this._navigatorKey,
  );

  /// 执行双轨更新巡检：优先静默下载热补丁，次选全量 APK 升级
  Future<void> checkForUpdates({String currentVersion = '1.0.0'}) async {
    if (_shorebirdService.isAvailable) {
      final status = await _shorebirdService.checkUpdateStatus();

      if (status == UpdateStatus.restartRequired) {
        final patchNumber = await _shorebirdService.getCurrentPatchNumber();
        final context = _navigatorKey.currentContext;
        if (context != null && context.mounted) {
          await PatchReadyDialog.show(
            context,
            patchNumber: patchNumber,
            onRestart: () => _shorebirdService.restartApp(),
          );
        }
        return;
      }

      if (status == UpdateStatus.outdated) {
        final success = await _shorebirdService.downloadAndInstallPatch();
        if (success) {
          final nextPatchNumber = await _shorebirdService.getCurrentPatchNumber();
          final context = _navigatorKey.currentContext;
          if (context != null && context.mounted) {
            await PatchReadyDialog.show(
              context,
              patchNumber: nextPatchNumber,
              onRestart: () => _shorebirdService.restartApp(),
            );
            return;
          }
        }
      }
    }

    final versionInfo = await _fullUpgradeService.checkUpdate(
      currentVersion: currentVersion,
    );

    if (versionInfo != null && versionInfo.hasUpdate) {
      final context = _navigatorKey.currentContext;
      if (context != null && context.mounted) {
        await UpgradeDialog.show(context, versionInfo);
      }
    }
  }
}
