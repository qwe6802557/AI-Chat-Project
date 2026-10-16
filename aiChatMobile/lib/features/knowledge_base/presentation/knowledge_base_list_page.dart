import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/stitch_tokens.dart';
import '../domain/knowledge_base_model.dart';
import '../providers/knowledge_base_providers.dart';
import 'widgets/create_kb_modal.dart';
import 'widgets/knowledge_base_card.dart';

/// 移动端知识库资产中心主页面
class KnowledgeBaseListPage extends ConsumerWidget {
  const KnowledgeBaseListPage({super.key});

  void _showCreateModal(BuildContext context, WidgetRef ref) {
    CreateKbModal.show(
      context,
      onSubmit: ({required name, required description, required avatar}) async {
        await ref.read(knowledgeBasesProvider.notifier).createKnowledgeBase(
          name: name,
          description: description,
          avatar: avatar,
        );
      },
    );
  }

  void _showEditModal(BuildContext context, WidgetRef ref, KnowledgeBaseModel kb) {
    CreateKbModal.show(
      context,
      initialKb: kb,
      onSubmit: ({required name, required description, required avatar}) async {
        await ref.read(knowledgeBasesProvider.notifier).updateKnowledgeBase(
          kb.id,
          name: name,
          description: description,
          avatar: avatar,
        );
      },
    );
  }

  void _confirmDelete(BuildContext context, WidgetRef ref, KnowledgeBaseModel kb) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(StitchTokens.radiusXl),
        ),
        title: const Text('删除知识库', style: TextStyle(fontSize: 16.0, fontWeight: FontWeight.w700)),
        content: Text('确定要删除「${kb.name}」吗？此操作将永久清空该知识库下的全部文档切片。', style: const TextStyle(fontSize: 13.0)),
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
              await ref.read(knowledgeBasesProvider.notifier).deleteKnowledgeBase(kb.id);
            },
            child: const Text('确认删除', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final kbAsync = ref.watch(knowledgeBasesProvider);

    return Scaffold(
      backgroundColor: StitchTokens.background,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0.5,
        title: const Text(
          '知识大脑中心',
          style: TextStyle(
            fontSize: 17.0,
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
              context.go('/chat');
            }
          },
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.add_rounded, color: StitchTokens.primary, size: 24.0),
            tooltip: '新建知识库',
            onPressed: () => _showCreateModal(context, ref),
          ),
        ],
      ),
      body: RefreshIndicator(
        color: StitchTokens.primary,
        onRefresh: () => ref.read(knowledgeBasesProvider.notifier).refresh(),
        child: kbAsync.when(
          loading: () => _buildSkeletonView(),
          error: (err, _) => _buildErrorView(err, ref),
          data: (list) {
            if (list.isEmpty) {
              return _buildEmptyView(context, ref);
            }
            return _buildListView(context, ref, list);
          },
        ),
      ),
    );
  }

  Widget _buildListView(BuildContext context, WidgetRef ref, List<KnowledgeBaseModel> list) {
    // 统计总指标
    final totalDocs = list.fold<int>(0, (sum, item) => sum + item.documentCount);
    final totalChunks = list.fold<int>(0, (sum, item) => sum + item.chunkCount);

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16.0, 16.0, 16.0, 40.0),
      children: [
        // 顶部统计胶囊看板
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 14.0),
          decoration: BoxDecoration(
            color: StitchTokens.surfaceContainerLowest,
            borderRadius: BorderRadius.circular(StitchTokens.radiusXl),
            border: Border.all(
              color: StitchTokens.outlineVariant.withValues(alpha: 0.4),
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _buildStatItem('知识库', '${list.length}'),
              _buildDivider(),
              _buildStatItem('入库文档', '$totalDocs'),
              _buildDivider(),
              _buildStatItem('知识切片', '$totalChunks'),
            ],
          ),
        ),
        const SizedBox(height: 16.0),
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 4.0, vertical: 4.0),
          child: Text(
            '全部知识资产',
            style: TextStyle(
              fontSize: 13.0,
              fontWeight: FontWeight.w600,
              color: StitchTokens.outline,
            ),
          ),
        ),
        const SizedBox(height: 8.0),
        // 卡片流
        ...list.map(
          (kb) => Padding(
            padding: const EdgeInsets.only(bottom: 12.0),
            child: KnowledgeBaseCard(
              knowledgeBase: kb,
              onTap: () => context.push('/knowledge-base/${kb.id}'),
              onEdit: () => _showEditModal(context, ref, kb),
              onDelete: () => _confirmDelete(context, ref, kb),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildStatItem(String label, String value) {
    return Column(
      children: [
        Text(
          value,
          style: const TextStyle(
            fontSize: 18.0,
            fontWeight: FontWeight.w700,
            color: StitchTokens.onSurface,
          ),
        ),
        const SizedBox(height: 2.0),
        Text(
          label,
          style: const TextStyle(
            fontSize: 11.0,
            color: StitchTokens.outline,
          ),
        ),
      ],
    );
  }

  Widget _buildDivider() {
    return Container(
      width: 1.0,
      height: 24.0,
      color: StitchTokens.outlineVariant.withValues(alpha: 0.4),
    );
  }

  Widget _buildSkeletonView() {
    return ListView.separated(
      padding: const EdgeInsets.all(16.0),
      itemCount: 4,
      separatorBuilder: (_, __) => const SizedBox(height: 12.0),
      itemBuilder: (_, __) => Container(
        height: 110.0,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(StitchTokens.radiusXl),
          border: Border.all(color: StitchTokens.surfaceVariant),
        ),
      ),
    );
  }

  Widget _buildErrorView(Object error, WidgetRef ref) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.cloud_off_rounded, size: 48.0, color: StitchTokens.outline),
          const SizedBox(height: 12.0),
          Text('加载知识库失败: $error', style: const TextStyle(fontSize: 13.0, color: StitchTokens.outline)),
          const SizedBox(height: 16.0),
          ElevatedButton(
            onPressed: () => ref.read(knowledgeBasesProvider.notifier).refresh(),
            child: const Text('点击重试'),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyView(BuildContext context, WidgetRef ref) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32.0),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 64.0,
              height: 64.0,
              decoration: BoxDecoration(
                color: StitchTokens.primary.withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.auto_stories_outlined,
                size: 32.0,
                color: StitchTokens.primary,
              ),
            ),
            const SizedBox(height: 16.0),
            const Text(
              '暂无知识库资产',
              style: TextStyle(
                fontSize: 16.0,
                fontWeight: FontWeight.w600,
                color: StitchTokens.onSurface,
              ),
            ),
            const SizedBox(height: 6.0),
            const Text(
              '创建您的专属知识库，上传技术文档、白皮书或知识切片，赋能移动端精准 RAG 语义问答',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 12.0,
                color: StitchTokens.outline,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 20.0),
            ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: StitchTokens.primary,
                padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 12.0),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(StitchTokens.radiusMd),
                ),
              ),
              icon: const Icon(Icons.add_rounded, size: 18.0, color: Colors.white),
              label: const Text('创建第一个知识库', style: TextStyle(color: Colors.white)),
              onPressed: () => _showCreateModal(context, ref),
            ),
          ],
        ),
      ),
    );
  }
}
