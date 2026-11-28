import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/stitch_tokens.dart';
import 'package:ai_chat_mobile/features/chat/domain/swarm_timeline_event_model.dart';
import 'package:ai_chat_mobile/features/chat/presentation/widgets/agent_collaboration_timeline.dart';
import 'package:ai_chat_mobile/features/chat/providers/chat_provider.dart';
import '../domain/workflow_model.dart';
import '../providers/orchestration_provider.dart';

/// 阶段 4：移动端工作流只读目录、拓扑预览与快速调试台
class WorkflowDirectoryPage extends ConsumerWidget {
  const WorkflowDirectoryPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final workflowsAsync = ref.watch(allWorkflowsProvider);

    return Scaffold(
      backgroundColor: StitchTokens.background,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0.5,
        title: const Text(
          '智能编排工作流',
          style: TextStyle(
            fontSize: 17.0,
            fontWeight: FontWeight.w700,
            color: StitchTokens.onSurface,
          ),
        ),
        actions: [
          IconButton(
            tooltip: '刷新工作流',
            onPressed: () => ref.invalidate(allWorkflowsProvider),
            icon: const Icon(Icons.refresh_rounded, color: StitchTokens.onSurface),
          ),
        ],
      ),
      body: workflowsAsync.when(
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
              '加载工作流目录失败: $err',
              style: const TextStyle(fontSize: 13.0, color: Color(0xFF991B1B)),
            ),
          ),
        ),
        data: (items) {
          if (items.isEmpty) {
            return ListView(
              padding: const EdgeInsets.all(16.0),
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(vertical: 42.0, horizontal: 16.0),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14.0),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: const Column(
                    children: [
                      Icon(
                        Icons.account_tree_outlined,
                        size: 34.0,
                        color: Color(0xFF94A3B8),
                      ),
                      SizedBox(height: 10.0),
                      Text(
                        '暂无可用工作流',
                        style: TextStyle(
                          fontSize: 14.0,
                          fontWeight: FontWeight.w600,
                          color: StitchTokens.onSurface,
                        ),
                      ),
                      SizedBox(height: 4.0),
                      Text(
                        '在 Web 端画布创建并保存工作流后，可在此实时预览节点拓扑并应用至对话。',
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 12.0, color: Color(0xFF64748B)),
                      ),
                    ],
                  ),
                ),
              ],
            );
          }

          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(allWorkflowsProvider),
            child: ListView.separated(
              padding: const EdgeInsets.all(16.0),
              itemCount: items.length,
              separatorBuilder: (_, __) => const SizedBox(height: 12.0),
              itemBuilder: (context, idx) => _WorkflowCard(workflow: items[idx]),
            ),
          );
        },
      ),
    );
  }
}

class _WorkflowCard extends ConsumerStatefulWidget {
  final WorkflowItemModel workflow;

  const _WorkflowCard({required this.workflow});

  @override
  ConsumerState<_WorkflowCard> createState() => _WorkflowCardState();
}

class _WorkflowCardState extends ConsumerState<_WorkflowCard> {
  bool _publishing = false;

  IconData _nodeIcon(String type) {
    switch (type) {
      case 'start':
        return Icons.play_arrow_rounded;
      case 'rag':
        return Icons.menu_book_rounded;
      case 'tool':
        return Icons.extension_outlined;
      case 'condition':
        return Icons.call_split_rounded;
      case 'end':
        return Icons.flag_outlined;
      default:
        return Icons.smart_toy_outlined;
    }
  }

  Future<void> _publishWorkflow() async {
    setState(() => _publishing = true);
    try {
      await ref
          .read(orchestrationRepositoryProvider)
          .publishWorkflow(widget.workflow.id);
      ref.invalidate(allWorkflowsProvider);
      ref.invalidate(publishedWorkflowsProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('已发布工作流「${widget.workflow.name}」')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('发布失败: $e'),
            backgroundColor: StitchTokens.crimsonStop,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _publishing = false);
    }
  }

