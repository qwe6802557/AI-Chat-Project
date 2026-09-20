import 'dart:io';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import '../../../../core/theme/stitch_tokens.dart';
import '../../domain/file_attachment_model.dart';
import 'chat_image_lightbox.dart';

/// 对话输入框上方的待发送附件与图片预览条
class ChatAttachmentPreviewBar extends StatelessWidget {
  final List<AttachmentItem> attachments;
  final ValueChanged<String> onRemove;

  const ChatAttachmentPreviewBar({
    super.key,
    required this.attachments,
    required this.onRemove,
  });

  Widget _buildImageItem(BuildContext context, AttachmentItem item) {
    Widget imageWidget;
    if (item.bytes != null) {
      imageWidget = Image.memory(
        item.bytes!,
        width: 58.0,
        height: 58.0,
        fit: BoxFit.cover,
      );
    } else if (!kIsWeb && item.localPath != null && File(item.localPath!).existsSync()) {
      imageWidget = Image.file(
        File(item.localPath!),
        width: 58.0,
        height: 58.0,
        fit: BoxFit.cover,
      );
    } else if (item.serverUrl != null && item.serverUrl!.isNotEmpty) {
      imageWidget = Image.network(
        item.serverUrl!,
        width: 58.0,
        height: 58.0,
        fit: BoxFit.cover,
      );
    } else {
      imageWidget = Container(
        width: 58.0,
        height: 58.0,
        color: StitchTokens.surfaceGlassDark,
        child: const Icon(Icons.image_outlined, size: 24.0, color: StitchTokens.outline),
      );
    }

    return GestureDetector(
      onTap: () {
        if (item.serverUrl != null || item.bytes != null || item.localPath != null) {
          ChatImageLightbox.show(
            context,
            imageUrl: item.serverUrl ?? '',
            bytes: item.bytes,
            localPath: item.localPath,
          );
        }
      },
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Container(
            width: 58.0,
            height: 58.0,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(StitchTokens.radiusMd),
              border: Border.all(
                color: item.status == AttachmentUploadStatus.error
                    ? StitchTokens.crimsonStop
                    : StitchTokens.outlineVariant.withValues(alpha: 0.5),
                width: 1.0,
              ),
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(StitchTokens.radiusMd),
              child: imageWidget,
            ),
          ),
          // 上传中遮罩与微型进度指示
          if (item.status == AttachmentUploadStatus.uploading)
            Positioned.fill(
              child: Container(
                decoration: BoxDecoration(
                  color: Colors.black45,
                  borderRadius: BorderRadius.circular(StitchTokens.radiusMd),
                ),
                child: const Center(
                  child: SizedBox(
                    width: 20.0,
                    height: 20.0,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.0,
                      valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                    ),
                  ),
                ),
              ),
            ),
          // 上传成功绿色角标
          if (item.status == AttachmentUploadStatus.success)
            Positioned(
              left: 3.0,
              bottom: 3.0,
              child: Container(
                padding: const EdgeInsets.all(2.0),
                decoration: const BoxDecoration(
                  color: Color(0xFF10B981),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.check, size: 10.0, color: Colors.white),
              ),
            ),
          // 上传失败警告
          if (item.status == AttachmentUploadStatus.error)
            Positioned(
              left: 3.0,
              bottom: 3.0,
              child: Container(
                padding: const EdgeInsets.all(2.0),
                decoration: const BoxDecoration(
                  color: StitchTokens.crimsonStop,
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.error_outline_rounded, size: 10.0, color: Colors.white),
              ),
            ),
          // 移除按钮
          Positioned(
            top: -6.0,
            right: -6.0,
            child: GestureDetector(
              onTap: () => onRemove(item.id),
              child: Container(
                width: 18.0,
                height: 18.0,
                decoration: const BoxDecoration(
                  color: Color(0xFF475569),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.close_rounded, size: 12.0, color: Colors.white),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDocumentItem(AttachmentItem item) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Container(
          constraints: const BoxConstraints(maxWidth: 150.0),
          padding: const EdgeInsets.symmetric(horizontal: 10.0, vertical: 8.0),
          decoration: BoxDecoration(
            color: StitchTokens.surfaceGlassDark,
            borderRadius: BorderRadius.circular(StitchTokens.radiusMd),
            border: Border.all(
              color: StitchTokens.outlineVariant.withValues(alpha: 0.6),
              width: 1.0,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 32.0,
                height: 32.0,
                decoration: BoxDecoration(
                  color: StitchTokens.primary.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(StitchTokens.radiusSm),
                ),
                child: const Icon(
                  Icons.description_rounded,
                  size: 18.0,
                  color: StitchTokens.primary,
                ),
              ),
              const SizedBox(width: 8.0),
              Flexible(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.name,
                      style: const TextStyle(
                        fontSize: 12.0,
                        fontWeight: FontWeight.w600,
                        color: StitchTokens.onSurface,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 2.0),
                    Text(
                      item.formattedSize,
                      style: const TextStyle(
                        fontSize: 10.0,
                        color: StitchTokens.outline,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        // 移除按钮
        Positioned(
          top: -6.0,
          right: -6.0,
          child: GestureDetector(
            onTap: () => onRemove(item.id),
            child: Container(
              width: 18.0,
              height: 18.0,
              decoration: const BoxDecoration(
                color: Color(0xFF475569),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.close_rounded, size: 12.0, color: Colors.white),
            ),
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    if (attachments.isEmpty) return const SizedBox.shrink();

    return Container(
      height: 72.0,
      margin: const EdgeInsets.only(bottom: 8.0),
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: attachments.length,
        separatorBuilder: (_, __) => const SizedBox(width: 10.0),
        itemBuilder: (context, index) {
          final item = attachments[index];
          return item.isImage
              ? _buildImageItem(context, item)
              : _buildDocumentItem(item);
        },
      ),
    );
  }
}
