import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/stitch_tokens.dart';
import '../../providers/knowledge_base_providers.dart';

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

  @override
  Widget build(BuildContext context) {
    final searchState = ref.watch(kbSearchTestProvider);

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.85,
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
          // 顶端拖拽手柄
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
          // 标题与关闭
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
          const SizedBox(height: 14.0),
          // 测试输入框与执行按钮
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _queryController,
                  decoration: InputDecoration(
                    hintText: '输入提问关键词测试召回切片...',
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
          const SizedBox(height: 14.0),
          const Divider(height: 1.0, color: StitchTokens.surfaceVariant),
          const SizedBox(height: 10.0),
          // 检索测试结果流
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
        final scorePercent = (score * 100).toStringAsFixed(1);

        return Container(
          padding: const EdgeInsets.all(12.0),
          decoration: BoxDecoration(
            color: StitchTokens.surfaceContainerLow,
            borderRadius: BorderRadius.circular(StitchTokens.radiusMd),
            border: Border.all(
              color: StitchTokens.outlineVariant.withValues(alpha: 0.3),
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
                      '相似度: $scorePercent%',
                      style: const TextStyle(
                        fontSize: 11.0,
                        fontWeight: FontWeight.w700,
                        color: StitchTokens.playbackEmerald,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8.0),
                  Text(
                    '切片 #${item.chunkIndex + 1}',
                    style: const TextStyle(fontSize: 11.0, color: StitchTokens.outline),
                  ),
                ],
              ),
              const SizedBox(height: 6.0),
              Text(
                item.content,
                maxLines: 4,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 12.0,
                  color: StitchTokens.onSurface,
                  height: 1.45,
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
