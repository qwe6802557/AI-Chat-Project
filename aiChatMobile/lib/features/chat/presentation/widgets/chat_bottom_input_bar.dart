import 'package:flutter/material.dart';
import '../../../../core/theme/stitch_tokens.dart';
import '../../../../shared/widgets/glass_card.dart';

import '../../domain/file_attachment_model.dart';
import 'chat_attachment_preview_bar.dart';

/// 对话底部毛玻璃输入栏与操作条
class ChatBottomInputBar extends StatelessWidget {
  final TextEditingController textController;
  final bool isGenerating;
  final int creditsRemaining;
  final VoidCallback onSend;
  final VoidCallback onStop;
  final List<AttachmentItem> attachments;
  final VoidCallback? onPickImages;
  final VoidCallback? onPickDocument;
  final ValueChanged<String>? onRemoveAttachment;
  final bool isWebSearchEnabled;
  final VoidCallback? onToggleWebSearch;
  final List<String> enabledTools;
  final VoidCallback? onOpenPluginCenter;
  final ValueChanged<String>? onToggleTool;

  const ChatBottomInputBar({
    super.key,
    required this.textController,
    required this.isGenerating,
    required this.creditsRemaining,
    required this.onSend,
    required this.onStop,
    this.attachments = const [],
    this.onPickImages,
    this.onPickDocument,
    this.onRemoveAttachment,
    this.isWebSearchEnabled = false,
    this.onToggleWebSearch,
    this.enabledTools = const ['web_search_v2'],
    this.onOpenPluginCenter,
    this.onToggleTool,
  });

  Widget _buildWebSearchPill() {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(StitchTokens.radiusFull),
        onTap: isGenerating ? null : onToggleWebSearch,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(horizontal: 10.0, vertical: 3.0),
          decoration: BoxDecoration(
            color: isWebSearchEnabled ? const Color(0xFFEFF6FF) : const Color(0xFFF8FAFC),
            borderRadius: BorderRadius.circular(StitchTokens.radiusFull),
            border: Border.all(
              color: isWebSearchEnabled ? const Color(0xFF93C5FD) : const Color(0xFFE2E8F0),
            ),
            boxShadow: isWebSearchEnabled
                ? const [
                    BoxShadow(
                      color: Color.fromRGBO(29, 78, 216, 0.08),
                      blurRadius: 4.0,
                      offset: Offset(0, 1),
                    ),
                  ]
                : null,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.language_rounded,
                size: 13.0,
                color: isWebSearchEnabled ? StitchTokens.primaryContainer : const Color(0xFF64748B),
              ),
              const SizedBox(width: 4.0),
              Text(
                '联网搜索',
                style: TextStyle(
                  fontSize: 11.0,
                  fontWeight: FontWeight.w500,
                  color: isWebSearchEnabled ? StitchTokens.primary : const Color(0xFF475467),
                ),
              ),
              if (isWebSearchEnabled) ...[
                const SizedBox(width: 4.0),
                Container(
                  width: 5.0,
                  height: 5.0,
                  decoration: const BoxDecoration(
                    color: StitchTokens.primaryContainer,
                    shape: BoxShape.circle,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildToolCapsules() {
    final activeCount = enabledTools.length;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        _buildWebSearchPill(),
        const SizedBox(width: 6.0),
        Material(
          color: Colors.transparent,
          child: InkWell(
            borderRadius: BorderRadius.circular(StitchTokens.radiusFull),
            onTap: isGenerating ? null : onOpenPluginCenter,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 3.0),
              decoration: BoxDecoration(
                color: activeCount > 0 ? const Color(0xFFF0FDF4) : const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(StitchTokens.radiusFull),
                border: Border.all(
                  color: activeCount > 0 ? const Color(0xFFBBF7D0) : const Color(0xFFE2E8F0),
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.extension_outlined,
                    size: 13.0,
                    color: activeCount > 0 ? const Color(0xFF16A34A) : const Color(0xFF64748B),
                  ),
                  const SizedBox(width: 3.0),
                  Text(
                    '插件 ($activeCount)',
                    style: TextStyle(
                      fontSize: 11.0,
                      fontWeight: FontWeight.w500,
                      color: activeCount > 0 ? const Color(0xFF15803D) : const Color(0xFF475467),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

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
            if (attachments.isNotEmpty) ...[
              ChatAttachmentPreviewBar(
                attachments: attachments,
                onRemove: onRemoveAttachment ?? (_) {},
              ),
            ],
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
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
                _buildToolCapsules(),
              ],
            ),
            const SizedBox(height: 8.0),
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Material(
                  color: Colors.transparent,
                  child: InkWell(
                    borderRadius: BorderRadius.circular(StitchTokens.radiusSm),
                    onTap: isGenerating ? null : onPickDocument,
                    child: Padding(
                      padding: const EdgeInsets.all(4.0),
                      child: Icon(
                        Icons.attach_file_rounded,
                        size: 22.0,
                        color: isGenerating ? StitchTokens.outlineVariant : StitchTokens.outline,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 4.0),
                Material(
                  color: Colors.transparent,
                  child: InkWell(
                    borderRadius: BorderRadius.circular(StitchTokens.radiusSm),
                    onTap: isGenerating ? null : onPickImages,
                    child: Padding(
                      padding: const EdgeInsets.all(4.0),
                      child: Icon(
                        Icons.image_outlined,
                        size: 22.0,
                        color: isGenerating ? StitchTokens.outlineVariant : StitchTokens.outline,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 6.0),
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