  void _openDebugSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _WorkflowDebugSheet(workflow: widget.workflow),
    );
  }

  @override
  Widget build(BuildContext context) {
    final wf = widget.workflow;
    final orderedNodes = wf.displayGraph.orderedNodes;
    final activeWorkflowId = ref.watch(chatProvider).selectedWorkflowId;
    final isAppliedToChat = activeWorkflowId == wf.id;

    return Container(
      padding: const EdgeInsets.all(14.0),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14.0),
        border: Border.all(
          color: isAppliedToChat
              ? StitchTokens.primary
              : const Color(0xFFE2E8F0),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  wf.name,
                  style: const TextStyle(
                    fontSize: 15.0,
                    fontWeight: FontWeight.w700,
                    color: StitchTokens.onSurface,
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6.0, vertical: 2.0),
                decoration: BoxDecoration(
                  color: const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(5.0),
                ),
                child: Text(
                  'v${wf.version}',
                  style: const TextStyle(
                    fontSize: 11.0,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF475569),
                    fontFeatures: [FontFeature.tabularFigures()],
                  ),
                ),
              ),
              const SizedBox(width: 6.0),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7.0, vertical: 2.0),
                decoration: BoxDecoration(
                  color: wf.isPublished
                      ? const Color(0xFFECFDF5)
                      : const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(5.0),
                ),
                child: Text(
                  wf.isPublished ? '已发布' : '草稿',
                  style: TextStyle(
                    fontSize: 11.0,
                    fontWeight: FontWeight.w600,
                    color: wf.isPublished
                        ? StitchTokens.playbackEmerald
                        : const Color(0xFF64748B),
                  ),
                ),
              ),
            ],
          ),
          if (wf.description != null && wf.description!.trim().isNotEmpty) ...[
            const SizedBox(height: 6.0),
            Text(
              wf.description!.trim(),
              style: const TextStyle(fontSize: 12.5, color: Color(0xFF64748B)),
            ),
          ],
          const SizedBox(height: 10.0),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: List.generate(orderedNodes.length, (idx) {
                final node = orderedNodes[idx];
                return Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8.0,
                        vertical: 5.0,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(8.0),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            _nodeIcon(node.type),
                            size: 13.0,
                            color: StitchTokens.primary,
                          ),
                          const SizedBox(width: 4.0),
                          Text(
                            node.label,
                            style: const TextStyle(
                              fontSize: 11.5,
                              fontWeight: FontWeight.w600,
                              color: StitchTokens.onSurface,
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (idx < orderedNodes.length - 1)
                      const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 4.0),
                        child: Icon(
                          Icons.arrow_forward_rounded,
                          size: 13.0,
                          color: Color(0xFF94A3B8),
                        ),
                      ),
                  ],
                );
              }),
            ),
          ),
          const SizedBox(height: 12.0),
          Wrap(
            spacing: 8.0,
            runSpacing: 8.0,
            children: [
              if (wf.isPublished)
                FilledButton.tonalIcon(
                  onPressed: () {
                    ref.read(chatProvider.notifier).selectWorkflow(wf.id);
                    context.go('/chat');
                  },
                  icon: Icon(
                    isAppliedToChat ? Icons.check_rounded : Icons.chat_outlined,
                    size: 15.0,
                  ),
                  label: Text(isAppliedToChat ? '当前对话使用中' : '应用到对话'),
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFFEFF6FF),
                    foregroundColor: StitchTokens.primary,
                    visualDensity: VisualDensity.compact,
                  ),
                ),
              if (!wf.isPublished)
                OutlinedButton.icon(
                  onPressed: _publishing ? null : _publishWorkflow,
                  icon: const Icon(Icons.publish_rounded, size: 15.0),
                  label: Text(_publishing ? '发布中...' : '发布工作流'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: StitchTokens.primary,
                    visualDensity: VisualDensity.compact,
                  ),
                ),
              OutlinedButton.icon(
                onPressed: _openDebugSheet,
                icon: const Icon(Icons.play_circle_outline_rounded, size: 15.0),
                label: const Text('调试试跑'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: StitchTokens.onSurface,
                  side: const BorderSide(color: Color(0xFFE2E8F0)),
                  visualDensity: VisualDensity.compact,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _WorkflowDebugSheet extends ConsumerStatefulWidget {
  final WorkflowItemModel workflow;

  const _WorkflowDebugSheet({required this.workflow});

  @override
  ConsumerState<_WorkflowDebugSheet> createState() =>
      _WorkflowDebugSheetState();
}

class _WorkflowDebugSheetState extends ConsumerState<_WorkflowDebugSheet> {
  final _inputController = TextEditingController();
  StreamSubscription<DagDebugStreamEventModel>? _sub;
  bool _running = false;
  String? _traceId;
  String? _finalOutput;
  String? _errorText;
  List<SwarmTimelineEventModel> _timeline = const [];

  @override
  void initState() {
    super.initState();
    final nodes = widget.workflow.draftGraph.nodes;
    for (final n in nodes) {
      if (n.type == 'start' && (n.defaultInput ?? '').trim().isNotEmpty) {
        _inputController.text = n.defaultInput!.trim();
        break;
      }
    }
    if (_inputController.text.isEmpty) {
      _inputController.text = '请输出一段简短的系统巡检诊断示例。';
    }
  }

  @override
  void dispose() {
    _sub?.cancel();
    _inputController.dispose();
    super.dispose();
  }

  Future<void> _startDebug() async {
    final prompt = _inputController.text.trim();
    if (prompt.isEmpty || _running) return;
    _sub?.cancel();
    setState(() {
      _running = true;
      _traceId = null;
      _finalOutput = null;
      _errorText = null;
      _timeline = const [];
    });

    try {
      final stream = await ref
          .read(orchestrationRepositoryProvider)
          .debugRunWorkflow(widget.workflow.id, prompt);
      _sub = stream.listen(
        (evt) {
          if (!mounted) return;
          setState(() {
            if (evt.traceId != null && evt.traceId!.isNotEmpty) {
              _traceId = evt.traceId;
            }
            final tlEvt = evt.timelineEvent;
            if (tlEvt != null) {
              final next = List<SwarmTimelineEventModel>.from(_timeline);
              final idx = next.indexWhere((e) => e.id == tlEvt.id);
              if (idx != -1) {
                next[idx] = tlEvt;
              } else {
                next.add(tlEvt);
              }
              _timeline = next;
            }
            if (evt.timeline.isNotEmpty) {
              _timeline = evt.timeline;
            }
            if (evt.type == 'done') {
              _running = false;
              _finalOutput = evt.content;
            } else if (evt.type == 'error') {
              _running = false;
              _errorText = evt.error ?? evt.content ?? '调试运行失败';
            }
          });
        },
        onError: (err) {
          if (!mounted) return;
          setState(() {
            _running = false;
            _errorText = err.toString();
          });
        },
        onDone: () {
          if (mounted && _running) {
            setState(() => _running = false);
          }
        },
      );
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _running = false;
        _errorText = e.toString().replaceAll('Exception: ', '');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.85,
      ),
      padding: EdgeInsets.fromLTRB(
        16.0,
        14.0,
        16.0,
        16.0 + MediaQuery.of(context).viewInsets.bottom,
      ),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(StitchTokens.radius2Xl),
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  '调试 · ${widget.workflow.name}',
                  style: const TextStyle(
                    fontSize: 15.5,
                    fontWeight: FontWeight.w700,
                    color: StitchTokens.onSurface,
                  ),
                ),
              ),
              if (_traceId != null)
                TextButton(
                  onPressed: () {
                    final id = _traceId!;
                    Navigator.of(context).pop();
                    context.push('/traces/$id');
                  },
                  child: Text(
                    'Trace #${_traceId!.length > 8 ? _traceId!.substring(_traceId!.length - 8) : _traceId!}',
                    style: const TextStyle(
                      fontFamily: 'monospace',
                      fontSize: 12.0,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 8.0),
          TextField(
            controller: _inputController,
            maxLines: 2,
            decoration: InputDecoration(
              hintText: '输入工作流试跑指令...',
              filled: true,
              fillColor: const Color(0xFFF8FAFC),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10.0),
                borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10.0),
                borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
              ),
            ),
          ),
          const SizedBox(height: 10.0),
          FilledButton.icon(
            onPressed: _running ? null : _startDebug,
            icon: _running
                ? const SizedBox(
                    width: 14.0,
                    height: 14.0,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.0,
                      color: Colors.white,
                    ),
                  )
                : const Icon(Icons.play_arrow_rounded, size: 18.0),
            label: Text(_running ? 'DAG 拓扑执行中...' : '运行调试'),
            style: FilledButton.styleFrom(backgroundColor: StitchTokens.primary),
          ),
          const SizedBox(height: 12.0),
          Flexible(
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (_timeline.isNotEmpty)
                    AgentCollaborationTimeline(
                      timeline: _timeline,
                      streaming: _running,
                      autoCollapseOnComplete: false,
                    ),
                  if (_errorText != null)
                    Container(
                      padding: const EdgeInsets.all(10.0),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEF2F2),
                        borderRadius: BorderRadius.circular(10.0),
                      ),
                      child: Text(
                        _errorText!,
                        style: const TextStyle(
                          fontSize: 12.5,
                          color: StitchTokens.crimsonStop,
                        ),
                      ),
                    ),
                  if (_finalOutput != null && _finalOutput!.isNotEmpty)
                    Container(
                      padding: const EdgeInsets.all(12.0),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(10.0),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: SelectableText(
                        _finalOutput!,
                        style: const TextStyle(
                          fontSize: 13.0,
                          height: 1.5,
                          color: StitchTokens.onSurface,
                        ),
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
}
