import 'package:flutter/material.dart';
import '../../../../core/theme/stitch_tokens.dart';
import '../../domain/artifact_model.dart';
import 'artifact_preview_sheet.dart';

/// 移动端消息流中的 Artifact 产物胶囊卡片
/// 严格遵循 stitch-design-taste 视觉令牌与触感反馈
class ArtifactCapsuleCard extends StatelessWidget {
  final ArtifactModel artifact;

  const ArtifactCapsuleCard({
    super.key,
    required this.artifact,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 6.0),
      child: Material(
        color: StitchTokens.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(StitchTokens.radiusLg),
        elevation: 0,
        child: InkWell(
          borderRadius: BorderRadius.circular(StitchTokens.radiusLg),
          onTap: () => ArtifactPreviewSheet.show(context, artifact),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14.0, vertical: 12.0),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(StitchTokens.radiusLg),
              border: Border.all(
                color: StitchTokens.outlineVariant.withValues(alpha: 0.5),
                width: 1.0,
              ),
            ),
            child: Row(
              children: [
                // 左侧类型图标徽章
                Container(
                  width: 38.0,
                  height: 38.0,
                  decoration: BoxDecoration(
                    color: _getTypeBgColor(artifact.type),
                    borderRadius: BorderRadius.circular(StitchTokens.radiusMd),
                  ),
                  child: Icon(
                    _getTypeIcon(artifact.type),
                    size: 20.0,
                    color: _getTypeColor(artifact.type),
                  ),
                ),
                const SizedBox(width: 12.0),

                // 中间标题与元数据
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              artifact.title,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 14.0,
                                fontWeight: FontWeight.w600,
                                color: StitchTokens.onSurface,
                                letterSpacing: -0.2,
                              ),
                            ),
                          ),
                          if (!artifact.isComplete) ...[
                            const SizedBox(width: 6.0),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6.0, vertical: 1.5),
                              decoration: BoxDecoration(
                                color: StitchTokens.thinkingBg,
                                borderRadius: BorderRadius.circular(StitchTokens.radiusFull),
                              ),
                              child: const Text(
                                '生成中',
                                style: TextStyle(
                                  fontSize: 10.0,
                                  fontWeight: FontWeight.w500,
                                  color: StitchTokens.primary,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 3.0),
                      Row(
                        children: [
                          Text(
                            _formatTypeLabel(artifact.type, artifact.language),
                            style: TextStyle(
                              fontSize: 11.0,
                              fontWeight: FontWeight.w500,
                              color: StitchTokens.onSurfaceVariant.withValues(alpha: 0.8),
                              fontFamily: 'monospace',
                            ),
                          ),
                          const SizedBox(width: 6.0),
                          Text(
                            'v${artifact.version}',
                            style: const TextStyle(
                              fontSize: 11.0,
                              fontWeight: FontWeight.w600,
                              color: StitchTokens.primary,
                              fontFamily: 'monospace',
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),

                // 右侧箭头与进入指示
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      '查看产物',
                      style: TextStyle(
                        fontSize: 12.0,
                        fontWeight: FontWeight.w600,
                        color: StitchTokens.primary,
                      ),
                    ),
                    const SizedBox(width: 2.0),
                    Icon(
                      Icons.chevron_right_rounded,
                      size: 18.0,
                      color: StitchTokens.primary,
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  IconData _getTypeIcon(String type) {
    if (type.contains('html')) return Icons.language_rounded;
    if (type.contains('svg')) return Icons.image_outlined;
    if (type.contains('mermaid')) return Icons.account_tree_outlined;
    return Icons.code_rounded;
  }

  Color _getTypeColor(String type) {
    if (type.contains('html')) return StitchTokens.primary;
    if (type.contains('svg')) return Colors.green.shade600;
    if (type.contains('mermaid')) return Colors.purple.shade600;
    return StitchTokens.onSurface;
  }

  Color _getTypeBgColor(String type) {
    if (type.contains('html')) return StitchTokens.thinkingBg;
    if (type.contains('svg')) return Colors.green.shade50;
    if (type.contains('mermaid')) return Colors.purple.shade50;
    return StitchTokens.surfaceContainerLow;
  }

  String _formatTypeLabel(String type, String? lang) {
    if (type.contains('html')) return 'HTML 网页';
    if (type.contains('svg')) return 'SVG 矢量';
    if (type.contains('mermaid')) return 'Mermaid 图表';
    if (lang != null && lang.isNotEmpty) return lang.toUpperCase();
    return 'CODE';
  }
}
