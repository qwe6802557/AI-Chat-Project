import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../../core/theme/stitch_tokens.dart';
import '../../domain/chat_message_model.dart';

/// 移动端 Stitch 风格行内引用角标组件
class ChatCitationBadge extends StatefulWidget {
  final int index;
  final SearchSourceModel? source;
  final VoidCallback onTap;

  const ChatCitationBadge({
    super.key,
    required this.index,
    this.source,
    required this.onTap,
  });

  @override
  State<ChatCitationBadge> createState() => _ChatCitationBadgeState();
}

class _ChatCitationBadgeState extends State<ChatCitationBadge> {
  bool _isPressed = false;

  @override
  Widget build(BuildContext context) {
    final isKnowledgeBase = widget.source?.isKnowledgeBase ?? true;

    return GestureDetector(
      onTapDown: (_) {
        setState(() => _isPressed = true);
      },
      onTapUp: (_) {
        setState(() => _isPressed = false);
        try {
          HapticFeedback.lightImpact();
        } catch (_) {}
        widget.onTap();
      },
      onTapCancel: () => setState(() => _isPressed = false),
      child: AnimatedScale(
        scale: _isPressed ? 0.92 : 1.0,
        duration: const Duration(milliseconds: 100),
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 2.0, vertical: 1.0),
          padding: const EdgeInsets.symmetric(horizontal: 5.5, vertical: 1.5),
          decoration: BoxDecoration(
            color: _isPressed
                ? const Color(0xFFDBEAFE)
                : (isKnowledgeBase ? const Color(0xFFEFF6FF) : const Color(0xFFF1F5F9)),
            borderRadius: BorderRadius.circular(StitchTokens.radiusSm + 2),
            border: Border.all(
              color: _isPressed
                  ? StitchTokens.primary
                  : (isKnowledgeBase ? const Color(0xFFBFDBFE) : const Color(0xFFCBD5E1)),
              width: 0.8,
            ),
            boxShadow: _isPressed
                ? []
                : [
                    const BoxShadow(
                      color: Color.fromRGBO(0, 88, 195, 0.04),
                      blurRadius: 2.0,
                      offset: Offset(0, 1),
                    ),
                  ],
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              if (isKnowledgeBase) ...[
                const Icon(
                  Icons.menu_book_rounded,
                  size: 9.5,
                  color: StitchTokens.primary,
                ),
                const SizedBox(width: 2.5),
              ],
              Text(
                '${widget.index}',
                style: TextStyle(
                  fontSize: 10.5,
                  fontWeight: FontWeight.w700,
                  color: isKnowledgeBase ? StitchTokens.primary : const Color(0xFF475569),
                  height: 1.1,
                  fontFamily: 'monospace',
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
