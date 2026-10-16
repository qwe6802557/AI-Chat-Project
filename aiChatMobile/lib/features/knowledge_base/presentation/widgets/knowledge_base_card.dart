import 'package:flutter/material.dart';
import '../../../../core/theme/stitch_tokens.dart';
import '../../domain/knowledge_base_model.dart';

/// Stitch 风格知识库卡片组件
class KnowledgeBaseCard extends StatelessWidget {
  final KnowledgeBaseModel knowledgeBase;
  final VoidCallback onTap;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  const KnowledgeBaseCard({
    super.key,
    required this.knowledgeBase,
    required this.onTap,
    required this.onEdit,
    required this.onDelete,
  });

  IconData _getAvatarIcon(String name) {
    switch (name) {
      case 'menu_book':
        return Icons.menu_book_rounded;
      case 'folder':
        return Icons.folder_rounded;
      case 'memory':
        return Icons.memory_rounded;
      case 'description':
        return Icons.description_rounded;
      case 'architecture':
        return Icons.architecture_rounded;
      case 'code':
        return Icons.code_rounded;
      case 'science':
        return Icons.science_rounded;
      case 'auto_stories':
      default:
        return Icons.auto_stories_rounded;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(StitchTokens.radiusXl),
        child: Container(
          decoration: BoxDecoration(
            color: StitchTokens.surfaceContainerLowest,
            borderRadius: BorderRadius.circular(StitchTokens.radiusXl),
            border: Border.all(
              color: StitchTokens.outlineVariant.withValues(alpha: 0.5),
              width: 1.0,
            ),
            boxShadow: const [
              BoxShadow(
                color: Color.fromRGBO(0, 0, 0, 0.03),
                blurRadius: 16.0,
                offset: Offset(0, 4),
              ),
            ],
          ),
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // 图标徽章
                  Container(
                    width: 44.0,
                    height: 44.0,
                    decoration: BoxDecoration(
                      color: StitchTokens.primaryContainer.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(StitchTokens.radiusLg),
                      border: Border.all(
                        color: StitchTokens.primaryContainer.withValues(alpha: 0.2),
                      ),
                    ),
                    child: Icon(
                      _getAvatarIcon(knowledgeBase.avatar),
                      color: StitchTokens.primary,
                      size: 22.0,
                    ),
                  ),
                  const SizedBox(width: 14.0),
                  // 名称与描述
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          knowledgeBase.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 16.0,
                            fontWeight: FontWeight.w600,
                            color: StitchTokens.onSurface,
                            letterSpacing: -0.2,
                          ),
                        ),
                        const SizedBox(height: 4.0),
                        Text(
                          knowledgeBase.description.isNotEmpty
                              ? knowledgeBase.description
                              : '暂无详细描述说明',
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 12.0,
                            color: StitchTokens.outline,
                            height: 1.35,
                          ),
                        ),
                      ],
                    ),
                  ),
                  // 操作弹出菜单
                  PopupMenuButton<String>(
                    icon: const Icon(
                      Icons.more_horiz_rounded,
                      color: StitchTokens.outline,
                      size: 20.0,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(StitchTokens.radiusLg),
                    ),
                    onSelected: (val) {
                      if (val == 'edit') {
                        onEdit();
                      } else if (val == 'delete') {
                        onDelete();
                      }
                    },
                    itemBuilder: (ctx) => [
                      const PopupMenuItem(
                        value: 'edit',
                        child: Row(
                          children: [
                            Icon(Icons.edit_outlined, size: 18.0, color: StitchTokens.onSurface),
                            SizedBox(width: 10.0),
                            Text('编辑信息', style: TextStyle(fontSize: 13.0)),
                          ],
                        ),
                      ),
                      const PopupMenuItem(
                        value: 'delete',
                        child: Row(
                          children: [
                            Icon(Icons.delete_outline_rounded, size: 18.0, color: StitchTokens.crimsonStop),
                            SizedBox(width: 10.0),
                            Text('删除知识库', style: TextStyle(fontSize: 13.0, color: StitchTokens.crimsonStop)),
                          ],
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 14.0),
              // 底部分割与元数据标签
              Container(
                height: 1.0,
                color: StitchTokens.outlineVariant.withValues(alpha: 0.3),
              ),
              const SizedBox(height: 10.0),
              Row(
                children: [
                  _buildMetricBadge(
                    icon: Icons.description_outlined,
                    label: '${knowledgeBase.documentCount} 篇文档',
                  ),
                  const SizedBox(width: 12.0),
                  _buildMetricBadge(
                    icon: Icons.layers_outlined,
                    label: '${knowledgeBase.chunkCount} 切片',
                  ),
                  const Spacer(),
                  const Icon(
                    Icons.chevron_right_rounded,
                    color: StitchTokens.outlineVariant,
                    size: 20.0,
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildMetricBadge({required IconData icon, required String label}) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14.0, color: StitchTokens.outline),
        const SizedBox(width: 4.0),
        Text(
          label,
          style: const TextStyle(
            fontSize: 12.0,
            color: StitchTokens.onSurfaceVariant,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }
}
