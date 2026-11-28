import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../../core/theme/stitch_tokens.dart';
import '../../domain/trace_model.dart';

/// 阶段 4：移动端 Stitch 原生比例 Gantt Span 瀑布流组件
class TraceSpanWaterfall extends StatefulWidget {
  final List<AgentSpanItemModel> spans;

  const TraceSpanWaterfall({super.key, required this.spans});

  @override
  State<TraceSpanWaterfall> createState() => _TraceSpanWaterfallState();
}

class _TraceSpanWaterfallState extends State<TraceSpanWaterfall> {
  String? _selectedSpanId;

  @override
  void initState() {
    super.initState();
    if (widget.spans.isNotEmpty) {
      _selectedSpanId = widget.spans.first.spanId;
    }
  }

  List<({AgentSpanItemModel span, int depth, double leftPct, double widthPct})>
      _buildFlattenedRows() {
    if (widget.spans.isEmpty) return const [];

    final sorted = List<AgentSpanItemModel>.from(widget.spans)
      ..sort((a, b) => a.startedAt.compareTo(b.startedAt));

    var minStart = sorted.first.startedAt;
    var maxEnd = minStart + math.max(sorted.first.durationMs, 1);
    for (final s in sorted) {
      if (s.startedAt < minStart) minStart = s.startedAt;
      final end = s.startedAt + math.max(s.durationMs, 1);
      if (end > maxEnd) maxEnd = end;
    }
    final totalWindow = math.max(maxEnd - minStart, 1);

    final byParent = <String?, List<AgentSpanItemModel>>{};
    final spanIds = {for (final s in sorted) s.spanId};
    for (final s in sorted) {
      final parentKey =
          (s.parentSpanId != null && spanIds.contains(s.parentSpanId))
              ? s.parentSpanId
              : null;
      byParent.putIfAbsent(parentKey, () => []).add(s);
    }

    final result =
        <({AgentSpanItemModel span, int depth, double leftPct, double widthPct})>[];
    final visited = <String>{};

    void dfs(AgentSpanItemModel node, int depth) {
      if (!visited.add(node.spanId)) return;
      final left = ((node.startedAt - minStart) / totalWindow).clamp(0.0, 0.96);
      final width = (math.max(node.durationMs, 1) / totalWindow).clamp(0.04, 1.0 - left);
      result.add((span: node, depth: depth.clamp(0, 4), leftPct: left, widthPct: width));

      for (final child in byParent[node.spanId] ?? const <AgentSpanItemModel>[]) {
        dfs(child, depth + 1);
      }
    }

    for (final root in byParent[null] ?? const <AgentSpanItemModel>[]) {
      dfs(root, 0);
    }
    for (final s in sorted) {
      if (!visited.contains(s.spanId)) {
        dfs(s, 0);
      }
    }
    return result;
  }

  String _spanTypeTag(String type) {
    switch (type) {
      case 'workflow':
        return 'WF';
      case 'dag_node':
        return 'DAG';
      case 'llm':
        return 'LLM';
      case 'tool':
        return 'TOOL';
      case 'rag':
        return 'RAG';
      case 'memory':
        return 'MEM';
      case 'swarm_handoff':
        return 'SWARM';
      case 'channel_dispatch':
        return 'IM';
      default:
        return type.toUpperCase();
    }
  }

  Color _barColor(AgentSpanItemModel span) {
    if (span.status == 'failed') return StitchTokens.crimsonStop;
    if (span.status == 'skipped') return const Color(0xFF94A3B8);
    switch (span.spanType) {
      case 'rag':
        return const Color(0xFF0D9488);
      case 'tool':
        return const Color(0xFFD97706);
      case 'swarm_handoff':
        return const Color(0xFF4F46E5);
      case 'channel_dispatch':
        return StitchTokens.playbackEmerald;
      default:
        return StitchTokens.primary;
    }
  }

