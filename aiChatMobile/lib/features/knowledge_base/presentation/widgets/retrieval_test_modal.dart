import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/stitch_tokens.dart';
import '../../domain/chunk_model.dart';
import '../../providers/knowledge_base_providers.dart';
import 'chunk_detail_drawer.dart';
import 'highlighted_chunk_text.dart';

/// 移动端知识库检索演练测试沙箱弹窗
class RetrievalTestModal extends ConsumerStatefulWidget {
  final String knowledgeBaseId;
  final String knowledgeBaseName;

  const RetrievalTestModal({
    super.key,
    required this.knowledgeBaseId,
    required this.knowledgeBaseName,
  });

  static Future<void> show(
    BuildContext context, {
    required String knowledgeBaseId,
    required String knowledgeBaseName,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useRootNavigator: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => RetrievalTestModal(
        knowledgeBaseId: knowledgeBaseId,
        knowledgeBaseName: knowledgeBaseName,
      ),
    );
  }

  @override
  ConsumerState<RetrievalTestModal> createState() => _RetrievalTestModalState();
}

class _RetrievalTestModalState extends ConsumerState<RetrievalTestModal> {
  final TextEditingController _queryController = TextEditingController();

  @override
  void dispose() {
    _queryController.dispose();
    super.dispose();
  }

  void _handleSearch() {
    final query = _queryController.text.trim();
    if (query.isEmpty) return;
    ref.read(kbSearchTestProvider.notifier).runSearch(
      query: query,
      knowledgeBaseIds: [widget.knowledgeBaseId],
    );
  }

  String _hitSourceLabel(String? hitSource) {
    switch (hitSource) {
      case 'hybrid':
        return '双路共振';
      case 'dense':
        return '语义召回';
      case 'sparse':
        return '字面匹配';
      default:
        return '';
    }
  }

  String _formatMetrics(ChunkModel item) {
    final parts = <String>[];
    if (item.rerankApplied && item.rerankScore != null) {
      parts.add('Rerank ${(item.rerankScore! * 100).toStringAsFixed(0)}%');
    }
    if (item.denseScore != null) {
      parts.add('Dense ${(item.denseScore! * 100).toStringAsFixed(0)}%');
    }
    if (item.sparseRank != null) {
      parts.add('Sparse #${item.sparseRank}');
    }
    return parts.join(' · ');
  }

