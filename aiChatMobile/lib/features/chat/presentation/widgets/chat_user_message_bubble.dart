import 'dart:io';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import '../../../../core/theme/stitch_tokens.dart';
import '../../domain/chat_message_model.dart';
import '../../domain/file_attachment_model.dart';
import 'chat_image_lightbox.dart';

/// 用户消息气泡组件（支持多模态图片自适应网格、全屏手势缩放灯箱与文档附件）
class ChatUserMessageBubble extends StatelessWidget {
  final ChatMessageModel msg;

  const ChatUserMessageBubble({
    super.key,
    required this.msg,
  });

  Widget _buildSingleImage(
    BuildContext context,
    AttachmentItem item, {
    double? width,
    double? height,
  }) {
    Widget img;
    if (item.bytes != null) {
      img = Image.memory(
        item.bytes!,
        width: width,
        height: height,
        fit: BoxFit.cover,
      );
    } else if (!kIsWeb && item.localPath != null && File(item.localPath!).existsSync()) {
      img = Image.file(
        File(item.localPath!),
        width: width,
        height: height,
        fit: BoxFit.cover,
      );
    } else if (item.serverUrl != null && item.serverUrl!.isNotEmpty) {
      img = Image.network(
        item.serverUrl!,
        width: width,
        height: height,
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) => Container(
          width: width,
          height: height,
          color: Colors.black26,
          child: const Icon(Icons.broken_image_rounded, size: 24.0, color: Colors.white70),
        ),
      );
    } else {
      img = Container(
        width: width,
        height: height,
        color: Colors.black26,
        child: const Icon(Icons.image_outlined, size: 24.0, color: Colors.white70),
      );
    }

    return GestureDetector(
      onTap: () {
        ChatImageLightbox.show(
          context,
          imageUrl: item.serverUrl ?? '',
          bytes: item.bytes,
          localPath: item.localPath,
        );
      },
      child: ClipRRect(
        borderRadius: BorderRadius.circular(StitchTokens.radiusMd),
        child: img,
      ),
    );
  }

  Widget _buildImageGallery(BuildContext context, List<AttachmentItem> images) {
    if (images.length == 1) {
      return ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 220.0, maxHeight: 200.0),
        child: _buildSingleImage(context, images.first),
      );
    }

    return Wrap(
      spacing: 6.0,
      runSpacing: 6.0,
      children: images.map((img) {
        return SizedBox(
          width: 88.0,
          height: 88.0,
          child: _buildSingleImage(context, img, width: 88.0, height: 88.0),
        );
      }).toList(),
    );
  }

  Widget _buildDocumentList(List<AttachmentItem> documents) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: documents.map((doc) {
        return Container(
          margin: const EdgeInsets.only(bottom: 6.0),
          padding: const EdgeInsets.symmetric(horizontal: 10.0, vertical: 6.0),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.15),
            borderRadius: BorderRadius.circular(StitchTokens.radiusMd),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.description_rounded, size: 16.0, color: Colors.white),
              const SizedBox(width: 6.0),
              Flexible(
                child: Text(
                  doc.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 12.0,
                    fontWeight: FontWeight.w600,
                    color: Colors.white,
                  ),
                ),
              ),
              const SizedBox(width: 6.0),
              Text(
                doc.formattedSize,
                style: const TextStyle(fontSize: 10.0, color: Colors.white70),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }

  @override
  Widget build(BuildContext context) {
    final images = msg.attachments.where((a) => a.isImage).toList();
    final documents = msg.attachments.where((a) => !a.isImage).toList();
    final hasText = msg.content.trim().isNotEmpty;

    return Align(
      alignment: Alignment.centerRight,
      child: Container(
        margin: const EdgeInsets.only(left: 48.0, bottom: 16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Container(
              padding: const EdgeInsets.all(12.0),
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
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (images.isNotEmpty) ...[
                    _buildImageGallery(context, images),
                    if (documents.isNotEmpty || hasText) const SizedBox(height: 8.0),
                  ],
                  if (documents.isNotEmpty) ...[
                    _buildDocumentList(documents),
                    if (hasText) const SizedBox(height: 8.0),
                  ],
                  if (hasText)
                    Text(
                      msg.content,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 14.0,
                        height: 1.5,
                      ),
                    ),
                ],
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
