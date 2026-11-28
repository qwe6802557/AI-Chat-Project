import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/stitch_tokens.dart';
import '../domain/trace_model.dart';
import '../providers/orchestration_provider.dart';

/// 阶段 4：全链路 Trace 可观测中心页面
class TraceCenterPage extends ConsumerStatefulWidget {
  const TraceCenterPage({super.key});

  @override
  ConsumerState<TraceCenterPage> createState() => _TraceCenterPageState();
}

class _TraceCenterPageState extends ConsumerState<TraceCenterPage> {
  String _selectedSource = '';
  bool _loading = true;
  String? _error;
  TraceStatsSummaryModel _stats = const TraceStatsSummaryModel();
  List<AgentTraceItemModel> _items = const [];

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final repo = ref.read(orchestrationRepositoryProvider);
      final sourceParam = _selectedSource.isEmpty ? null : _selectedSource;
      final results = await Future.wait([
        repo.getTraceStats(source: sourceParam, days: 7),
        repo.getTraceList(source: sourceParam, days: 7, page: 1, pageSize: 30),
      ]);
      if (!mounted) return;
      final stats = results[0] as TraceStatsSummaryModel;
      final listRes = results[1] as ({List<AgentTraceItemModel> items, int total});
      setState(() {
        _stats = stats;
        _items = listRes.items;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString().replaceAll('Exception: ', '');
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: StitchTokens.background,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0.5,
        title: const Text(
          '全链路 Trace 观测',
          style: TextStyle(
            fontSize: 17.0,
            fontWeight: FontWeight.w700,
            color: StitchTokens.onSurface,
          ),
        ),
        actions: [
          IconButton(
            tooltip: '刷新数据',
            onPressed: _loadData,
            icon: const Icon(Icons.refresh_rounded, color: StitchTokens.onSurface),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _loadData,
        child: ListView(
          padding: const EdgeInsets.all(16.0),
          children: [
            _buildKpiRow(),
            const SizedBox(height: 14.0),
            _buildSourceFilterRow(),
            const SizedBox(height: 12.0),
            if (_loading)
              const Padding(
                padding: EdgeInsets.only(top: 48.0),
                child: Center(child: CircularProgressIndicator(strokeWidth: 2.2)),
              )
            else if (_error != null)
              _buildErrorCard()
            else if (_items.isEmpty)
              _buildEmptyCard()
            else
              ..._items.map(_buildTraceCard),
          ],
        ),
      ),
    );
  }

  Widget _buildKpiRow() {
    return Row(
      children: [
        Expanded(
          child: _buildKpiTile(
            label: '7日总链路',
            value: '${_stats.totalTraces}',
            accent: StitchTokens.onSurface,
          ),
        ),
        const SizedBox(width: 8.0),
        Expanded(
          child: _buildKpiTile(
            label: '成功率',
            value: '${_stats.successRate.toStringAsFixed(0)}%',
            accent: StitchTokens.playbackEmerald,
          ),
        ),
        const SizedBox(width: 8.0),
        Expanded(
          child: _buildKpiTile(
            label: 'P95 延迟',
            value: '${_stats.p95DurationMs}ms',
            accent: StitchTokens.primary,
          ),
        ),
      ],
    );
  }

  Widget _buildKpiTile({
    required String label,
    required String value,
    required Color accent,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12.0, vertical: 12.0),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12.0),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(fontSize: 11.0, color: Color(0xFF64748B)),
          ),
          const SizedBox(height: 4.0),
          Text(
            value,
            style: TextStyle(
              fontSize: 17.0,
              fontWeight: FontWeight.w700,
              color: accent,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSourceFilterRow() {
    const filters = [
      (key: '', label: '全部'),
      (key: 'web_chat', label: '对话'),
      (key: 'workflow_chat', label: '工作流对话'),
      (key: 'workflow_debug', label: '调试'),
      (key: 'channel', label: 'IM 通道'),
    ];
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: filters.map((item) {
          final active = _selectedSource == item.key;
          return Padding(
            padding: const EdgeInsets.only(right: 8.0),
            child: ChoiceChip(
              label: Text(item.label),
              selected: active,
              onSelected: (_) {
                setState(() => _selectedSource = item.key);
                _loadData();
              },
              selectedColor: const Color(0xFFEFF6FF),
              backgroundColor: Colors.white,
              side: BorderSide(
                color: active ? StitchTokens.primary : const Color(0xFFE2E8F0),
              ),
              labelStyle: TextStyle(
                fontSize: 12.0,
                fontWeight: active ? FontWeight.w600 : FontWeight.w500,
                color: active ? StitchTokens.primary : const Color(0xFF475569),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildTraceCard(AgentTraceItemModel item) {
    final isFailed = item.status == 'failed';
    final statusColor =
        isFailed ? StitchTokens.crimsonStop : StitchTokens.playbackEmerald;
    final statusBg =
        isFailed ? const Color(0xFFFEF2F2) : const Color(0xFFECFDF5);
    final durationLabel = item.durationMs >= 1000
        ? '${(item.durationMs / 1000).toStringAsFixed(1)}s'
        : '${item.durationMs}ms';

    return Padding(
      padding: const EdgeInsets.only(bottom: 10.0),
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14.0),
        child: InkWell(
          borderRadius: BorderRadius.circular(14.0),
          onTap: () => context.push('/traces/${item.traceId}'),
          child: Container(
            padding: const EdgeInsets.all(14.0),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14.0),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 7.0,
                        vertical: 2.0,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFEFF6FF),
                        borderRadius: BorderRadius.circular(5.0),
                      ),
                      child: Text(
                        '#${item.shortId}',
                        style: const TextStyle(
                          fontSize: 11.0,
                          fontWeight: FontWeight.w600,
                          fontFamily: 'monospace',
                          color: StitchTokens.primary,
                          fontFeatures: [FontFeature.tabularFigures()],
                        ),
                      ),
                    ),
                    const SizedBox(width: 6.0),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6.0,
                        vertical: 2.0,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(5.0),
                      ),
                      child: Text(
                        item.sourceLabel,
                        style: const TextStyle(
                          fontSize: 10.5,
                          color: Color(0xFF475569),
                        ),
                      ),
                    ),
                    const Spacer(),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6.0,
                        vertical: 2.0,
                      ),
                      decoration: BoxDecoration(
                        color: statusBg,
                        borderRadius: BorderRadius.circular(5.0),
                      ),
                      child: Text(
                        isFailed ? '异常' : '完成',
                        style: TextStyle(
                          fontSize: 10.5,
                          fontWeight: FontWeight.w600,
                          color: statusColor,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8.0),
                Text(
                  (item.title != null && item.title!.trim().isNotEmpty)
                      ? item.title!.trim()
                      : '未命名链路追踪任务',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w600,
                    color: StitchTokens.onSurface,
                  ),
                ),
                const SizedBox(height: 8.0),
                Row(
                  children: [
                    Text(
                      durationLabel,
                      style: const TextStyle(
                        fontSize: 11.5,
                        color: Color(0xFF64748B),
                        fontFeatures: [FontFeature.tabularFigures()],
                      ),
                    ),
                    const SizedBox(width: 12.0),
                    Text(
                      '${item.totalTokens} tok',
                      style: const TextStyle(
                        fontSize: 11.5,
                        color: Color(0xFF64748B),
                        fontFeatures: [FontFeature.tabularFigures()],
                      ),
                    ),
                    const Spacer(),
                    const Icon(
                      Icons.chevron_right_rounded,
                      size: 18.0,
                      color: Color(0xFF94A3B8),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildErrorCard() {
    return Container(
      padding: const EdgeInsets.all(16.0),
      decoration: BoxDecoration(
        color: const Color(0xFFFEF2F2),
        borderRadius: BorderRadius.circular(12.0),
        border: Border.all(color: const Color(0xFFFCA5A5)),
      ),
      child: Text(
        '加载 Trace 数据失败: $_error',
        style: const TextStyle(fontSize: 13.0, color: Color(0xFF991B1B)),
      ),
    );
  }

  Widget _buildEmptyCard() {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 40.0, horizontal: 16.0),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14.0),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: const Column(
        children: [
          Icon(Icons.timeline_rounded, size: 32.0, color: Color(0xFF94A3B8)),
          SizedBox(height: 10.0),
          Text(
            '近 7 日暂无匹配的链路记录',
            style: TextStyle(fontSize: 13.5, color: Color(0xFF64748B)),
          ),
        ],
      ),
    );
  }
}
