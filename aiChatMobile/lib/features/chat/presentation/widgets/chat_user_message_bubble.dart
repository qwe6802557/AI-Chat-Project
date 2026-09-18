import 'package:flutter/material.dart';
import '../../../../core/theme/stitch_tokens.dart';
import '../../domain/chat_message_model.dart';

/// 用户消息气泡组件
class ChatUserMessageBubble extends StatelessWidget {
  final ChatMessageModel msg;

  const ChatUserMessageBubble({
    super.key,
    required this.msg,
  });

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerRight,
      child: Container(
        margin: const EdgeInsets.only(left: 48.0, bottom: 16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Container(
              padding: const EdgeInsets.all(14.0),
              decoration: BoxDecoration(
                color: StitchTokens.primary,
                borderRadius: const BorderRadius.only(
                  topLeft: Radius.circular(StitchTokens.radiusXl),
                  topRight: Radius.circular(StitchTokens.radiusSm),
                  bottomLeft: Radius.circular(StitchTokens.radiusXl),
                  bottomRight: Radius.circular(StitchTokens.radiusXl),
                ),
                boxShadow: [
                  BoxShadow(
                    color: StitchTokens.primary.withValues(alpha: 0.2),
                    blurRadius: 10.0,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Text(
                msg.content,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 14.0,
                  height: 1.5,
                ),
              ),
            ),
            const SizedBox(height: 4.0),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.done_all_rounded, size: 14.0, color: StitchTokens.playbackEmerald),
                const SizedBox(width: 4.0),
                Text(
                  '${msg.createdAt.hour.toString().padLeft(2, '0')}:${msg.createdAt.minute.toString().padLeft(2, '0')}',
                  style: const TextStyle(fontSize: 11.0, color: StitchTokens.onSurfaceVariant),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
