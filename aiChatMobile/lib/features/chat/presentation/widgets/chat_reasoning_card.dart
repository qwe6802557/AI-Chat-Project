import 'package:flutter/material.dart';
import '../../../../core/theme/stitch_tokens.dart';
import '../../domain/chat_message_model.dart';

/// DeepSeek-R1 思考链卡片（支持折叠/展开动画）
class ChatReasoningCard extends StatefulWidget {
  final ChatMessageModel msg;
  final bool initialExpanded;

  const ChatReasoningCard({
    super.key,
    required this.msg,
    this.initialExpanded = true,
  });

  @override
  State<ChatReasoningCard> createState() => _ChatReasoningCardState();
}

class _ChatReasoningCardState extends State<ChatReasoningCard> {
  late bool _isExpanded;

  @override
  void initState() {
    super.initState();
    _isExpanded = widget.initialExpanded;
  }

  @override
  Widget build(BuildContext context) {
    final seconds = widget.msg.reasoningDurationSeconds;

    return Container(
      margin: const EdgeInsets.only(bottom: 12.0),
      decoration: BoxDecoration(
        color: StitchTokens.surfaceContainerLow,
        borderRadius: BorderRadius.circular(StitchTokens.radiusLg),
        border: Border.all(color: StitchTokens.thinkingBorder),
      ),
      child: Column(
        children: [
          InkWell(
            borderRadius: BorderRadius.circular(StitchTokens.radiusLg),
            onTap: () {
              setState(() {
                _isExpanded = !_isExpanded;
              });
            },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12.0, vertical: 10.0),
              decoration: BoxDecoration(
                color: StitchTokens.thinkingBg,
                borderRadius: _isExpanded
                    ? const BorderRadius.vertical(top: Radius.circular(StitchTokens.radiusLg))
                    : BorderRadius.circular(StitchTokens.radiusLg),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      const Icon(
                        Icons.psychology_rounded,
                        size: 18.0,
                        color: StitchTokens.thinkingText,
                      ),
                      const SizedBox(width: 8.0),
                      Text(
                        '已深度思考 $seconds 秒',
                        style: const TextStyle(
                          fontSize: 13.0,
                          fontWeight: FontWeight.w600,
                          color: StitchTokens.thinkingText,
                        ),
                      ),
                    ],
                  ),
                  Row(
                    children: [
                      Text(
                        _isExpanded ? '收起思考' : '展开思考',
                        style: const TextStyle(
                          fontSize: 12.0,
                          color: StitchTokens.onSurfaceVariant,
                        ),
                      ),
                      Icon(
                        _isExpanded
                            ? Icons.keyboard_arrow_up_rounded
                            : Icons.keyboard_arrow_down_rounded,
                        size: 18.0,
                        color: StitchTokens.onSurfaceVariant,
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          if (_isExpanded)
            Container(
              padding: const EdgeInsets.all(12.0),
              decoration: const BoxDecoration(
                color: StitchTokens.surfaceContainerLowest,
                borderRadius: BorderRadius.vertical(
                  bottom: Radius.circular(StitchTokens.radiusLg),
                ),
              ),
              child: Text(
                widget.msg.reasoningContent ?? '',
                style: const TextStyle(
                  fontSize: 12.0,
                  height: 1.5,
                  color: StitchTokens.onSurfaceVariant,
                ),
              ),
            ),
        ],
      ),
    );
  }
}