  @override
  Widget build(BuildContext context) {
    final rows = _buildFlattenedRows();
    if (rows.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(24.0),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14.0),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: const Center(
          child: Text(
            '该链路暂无 Span 时序明细',
            style: TextStyle(fontSize: 13.0, color: Color(0xFF64748B)),
          ),
        ),
      );
    }

    AgentSpanItemModel? selectedSpan;
    for (final r in rows) {
      if (r.span.spanId == _selectedSpanId) {
        selectedSpan = r.span;
        break;
      }
    }
    selectedSpan ??= rows.first.span;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14.0),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Column(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12.0,
                  vertical: 9.0,
                ),
                decoration: const BoxDecoration(
                  color: Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.vertical(top: Radius.circular(14.0)),
                  border: Border(bottom: BorderSide(color: Color(0xFFE2E8F0))),
                ),
                child: const Row(
                  children: [
                    Text(
                      'Span 调用瀑布流',
                      style: TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                        color: StitchTokens.onSurface,
                      ),
                    ),
                    Spacer(),
                    Text(
                      '点击节点查看脱敏 I/O',
                      style: TextStyle(
                        fontSize: 11.0,
                        color: Color(0xFF64748B),
                      ),
                    ),
                  ],
                ),
              ),
              ...rows.map((row) {
                final isSelected = row.span.spanId == selectedSpan?.spanId;
                final barColor = _barColor(row.span);
                return Material(
                  color: isSelected ? const Color(0xFFEFF6FF) : Colors.white,
                  child: InkWell(
                    onTap: () => setState(() => _selectedSpanId = row.span.spanId),
                    child: Container(
                      padding: EdgeInsets.fromLTRB(
                        12.0 + row.depth * 14.0,
                        10.0,
                        12.0,
                        10.0,
                      ),
                      decoration: const BoxDecoration(
                        border: Border(
                          bottom: BorderSide(color: Color(0xFFF1F5F9)),
                        ),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 5.0,
                                  vertical: 1.5,
                                ),
                                decoration: BoxDecoration(
                                  color: barColor.withValues(alpha: 0.12),
                                  borderRadius: BorderRadius.circular(4.0),
                                ),
                                child: Text(
                                  _spanTypeTag(row.span.spanType),
                                  style: TextStyle(
                                    fontSize: 9.5,
                                    fontWeight: FontWeight.w700,
                                    fontFamily: 'monospace',
                                    color: barColor,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 6.0),
                              Expanded(
                                child: Text(
                                  row.span.name,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    fontSize: 12.5,
                                    fontWeight: FontWeight.w600,
                                    color: StitchTokens.onSurface,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8.0),
                              Text(
                                '${row.span.durationMs} ms',
                                style: const TextStyle(
                                  fontSize: 11.5,
                                  fontWeight: FontWeight.w600,
                                  color: Color(0xFF475569),
                                  fontFeatures: [FontFeature.tabularFigures()],
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 6.0),
                          LayoutBuilder(
                            builder: (context, constraints) {
                              final totalW = constraints.maxWidth;
                              final leftOffset = totalW * row.leftPct;
                              final barW = math.max(totalW * row.widthPct, 6.0);
                              return Container(
                                height: 6.0,
                                width: totalW,
                                decoration: BoxDecoration(
                                  color: const Color(0xFFF1F5F9),
                                  borderRadius: BorderRadius.circular(3.0),
                                ),
                                child: Stack(
                                  children: [
                                    Positioned(
                                      left: leftOffset,
                                      width: barW.clamp(6.0, totalW - leftOffset),
                                      top: 0,
                                      bottom: 0,
                                      child: Container(
                                        decoration: BoxDecoration(
                                          color: barColor,
                                          borderRadius: BorderRadius.circular(3.0),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              );
                            },
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              }),
            ],
          ),
        ),
        const SizedBox(height: 12.0),
        _buildSelectedSpanInspector(context, selectedSpan),
      ],
    );
  }

  Widget _buildSelectedSpanInspector(
    BuildContext context,
    AgentSpanItemModel span,
  ) {
    return Container(
      padding: const EdgeInsets.all(14.0),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14.0),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  span.name,
                  style: const TextStyle(
                    fontSize: 14.0,
                    fontWeight: FontWeight.w700,
                    color: StitchTokens.onSurface,
                  ),
                ),
              ),
              if (span.modelId != null && span.modelId!.isNotEmpty)
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
                    span.modelId!,
                    style: const TextStyle(
                      fontSize: 10.5,
                      fontFamily: 'monospace',
                      fontWeight: FontWeight.w600,
                      color: StitchTokens.primary,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 6.0),
          Wrap(
            spacing: 12.0,
            runSpacing: 4.0,
            children: [
              Text(
                '耗时 ${span.durationMs} ms',
                style: const TextStyle(
                  fontSize: 11.5,
                  color: Color(0xFF64748B),
                  fontFeatures: [FontFeature.tabularFigures()],
                ),
              ),
              if (span.totalTokens > 0)
                Text(
                  '${span.totalTokens} tok (in ${span.promptTokens} / out ${span.completionTokens})',
                  style: const TextStyle(
                    fontSize: 11.5,
                    color: Color(0xFF64748B),
                    fontFeatures: [FontFeature.tabularFigures()],
                  ),
                ),
              if (span.estimatedCredits > 0)
                Text(
                  '积分 ${span.estimatedCredits.toStringAsFixed(4)}',
                  style: const TextStyle(
                    fontSize: 11.5,
                    color: Color(0xFF64748B),
                    fontFeatures: [FontFeature.tabularFigures()],
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12.0),
          _buildPayloadBox(
            context,
            title: 'Input 脱敏摘要',
            content: span.inputSummary ?? '（无入参快照）',
          ),
          const SizedBox(height: 10.0),
          _buildPayloadBox(
            context,
            title: 'Output 脱敏摘要',
            content: span.outputSummary ?? '（无出参快照）',
          ),
        ],
      ),
    );
  }

  Widget _buildPayloadBox(
    BuildContext context, {
    required String title,
    required String content,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(10.0),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(10.0),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF475569),
                ),
              ),
              const Spacer(),
              InkWell(
                onTap: () {
                  Clipboard.setData(ClipboardData(text: content));
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('已复制摘要内容'),
                      duration: Duration(seconds: 1),
                    ),
                  );
                },
                child: const Padding(
                  padding: EdgeInsets.all(4.0),
                  child: Icon(
                    Icons.copy_rounded,
                    size: 14.0,
                    color: Color(0xFF64748B),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4.0),
          SelectableText(
            content,
            style: const TextStyle(
              fontSize: 11.5,
              height: 1.45,
              fontFamily: 'monospace',
              color: Color(0xFF1E293B),
            ),
          ),
        ],
      ),
    );
  }
}
