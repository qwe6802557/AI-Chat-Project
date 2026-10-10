import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../../core/theme/stitch_tokens.dart';
import '../../domain/file_attachment_model.dart';

/// 移动端文档解析内容预览弹窗
class ChatDocumentPreviewSheet extends StatelessWidget {
  final AttachmentItem item;

  const ChatDocumentPreviewSheet({
    super.key,
    required this.item,
  });

  static Future<void> show(BuildContext context, AttachmentItem item) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ChatDocumentPreviewSheet(item: item),
    );
  }

  @override
  Widget build(BuildContext context) {
    final text = item.textContent?.trim() ?? '';
    final maxHeight = MediaQuery.of(context).size.height * 0.76;

    return Container(
      constraints: BoxConstraints(maxHeight: maxHeight),
      decoration: const BoxDecoration(
        color: StitchTokens.surfaceContainerLowest,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24.0)),
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                margin: const EdgeInsets.only(top: 10.0, bottom: 8.0),
                width: 36.0,
                height: 4.0,
                decoration: BoxDecoration(
                  color: StitchTokens.outlineVariant,
                  borderRadius: BorderRadius.circular(999.0),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20.0, 6.0, 16.0, 12.0),
              child: Row(
                children: [
                  Container(
                    width: 40.0,
                    height: 40.0,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: StitchTokens.primary.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(StitchTokens.radiusMd),
                    ),
                    child: Text(
                      item.badgeLabel,
                      style: const TextStyle(
                        fontSize: 11.0,
                        fontWeight: FontWeight.w700,
                        color: StitchTokens.primary,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12.0),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          item.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 15.0,
                            fontWeight: FontWeight.w600,
                            color: StitchTokens.onSurface,
                          ),
                        ),
                        const SizedBox(height: 2.0),
                        Text(
                          item.formattedMeta,
                          style: const TextStyle(
                            fontSize: 12.0,
                            color: StitchTokens.onSurfaceVariant,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (text.isNotEmpty)
                    IconButton(
                      tooltip: '复制解析文本',
                      icon: const Icon(
                        Icons.copy_rounded,
                        size: 18.0,
                        color: StitchTokens.onSurfaceVariant,
                      ),
                      onPressed: () {
                        Clipboard.setData(ClipboardData(text: text));
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('已复制解析文本')),
                        );
                      },
                    ),
                  IconButton(
                    icon: const Icon(
                      Icons.close_rounded,
                      color: StitchTokens.onSurfaceVariant,
                    ),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ],
              ),
            ),
            const Divider(height: 1.0),
            Flexible(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(20.0),
                child: text.isNotEmpty
                    ? SelectableText(
                        text,
                        style: const TextStyle(
                          fontSize: 13.0,
                          height: 1.6,
                          fontFamily: 'monospace',
                          color: StitchTokens.onSurface,
                        ),
                      )
                    : const Padding(
                        padding: EdgeInsets.symmetric(vertical: 32.0),
                        child: Center(
                          child: Text(
                            '当前文档暂无可预览的解析文本',
                            style: TextStyle(
                              fontSize: 13.0,
                              color: StitchTokens.onSurfaceVariant,
                            ),
                          ),
                        ),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
