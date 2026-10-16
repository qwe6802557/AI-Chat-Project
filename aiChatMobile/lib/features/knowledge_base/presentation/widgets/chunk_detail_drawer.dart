import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/stitch_tokens.dart';
import '../../data/knowledge_base_repository.dart';
import '../../domain/chunk_model.dart';
import '../../domain/document_model.dart';

/// 知识库切片明细审阅抽屉
class ChunkDetailDrawer extends ConsumerStatefulWidget {
  final DocumentModel document;

  const ChunkDetailDrawer({
    super.key,
    required this.document,
  });

  static Future<void> show(
    BuildContext context, {
    required DocumentModel document,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useRootNavigator: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => ChunkDetailDrawer(document: document),
    );
  }

  @override
  ConsumerState<ChunkDetailDrawer> createState() => _ChunkDetailDrawerState();
}

class _ChunkDetailDrawerState extends ConsumerState<ChunkDetailDrawer> {
  bool _loading = true;
  List<ChunkModel> _chunks = [];
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadChunks();
  }

  Future<void> _loadChunks() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final repo = ref.read(knowledgeBaseRepositoryProvider);
      final list = await repo.getChunks(widget.document.id, page: 1, pageSize: 50);
      if (mounted) {
        setState(() {
          _chunks = list;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString().replaceAll('Exception:', '').trim();
          _loading = false;
        });
      }
    }
  }

  void _copyChunkText(String content) {
    Clipboard.setData(ClipboardData(text: content));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: const Text('切片内容已复制到剪贴板'),
        duration: const Duration(seconds: 2),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(StitchTokens.radiusMd),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
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
        MediaQuery.of(context).padding.bottom + 16.0,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 拖拽指示条
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
          // 顶栏信息
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      widget.document.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 16.0,
                        fontWeight: FontWeight.w700,
                        color: StitchTokens.onSurface,
                      ),
                    ),
                    const SizedBox(height: 2.0),
                    Text(
                      '共 ${widget.document.chunkCount} 个切片 · ${widget.document.charCount} 字符',
                      style: const TextStyle(
                        fontSize: 12.0,
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
          const Divider(height: 1.0, color: StitchTokens.surfaceVariant),
          const SizedBox(height: 12.0),
          // 列表状态
          Expanded(
            child: _buildBody(),
          ),
        ],
      ),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const Center(
        child: CircularProgressIndicator(
          strokeWidth: 2.0,
          valueColor: AlwaysStoppedAnimation(StitchTokens.primary),
        ),
      );
    }

    if (_error != null) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline_rounded, color: StitchTokens.crimsonStop, size: 36.0),
            const SizedBox(height: 8.0),
            Text(_error!, style: const TextStyle(fontSize: 13.0, color: StitchTokens.crimsonStop)),
            const SizedBox(height: 12.0),
            OutlinedButton(
              onPressed: _loadChunks,
              child: const Text('重试加载'),
            ),
          ],
        ),
      );
    }

    if (_chunks.isEmpty) {
      return const Center(
        child: Text(
          '该文档暂无切片内容',
          style: TextStyle(fontSize: 13.0, color: StitchTokens.outline),
        ),
      );
    }

    return ListView.separated(
      itemCount: _chunks.length,
      separatorBuilder: (_, __) => const SizedBox(height: 12.0),
      itemBuilder: (context, index) {
        final chunk = _chunks[index];
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
                      color: StitchTokens.primary.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(StitchTokens.radiusSm),
                    ),
                    child: Text(
                      '#${chunk.chunkIndex + 1}',
                      style: const TextStyle(
                        fontSize: 11.0,
                        fontWeight: FontWeight.w700,
                        color: StitchTokens.primary,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8.0),
                  Text(
                    '${chunk.charCount} 字符',
                    style: const TextStyle(fontSize: 11.0, color: StitchTokens.outline),
                  ),
                  const Spacer(),
                  IconButton(
                    icon: const Icon(Icons.copy_rounded, size: 16.0, color: StitchTokens.outline),
                    onPressed: () => _copyChunkText(chunk.content),
                    splashRadius: 16.0,
                    tooltip: '复制切片',
                  ),
                ],
              ),
              const SizedBox(height: 8.0),
              SelectableText(
                chunk.content,
                style: const TextStyle(
                  fontSize: 13.0,
                  color: StitchTokens.onSurface,
                  height: 1.5,
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
