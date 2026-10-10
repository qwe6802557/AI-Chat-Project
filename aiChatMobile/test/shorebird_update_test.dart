import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shorebird_code_push/shorebird_code_push.dart';
import 'package:ai_chat_mobile/features/upgrade/services/shorebird_update_service.dart';
import 'package:ai_chat_mobile/features/upgrade/services/upgrade_service.dart';
import 'package:ai_chat_mobile/features/upgrade/services/update_coordinator.dart';

class _FakeShorebirdUpdater implements ShorebirdUpdater {
  final bool _available;
  final UpdateStatus _status;

  _FakeShorebirdUpdater({bool available = false, UpdateStatus status = UpdateStatus.unavailable})
      : _available = available,
        _status = status;

  @override
  bool get isAvailable => _available;

  @override
  Future<UpdateStatus> checkForUpdate({UpdateTrack? track}) async => _status;

  @override
  Future<Patch?> readCurrentPatch() async => null;

  @override
  Future<Patch?> readNextPatch() async => null;

  @override
  Future<void> update({UpdateTrack? track}) async {}
}

void main() {
  group('ShorebirdUpdateService Tests', () {
    test('当 ShorebirdUpdater 不可用时返回 unavailable 状态', () async {
      final fakeUpdater = _FakeShorebirdUpdater(available: false);
      final service = ShorebirdUpdateService(fakeUpdater);

      expect(service.isAvailable, isFalse);
      final status = await service.checkUpdateStatus();
      expect(status, equals(UpdateStatus.unavailable));
    });

    test('当 ShorebirdUpdater 可用时返回真实检测状态', () async {
      final fakeUpdater = _FakeShorebirdUpdater(
        available: true,
        status: UpdateStatus.outdated,
      );
      final service = ShorebirdUpdateService(fakeUpdater);

      expect(service.isAvailable, isTrue);
      final status = await service.checkUpdateStatus();
      expect(status, equals(UpdateStatus.outdated));
    });
  });

  group('UpdateCoordinator Initialization Tests', () {
    test('UpdateCoordinator 成功实例化并持有必要依赖', () {
      final fakeUpdater = _FakeShorebirdUpdater();
      final shorebirdService = ShorebirdUpdateService(fakeUpdater);
      final fullUpgradeService = UpgradeService();
      final navKey = GlobalKey<NavigatorState>();

      final coordinator = UpdateCoordinator(
        shorebirdService,
        fullUpgradeService,
        navKey,
      );

      expect(coordinator, isNotNull);
    });
  });
}
