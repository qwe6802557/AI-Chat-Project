import 'package:flutter/material.dart';
import '../../../../core/theme/stitch_tokens.dart';
import '../../domain/knowledge_base_model.dart';

/// 移动端知识库选择底部弹窗
class KnowledgeBaseBottomSheet extends StatefulWidget {
  final List<String> selectedIds;
  final ValueChanged<String> onToggleKnowledgeBase;
  final ValueChanged<List<String>> onSetKnowledgeBases;
  final Future<List<KnowledgeBaseModel>> Function() onFetchKnowledgeBases;

  const KnowledgeBaseBottomSheet({
    super.key,
    required this.selectedIds,
    required this.onToggleKnowledgeBase,
    required this.onSetKnowledgeBases,
    required this.onFetchKnowledgeBases,
  });

  static Future<void> show(
    BuildContext context, {
    required List<String> selectedIds,
    required ValueChanged<String> onToggleKnowledgeBase,
    required ValueChanged<List<String>> onSetKnowledgeBases,
    required Future<List<KnowledgeBaseModel>> Function() onFetchKnowledgeBases,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => KnowledgeBaseBottomSheet(
        selectedIds: selectedIds,
        onToggleKnowledgeBase: onToggleKnowledgeBase,
        onSetKnowledgeBases: onSetKnowledgeBases,
        onFetchKnowledgeBases: onFetchKnowledgeBases,
      ),
    );
  }

  @override
  State<KnowledgeBaseBottomSheet> createState() =>
      _KnowledgeBaseBottomSheetState();
}

class _KnowledgeBaseBottomSheetState extends State<KnowledgeBaseBottomSheet> {
  bool _loading = true;
  List<KnowledgeBaseModel> _knowledgeBases = [];

  @override
  void initState() {
    super.initState();
    _loadList();
  }

  Future<void> _loadList() async {
    setState(() => _loading = true);
    try {
      final list = await widget.onFetchKnowledgeBases();
      if (mounted) {
        setState(() {
          _knowledgeBases = list.where((k) => k.status == 'active').toList();
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final activeCount = widget.selectedIds.length;

    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(StitchTokens.radius2Xl),
        ),
        boxShadow: [
          BoxShadow(
            color: Color.fromRGBO(0, 0, 0, 0.12),
            blurRadius: 20.0,
            offset: Offset(0, -4),
          ),
        ],
      ),
      padding: EdgeInsets.fromLTRB(
        20.0,
        12.0,
        20.0,
        MediaQuery.of(context).padding.bottom + 16.0,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Container(
              width: 36.0,
              height: 4.0,
              decoration: BoxDecoration(
                color: const Color(0xFFE2E8F0),
                borderRadius: BorderRadius.circular(StitchTokens.radiusFull),
              ),
            ),
          ),
          const SizedBox(height: 16.0),
          Row(
            children: [
              Container(
                width: 38.0,
                height: 38.0,
                decoration: BoxDecoration(
                  color: const Color(0xFFEFF6FF),
                  borderRadius: BorderRadius.circular(StitchTokens.radiusMd),
                ),
                child: const Icon(
                  Icons.menu_book_rounded,
                  size: 20.0,
                  color: StitchTokens.primary,
                ),
              ),
              const SizedBox(width: 12.0),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Text(
                          '私域知识库 (混合 RAG)',
                          style: TextStyle(
                            fontSize: 16.0,
                            fontWeight: FontWeight.w600,
                            color: StitchTokens.onSurface,
                          ),
                        ),
                        if (activeCount > 0) ...[
                          const SizedBox(width: 8.0),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 6.0,
                              vertical: 2.0,
                            ),
                            decoration: BoxDecoration(
                              color: StitchTokens.primary,
                              borderRadius: BorderRadius.circular(
                                StitchTokens.radiusFull,
                              ),
                            ),
                            child: Text(
                              '已选 $activeCount 个',
                              style: const TextStyle(
                                fontSize: 10.0,
                                fontWeight: FontWeight.w600,
                                color: Colors.white,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 2.0),
                    const Text(
                      'PostgreSQL + pgvector 稠密向量与关键词 RRF 融合',
                      style: TextStyle(
                        fontSize: 12.0,
                        color: StitchTokens.outline,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16.0),
          if (_loading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 36.0),
              child: Center(
                child: CircularProgressIndicator(strokeWidth: 2.0),
              ),
            )
          else if (_knowledgeBases.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 32.0),
              child: Column(
                children: const [
                  Icon(
                    Icons.inventory_2_outlined,
                    size: 36.0,
                    color: Color(0xFF94A3B8),
                  ),
                  SizedBox(height: 8.0),
                  Text(
                    '暂无可用知识库，可在电脑端工作台创建与上传文档',
                    style: TextStyle(
                      fontSize: 13.0,
                      color: Color(0xFF64748B),
                    ),
                  ),
                ],
              ),
            )
          else
            ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 340.0),
              child: ListView.separated(
                shrinkWrap: true,
                itemCount: _knowledgeBases.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8.0),
                itemBuilder: (context, index) {
                  final kb = _knowledgeBases[index];
                  final isSelected = widget.selectedIds.contains(kb.id);

                  return Material(
                    color: Colors.transparent,
                    child: InkWell(
                      borderRadius: BorderRadius.circular(
                        StitchTokens.radiusMd,
                      ),
                      onTap: () {
                        widget.onToggleKnowledgeBase(kb.id);
                        setState(() {});
                      },
                      child: Container(
                        padding: const EdgeInsets.all(12.0),
                        decoration: BoxDecoration(
                          color: isSelected
                              ? const Color(0xFFEFF6FF)
                              : const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(
                            StitchTokens.radiusMd,
                          ),
                          border: Border.all(
                            color: isSelected
                                ? const Color(0xFF93C5FD)
                                : const Color(0xFFE2E8F0),
                          ),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              isSelected
                                  ? Icons.check_circle_rounded
                                  : Icons.radio_button_unchecked_rounded,
                              size: 20.0,
                              color: isSelected
                                  ? StitchTokens.primary
                                  : const Color(0xFF94A3B8),
                            ),
                            const SizedBox(width: 12.0),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    kb.name,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      fontSize: 14.0,
                                      fontWeight: FontWeight.w600,
                                      color: isSelected
                                          ? const Color(0xFF1E3A8A)
                                          : StitchTokens.onSurface,
                                    ),
                                  ),
                                  if (kb.description.isNotEmpty) ...[
                                    const SizedBox(height: 2.0),
                                    Text(
                                      kb.description,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                        fontSize: 11.0,
                                        color: StitchTokens.outline,
                                      ),
                                    ),
                                  ],
                                  const SizedBox(height: 4.0),
                                  Text(
                                    '${kb.documentCount} 文档 · ${kb.chunkCount} 切片',
                                    style: const TextStyle(
                                      fontSize: 11.0,
                                      color: Color(0xFF64748B),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
          const SizedBox(height: 16.0),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 12.0),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(
                        StitchTokens.radiusMd,
                      ),
                    ),
                  ),
                  onPressed: () {
                    widget.onSetKnowledgeBases([]);
                    setState(() {});
                  },
                  child: const Text('清空选择'),
                ),
              ),
              const SizedBox(width: 12.0),
              Expanded(
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: StitchTokens.primary,
                    padding: const EdgeInsets.symmetric(vertical: 12.0),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(
                        StitchTokens.radiusMd,
                      ),
                    ),
                  ),
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text(
                    '完成',
                    style: TextStyle(color: Colors.white),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
