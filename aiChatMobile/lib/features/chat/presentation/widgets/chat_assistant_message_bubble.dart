import 'package:flutter/material.dart';
import '../../../../core/theme/stitch_tokens.dart';
import '../../../../shared/widgets/glass_card.dart';
import '../../domain/chat_message_model.dart';
import 'chat_reasoning_card.dart';

/// AI 助手消息气泡组件
class ChatAssistantMessageBubble extends StatelessWidget {
  final ChatMessageModel msg;

  const ChatAssistantMessageBubble({
    super.key,
    required this.msg,
  });

  Widget _buildAssistantErrorCard() {
    return Container(
      padding: const EdgeInsets.all(14.0),
      decoration: BoxDecoration(
        color: const Color(0xFFFEF2F2),
        borderRadius: BorderRadius.circular(StitchTokens.radiusLg),
        border: Border.all(color: const Color(0xFFFCA5A5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: const [
              Icon(Icons.error_outline_rounded, color: StitchTokens.crimsonStop, size: 18.0),
              SizedBox(width: 6.0),
              Text(
                '回复生成失败',
                style: TextStyle(
                  fontSize: 13.0,
                  fontWeight: FontWeight.w600,
                  color: StitchTokens.crimsonStop,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6.0),
          Text(
            msg.errorMessage ?? '连接中断或服务器未响应',
            style: const TextStyle(fontSize: 12.0, color: Color(0xFF991B1B)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(right: 32.0, bottom: 16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 28.0,
                height: 28.0,
                decoration: BoxDecoration(
                  color: StitchTokens.surfaceGlassDark,
                  borderRadius: BorderRadius.circular(StitchTokens.radiusMd),
                ),
                child: const Icon(
                  Icons.neurology_rounded,
                  size: 16.0,
                  color: StitchTokens.primaryGlow,
                ),
              ),
              const SizedBox(width: 8.0),
              Text(
                msg.model ?? 'AI Assistant',
                style: const TextStyle(
                  fontSize: 14.0,
                  fontWeight: FontWeight.w600,
                  color: StitchTokens.onSurface,
                ),
              ),
              if (msg.reasoningContent != null) ...[
                const SizedBox(width: 6.0),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6.0, vertical: 1.0),
                  decoration: BoxDecoration(
                    color: const Color(0xFFDAE2FD),
                    borderRadius: BorderRadius.circular(StitchTokens.radiusFull),
                  ),
                  child: const Text(
                    'CoT Active',
                    style: TextStyle(
                      fontSize: 10.0,
                      fontWeight: FontWeight.w600,
                      color: StitchTokens.thinkingText,
                    ),
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 8.0),
          GlassCard(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (msg.reasoningContent != null && msg.reasoningContent!.isNotEmpty)
                  ChatReasoningCard(msg: msg),
                if (msg.status == MessageStatus.error)
                  _buildAssistantErrorCard()
                else
                  Text(
                    msg.content.isEmpty && msg.status == MessageStatus.streaming
                        ? '正在构思回复...'
                        : msg.content,
                    style: TextStyle(
                      fontSize: 14.0,
                      height: 1.5,
                      color: msg.content.isEmpty ? StitchTokens.outline : StitchTokens.onSurface,
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
