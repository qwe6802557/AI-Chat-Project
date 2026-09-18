import 'package:flutter/material.dart';
import '../../../../core/theme/stitch_tokens.dart';
import '../../../../shared/widgets/glass_card.dart';

/// Stitch AI 顶部吸顶模型指示条
class ChatStickyModelBar extends StatelessWidget {
  final String model;
  final VoidCallback onTap;

  const ChatStickyModelBar({
    super.key,
    required this.model,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: GlassCard(
        onTap: onTap,
        padding: const EdgeInsets.symmetric(horizontal: 12.0, vertical: 6.0),
        borderRadius: StitchTokens.radiusFull,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 20.0,
              height: 20.0,
              decoration: const BoxDecoration(
                color: StitchTokens.surfaceGlassDark,
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.neurology_rounded,
                size: 12.0,
                color: StitchTokens.primaryGlow,
              ),
            ),
            const SizedBox(width: 6.0),
            Text(
              model,
              style: const TextStyle(
                fontSize: 12.0,
                fontWeight: FontWeight.w600,
                color: StitchTokens.onSurface,
              ),
            ),
            const SizedBox(width: 6.0),
            Container(
              width: 2.0,
              height: 10.0,
              color: StitchTokens.surfaceVariant,
            ),
            const SizedBox(width: 6.0),
            const Text(
              'SSE 流式打字中',
              style: TextStyle(fontSize: 11.0, color: StitchTokens.onSurfaceVariant),
            ),
          ],
        ),
      ),
    );
  }
}
