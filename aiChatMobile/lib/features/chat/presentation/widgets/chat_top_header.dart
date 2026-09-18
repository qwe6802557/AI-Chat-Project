import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/stitch_tokens.dart';
import '../../../auth/providers/auth_provider.dart';

/// Stitch AI 顶部导航状态栏
class ChatTopHeader extends ConsumerWidget {
  final String selectedModel;
  final VoidCallback onModelTap;
  final VoidCallback onProfileTap;

  const ChatTopHeader({
    super.key,
    required this.selectedModel,
    required this.onModelTap,
    required this.onProfileTap,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authProvider);
    final username = authState.user?.username ?? 'AI User';

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              Container(
                width: 32.0,
                height: 32.0,
                decoration: BoxDecoration(
                  color: StitchTokens.surfaceGlassDark,
                  borderRadius: BorderRadius.circular(StitchTokens.radiusMd),
                ),
                child: const Icon(
                  Icons.auto_awesome_rounded,
                  color: StitchTokens.primaryGlow,
                  size: 18.0,
                ),
              ),
              const SizedBox(width: 8.0),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Text(
                        'AI Spark',
                        style: TextStyle(
                          fontSize: 16.0,
                          fontWeight: FontWeight.w700,
                          color: StitchTokens.onSurface,
                        ),
                      ),
                      const SizedBox(width: 4.0),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6.0, vertical: 2.0),
                        decoration: BoxDecoration(
                          color: StitchTokens.surfaceContainer,
                          borderRadius: BorderRadius.circular(StitchTokens.radiusFull),
                        ),
                        child: const Text(
                          'PRO',
                          style: TextStyle(fontSize: 10.0, fontWeight: FontWeight.w700),
                        ),
                      ),
                    ],
                  ),
                  const Text(
                    'Chat Workbench',
                    style: TextStyle(fontSize: 11.0, color: StitchTokens.onSurfaceVariant),
                  ),
                ],
              ),
            ],
          ),
          Row(
            children: [
              GestureDetector(
                onTap: onModelTap,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10.0, vertical: 4.0),
                  decoration: BoxDecoration(
                    color: StitchTokens.surfaceContainerLow,
                    borderRadius: BorderRadius.circular(StitchTokens.radiusFull),
                  ),
                  child: Row(
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
                        selectedModel,
                        style: const TextStyle(
                          fontSize: 11.0,
                          fontWeight: FontWeight.w600,
                          color: StitchTokens.onSurfaceVariant,
                        ),
                      ),
                      const SizedBox(width: 4.0),
                      const Icon(
                        Icons.keyboard_arrow_down_rounded,
                        size: 14.0,
                        color: StitchTokens.onSurfaceVariant,
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 10.0),
              GestureDetector(
                onTap: onProfileTap,
                child: Stack(
                  children: [
                    CircleAvatar(
                      radius: 16.0,
                      backgroundColor: StitchTokens.primaryContainer.withValues(alpha: 0.2),
                      child: Text(
                        username.isNotEmpty ? username[0].toUpperCase() : 'U',
                        style: const TextStyle(
                          fontSize: 14.0,
                          fontWeight: FontWeight.w700,
                          color: StitchTokens.primary,
                        ),
                      ),
                    ),
                    Positioned(
                      right: 0,
                      bottom: 0,
                      child: Container(
                        width: 8.0,
                        height: 8.0,
                        decoration: BoxDecoration(
                          color: StitchTokens.playbackEmerald,
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 1.5),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
