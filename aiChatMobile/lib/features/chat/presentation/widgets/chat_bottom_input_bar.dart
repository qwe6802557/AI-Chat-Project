import 'package:flutter/material.dart';
import '../../../../core/theme/stitch_tokens.dart';
import '../../../../shared/widgets/glass_card.dart';

/// 对话底部毛玻璃输入栏与操作条
class ChatBottomInputBar extends StatelessWidget {
  final TextEditingController textController;
  final bool isGenerating;
  final int creditsRemaining;
  final VoidCallback onSend;
  final VoidCallback onStop;

  const ChatBottomInputBar({
    super.key,
    required this.textController,
    required this.isGenerating,
    required this.creditsRemaining,
    required this.onSend,
    required this.onStop,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16.0, 4.0, 16.0, 84.0),
      child: GlassCard(
        padding: const EdgeInsets.all(12.0),
        borderRadius: StitchTokens.radius2Xl,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 2.0),
                  decoration: BoxDecoration(
                    color: StitchTokens.creditBg,
                    borderRadius: BorderRadius.circular(StitchTokens.radiusFull),
                    border: Border.all(color: StitchTokens.creditBorder),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.toll_rounded, size: 12.0, color: StitchTokens.creditAmber),
                      const SizedBox(width: 4.0),
                      Text(
                        '10 算力点/次 (余 $creditsRemaining)',
                        style: const TextStyle(
                          fontSize: 11.0,
                          fontWeight: FontWeight.w600,
                          color: StitchTokens.creditAmber,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8.0),
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                const Icon(Icons.attach_file_rounded, size: 22.0, color: StitchTokens.outline),
                const SizedBox(width: 8.0),
                const Icon(Icons.image_outlined, size: 22.0, color: StitchTokens.outline),
                const SizedBox(width: 8.0),
                Expanded(
                  child: TextField(
                    controller: textController,
                    maxLines: 4,
                    minLines: 1,
                    onSubmitted: (_) => onSend(),
                    decoration: const InputDecoration(
                      hintText: '提出你的技术疑问或创作指令...',
                      hintStyle: TextStyle(fontSize: 13.0, color: StitchTokens.outline),
                      border: InputBorder.none,
                      isDense: true,
                      contentPadding: EdgeInsets.symmetric(vertical: 4.0),
                    ),
                  ),
                ),
                const SizedBox(width: 8.0),
                GestureDetector(
                  onTap: isGenerating ? onStop : onSend,
                  child: Container(
                    width: 36.0,
                    height: 36.0,
                    decoration: BoxDecoration(
                      color: isGenerating ? StitchTokens.crimsonStop : StitchTokens.primary,
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: (isGenerating ? StitchTokens.crimsonStop : StitchTokens.primary)
                              .withValues(alpha: 0.3),
                          blurRadius: 10.0,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: Icon(
                      isGenerating ? Icons.stop_rounded : Icons.arrow_upward_rounded,
                      color: Colors.white,
                      size: isGenerating ? 18.0 : 20.0,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
