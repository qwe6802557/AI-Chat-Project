import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:file_picker/file_picker.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/stitch_tokens.dart';
import '../domain/document_model.dart';
import '../domain/knowledge_base_model.dart';
import '../providers/knowledge_base_providers.dart';
import 'widgets/chunk_detail_drawer.dart';
import 'widgets/document_item_tile.dart';
import 'widgets/document_upload_stream_card.dart';
import 'widgets/retrieval_test_modal.dart';

/// 移动端知识库详情与文档投喂工作台
class KnowledgeBaseDetailPage extends ConsumerStatefulWidget {
  final String knowledgeBaseId;

  const KnowledgeBaseDetailPage({
    super.key,
    required this.knowledgeBaseId,
  });

  @override
  ConsumerState<KnowledgeBaseDetailPage> createState() => _KnowledgeBaseDetailPageState();
}

class _KnowledgeBaseDetailPageState extends ConsumerState<KnowledgeBaseDetailPage> {
  Future<void> _pickAndUploadDocument() async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['pdf', 'docx', 'doc', 'md', 'txt'],
        withData: true, // 保障 Web 和内存环境可直接获取 bytes
      );

      if (result == null || result.files.isEmpty) return;
      final file = result.files.first;

      final progressNotifier = ref.read(kbUploadProgressProvider.notifier);
      progressNotifier.state = UploadProgressState(
        fileName: file.name,
        progress: 0.05,
        isUploading: true,
        isProcessing: false,
      );

      final notifier = ref.read(kbDocumentsProvider(widget.knowledgeBaseId).notifier);
      await notifier.uploadDocument(
        fileName: file.name,
        bytes: file.bytes,
        filePath: kIsWeb ? null : file.path,
        onProgress: (p) {
          if (mounted) {
            progressNotifier.state = progressNotifier.state.copyWith(
              progress: p,
              isProcessing: p >= 1.0,
            );
          }
        },
      );

      // 上传并提交处理成功
      if (mounted) {
        progressNotifier.state = const UploadProgressState();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('文档「${file.name}」已提交入库解析'),
            duration: const Duration(seconds: 2),
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(StitchTokens.radiusMd),
            ),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ref.read(kbUploadProgressProvider.notifier).state = UploadProgressState(
          error: '上传失败: ${e.toString().replaceAll('Exception:', '').trim()}',
        );
      }
    }
  }

  void _confirmDeleteDocument(DocumentModel doc) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(StitchTokens.radiusXl),
        ),
        title: const Text('删除文档', style: TextStyle(fontSize: 16.0, fontWeight: FontWeight.w700)),
        content: Text('确定要删除文档「${doc.title}」及其全部切片吗？', style: const TextStyle(fontSize: 13.0)),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('取消', style: TextStyle(color: StitchTokens.outline)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: StitchTokens.crimsonStop,
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(StitchTokens.radiusMd),
              ),
            ),
            onPressed: () async {
              Navigator.of(ctx).pop();
              await ref.read(kbDocumentsProvider(widget.knowledgeBaseId).notifier).deleteDocument(doc.id);
            },
            child: const Text('确认删除', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final kbListAsync = ref.watch(knowledgeBasesProvider);
    final KnowledgeBaseModel? kb = kbListAsync.valueOrNull?.firstWhere(
      (k) => k.id == widget.knowledgeBaseId,
      orElse: () => KnowledgeBaseModel(id: widget.knowledgeBaseId, name: '知识库详情'),
    );

    final docsAsync = ref.watch(kbDocumentsProvider(widget.knowledgeBaseId));
    final uploadProgress = ref.watch(kbUploadProgressProvider);

    return Scaffold(
      backgroundColor: StitchTokens.background,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0.5,
        title: Text(
          kb?.name ?? '知识库工作台',
          style: const TextStyle(
            fontSize: 16.0,
            fontWeight: FontWeight.w700,
            color: StitchTokens.onSurface,
          ),
        ),
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 18.0, color: StitchTokens.onSurface),
          onPressed: () {
            if (context.canPop()) {
              context.pop();
            } else {
              context.go('/knowledge-base');
            }
          },
        ),
        actions: [
          TextButton.icon(
            style: TextButton.styleFrom(
              foregroundColor: StitchTokens.primary,
              padding: const EdgeInsets.symmetric(horizontal: 12.0),
            ),
            icon: const Icon(Icons.manage_search_rounded, size: 18.0),
            label: const Text(
              '检索演练',
              style: TextStyle(fontSize: 13.0, fontWeight: FontWeight.w600),
            ),
            onPressed: () {
              RetrievalTestModal.show(
                context,
                knowledgeBaseId: widget.knowledgeBaseId,
                knowledgeBaseName: kb?.name ?? '知识库',
              );
            },
          ),
        ],
      ),
      body: RefreshIndicator(
        color: StitchTokens.primary,
        onRefresh: () => ref.read(kbDocumentsProvider(widget.knowledgeBaseId).notifier).refresh(),
        child: docsAsync.when(
          loading: () => _buildSkeletonView(),
          error: (err, _) => _buildErrorView(err),
          data: (docs) {
            return ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16.0, 16.0, 16.0, 90.0),
              children: [
                // 知识库概览胶囊卡片
                if (kb != null) _buildOverviewCard(kb),
                const SizedBox(height: 16.0),
                // 实时推流上传进度卡片
                if (uploadProgress.isUploading || uploadProgress.error != null)
                  DocumentUploadStreamCard(
                    fileName: uploadProgress.fileName,
                    progress: uploadProgress.progress,
                    isProcessing: uploadProgress.isProcessing,
                    error: uploadProgress.error,
                  ),
                // 文档列表标题
                Row(
                  children: [
                    const Text(
                      '已入库文档',
                      style: TextStyle(
                        fontSize: 13.0,
                        fontWeight: FontWeight.w600,
                        color: StitchTokens.outline,
                      ),
                    ),
                    const SizedBox(width: 6.0),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6.0, vertical: 1.0),
                      decoration: BoxDecoration(
                        color: StitchTokens.surfaceVariant,
                        borderRadius: BorderRadius.circular(StitchTokens.radiusSm),
                      ),
                      child: Text(
                        '${docs.length}',
                        style: const TextStyle(fontSize: 11.0, color: StitchTokens.onSurfaceVariant),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10.0),
                if (docs.isEmpty && !uploadProgress.isUploading)
                  _buildEmptyDocsView()
                else
                  ...docs.map(
                    (doc) => Padding(
                      padding: const EdgeInsets.only(bottom: 10.0),
                      child: DocumentItemTile(
                        document: doc,
                        onTap: () => ChunkDetailDrawer.show(context, document: doc),
                        onDelete: () => _confirmDeleteDocument(doc),
                      ),
                    ),
                  ),
              ],
            );
          },
        ),
      ),
      // 底部悬浮投喂按钮
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: StitchTokens.primary,
        elevation: 3.0,
        icon: const Icon(Icons.file_upload_outlined, color: Colors.white, size: 20.0),
        label: const Text(
          '投喂文档 (PDF/MD/TXT/DOCX)',
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 13.0),
        ),
        onPressed: _pickAndUploadDocument,
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
    );
  }

  Widget _buildOverviewCard(KnowledgeBaseModel kb) {
    return Container(
      padding: const EdgeInsets.all(16.0),
      decoration: BoxDecoration(
        color: StitchTokens.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(StitchTokens.radiusXl),
        border: Border.all(
          color: StitchTokens.outlineVariant.withValues(alpha: 0.4),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 36.0,
                height: 36.0,
                decoration: BoxDecoration(
                  color: StitchTokens.primaryContainer.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(StitchTokens.radiusMd),
                ),
                child: const Icon(Icons.auto_stories_rounded, color: StitchTokens.primary, size: 20.0),
              ),
              const SizedBox(width: 10.0),
              Expanded(
                child: Text(
                  kb.name,
                  style: const TextStyle(
                    fontSize: 16.0,
                    fontWeight: FontWeight.w700,
                    color: StitchTokens.onSurface,
                  ),
                ),
              ),
            ],
          ),
          if (kb.description.isNotEmpty) ...[
            const SizedBox(height: 8.0),
            Text(
              kb.description,
              style: const TextStyle(
                fontSize: 12.0,
                color: StitchTokens.outline,
                height: 1.4,
              ),
            ),
          ],
          const SizedBox(height: 12.0),
          Row(
            children: [
              _buildMetricChip(Icons.description_outlined, '${kb.documentCount} 篇文档'),
              const SizedBox(width: 8.0),
              _buildMetricChip(Icons.layers_outlined, '${kb.chunkCount} 个切片'),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildMetricChip(IconData icon, String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 4.0),
      decoration: BoxDecoration(
        color: StitchTokens.surfaceContainerLow,
        borderRadius: BorderRadius.circular(StitchTokens.radiusSm),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12.0, color: StitchTokens.outline),
          const SizedBox(width: 4.0),
          Text(text, style: const TextStyle(fontSize: 11.0, color: StitchTokens.onSurfaceVariant)),
        ],
      ),
    );
  }

  Widget _buildSkeletonView() {
    return ListView.separated(
      padding: const EdgeInsets.all(16.0),
      itemCount: 4,
      separatorBuilder: (_, __) => const SizedBox(height: 12.0),
      itemBuilder: (_, __) => Container(
        height: 60.0,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(StitchTokens.radiusLg),
          border: Border.all(color: StitchTokens.surfaceVariant),
        ),
      ),
    );
  }

  Widget _buildErrorView(Object error) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.error_outline_rounded, size: 40.0, color: StitchTokens.crimsonStop),
          const SizedBox(height: 10.0),
          Text('加载文档失败: $error', style: const TextStyle(fontSize: 13.0, color: StitchTokens.crimsonStop)),
          const SizedBox(height: 12.0),
          OutlinedButton(
            onPressed: () => ref.read(kbDocumentsProvider(widget.knowledgeBaseId).notifier).refresh(),
            child: const Text('重试'),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyDocsView() {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 40.0, horizontal: 20.0),
      decoration: BoxDecoration(
        color: StitchTokens.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(StitchTokens.radiusXl),
        border: Border.all(
          color: StitchTokens.outlineVariant.withValues(alpha: 0.3),
        ),
      ),
      child: Center(
        child: Column(
          children: [
            Icon(Icons.cloud_upload_outlined, size: 40.0, color: StitchTokens.outline.withValues(alpha: 0.5)),
            const SizedBox(height: 10.0),
            const Text(
              '当前知识库暂无文档',
              style: TextStyle(fontSize: 14.0, fontWeight: FontWeight.w600, color: StitchTokens.onSurface),
            ),
            const SizedBox(height: 4.0),
            const Text(
              '点击下方按钮上传 PDF、DOCX、Markdown 或 TXT 格式文档',
              style: TextStyle(fontSize: 12.0, color: StitchTokens.outline),
            ),
          ],
        ),
      ),
    );
  }
}
