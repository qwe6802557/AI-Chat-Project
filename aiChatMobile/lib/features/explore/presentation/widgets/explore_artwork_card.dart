import 'package:flutter/material.dart';
import '../../../../core/theme/stitch_tokens.dart';
import '../../../../shared/widgets/glass_card.dart';
import '../../domain/image_task_model.dart';

/// 历史画作卡片组件
class ExploreArtworkCard extends StatelessWidget {
  final ImageTaskModel task;
  final void Function(String imageUrl, String prompt) onTapImage;

  const ExploreArtworkCard({
    super.key,
    required this.task,
    required this.onTapImage,
  });

  @override
  Widget build(BuildContext context) {
    final firstUrl = task.imageUrls.isNotEmpty ? task.imageUrls.first : null;

    return GlassCard(
      padding: const EdgeInsets.all(12.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    width: 6.0,
                    height: 6.0,
                    decoration: const BoxDecoration(
                      color: StitchTokens.playbackEmerald,
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 6.0),
                  Text(
                    task.model,
                    style: const TextStyle(fontSize: 11.0, fontWeight: FontWeight.w600),
                  ),
                ],
              ),
              Text(
                task.aspectRatio,
                style: const TextStyle(fontSize: 11.0, color: StitchTokens.onSurfaceVariant),
              ),
            ],
          ),
          const SizedBox(height: 8.0),
          if (firstUrl != null)
            GestureDetector(
              onTap: () => onTapImage(firstUrl, task.prompt),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(10.0),
                child: AspectRatio(
                  aspectRatio: task.aspectRatio == '16:9'
                      ? 16 / 9
                      : (task.aspectRatio == '9:16' ? 9 / 16 : 1.0),
                  child: Image.network(
                    firstUrl,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => Container(
                      color: StitchTokens.surfaceContainerLow,
                      child: const Icon(Icons.broken_image_rounded, color: StitchTokens.outline),
                    ),
                  ),
                ),
              ),
            )
          else
            Container(
              height: 120.0,
              decoration: BoxDecoration(
                color: StitchTokens.surfaceContainerLow,
                borderRadius: BorderRadius.circular(10.0),
              ),
              child: const Center(
                child: Text('生成处理中...', style: TextStyle(color: StitchTokens.outline)),
              ),
            ),
          const SizedBox(height: 8.0),
          Text(
            task.prompt,
            style: const TextStyle(fontSize: 12.0, color: StitchTokens.onSurface),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}
