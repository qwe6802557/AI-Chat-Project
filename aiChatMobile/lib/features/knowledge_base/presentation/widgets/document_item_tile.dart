import 'package:flutter/material.dart';
import '../../../../core/theme/stitch_tokens.dart';
import '../../domain/document_model.dart';

/// 移动端知识库文档条目组件
class DocumentItemTile extends StatelessWidget {
  final DocumentModel document;
  final VoidCallback onTap;
  final VoidCallback onDelete;

  const DocumentItemTile({
    super.key,
    required this.document,
    required this.onTap,
    required this.onDelete,
  });

  Color _getFileTypeColor(String type) {
    switch (type.toLowerCase()) {
      case 'pdf':
        return const Color(0xFFE11D48); // 玫瑰红
      case 'doc':
      case 'docx':
        return const Color(0xFF2563EB); // 经典蓝
      case 'md':
      case 'markdown':
        return const Color(0xFF0D9488); // 蓝绿
      case 'txt':
      default:
        return const Color(0xFF64748B); // 灰蓝
    }
  }

  IconData _getFileTypeIcon(String type) {
    switch (type.toLowerCase()) {
      case 'pdf':
        return Icons.picture_as_pdf_rounded;
      case 'doc':
      case 'docx':
        return Icons.article_rounded;
      case 'md':
      case 'markdown':
        return Icons.code_rounded;
      case 'txt':
      default:
        return Icons.description_rounded;
    }
  }

  @override
  Widget build(BuildContext context) {
    final typeColor = _getFileTypeColor(document.fileType);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: document.isCompleted ? onTap : null,
        borderRadius: BorderRadius.circular(StitchTokens.radiusLg),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14.0, vertical: 12.0),
          decoration: BoxDecoration(
            color: StitchTokens.surfaceContainerLowest,
            borderRadius: BorderRadius.circular(StitchTokens.radiusLg),
            border: Border.all(
              color: StitchTokens.outlineVariant.withValues(alpha: 0.4),
            ),
          ),
          child: Row(
            children: [
              // 文件类型微章
              Container(
                width: 38.0,
                height: 38.0,
                decoration: BoxDecoration(
                  color: typeColor.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(StitchTokens.radiusMd),
                ),
                child: Icon(
                  _getFileTypeIcon(document.fileType),
                  color: typeColor,
                  size: 20.0,
                ),
              ),
              const SizedBox(width: 12.0),
              // 文件名与容量切片元数据
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      document.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 14.0,
                        fontWeight: FontWeight.w600,
                        color: StitchTokens.onSurface,
                      ),
                    ),
                    const SizedBox(height: 3.0),
                    Row(
                      children: [
                        Text(
                          document.formattedSize,
                          style: const TextStyle(
                            fontSize: 11.0,
                            color: StitchTokens.outline,
                          ),
                        ),
                        if (document.isCompleted) ...[
                          const SizedBox(width: 8.0),
                          Container(
                            width: 3.0,
                            height: 3.0,
                            decoration: const BoxDecoration(
                              color: StitchTokens.outlineVariant,
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: 8.0),
                          Text(
                            '${document.chunkCount} 个切片',
                            style: const TextStyle(
                              fontSize: 11.0,
                              color: StitchTokens.outline,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8.0),
              // 状态指示徽标
              _buildStatusIndicator(),
              const SizedBox(width: 4.0),
              // 删除操作
              IconButton(
                icon: const Icon(
                  Icons.delete_outline_rounded,
                  color: StitchTokens.outline,
                  size: 18.0,
                ),
                onPressed: onDelete,
                splashRadius: 20.0,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatusIndicator() {
    if (document.isProcessing) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 4.0),
        decoration: BoxDecoration(
          color: StitchTokens.primaryContainer.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(StitchTokens.radiusSm),
        ),
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              width: 10.0,
              height: 10.0,
              child: CircularProgressIndicator(
                strokeWidth: 1.5,
                valueColor: AlwaysStoppedAnimation(StitchTokens.primary),
              ),
            ),
            SizedBox(width: 6.0),
            Text(
              '解析中',
              style: TextStyle(
                fontSize: 11.0,
                color: StitchTokens.primary,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      );
    } else if (document.isFailed) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 4.0),
        decoration: BoxDecoration(
          color: StitchTokens.crimsonStop.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(StitchTokens.radiusSm),
        ),
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.error_outline_rounded, size: 12.0, color: StitchTokens.crimsonStop),
            SizedBox(width: 4.0),
            Text(
              '失败',
              style: TextStyle(
                fontSize: 11.0,
                color: StitchTokens.crimsonStop,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 4.0),
      decoration: BoxDecoration(
        color: StitchTokens.playbackEmerald.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(StitchTokens.radiusSm),
      ),
      child: const Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.check_circle_rounded, size: 12.0, color: StitchTokens.playbackEmerald),
          SizedBox(width: 4.0),
          Text(
            '就绪',
            style: TextStyle(
              fontSize: 11.0,
              color: StitchTokens.playbackEmerald,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}
