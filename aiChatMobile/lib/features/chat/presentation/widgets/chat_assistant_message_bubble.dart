import 'package:flutter/material.dart';
import '../../../../core/theme/stitch_tokens.dart';
import '../../../../shared/widgets/glass_card.dart';
import '../../domain/artifact_model.dart';
import '../../domain/chat_message_model.dart';
import 'artifact_capsule_card.dart';
import 'chat_reasoning_card.dart';
import 'chat_search_source_gallery.dart';
import 'chat_tool_execution_card.dart';
import 'chat_typing_indicator.dart';
import 'citation_bottom_sheet.dart';
import 'stitch_markdown_view.dart';

/// AI 助手消息气泡组件
class ChatAssistantMessageBubble extends StatelessWidget {
  final ChatMessageModel msg;

  const ChatAssistantMessageBubble({
    super.key,
    required this.msg,
  });

  List<Widget> _buildArtifactCards(String rawContent) {
    final result = ArtifactModel.extractFromText(rawContent);
    if (result.artifacts.isEmpty) return const [];
    return result.artifacts
        .map((art) => ArtifactCapsuleCard(artifact: art))
        .toList();
  }

  String _getCleanedContent(String rawContent) {
    if (!rawContent.contains('<antArtifact')) return rawContent;
    return ArtifactModel.extractFromText(rawContent).cleanedText;
  }

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
                  Icons.psychology_rounded,
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
                if (msg.searchStatus != null || msg.sources.isNotEmpty)
                  ChatSearchSourceGallery(
                    sources: msg.sources,
                    searchStatus: msg.searchStatus,
                    isKnowledgeBaseEnabled: msg.isKnowledgeBaseEnabled ?? false,
                    isWebSearchEnabled: msg.isWebSearchEnabled ?? false,
                    hasAnswerContent: _getCleanedContent(msg.content).trim().isNotEmpty,
                    isDone: msg.status == MessageStatus.done,
                  ),
                if (msg.toolCalls.isNotEmpty)
                  ChatToolExecutionGallery(toolCalls: msg.toolCalls),
                if (msg.reasoningContent != null && msg.reasoningContent!.isNotEmpty)
                  ChatReasoningCard(msg: msg),
                ..._buildArtifactCards(msg.content),
                if (msg.status == MessageStatus.error)
                  _buildAssistantErrorCard()
                else if (_getCleanedContent(msg.content).isNotEmpty || msg.status == MessageStatus.streaming)
                  _getCleanedContent(msg.content).isEmpty && msg.status == MessageStatus.streaming
                      ? ChatTypingIndicator(
                          label: msg.searchStatus == 'searching'
                              ? '正在检索并准备回复...'
                              : '正在深度构思回复...',
                        )
                      : StitchMarkdownView(
                          data: _getCleanedContent(msg.content),
                          sources: msg.sources,
                          onCitationTap: (source, index) {
                            CitationBottomSheet.show(
                              context,
                              source: source,
                              index: index,
                            );
                          },
                        ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
