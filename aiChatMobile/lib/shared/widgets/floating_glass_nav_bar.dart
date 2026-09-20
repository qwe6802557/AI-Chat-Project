import 'dart:ui';
import 'package:flutter/material.dart';
import '../../core/theme/stitch_tokens.dart';

/// Stitch 悬浮式毛玻璃底部主导航栏
class FloatingGlassNavBar extends StatelessWidget {
  final int currentIndex;
  final ValueChanged<int> onTabSelected;

  const FloatingGlassNavBar({
    super.key,
    required this.currentIndex,
    required this.onTabSelected,
  });

  Widget _buildNavItem({
    required int index,
    required IconData icon,
    required IconData activeIcon,
    required String label,
  }) {
    final isSelected = currentIndex == index;
    final color = isSelected ? StitchTokens.primary : StitchTokens.onSurfaceVariant;

    return InkWell(
      borderRadius: BorderRadius.circular(StitchTokens.radiusFull),
      onTap: () => onTabSelected(index),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              isSelected ? activeIcon : icon,
              color: color,
              size: 22.0,
            ),
            const SizedBox(height: 2.0),
            Text(
              label,
              style: TextStyle(
                fontSize: 11.0,
                fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(StitchTokens.radiusFull),
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 20.0, sigmaY: 20.0),
            child: Container(
              height: 64.0,
              decoration: BoxDecoration(
                color: StitchTokens.surfaceGlass,
                borderRadius: BorderRadius.circular(StitchTokens.radiusFull),
                border: Border.all(
                  color: Colors.white.withValues(alpha: 0.7),
                  width: 1.0,
                ),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF0F172A).withValues(alpha: 0.08),
                    blurRadius: 24.0,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _buildNavItem(
                    index: 0,
                    icon: Icons.chat_bubble_outline_rounded,
                    activeIcon: Icons.chat_bubble_rounded,
                    label: '对话',
                  ),
                  _buildNavItem(
                    index: 1,
                    icon: Icons.folder_open_rounded,
                    activeIcon: Icons.folder_rounded,
                    label: '历史',
                  ),
                  _buildNavItem(
                    index: 2,
                    icon: Icons.mic_none_rounded,
                    activeIcon: Icons.mic_rounded,
                    label: '语音',
                  ),
                  _buildNavItem(
                    index: 3,
                    icon: Icons.explore_outlined,
                    activeIcon: Icons.explore_rounded,
                    label: '探索',
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
