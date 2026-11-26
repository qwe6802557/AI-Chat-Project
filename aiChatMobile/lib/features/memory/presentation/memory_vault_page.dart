import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/stitch_tokens.dart';
import '../domain/memory_models.dart';
import '../providers/memory_providers.dart';
import 'widgets/daily_memory_card.dart';

/// 移动端记忆工坊主页面（对齐 PC MemoryVaultDrawer 功能与 Stitch 设计规范）
class MemoryVaultPage extends ConsumerStatefulWidget {
  const MemoryVaultPage({super.key});

  @override
  ConsumerState<MemoryVaultPage> createState() => _MemoryVaultPageState();
}

class _MemoryVaultPageState extends ConsumerState<MemoryVaultPage>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;
  final TextEditingController _summaryController = TextEditingController();
  final TextEditingController _searchController = TextEditingController();
  String _lastSyncedSummary = '';

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _tabController.addListener(() {
      if (mounted) setState(() {});
    });
    Future.microtask(() {
      ref.read(memoryVaultProvider.notifier).loadAll();
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    _summaryController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  void _showMessage(String text, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(text),
        backgroundColor: isError ? StitchTokens.crimsonStop : StitchTokens.onSurface,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  Future<void> _handleSaveProfile() async {
    final ok = await ref
        .read(memoryVaultProvider.notifier)
        .saveProfileSummary(_summaryController.text);
    if (ok) {
      _lastSyncedSummary = _summaryController.text;
      _showMessage('核心画像已纠偏保存');
    } else {
      final err = ref.read(memoryVaultProvider).errorMessage;
      _showMessage(err ?? '保存失败', isError: true);
    }
  }

  Future<void> _handleDistill() async {
    final ok = await ref.read(memoryVaultProvider.notifier).triggerDistill();
    if (ok) {
      _showMessage('增量蒸馏完成，核心画像已更新');
    } else {
      final err = ref.read(memoryVaultProvider).errorMessage;
      _showMessage(err ?? '增量蒸馏失败', isError: true);
    }
  }

  Future<void> _confirmDeleteMemory(AgentDailyMemoryModel item) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(StitchTokens.radiusXl),
        ),
        title: const Text(
          '彻底遗忘记忆',
          style: TextStyle(fontSize: 16.0, fontWeight: FontWeight.w700),
        ),
        content: Text(
          '确定彻底删除「${item.content}」吗？删除后将不再被对话回忆。',
          style: const TextStyle(fontSize: 13.0),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
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
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('遗忘', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      final ok = await ref.read(memoryVaultProvider.notifier).deleteMemory(item.id);
      if (ok) {
        _showMessage('记忆条目已彻底遗忘');
      }
    }
  }

  Future<void> _showCreateMemorySheet() async {
    MemoryCategory selectedCategory = MemoryCategory.fact;
    final contentController = TextEditingController();

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20.0)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) {
          final isCreating = ref.watch(memoryVaultProvider).isCreatingMemory;
          final bottomInset = MediaQuery.of(ctx).viewInsets.bottom;

          return Padding(
            padding: EdgeInsets.fromLTRB(16.0, 16.0, 16.0, bottomInset + 20.0),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      '手动记录情境记忆',
                      style: TextStyle(
                        fontSize: 16.0,
                        fontWeight: FontWeight.w700,
                        color: StitchTokens.onSurface,
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close_rounded, size: 20.0),
                      onPressed: () => Navigator.of(ctx).pop(),
                    ),
                  ],
                ),
                const SizedBox(height: 8.0),
                Wrap(
                  spacing: 8.0,
                  runSpacing: 6.0,
                  children: MemoryCategory.values.map((cat) {
                    final active = selectedCategory == cat;
                    return ChoiceChip(
                      label: Text('${cat.label} (${cat.code})'),
                      selected: active,
                      selectedColor: StitchTokens.onSurface,
                      labelStyle: TextStyle(
                        fontSize: 12.0,
                        color: active ? Colors.white : StitchTokens.onSurfaceVariant,
                      ),
                      onSelected: (_) {
                        setSheetState(() => selectedCategory = cat);
                      },
                    );
                  }).toList(),
                ),
                const SizedBox(height: 12.0),
                TextField(
                  controller: contentController,
                  maxLines: 3,
                  maxLength: 1000,
                  decoration: InputDecoration(
                    hintText: '输入需要长期记住的事实、偏好、技术决策或待办...',
                    hintStyle: const TextStyle(fontSize: 13.0),
                    filled: true,
                    fillColor: StitchTokens.surfaceContainerLow,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(StitchTokens.radiusLg),
                      borderSide: const BorderSide(color: StitchTokens.surfaceVariant),
                    ),
                  ),
                ),
                const SizedBox(height: 10.0),
                SizedBox(
                  width: double.infinity,
                  height: 44.0,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: StitchTokens.primary,
                      foregroundColor: Colors.white,
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(StitchTokens.radiusLg),
                      ),
                    ),
                    onPressed: isCreating
                        ? null
                        : () async {
                            final text = contentController.text.trim();
                            if (text.length < 2) {
                              _showMessage('记忆内容至少需要 2 个字符', isError: true);
                              return;
                            }
                            final result = await ref
                                .read(memoryVaultProvider.notifier)
                                .createMemory(
                                  category: selectedCategory,
                                  content: text,
                                );
                            if (ctx.mounted && result != null) {
                              Navigator.of(ctx).pop();
                              _showMessage(
                                result.isMerged
                                    ? '已与高度相似记忆合并更新'
                                    : '已保存新记忆',
                              );
                            }
                          },
                    child: Text(isCreating ? '向量化入库中...' : '保存记忆'),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
    contentController.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(memoryVaultProvider);
    final profileSummary = state.profile?.rawSummary ?? '';
    if (profileSummary != _lastSyncedSummary && !state.isSavingProfile) {
      _lastSyncedSummary = profileSummary;
      _summaryController.text = profileSummary;
    }

    return Scaffold(
      backgroundColor: StitchTokens.background,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0.5,
        leading: IconButton(
          icon: const Icon(
            Icons.arrow_back_ios_new_rounded,
            size: 18.0,
            color: StitchTokens.onSurface,
          ),
          onPressed: () {
            if (context.canPop()) {
              context.pop();
            } else {
              context.go('/chat');
            }
          },
        ),
        title: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              '记忆工坊',
              style: TextStyle(
                fontSize: 17.0,
                fontWeight: FontWeight.w700,
                color: StitchTokens.onSurface,
              ),
            ),
            if (state.profile != null) ...[
              const SizedBox(width: 6.0),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6.0, vertical: 2.0),
                decoration: BoxDecoration(
                  color: const Color(0xFFE0F2FE),
                  borderRadius: BorderRadius.circular(StitchTokens.radiusSm),
                ),
                child: Text(
                  'v${state.profile!.version}',
                  style: const TextStyle(
                    fontFamily: 'monospace',
                    fontSize: 10.5,
                    fontWeight: FontWeight.w600,
                    color: StitchTokens.primary,
                  ),
                ),
              ),
            ],
          ],
        ),
        centerTitle: true,
        actions: [
          TextButton.icon(
            onPressed: state.isDistilling ? null : _handleDistill,
            icon: state.isDistilling
                ? const SizedBox(
                    width: 14.0,
                    height: 14.0,
                    child: CircularProgressIndicator(strokeWidth: 2.0),
                  )
                : const Icon(Icons.auto_awesome_rounded, size: 16.0),
            label: Text(
              state.isDistilling ? '蒸馏中' : '蒸馏',
              style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600),
            ),
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          labelColor: StitchTokens.onSurface,
          unselectedLabelColor: StitchTokens.outline,
          indicatorColor: StitchTokens.primary,
          tabs: [
            const Tab(text: '核心画像 (Layer 3)'),
            Tab(text: '每日情境 (${state.dailyTotal})'),
          ],
        ),
      ),
      floatingActionButton: _tabController.index == 1
          ? FloatingActionButton.extended(
              backgroundColor: StitchTokens.onSurface,
              foregroundColor: Colors.white,
              onPressed: _showCreateMemorySheet,
              icon: const Icon(Icons.add_rounded, size: 18.0),
              label: const Text('记一条', style: TextStyle(fontSize: 13.0)),
            )
          : null,
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildProfileTab(state),
          _buildDailyTab(state),
        ],
      ),
    );
  }

  Widget _buildProfileTab(MemoryVaultState state) {
    if (state.profileLoading && state.profile == null) {
      return const Center(child: CircularProgressIndicator());
    }

    final profile = state.profile;
    return RefreshIndicator(
      color: StitchTokens.primary,
      onRefresh: () => ref.read(memoryVaultProvider.notifier).loadProfile(),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16.0, 16.0, 16.0, 40.0),
        children: [
          Container(
            padding: const EdgeInsets.all(14.0),
            decoration: BoxDecoration(
              color: StitchTokens.surfaceContainerLowest,
              borderRadius: BorderRadius.circular(StitchTokens.radiusXl),
              border: Border.all(color: StitchTokens.surfaceVariant),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  '核心画像与工作态势摘要',
                  style: TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w700,
                    color: StitchTokens.onSurface,
                  ),
                ),
                const SizedBox(height: 4.0),
                const Text(
                  'AI 依据日常交互持续蒸馏的长期用户设定，支持直接纠偏。',
                  style: TextStyle(fontSize: 11.5, color: StitchTokens.outline),
                ),
                const SizedBox(height: 10.0),
                TextField(
                  controller: _summaryController,
                  maxLines: 5,
                  style: const TextStyle(
                    fontFamily: 'monospace',
                    fontSize: 12.0,
                    height: 1.5,
                  ),
                  decoration: InputDecoration(
                    hintText: '暂无核心画像摘要，可在此处补充或纠偏...',
                    filled: true,
                    fillColor: StitchTokens.surfaceContainerLow,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(StitchTokens.radiusMd),
                      borderSide: const BorderSide(color: StitchTokens.surfaceVariant),
                    ),
                  ),
                ),
                const SizedBox(height: 10.0),
                Align(
                  alignment: Alignment.centerRight,
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: StitchTokens.onSurface,
                      foregroundColor: Colors.white,
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(StitchTokens.radiusMd),
                      ),
                    ),
                    onPressed: state.isSavingProfile ? null : _handleSaveProfile,
                    icon: const Icon(Icons.check_rounded, size: 16.0),
                    label: Text(state.isSavingProfile ? '保存中...' : '保存纠偏'),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12.0),
          _buildKeyValueSection('固化偏好与行为规约 (Preferences)', profile?.preferences),
          const SizedBox(height: 12.0),
          _buildKeyValueSection('已确认事实库 (Facts)', profile?.facts),
        ],
      ),
    );
  }

  Widget _buildKeyValueSection(String title, Map<String, dynamic>? data) {
    final entries = data?.entries.toList() ?? const [];
    return Container(
      padding: const EdgeInsets.all(14.0),
      decoration: BoxDecoration(
        color: StitchTokens.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(StitchTokens.radiusXl),
        border: Border.all(color: StitchTokens.surfaceVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              fontSize: 13.0,
              fontWeight: FontWeight.w700,
              color: StitchTokens.onSurface,
            ),
          ),
          const SizedBox(height: 8.0),
          if (entries.isEmpty)
            const Text(
              '暂无条目',
              style: TextStyle(fontSize: 12.0, color: StitchTokens.outline),
            )
          else
            ...entries.map(
              (entry) => Padding(
                padding: const EdgeInsets.only(bottom: 8.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      entry.key,
                      style: const TextStyle(
                        fontFamily: 'monospace',
                        fontSize: 11.0,
                        fontWeight: FontWeight.w600,
                        color: StitchTokens.outline,
                      ),
                    ),
                    const SizedBox(height: 2.0),
                    Text(
                      entry.value.toString(),
                      style: const TextStyle(
                        fontSize: 12.5,
                        color: StitchTokens.onSurface,
                      ),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildDailyTab(MemoryVaultState state) {
    return Column(
      children: [
        Container(
          color: Colors.white,
          padding: const EdgeInsets.fromLTRB(16.0, 12.0, 16.0, 10.0),
          child: Column(
            children: [
              TextField(
                controller: _searchController,
                onChanged: (value) {
                  setState(() {});
                  ref.read(memoryVaultProvider.notifier).setSearchKeyword(value);
                },
                onSubmitted: (value) {
                  ref.read(memoryVaultProvider.notifier).searchImmediately(value);
                },
                decoration: InputDecoration(
                  hintText: '语义搜索历史记忆（支持自然语言与关键词）',
                  hintStyle: const TextStyle(fontSize: 12.5, color: StitchTokens.outline),
                  prefixIcon: const Icon(Icons.search_rounded, size: 18.0),
                  suffixIcon: _searchController.text.isNotEmpty
                      ? IconButton(
                          icon: const Icon(Icons.close_rounded, size: 16.0),
                          onPressed: () {
                            _searchController.clear();
                            setState(() {});
                            ref
                                .read(memoryVaultProvider.notifier)
                                .searchImmediately('');
                          },
                        )
                      : null,
                  isDense: true,
                  filled: true,
                  fillColor: StitchTokens.surfaceContainerLow,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(StitchTokens.radiusLg),
                    borderSide: BorderSide.none,
                  ),
                ),
              ),
              const SizedBox(height: 10.0),
              SizedBox(
                height: 32.0,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  children: [
                    _buildCategoryChip(label: '全部', code: null, current: state.selectedCategory),
                    ...MemoryCategory.values.map(
                      (cat) => _buildCategoryChip(
                        label: '${cat.label} (${cat.code})',
                        code: cat.code,
                        current: state.selectedCategory,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: RefreshIndicator(
            color: StitchTokens.primary,
            onRefresh: () =>
                ref.read(memoryVaultProvider.notifier).loadDailyMemories(),
            child: state.dailyLoading && state.dailyItems.isEmpty
                ? const Center(child: CircularProgressIndicator())
                : state.dailyItems.isEmpty
                    ? ListView(
                        padding: const EdgeInsets.only(top: 80.0, left: 24.0, right: 24.0),
                        children: [
                          Center(
                            child: Text(
                              state.searchKeyword.trim().isNotEmpty
                                  ? '未检索到匹配记忆，点击右下角「记一条」可手动补充'
                                  : '暂无情境记忆，可在对话后自动提炼或点击「记一条」手动录入',
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                fontSize: 13.0,
                                color: StitchTokens.outline,
                              ),
                            ),
                          ),
                        ],
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.fromLTRB(16.0, 12.0, 16.0, 88.0),
                        itemCount: state.dailyItems.length,
                        itemBuilder: (context, index) {
                          final item = state.dailyItems[index];
                          return DailyMemoryCard(
                            item: item,
                            showScore: state.searchKeyword.trim().isNotEmpty,
                            onDelete: () => _confirmDeleteMemory(item),
                          );
                        },
                      ),
          ),
        ),
      ],
    );
  }

  Widget _buildCategoryChip({
    required String label,
    required String? code,
    required String? current,
  }) {
    final active = (code ?? '') == (current ?? '');
    return Padding(
      padding: const EdgeInsets.only(right: 6.0),
      child: ChoiceChip(
        label: Text(label),
        selected: active,
        selectedColor: StitchTokens.onSurface,
        backgroundColor: StitchTokens.surfaceContainerLow,
        labelStyle: TextStyle(
          fontSize: 11.5,
          color: active ? Colors.white : StitchTokens.onSurfaceVariant,
        ),
        onSelected: (_) => ref.read(memoryVaultProvider.notifier).setCategory(code),
      ),
    );
  }
}
