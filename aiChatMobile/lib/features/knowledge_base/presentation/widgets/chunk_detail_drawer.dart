import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/stitch_tokens.dart';
import '../../data/knowledge_base_repository.dart';
import '../../domain/chunk_model.dart';
import '../../domain/document_model.dart';
import 'highlighted_chunk_text.dart';

/// 知识库切片明细审阅与命中上下文抽屉
class ChunkDetailDrawer extends ConsumerStatefulWidget {
  final DocumentModel? document;
  final String? initialChunkId;
  final String? initialDocumentTitle;
  final List<HighlightSpan> initialHighlights;
  final String? searchQuery;

  const ChunkDetailDrawer({
    super.key,
    this.document,
    this.initialChunkId,
    this.initialDocumentTitle,
    this.initialHighlights = const [],
    this.searchQuery,
  });

  /// 从文档列表进入：分页审阅与治理切片
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

  /// 从检索评测命中卡片进入：直达上下文邻接窗预览
  static Future<void> showHitContext(
    BuildContext context, {
    required String chunkId,
    String? documentTitle,
    List<HighlightSpan> highlights = const [],
    String? query,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useRootNavigator: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => ChunkDetailDrawer(
        initialChunkId: chunkId,
        initialDocumentTitle: documentTitle,
        initialHighlights: highlights,
        searchQuery: query,
      ),
    );
  }

  @override
  ConsumerState<ChunkDetailDrawer> createState() => _ChunkDetailDrawerState();
}

class _ChunkDetailDrawerState extends ConsumerState<ChunkDetailDrawer> {
  static const int _pageSize = 20;

  late bool _isContextMode;
  bool _loading = true;
  String? _error;

  // 上下文预览态
  ChunkContextModel? _contextModel;
  int _contextWindow = 1;

  // 文档全量切片浏览态
  String? _activeDocId;
  String _activeDocTitle = '';
  int _docChunkCount = 0;
  int _docCharCount = 0;
  List<ChunkModel> _chunks = [];
  int _totalChunks = 0;
  int _page = 1;
  bool _loadingMore = false;
  bool _enabledOnly = false;
  String _keyword = '';
  final TextEditingController _keywordController = TextEditingController();
  Timer? _debounceTimer;

  String? _updatingChunkId;

  @override
  void initState() {
    super.initState();
    _isContextMode = widget.initialChunkId != null;
    if (_isContextMode) {
      _activeDocTitle = widget.initialDocumentTitle ?? '命中切片上下文';
      _loadContext();
    } else if (widget.document != null) {
      _activeDocId = widget.document!.id;
      _activeDocTitle = widget.document!.title;
      _docChunkCount = widget.document!.chunkCount;
      _docCharCount = widget.document!.charCount;
      _loadDocChunks(reset: true);
    } else {
      _loading = false;
      _error = '未指定文档或切片标识';
    }
  }

  @override
  void dispose() {
    _debounceTimer?.cancel();
    _keywordController.dispose();
    super.dispose();
  }