  @override
  Widget build(BuildContext context) {
    final searchState = ref.watch(kbSearchTestProvider);
    final notifier = ref.read(kbSearchTestProvider.notifier);

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.88,
      ),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(StitchTokens.radius2Xl),
        ),
      ),
      padding: EdgeInsets.fromLTRB(
        20.0,
        14.0,
        20.0,
        MediaQuery.of(context).viewInsets.bottom + MediaQuery.of(context).padding.bottom + 16.0,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 36.0,
              height: 4.0,
              decoration: BoxDecoration(
                color: StitchTokens.outlineVariant.withValues(alpha: 0.6),
                borderRadius: BorderRadius.circular(StitchTokens.radiusFull),
              ),
            ),
          ),
          const SizedBox(height: 14.0),
          Row(
            children: [
              Container(
                width: 32.0,
                height: 32.0,
                decoration: BoxDecoration(
                  color: StitchTokens.primaryContainer.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(StitchTokens.radiusMd),
                ),
                child: const Icon(
                  Icons.manage_search_rounded,
                  color: StitchTokens.primary,
                  size: 18.0,
                ),
              ),
              const SizedBox(width: 10.0),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      '检索演练沙箱',
                      style: TextStyle(
                        fontSize: 16.0,
                        fontWeight: FontWeight.w700,
                        color: StitchTokens.onSurface,
                      ),
                    ),
                    Text(
                      widget.knowledgeBaseName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 11.0,
                        color: StitchTokens.outline,
                      ),
                    ),
                  ],
                ),
              ),
              IconButton(
                icon: const Icon(Icons.close_rounded, size: 20.0, color: StitchTokens.outline),
                onPressed: () => Navigator.of(context).pop(),
                splashRadius: 20.0,
              ),
            ],
          ),
          const SizedBox(height: 12.0),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _queryController,
                  decoration: InputDecoration(
                    hintText: '输入提问关键词测试召回与高亮...',
                    hintStyle: const TextStyle(fontSize: 13.0, color: StitchTokens.outline),
                    filled: true,
                    fillColor: StitchTokens.surfaceContainerLow,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14.0, vertical: 10.0),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(StitchTokens.radiusMd),
                      borderSide: BorderSide.none,
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(StitchTokens.radiusMd),
                      borderSide: const BorderSide(color: StitchTokens.primary, width: 1.5),
                    ),
                  ),
                  onSubmitted: (_) => _handleSearch(),
                ),
              ),
              const SizedBox(width: 10.0),
              SizedBox(
                height: 42.0,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: StitchTokens.primary,
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(StitchTokens.radiusMd),
                    ),
                  ),
                  onPressed: searchState.isLoading ? null : _handleSearch,
                  child: searchState.isLoading
                      ? const SizedBox(
                          width: 16.0,
                          height: 16.0,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.0,
                            valueColor: AlwaysStoppedAnimation(Colors.white),
                          ),
                        )
                      : const Text(
                          '测试',
                          style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
                        ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10.0),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                for (final entry in const [
                  ('hybrid', '混合'),
                  ('dense', '语义'),
                  ('sparse', '关键词'),
                ])
                  Padding(
                    padding: const EdgeInsets.only(right: 6.0),
                    child: ChoiceChip(
                      label: Text(entry.$2, style: const TextStyle(fontSize: 11.5)),
                      selected: searchState.mode == entry.$1,
                      onSelected: (_) => notifier.setMode(entry.$1),
                    ),
                  ),
                FilterChip(
                  label: const Text('Rerank 精排', style: TextStyle(fontSize: 11.5)),
                  selected: searchState.enableRerank,
                  onSelected: notifier.setEnableRerank,
                ),
              ],
            ),
          ),
          const SizedBox(height: 10.0),
          const Divider(height: 1.0, color: StitchTokens.surfaceVariant),
          const SizedBox(height: 10.0),
          Expanded(
            child: _buildResultsView(searchState),
          ),
        ],
      ),
    );
  }

  Widget _buildResultsView(SearchTestState state) {
    if (state.isLoading) {
      return const Center(
        child: CircularProgressIndicator(
          strokeWidth: 2.0,
          valueColor: AlwaysStoppedAnimation(StitchTokens.primary),
        ),
      );
    }

    if (state.error != null) {
      return Center(
        child: Text(
          '检索失败: ${state.error}',
          style: const TextStyle(fontSize: 13.0, color: StitchTokens.crimsonStop),
        ),
      );
    }

    if (state.results.isEmpty) {
      return Center(
        child: Text(
          state.query.isEmpty ? '请输入测试问题测算语义命中切片' : '未检索到相关相似切片',
          style: const TextStyle(fontSize: 13.0, color: StitchTokens.outline),
        ),
      );
    }

    return ListView.separated(
      itemCount: state.results.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10.0),
      itemBuilder: (context, index) {
        final item = state.results[index];
        final score = item.score ?? 0.0;
        final scorePercent = (score * 100).toStringAsFixed(0);
        final hitLabel = _hitSourceLabel(item.hitSource);
        final metrics = _formatMetrics(item);

        return Material(
          color: Colors.transparent,
          child: InkWell(
            borderRadius: BorderRadius.circular(StitchTokens.radiusMd),
            onTap: item.id.isNotEmpty
                ? () {
                    ChunkDetailDrawer.showHitContext(
                      context,
                      chunkId: item.id,
                      documentTitle: item.documentTitle,
                      highlights: item.highlights,
                      query: state.query,
                    );
                  }
                : null,
            child: Container(
              padding: const EdgeInsets.all(12.0),
              decoration: BoxDecoration(
                color: StitchTokens.surfaceContainerLow,
                borderRadius: BorderRadius.circular(StitchTokens.radiusMd),
                border: Border.all(
                  color: StitchTokens.outlineVariant.withValues(alpha: 0.35),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6.0, vertical: 2.0),
                        decoration: BoxDecoration(
                          color: StitchTokens.playbackEmerald.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(StitchTokens.radiusSm),
                        ),
                        child: Text(
                          '置信度 $scorePercent%',
                          style: const TextStyle(
                            fontSize: 11.0,
                            fontWeight: FontWeight.w700,
                            color: StitchTokens.playbackEmerald,
                          ),
                        ),
                      ),
                      if (hitLabel.isNotEmpty) ...[
                        const SizedBox(width: 6.0),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6.0, vertical: 2.0),
                          decoration: BoxDecoration(
                            color: StitchTokens.primary.withValues(alpha: 0.08),
                            borderRadius: BorderRadius.circular(StitchTokens.radiusSm),
                          ),
                          child: Text(
                            hitLabel,
                            style: const TextStyle(
                              fontSize: 10.5,
                              fontWeight: FontWeight.w600,
                              color: StitchTokens.primary,
                            ),
                          ),
                        ),
                      ],
                      const SizedBox(width: 8.0),
                      Expanded(
                        child: Text(
                          '${item.documentTitle ?? ''} · #${item.chunkIndex + 1}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 11.0, color: StitchTokens.outline),
                        ),
                      ),
                      const Icon(Icons.chevron_right_rounded, size: 16.0, color: StitchTokens.outline),
                    ],
                  ),
                  if (metrics.isNotEmpty) ...[
                    const SizedBox(height: 5.0),
                    Text(
                      metrics,
                      style: const TextStyle(
                        fontSize: 10.5,
                        color: Color(0xFF64748B),
                        fontFamily: 'monospace',
                      ),
                    ),
                  ],
                  const SizedBox(height: 6.0),
                  HighlightedChunkText(
                    content: item.content,
                    highlights: item.highlights,
                    keyword: state.query,
                    maxLines: 4,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 12.5,
                      color: StitchTokens.onSurface,
                      height: 1.5,
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}
