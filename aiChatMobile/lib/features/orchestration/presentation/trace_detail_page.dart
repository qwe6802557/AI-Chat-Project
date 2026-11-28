import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/stitch_tokens.dart';
import '../providers/orchestration_provider.dart';
import 'widgets/trace_span_waterfall.dart';

/// 阶段 4：分布式 Trace 链路详情与 Span 瀑布流检视页
class TraceDetailPage extends ConsumerWidget {
  final String traceId;

  const TraceDetailPage({super.key, required this.traceId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detailAsync = ref.watch(traceDetailProvider(traceId));

    return Scaffold(
      backgroundColor: StitchTokens.background,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0.5,
        title: Text(
          'Trace #${traceId.length > 8 ? traceId.substring(traceId.length - 8) : traceId}',
          style: const TextStyle(
            fontSize: 16.5,
            fontWeight: FontWeight.w700,
            fontFamily: 'monospace',
            color: StitchTokens.onSurface,
          ),
        ),
        actions: [
          IconButton(
            tooltip: '复制完整 Trace ID',
            onPressed: () {
              Clipboard.setData(ClipboardData(text: traceId));
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('已复制 Trace ID'),
                  duration: Duration(seconds: 1),
                ),
              );
            },
            icon: const Icon(Icons.copy_rounded, size: 19.0),
          ),
        ],
      ),
      body: detailAsync.when(
        loading: () => const Center(child: CircularProgressIndicator(strokeWidth: 2.2)),
        error: (err, _) => Padding(
          padding: const EdgeInsets.all(16.0),
          child: Container(
            padding: const EdgeInsets.all(14.0),
            decoration: BoxDecoration(
              color: const Color(0xFFFEF2F2),
              borderRadius: BorderRadius.circular(12.0),
              border: Border.all(color: const Color(0xFFFCA5A5)),
            ),
            child: Text(
              '加载链路详情失败: $err',
              style: const TextStyle(fontSize: 13.0, color: Color(0xFF991B1B)),
            ),
          ),
        ),
        data: (detail) {
          final trace = detail.trace;
          final isFailed = trace.status == 'failed';
          return ListView(
            padding: const EdgeInsets.all(16.0),
            children: [
              Container(
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
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8.0,
                            vertical: 2.5,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFFEFF6FF),
                            borderRadius: BorderRadius.circular(6.0),
                          ),
                          child: Text(
                            trace.sourceLabel,
                            style: const TextStyle(
                              fontSize: 11.0,
                              fontWeight: FontWeight.w600,
                              color: StitchTokens.primary,
                            ),
                          ),
                        ),
                        const Spacer(),
                        Text(
                          isFailed ? '执行异常' : '执行成功',
                          style: TextStyle(
                            fontSize: 12.0,
                            fontWeight: FontWeight.w600,
                            color: isFailed
                                ? StitchTokens.crimsonStop
                                : StitchTokens.playbackEmerald,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8.0),
                    Text(
                      (trace.title != null && trace.title!.trim().isNotEmpty)
                          ? trace.title!.trim()
                          : trace.traceId,
                      style: const TextStyle(
                        fontSize: 14.5,
                        fontWeight: FontWeight.w700,
                        color: StitchTokens.onSurface,
                      ),
                    ),
                    const SizedBox(height: 12.0),
                    Row(
                      children: [
                        _MetricCell(label: '总耗时', value: '${trace.durationMs} ms'),
                        _MetricCell(label: 'Tokens', value: '${trace.totalTokens}'),
                        _MetricCell(
                          label: '消耗积分',
                          value: trace.totalCredits.toStringAsFixed(2),
                        ),
                      ],
                    ),
                    if (trace.errorSummary != null &&
                        trace.errorSummary!.trim().isNotEmpty) ...[
                      const SizedBox(height: 10.0),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(10.0),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFEF2F2),
                          borderRadius: BorderRadius.circular(8.0),
                        ),
                        child: Text(
                          trace.errorSummary!,
                          style: const TextStyle(
                            fontSize: 12.0,
                            color: Color(0xFF991B1B),
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 14.0),
              TraceSpanWaterfall(spans: detail.spans),
            ],
          );
        },
      ),
    );
  }
}

class _MetricCell extends StatelessWidget {
  final String label;
  final String value;

  const _MetricCell({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(fontSize: 11.0, color: Color(0xFF64748B)),
          ),
          const SizedBox(height: 2.0),
          Text(
            value,
            style: const TextStyle(
              fontSize: 14.5,
              fontWeight: FontWeight.w700,
              color: StitchTokens.onSurface,
              fontFeatures: [FontFeature.tabularFigures()],
            ),
          ),
        ],
      ),
    );
  }
}
