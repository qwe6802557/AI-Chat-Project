import 'package:flutter/material.dart';
import '../../../../core/theme/stitch_tokens.dart';
import '../../domain/swarm_timeline_event_model.dart';

/// 阶段 4：Stitch 浅色极简多智能体协同时间线（流式展开，完成后自动折叠为单行轻量条）
class AgentCollaborationTimeline extends StatefulWidget {
  final List<SwarmTimelineEventModel> timeline;
  final bool streaming;
  final bool autoCollapseOnComplete;

  const AgentCollaborationTimeline({
    super.key,
    required this.timeline,
    this.streaming = false,
    this.autoCollapseOnComplete = true,
  });

  @override
  State<AgentCollaborationTimeline> createState() =>
      _AgentCollaborationTimelineState();
}

class _AgentCollaborationTimelineState
    extends State<AgentCollaborationTimeline> {
  late bool _isExpanded;
  bool _wasActive = false;

  bool get _hasRunningNode => widget.timeline.any((e) => e.isRunning);
  bool get _isActiveFlow => widget.streaming || _hasRunningNode;
  bool get _hasFailedNode => widget.timeline.any((e) => e.isFailed);

  @override
  void initState() {
    super.initState();
    _wasActive = _isActiveFlow;
    _isExpanded = _isActiveFlow;
  }

  @override
  void didUpdateWidget(covariant AgentCollaborationTimeline oldWidget) {
    super.didUpdateWidget(oldWidget);
    final isNowActive = _isActiveFlow;
    if (isNowActive && !_wasActive) {
      _isExpanded = true;
    } else if (_wasActive &&
        !isNowActive &&
        widget.autoCollapseOnComplete &&
        _isExpanded) {
      _isExpanded = false;
    }
    _wasActive = isNowActive;
  }

  String _formatDurationLabel() {
    var totalMs = 0;
    for (final evt in widget.timeline) {
      totalMs += evt.durationMs ?? 0;
    }
    if (totalMs <= 0) return '';
    if (totalMs >= 1000) {
      return '${(totalMs / 1000).toStringAsFixed(1)}s';
    }
    return '${totalMs}ms';
  }

  String _statusLabel(String status) {
    switch (status) {
      case 'running':
        return '执行中';
      case 'failed':
        return '异常';
      case 'skipped':
        return '已跳过';
      default:
        return '已完成';
    }
  }

  Color _statusTextColor(String status) {
    switch (status) {
      case 'running':
        return StitchTokens.primary;
      case 'failed':
        return StitchTokens.crimsonStop;
      case 'skipped':
        return const Color(0xFF64748B);
      default:
        return StitchTokens.playbackEmerald;
    }
  }

  Color _statusBgColor(String status) {
    switch (status) {
      case 'running':
        return const Color(0xFFEFF6FF);
      case 'failed':
        return const Color(0xFFFEF2F2);
      case 'skipped':
        return const Color(0xFFF1F5F9);
      default:
        return const Color(0xFFECFDF5);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (widget.timeline.isEmpty) return const SizedBox.shrink();

    final summaryDuration = _formatDurationLabel();
    final summaryStatusText = _isActiveFlow
        ? '协同执行中'
        : _hasFailedNode
            ? '部分异常'
            : '已完成';
    final summaryStatusColor = _isActiveFlow
        ? StitchTokens.primary
        : _hasFailedNode
            ? StitchTokens.crimsonStop
            : StitchTokens.playbackEmerald;

    return Container(
      margin: const EdgeInsets.only(bottom: 10.0),
      decoration: BoxDecoration(
        color: _isExpanded
            ? StitchTokens.surfaceContainerLowest
            : const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(10.0),
        border: Border.all(
          color: _isActiveFlow
              ? const Color(0xFFBFDBFE)
              : const Color(0xFFE2E8F0),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Material(
            color: Colors.transparent,
            child: InkWell(
              borderRadius: BorderRadius.circular(10.0),
              onTap: () => setState(() => _isExpanded = !_isExpanded),
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10.0,
                  vertical: 8.0,
                ),
                child: Row(
                  children: [
                    Container(
                      width: 22.0,
                      height: 22.0,
                      decoration: BoxDecoration(
                        color: _isActiveFlow
                            ? const Color(0xFFEFF6FF)
                            : const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(6.0),
                      ),
                      child: _isActiveFlow
                          ? const Padding(
                              padding: EdgeInsets.all(4.0),
                              child: CircularProgressIndicator(
                                strokeWidth: 1.8,
                                color: StitchTokens.primary,
                              ),
                            )
                          : const Icon(
                              Icons.account_tree_outlined,
                              size: 13.0,
                              color: Color(0xFF475569),
                            ),
                    ),
                    const SizedBox(width: 8.0),
                    const Flexible(
                      child: Text(
                        '多智能体协同',
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 12.0,
                          fontWeight: FontWeight.w600,
                          color: StitchTokens.onSurface,
                        ),
                      ),
                    ),
                    const SizedBox(width: 6.0),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6.0,
                        vertical: 1.5,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(StitchTokens.radiusFull),
                      ),
                      child: Text(
                        '${widget.timeline.length} 节点',
                        style: const TextStyle(
                          fontSize: 10.5,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF475569),
                          fontFeatures: [FontFeature.tabularFigures()],
                        ),
                      ),
                    ),
                    if (!_isExpanded && summaryDuration.isNotEmpty) ...[
                      const SizedBox(width: 5.0),
                      Text(
                        summaryDuration,
                        style: const TextStyle(
                          fontSize: 10.5,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF64748B),
                          fontFeatures: [FontFeature.tabularFigures()],
                        ),
                      ),
                    ],
                    const Spacer(),
                    Text(
                      summaryStatusText,
                      style: TextStyle(
                        fontSize: 11.0,
                        fontWeight: FontWeight.w600,
                        color: summaryStatusColor,
                      ),
                    ),
                    const SizedBox(width: 2.0),
                    Icon(
                      _isExpanded
                          ? Icons.keyboard_arrow_up_rounded
                          : Icons.keyboard_arrow_down_rounded,
                      size: 17.0,
                      color: const Color(0xFF64748B),
                    ),
                  ],
                ),
              ),
            ),
          ),
          AnimatedSize(
            duration: const Duration(milliseconds: 220),
            curve: Curves.easeOutCubic,
            child: !_isExpanded
                ? const SizedBox.shrink()
                : Container(
                    padding: const EdgeInsets.fromLTRB(10.0, 2.0, 10.0, 10.0),
                    decoration: const BoxDecoration(
                      border: Border(
                        top: BorderSide(color: Color(0xFFF1F5F9)),
                      ),
                    ),
                    child: Column(
                      children: List.generate(widget.timeline.length, (idx) {
                        final evt = widget.timeline[idx];
                        final isLast = idx == widget.timeline.length - 1;
                        return _buildTimelineNode(evt, isLast);
                      }),
                    ),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildTimelineNode(SwarmTimelineEventModel evt, bool isLast) {
    final badgeColor = _statusTextColor(evt.status);
    final badgeBg = _statusBgColor(evt.status);

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            width: 18.0,
            child: Column(
              children: [
                const SizedBox(height: 6.0),
                if (evt.isRunning)
                  const SizedBox(
                    width: 12.0,
                    height: 12.0,
                    child: CircularProgressIndicator(
                      strokeWidth: 1.6,
                      color: StitchTokens.primary,
                    ),
                  )
                else
                  Icon(
                    evt.isFailed
                        ? Icons.cancel_rounded
                        : evt.isSkipped
                            ? Icons.remove_circle_outline_rounded
                            : Icons.check_circle_rounded,
                    size: 13.0,
                    color: badgeColor,
                  ),
                if (!isLast)
                  Expanded(
                    child: Container(
                      width: 1.5,
                      margin: const EdgeInsets.symmetric(vertical: 3.0),
                      color: const Color(0xFFE2E8F0),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 8.0),
          Expanded(
            child: Container(
              margin: EdgeInsets.only(top: 4.0, bottom: isLast ? 0.0 : 8.0),
              padding: const EdgeInsets.all(8.0),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(8.0),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Wrap(
                    spacing: 4.0,
                    runSpacing: 4.0,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      _buildAgentTag(evt.fromAgent),
                      const Icon(
                        Icons.arrow_forward_rounded,
                        size: 12.0,
                        color: Color(0xFF94A3B8),
                      ),
                      _buildAgentTag(evt.toAgent, highlighted: true),
                      if (evt.durationMs != null)
                        Text(
                          '${evt.durationMs}ms',
                          style: const TextStyle(
                            fontSize: 10.5,
                            color: Color(0xFF64748B),
                            fontFeatures: [FontFeature.tabularFigures()],
                          ),
                        ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 5.0,
                          vertical: 1.0,
                        ),
                        decoration: BoxDecoration(
                          color: badgeBg,
                          borderRadius: BorderRadius.circular(4.0),
                        ),
                        child: Text(
                          _statusLabel(evt.status),
                          style: TextStyle(
                            fontSize: 10.0,
                            fontWeight: FontWeight.w600,
                            color: badgeColor,
                          ),
                        ),
                      ),
                    ],
                  ),
                  if (evt.modelId != null && evt.modelId!.isNotEmpty) ...[
                    const SizedBox(height: 3.0),
                    Text(
                      evt.modelId!,
                      style: const TextStyle(
                        fontSize: 10.5,
                        color: Color(0xFF64748B),
                        fontFamily: 'monospace',
                      ),
                    ),
                  ],
                  if (evt.task != null && evt.task!.trim().isNotEmpty) ...[
                    const SizedBox(height: 4.0),
                    Text(
                      evt.task!.trim(),
                      style: const TextStyle(
                        fontSize: 11.5,
                        height: 1.4,
                        color: StitchTokens.onSurface,
                      ),
                    ),
                  ],
                  if (evt.outputSnippet != null &&
                      evt.outputSnippet!.trim().isNotEmpty) ...[
                    const SizedBox(height: 5.0),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(6.0),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(6.0),
                      ),
                      child: Text(
                        evt.outputSnippet!.trim(),
                        maxLines: 4,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 10.5,
                          height: 1.35,
                          fontFamily: 'monospace',
                          color: Color(0xFF334155),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAgentTag(String label, {bool highlighted = false}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6.0, vertical: 2.0),
      decoration: BoxDecoration(
        color: highlighted ? const Color(0xFFEFF6FF) : Colors.white,
        borderRadius: BorderRadius.circular(5.0),
        border: Border.all(
          color: highlighted
              ? const Color(0xFFBFDBFE)
              : const Color(0xFFE2E8F0),
        ),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 11.0,
          fontWeight: FontWeight.w600,
          color: highlighted ? StitchTokens.primary : StitchTokens.onSurface,
        ),
      ),
    );
  }
}
