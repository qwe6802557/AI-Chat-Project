import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/network/connectivity_provider.dart';

/// Stitch 极简离线与弱网状态指示胶囊
class StitchOfflineBanner extends ConsumerStatefulWidget {
  const StitchOfflineBanner({super.key});

  @override
  ConsumerState<StitchOfflineBanner> createState() => _StitchOfflineBannerState();
}

class _StitchOfflineBannerState extends ConsumerState<StitchOfflineBanner>
    with SingleTickerProviderStateMixin {
  bool _showRecovered = false;

  @override
  Widget build(BuildContext context) {
    final netState = ref.watch(connectivityProvider);

    ref.listen<NetworkState>(connectivityProvider, (prev, next) {
      if (prev != null && !prev.isOnline && next.isOnline) {
        setState(() => _showRecovered = true);
        Future.delayed(const Duration(milliseconds: 2200), () {
          if (mounted) {
            setState(() => _showRecovered = false);
          }
        });
      }
    });

    final isVisible = !netState.isOnline || _showRecovered;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 260),
      curve: Curves.easeInOut,
      height: isVisible ? 32 : 0,
      child: AnimatedOpacity(
        duration: const Duration(milliseconds: 200),
        opacity: isVisible ? 1.0 : 0.0,
        child: Container(
          width: double.infinity,
          margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(
            color: _showRecovered
                ? const Color(0xFFECFDF5)
                : const Color(0xFFFEF3C7),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: _showRecovered
                  ? const Color(0xFFA7F3D0)
                  : const Color(0xFFFDE68A),
              width: 0.8,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 6,
                height: 6,
                decoration: BoxDecoration(
                  color: _showRecovered
                      ? const Color(0xFF10B981)
                      : const Color(0xFFD97706),
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 8),
              Text(
                _showRecovered ? '网络已恢复，数据同步中' : '当前处于离线模式，已加载本地快照',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                  color: _showRecovered
                      ? const Color(0xFF065F46)
                      : const Color(0xFF92400E),
                  fontFamily: 'Inter',
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
