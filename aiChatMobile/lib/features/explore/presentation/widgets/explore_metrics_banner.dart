import 'package:flutter/material.dart';
import '../../../../core/theme/stitch_tokens.dart';
import '../../../../shared/widgets/glass_card.dart';

/// Stitch Explore 顶部周度创作指标卡片
class ExploreMetricsBanner extends StatelessWidget {
  const ExploreMetricsBanner({super.key});

  Widget _buildMetricTile(String label, String count, String unit, Color countColor) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10.0, vertical: 8.0),
      decoration: BoxDecoration(
        color: StitchTokens.surfaceContainerLow,
        borderRadius: BorderRadius.circular(8.0),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(fontSize: 11.0, color: StitchTokens.onSurfaceVariant),
          ),
          const SizedBox(height: 2.0),
          Row(
            children: [
              Text(
                count,
                style: TextStyle(
                  fontSize: 18.0,
                  fontWeight: FontWeight.w700,
                  color: countColor,
                ),
              ),
              const SizedBox(width: 2.0),
              Text(
                unit,
                style: const TextStyle(fontSize: 11.0, color: StitchTokens.onSurfaceVariant),
              ),
            ],
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: const [
                  Icon(Icons.auto_awesome_rounded, color: StitchTokens.primary, size: 18.0),
                  SizedBox(width: 6.0),
                  Text(
                    '本周创作资产',
                    style: TextStyle(
                      fontSize: 15.0,
                      fontWeight: FontWeight.w700,
                      color: StitchTokens.onSurface,
                    ),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 2.0),
                decoration: BoxDecoration(
                  color: const Color(0xFFD9E2FF),
                  borderRadius: BorderRadius.circular(StitchTokens.radiusFull),
                ),
                child: const Text(
                  'SYNCED',
                  style: TextStyle(
                    fontSize: 10.0,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF001A43),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14.0),
          Row(
            children: [
              Expanded(child: _buildMetricTile('代码草稿', '14', '份', StitchTokens.primary)),
              const SizedBox(width: 8.0),
              Expanded(child: _buildMetricTile('技术方案', '8', '篇', const Color(0xFF006962))),
              const SizedBox(width: 8.0),
              Expanded(child: _buildMetricTile('对话摘要', '24', '个', StitchTokens.onSurface)),
            ],
          ),
        ],
      ),
    );
  }
}