  Future<void> _loadContext() async {
    final chunkId = widget.initialChunkId;
    if (chunkId == null) return;

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final repo = ref.read(knowledgeBaseRepositoryProvider);
      final ctxModel = await repo.getChunkContext(chunkId, window: _contextWindow);
      if (mounted) {
        setState(() {
          _contextModel = ctxModel;
          _activeDocId = ctxModel.document.id;
          _activeDocTitle = ctxModel.document.title;
          _docChunkCount = ctxModel.document.chunkCount;
          _docCharCount = ctxModel.document.charCount;
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

  Future<void> _loadDocChunks({required bool reset}) async {
    final docId = _activeDocId;
    if (docId == null) return;

    if (reset) {
      setState(() {
        _page = 1;
        _loading = true;
        _error = null;
      });
    } else {
      setState(() {
        _loadingMore = true;
      });
    }

    try {
      final repo = ref.read(knowledgeBaseRepositoryProvider);
      final paged = await repo.getChunksPaged(
        docId,
        page: _page,
        pageSize: _pageSize,
        keyword: _keyword,
        enabledOnly: _enabledOnly,
      );
      if (mounted) {
        setState(() {
          if (reset) {
            _chunks = paged.items;
          } else {
            _chunks = [..._chunks, ...paged.items];
          }
          _totalChunks = paged.total;
          _loading = false;
          _loadingMore = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString().replaceAll('Exception:', '').trim();
          _loading = false;
          _loadingMore = false;
        });
      }
    }
  }

  void _onKeywordChanged(String val) {
    _debounceTimer?.cancel();
    _debounceTimer = Timer(const Duration(milliseconds: 350), () {
      _keyword = val.trim();
      _loadDocChunks(reset: true);
    });
  }

  void _switchToDocumentMode() {
    setState(() {
      _isContextMode = false;
    });
    _loadDocChunks(reset: true);
  }

  void _expandContextWindow() {
    if (_contextWindow >= 5) return;
    _contextWindow += 1;
    _loadContext();
  }

  void _syncUpdatedChunk(ChunkModel updated) {
    _chunks = _chunks.map((c) => c.id == updated.id ? updated : c).toList();
    if (_contextModel != null) {
      final cm = _contextModel!;
      _contextModel = ChunkContextModel(
        document: cm.document,
        targetChunk: cm.targetChunk.id == updated.id ? updated : cm.targetChunk,
        prevChunks: cm.prevChunks.map((c) => c.id == updated.id ? updated : c).toList(),
        nextChunks: cm.nextChunks.map((c) => c.id == updated.id ? updated : c).toList(),
        window: cm.window,
      );
    }
  }

  Future<void> _toggleChunkEnabled(ChunkModel chunk) async {
    setState(() => _updatingChunkId = chunk.id);
    try {
      final repo = ref.read(knowledgeBaseRepositoryProvider);
      final updated = await repo.updateChunk(chunk.id, isEnabled: !chunk.isEnabled);
      if (mounted) {
        setState(() {
          _syncUpdatedChunk(updated);
          _updatingChunkId = null;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(updated.isEnabled ? '切片已恢复参与召回' : '切片已停用'),
            duration: const Duration(seconds: 2),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _updatingChunkId = null);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('更新失败: $e')),
        );
      }
    }
  }

  Future<void> _showEditDialog(ChunkModel chunk) async {
    final controller = TextEditingController(text: chunk.content);
    final newContent = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(StitchTokens.radiusXl),
        ),
        title: Text(
          '编辑切片 #${chunk.chunkIndex + 1}',
          style: const TextStyle(fontSize: 16.0, fontWeight: FontWeight.w700),
        ),
        content: TextField(
          controller: controller,
          maxLines: 7,
          minLines: 4,
          decoration: InputDecoration(
            hintText: '修改切片正文后将自动重算向量...',
            filled: true,
            fillColor: StitchTokens.surfaceContainerLow,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(StitchTokens.radiusMd),
              borderSide: BorderSide.none,
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('取消', style: TextStyle(color: StitchTokens.outline)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: StitchTokens.primary,
              elevation: 0,
            ),
            onPressed: () {
              final text = controller.text.trim();
              if (text.isNotEmpty) {
                Navigator.of(ctx).pop(text);
              }
            },
            child: const Text('保存重算', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
    controller.dispose();

    if (newContent == null || newContent == chunk.content) return;

    setState(() => _updatingChunkId = chunk.id);
    try {
      final repo = ref.read(knowledgeBaseRepositoryProvider);
      final updated = await repo.updateChunk(chunk.id, content: newContent);
      if (mounted) {
        setState(() {
          _syncUpdatedChunk(updated);
          _updatingChunkId = null;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('切片已更新并重新计算语义向量'),
            duration: Duration(seconds: 2),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _updatingChunkId = null);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('保存失败: $e')),
        );
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
        MediaQuery.of(context).padding.bottom + 16.0,
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
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _activeDocTitle,
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
                      _isContextMode
                          ? '命中上下文预览 · 窗口 ±$_contextWindow 段'
                          : '共 $_docChunkCount 个切片 · $_docCharCount 字符',
                      style: const TextStyle(
                        fontSize: 12.0,
                        color: StitchTokens.outline,
                      ),
                    ),
                  ],
                ),
              ),
              if (_isContextMode && _activeDocId != null)
                TextButton(
                  onPressed: _switchToDocumentMode,
                  child: const Text('整篇切片', style: TextStyle(fontSize: 12.0)),
                ),
              if (!_isContextMode && _contextModel != null)
                TextButton(
                  onPressed: () => setState(() => _isContextMode = true),
                  child: const Text('返回上下文', style: TextStyle(fontSize: 12.0)),
                ),
              IconButton(
                icon: const Icon(Icons.close_rounded, size: 20.0, color: StitchTokens.outline),
                onPressed: () => Navigator.of(context).pop(),
                splashRadius: 20.0,
              ),
            ],
          ),
          if (!_isContextMode) ...[
            const SizedBox(height: 10.0),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _keywordController,
                    onChanged: _onKeywordChanged,
                    decoration: InputDecoration(
                      hintText: '输入关键词筛选切片...',
                      hintStyle: const TextStyle(fontSize: 12.5, color: StitchTokens.outline),
                      prefixIcon: const Icon(Icons.search_rounded, size: 18.0, color: StitchTokens.outline),
                      filled: true,
                      fillColor: StitchTokens.surfaceContainerLow,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12.0, vertical: 8.0),
                      isDense: true,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(StitchTokens.radiusMd),
                        borderSide: BorderSide.none,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8.0),
                FilterChip(
                  label: const Text('仅启用', style: TextStyle(fontSize: 11.5)),
                  selected: _enabledOnly,
                  onSelected: (selected) {
                    setState(() => _enabledOnly = selected);
                    _loadDocChunks(reset: true);
                  },
                ),
              ],
            ),
          ],
          const SizedBox(height: 10.0),
          const Divider(height: 1.0, color: StitchTokens.surfaceVariant),
          const SizedBox(height: 10.0),
          Expanded(
            child: _isContextMode ? _buildContextBody() : _buildDocumentBody(),
          ),
        ],
      ),
    );
  }

  Widget _buildContextBody() {
    if (_loading) {
      return const Center(
        child: CircularProgressIndicator(
          strokeWidth: 2.0,
          valueColor: AlwaysStoppedAnimation(StitchTokens.primary),
        ),
      );
    }

    if (_error != null) {
      return _buildErrorRetry(_loadContext);
    }

    final ctx = _contextModel;
    if (ctx == null) {
      return const Center(child: Text('未找到目标切片上下文'));
    }

    final firstIndex = ctx.prevChunks.isNotEmpty
        ? ctx.prevChunks.first.chunkIndex
        : ctx.targetChunk.chunkIndex;
    final lastIndex = ctx.nextChunks.isNotEmpty
        ? ctx.nextChunks.last.chunkIndex
        : ctx.targetChunk.chunkIndex;
    final canExpand = _contextWindow < 5 &&
        (firstIndex > 0 || lastIndex < ctx.document.chunkCount - 1);

    return ListView(
      children: [
        if (firstIndex > 0 && _contextWindow < 5)
          Padding(
            padding: const EdgeInsets.only(bottom: 10.0),
            child: OutlinedButton.icon(
              onPressed: _expandContextWindow,
              icon: const Icon(Icons.expand_less_rounded, size: 18.0),
              label: const Text('展开上一段上下文', style: TextStyle(fontSize: 12.5)),
            ),
          ),
        ...ctx.prevChunks.map(
          (c) => Padding(
            padding: const EdgeInsets.only(bottom: 10.0),
            child: _buildChunkCard(c, roleLabel: '上文'),
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(bottom: 10.0),
          child: _buildChunkCard(
            ctx.targetChunk,
            isTarget: true,
            roleLabel: '命中',
            highlights: widget.initialHighlights,
          ),
        ),
        ...ctx.nextChunks.map(
          (c) => Padding(
            padding: const EdgeInsets.only(bottom: 10.0),
            child: _buildChunkCard(c, roleLabel: '下文'),
          ),
        ),
        if (canExpand && lastIndex < ctx.document.chunkCount - 1)
          OutlinedButton.icon(
            onPressed: _expandContextWindow,
            icon: const Icon(Icons.expand_more_rounded, size: 18.0),
            label: const Text('展开下一段上下文', style: TextStyle(fontSize: 12.5)),
          ),
      ],
    );
  }

  Widget _buildDocumentBody() {
    if (_loading) {
      return const Center(
        child: CircularProgressIndicator(
          strokeWidth: 2.0,
          valueColor: AlwaysStoppedAnimation(StitchTokens.primary),
        ),
      );
    }

    if (_error != null) {
      return _buildErrorRetry(() => _loadDocChunks(reset: true));
    }

    if (_chunks.isEmpty) {
      return const Center(
        child: Text(
          '暂无符合条件的切片内容',
          style: TextStyle(fontSize: 13.0, color: StitchTokens.outline),
        ),
      );
    }

    final hasMore = _chunks.length < _totalChunks;

    return ListView.separated(
      itemCount: _chunks.length + (hasMore ? 1 : 0),
      separatorBuilder: (_, __) => const SizedBox(height: 12.0),
      itemBuilder: (context, index) {
        if (index == _chunks.length) {
          return Center(
            child: OutlinedButton(
              onPressed: _loadingMore
                  ? null
                  : () {
                      _page += 1;
                      _loadDocChunks(reset: false);
                    },
              child: _loadingMore
                  ? const SizedBox(
                      width: 16.0,
                      height: 16.0,
                      child: CircularProgressIndicator(strokeWidth: 2.0),
                    )
                  : Text('加载更多 (${_chunks.length} / $_totalChunks)'),
            ),
          );
        }

        final chunk = _chunks[index];
        final isTarget = chunk.id == widget.initialChunkId;
        return _buildChunkCard(
          chunk,
          isTarget: isTarget,
          highlights: isTarget ? widget.initialHighlights : const [],
        );
      },
    );
  }

  Widget _buildErrorRetry(VoidCallback onRetry) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.error_outline_rounded, color: StitchTokens.crimsonStop, size: 36.0),
          const SizedBox(height: 8.0),
          Text(_error!, style: const TextStyle(fontSize: 13.0, color: StitchTokens.crimsonStop)),
          const SizedBox(height: 12.0),
          OutlinedButton(
            onPressed: onRetry,
            child: const Text('重试加载'),
          ),
        ],
      ),
    );
  }

  Widget _buildChunkCard(
    ChunkModel chunk, {
    bool isTarget = false,
    String? roleLabel,
    List<HighlightSpan> highlights = const [],
  }) {
    final isBusy = _updatingChunkId == chunk.id;

    return Opacity(
      opacity: chunk.isEnabled ? 1.0 : 0.56,
      child: Container(
        padding: const EdgeInsets.all(12.0),
        decoration: BoxDecoration(
          color: isTarget ? const Color(0xFFEFF6FF) : StitchTokens.surfaceContainerLow,
          borderRadius: BorderRadius.circular(StitchTokens.radiusMd),
          border: Border.all(
            color: isTarget
                ? StitchTokens.primary
                : StitchTokens.outlineVariant.withValues(alpha: 0.35),
            width: isTarget ? 1.4 : 1.0,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                if (roleLabel != null) ...[
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6.0, vertical: 2.0),
                    decoration: BoxDecoration(
                      color: isTarget ? StitchTokens.primary : const Color(0xFFE2E8F0),
                      borderRadius: BorderRadius.circular(StitchTokens.radiusSm),
                    ),
                    child: Text(
                      roleLabel,
                      style: TextStyle(
                        fontSize: 10.5,
                        fontWeight: FontWeight.w700,
                        color: isTarget ? Colors.white : const Color(0xFF475569),
                      ),
                    ),
                  ),
                  const SizedBox(width: 6.0),
                ],
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
                if (!chunk.isEnabled) ...[
                  const SizedBox(width: 6.0),
                  const Text(
                    '已停用',
                    style: TextStyle(fontSize: 10.5, color: StitchTokens.crimsonStop),
                  ),
                ],
                const Spacer(),
                IconButton(
                  icon: Icon(
                    chunk.isEnabled ? Icons.visibility_rounded : Icons.visibility_off_rounded,
                    size: 16.0,
                    color: chunk.isEnabled ? StitchTokens.playbackEmerald : StitchTokens.outline,
                  ),
                  onPressed: isBusy ? null : () => _toggleChunkEnabled(chunk),
                  tooltip: chunk.isEnabled ? '停用切片' : '启用切片',
                  constraints: const BoxConstraints(),
                  padding: const EdgeInsets.symmetric(horizontal: 6.0),
                ),
                IconButton(
                  icon: const Icon(Icons.edit_outlined, size: 16.0, color: StitchTokens.outline),
                  onPressed: isBusy ? null : () => _showEditDialog(chunk),
                  tooltip: '编辑切片',
                  constraints: const BoxConstraints(),
                  padding: const EdgeInsets.symmetric(horizontal: 6.0),
                ),
                IconButton(
                  icon: const Icon(Icons.copy_rounded, size: 16.0, color: StitchTokens.outline),
                  onPressed: () => _copyChunkText(chunk.content),
                  tooltip: '复制切片',
                  constraints: const BoxConstraints(),
                  padding: const EdgeInsets.only(left: 6.0),
                ),
              ],
            ),
            const SizedBox(height: 8.0),
            HighlightedChunkText(
              content: chunk.content,
              highlights: highlights,
              keyword: widget.searchQuery ?? (_keyword.isNotEmpty ? _keyword : null),
              style: const TextStyle(
                fontSize: 13.0,
                color: StitchTokens.onSurface,
                height: 1.5,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
