import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/stitch_tokens.dart';
import '../../../shared/widgets/glass_card.dart';
import '../providers/explore_provider.dart';
import 'widgets/explore_artwork_card.dart';
import 'widgets/explore_category_chips.dart';
import 'widgets/explore_generation_console.dart';
import 'widgets/explore_metrics_banner.dart';

/// Stitch 灵感生图与探索工作台
class ExplorePage extends ConsumerStatefulWidget {
  const ExplorePage({super.key});

  @override
  ConsumerState<ExplorePage> createState() => _ExplorePageState();
}

class _ExplorePageState extends ConsumerState<ExplorePage> {
  final TextEditingController _promptController = TextEditingController();
  String _activeCategory = '全部创作';

  static const List<String> _categories = [
    '全部创作',
    '交互预览 Artifacts',
    '代码组件',
    '文档报告',
    '灵感提示词库',
  ];

  @override
  void dispose() {
    _promptController.dispose();
    super.dispose();
  }

  void _handleGenerate() {
    final text = _promptController.text;
    if (text.trim().isEmpty) return;
    _promptController.clear();
    ref.read(exploreProvider.notifier).generateImage(text);
  }

  void _showImageLightbox(String imageUrl, String prompt) {
    showDialog(
      context: context,
      builder: (_) => Dialog(
        backgroundColor: Colors.black.withValues(alpha: 0.9),
        insetPadding: EdgeInsets.zero,
        child: Stack(
          children: [
            Center(
              child: InteractiveViewer(
                minScale: 0.5,
                maxScale: 4.0,
                child: Image.network(
                  imageUrl,
                  fit: BoxFit.contain,
                  errorBuilder: (_, __, ___) => const Center(
                    child: Text('图片加载失败', style: TextStyle(color: Colors.white70)),
                  ),
                ),
              ),
            ),
            Positioned(
              top: 40.0,
              right: 20.0,
              child: IconButton(
                icon: const Icon(Icons.close_rounded, color: Colors.white, size: 28.0),
                onPressed: () => Navigator.of(context).pop(),
              ),
            ),
            Positioned(
              bottom: 40.0,
              left: 20.0,
              right: 20.0,
              child: GlassCard(
                backgroundColor: Colors.black.withValues(alpha: 0.6),
                padding: const EdgeInsets.all(16.0),
                child: Text(
                  prompt,
                  style: const TextStyle(color: Colors.white, fontSize: 13.0, height: 1.4),
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final exploreState = ref.watch(exploreProvider);

    return Scaffold(
      backgroundColor: StitchTokens.background,
      appBar: AppBar(
        title: const Text(
          '探索创作',
          style: TextStyle(fontSize: 18.0, fontWeight: FontWeight.w600),
        ),
        centerTitle: true,
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16.0, 8.0, 16.0, 88.0),
          children: [
            const ExploreMetricsBanner(),
            const SizedBox(height: 12.0),
            ExploreCategoryChips(
              categories: _categories,
              activeCategory: _activeCategory,
              onSelected: (cat) => setState(() => _activeCategory = cat),
            ),
            const SizedBox(height: 12.0),
            if (exploreState.errorMessage != null)
              Container(
                margin: const EdgeInsets.only(bottom: 12.0),
                padding: const EdgeInsets.symmetric(horizontal: 12.0, vertical: 8.0),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEF2F2),
                  borderRadius: BorderRadius.circular(8.0),
                  border: Border.all(color: const Color(0xFFFCA5A5)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.error_outline_rounded, size: 16.0, color: StitchTokens.crimsonStop),
                    const SizedBox(width: 6.0),
                    Expanded(
                      child: Text(
                        exploreState.errorMessage!,
                        style: const TextStyle(fontSize: 12.0, color: Color(0xFF991B1B)),
                      ),
                    ),
                  ],
                ),
              ),
            ExploreGenerationConsole(
              promptController: _promptController,
              selectedRatio: exploreState.aspectRatio,
              isGenerating: exploreState.isGenerating,
              onRatioChanged: (ratio) => ref.read(exploreProvider.notifier).setAspectRatio(ratio),
              onGenerate: _handleGenerate,
            ),
            const SizedBox(height: 16.0),
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 4.0, vertical: 4.0),
              child: Text(
                '近期画作作品',
                style: TextStyle(
                  fontSize: 13.0,
                  fontWeight: FontWeight.w600,
                  color: StitchTokens.onSurfaceVariant,
                ),
              ),
            ),
            const SizedBox(height: 8.0),
            if (exploreState.tasks.isEmpty)
              const Center(
                child: Padding(
                  padding: EdgeInsets.symmetric(vertical: 32.0),
                  child: Text(
                    '暂无画作，在上方输入提示词创作第一幅作品吧',
                    style: TextStyle(fontSize: 13.0, color: StitchTokens.outline),
                  ),
                ),
              )
            else
              ...exploreState.tasks.map((task) => Padding(
                    padding: const EdgeInsets.only(bottom: 12.0),
                    child: ExploreArtworkCard(
                      task: task,
                      onTapImage: _showImageLightbox,
                    ),
                  )),
          ],
        ),
      ),
    );
  }
}
