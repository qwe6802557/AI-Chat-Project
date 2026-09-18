import 'package:flutter/material.dart';
import '../../../../core/theme/stitch_tokens.dart';
import 'model_switcher_bottom_sheet.dart';

/// Stitch AI 模型列表单项卡片
class ModelInfoCard extends StatelessWidget {
  final ModelInfo model;
  final bool isSelected;
  final VoidCallback onTap;

  const ModelInfoCard({
    super.key,
    required this.model,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14.0),
        decoration: BoxDecoration(
          color: isSelected ? StitchTokens.thinkingBg : StitchTokens.surfaceContainerLow,
          borderRadius: BorderRadius.circular(16.0),
          border: Border.all(
            color: isSelected ? StitchTokens.primary : Colors.transparent,
            width: 1.5,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 32.0,
                  height: 32.0,
                  decoration: BoxDecoration(
                    color: StitchTokens.surfaceGlassDark,
                    borderRadius: BorderRadius.circular(10.0),
                  ),
                  child: Icon(
                    model.icon,
                    color: isSelected ? StitchTokens.primaryGlow : Colors.white,
                    size: 18.0,
                  ),
                ),
                const SizedBox(width: 10.0),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(
                            model.name,
                            style: TextStyle(
                              fontSize: 15.0,
                              fontWeight: isSelected ? FontWeight.w700 : FontWeight.w600,
                              color: StitchTokens.onSurface,
                            ),
                          ),
                          const SizedBox(width: 6.0),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6.0, vertical: 1.0),
                            decoration: BoxDecoration(
                              color: isSelected
                                  ? StitchTokens.primary
                                  : StitchTokens.surfaceVariant,
                              borderRadius: BorderRadius.circular(StitchTokens.radiusFull),
                            ),
                            child: Text(
                              isSelected ? '当前在用' : model.tag,
                              style: TextStyle(
                                fontSize: 10.0,
                                fontWeight: FontWeight.w600,
                                color: isSelected ? Colors.white : StitchTokens.onSurfaceVariant,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 2.0),
                      Text(
                        model.description,
                        style: const TextStyle(
                          fontSize: 12.0,
                          color: StitchTokens.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8.0),
                Container(
                  width: 22.0,
                  height: 22.0,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: isSelected ? StitchTokens.primary : Colors.transparent,
                    border: Border.all(
                      color: isSelected ? StitchTokens.primary : StitchTokens.outlineVariant,
                      width: 2.0,
                    ),
                  ),
                  child: isSelected
                      ? const Icon(Icons.check_rounded, size: 14.0, color: Colors.white)
                      : null,
                ),
              ],
            ),
            const SizedBox(height: 10.0),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    const Icon(Icons.speed_rounded, size: 13.0, color: StitchTokens.playbackEmerald),
                    const SizedBox(width: 4.0),
                    Text(
                      model.latency,
                      style: const TextStyle(fontSize: 11.0, color: StitchTokens.onSurfaceVariant),
                    ),
                    const SizedBox(width: 8.0),
                    const Text('•', style: TextStyle(color: StitchTokens.outlineVariant)),
                    const SizedBox(width: 8.0),
                    Text(
                      '上下文 ${model.contextWindow}',
                      style: const TextStyle(fontSize: 11.0, color: StitchTokens.onSurfaceVariant),
                    ),
                  ],
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 2.0),
                  decoration: BoxDecoration(
                    color: StitchTokens.creditBg,
                    borderRadius: BorderRadius.circular(StitchTokens.radiusFull),
                  ),
                  child: Text(
                    '${model.cost} 算力点/次',
                    style: const TextStyle(
                      fontSize: 11.0,
                      fontWeight: FontWeight.w600,
                      color: StitchTokens.creditAmber,
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
