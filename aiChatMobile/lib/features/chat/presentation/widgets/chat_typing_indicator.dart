import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../../../core/theme/stitch_tokens.dart';

/// Stitch AI 助手思考与流式响应加载动效指示器
class ChatTypingIndicator extends StatefulWidget {
  final String label;

  const ChatTypingIndicator({
    super.key,
    this.label = '正在深度构思回复...',
  });

  @override
  State<ChatTypingIndicator> createState() => _ChatTypingIndicatorState();
}

class _ChatTypingIndicatorState extends State<ChatTypingIndicator>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1300),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Widget _buildBouncingDot(int index) {
    // 3 个圆点带有相位差的平滑正弦跳动与缩放
    final delay = index * 0.22;
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        final rawVal = (_controller.value - delay) % 1.0;
        final wave = math.sin(rawVal * math.pi * 2);
        // 计算平滑位移与透明度缩放
        final translateY = wave < 0 ? 0.0 : -wave * 3.5;
        final scale = 0.8 + (wave > 0 ? wave * 0.35 : 0.0);
        final opacity = 0.4 + (wave > 0 ? wave * 0.6 : 0.0);

        return Transform.translate(
          offset: Offset(0, translateY),
          child: Transform.scale(
            scale: scale,
            child: Container(
              width: 5.5,
              height: 5.5,
              margin: const EdgeInsets.symmetric(horizontal: 2.5),
              decoration: BoxDecoration(
                color: StitchTokens.primary.withValues(alpha: opacity.clamp(0.0, 1.0)),
                shape: BoxShape.circle,
                boxShadow: wave > 0.5
                    ? [
                        BoxShadow(
                          color: StitchTokens.primaryGlowSubtle.withValues(alpha: 0.35),
                          blurRadius: 4.0,
                          spreadRadius: 0.5,
                        ),
                      ]
                    : null,
              ),
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14.0, vertical: 8.0),
      decoration: BoxDecoration(
        color: const Color(0xFFF0F5FF),
        borderRadius: BorderRadius.circular(StitchTokens.radiusFull),
        border: Border.all(
          color: const Color(0xFFD6E4FF),
          width: 0.8,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              _buildBouncingDot(0),
              _buildBouncingDot(1),
              _buildBouncingDot(2),
            ],
          ),
          const SizedBox(width: 10.0),
          AnimatedBuilder(
            animation: _controller,
            builder: (context, child) {
              final shimmerOpacity =
                  0.72 + 0.28 * math.sin(_controller.value * math.pi * 2).abs();
              return Opacity(
                opacity: shimmerOpacity,
                child: Text(
                  widget.label,
                  style: const TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w500,
                    color: StitchTokens.thinkingText,
                    letterSpacing: 0.2,
                  ),
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}
