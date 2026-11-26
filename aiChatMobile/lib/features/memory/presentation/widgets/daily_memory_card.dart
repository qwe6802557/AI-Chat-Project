import 'package:flutter/material.dart';
import '../../../../core/theme/stitch_tokens.dart';
import '../../domain/memory_models.dart';

/// 单条日常情境记忆卡片（对齐 PC 记忆工坊 Stitch 视觉风格）
class DailyMemoryCard extends StatelessWidget {
  final AgentDailyMemoryModel item;
  final bool showScore;
  final VoidCallback onDelete;

  const DailyMemoryCard({
    super.key,
    required this.item,
    this.showScore = false,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final scorePercent =
        item.score != null ? (item.score! * 100).round() : null;

    return Container(
      margin: const EdgeInsets.only(bottom: 10.0),
      padding: const EdgeInsets.all(12.0),
      decoration: BoxDecoration(
        color: StitchTokens.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(StitchTokens.radiusLg),
        border: Border.all(color: StitchTokens.surfaceVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Wrap(
                  spacing: 6.0,
                  runSpacing: 4.0,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6.0,
                        vertical: 2.0,
                      ),
                      decoration: BoxDecoration(
                        color: StitchTokens.surfaceContainer,
                        borderRadius: BorderRadius.circular(StitchTokens.radiusSm),
                      ),
                      child: Text(
                        item.categoryBadge,
                        style: const TextStyle(
                          fontFamily: 'monospace',
                          fontSize: 10.0,
                          fontWeight: FontWeight.w700,
                          color: StitchTokens.onSurface,
                        ),
                      ),
                    ),
                    Text(
                      item.dateKey,
                      style: const TextStyle(
                        fontFamily: 'monospace',
                        fontSize: 10.5,
                        color: StitchTokens.outline,
                      ),
                    ),
                    if (item.isArchived)
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 5.0,
                          vertical: 1.0,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0xFFD1FAE5),
                          borderRadius: BorderRadius.circular(3.0),
                        ),
                        child: const Text(
                          '已蒸馏',
                          style: TextStyle(
                            fontSize: 9.5,
                            fontWeight: FontWeight.w600,
                            color: StitchTokens.playbackEmerald,
                          ),
                        ),
                      ),
                    if (showScore && scorePercent != null)
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 6.0,
                          vertical: 1.0,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0xFFE0F2FE),
                          borderRadius: BorderRadius.circular(3.0),
                        ),
                        child: Text(
                          '相关度 $scorePercent%',
                          style: const TextStyle(
                            fontFamily: 'monospace',
                            fontSize: 10.0,
                            fontWeight: FontWeight.w600,
                            color: StitchTokens.primary,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              IconButton(
                icon: const Icon(
                  Icons.delete_outline_rounded,
                  size: 18.0,
                  color: StitchTokens.outline,
                ),
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(minWidth: 28.0, minHeight: 28.0),
                tooltip: '彻底遗忘此条记忆',
                onPressed: onDelete,
              ),
            ],
          ),
          const SizedBox(height: 6.0),
          Text(
            item.content,
            style: const TextStyle(
              fontSize: 13.0,
              height: 1.5,
              color: StitchTokens.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }
}
