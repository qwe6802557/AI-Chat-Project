import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/stitch_tokens.dart';
import '../domain/channel_model.dart';
import '../domain/workflow_model.dart';
import '../providers/orchestration_provider.dart';

/// 阶段 4：五大 IM 智能助理通道移动端控制台（含企微智能机器人 wecom_bot）
class ChannelConsolePage extends ConsumerWidget {
  const ChannelConsolePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final instancesAsync = ref.watch(channelInstancesProvider);

    return Scaffold(
      backgroundColor: StitchTokens.background,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0.5,
        title: const Text(
          'IM 智能助理通道',
          style: TextStyle(
            fontSize: 17.0,
            fontWeight: FontWeight.w700,
            color: StitchTokens.onSurface,
          ),
        ),
        actions: [
          IconButton(
            tooltip: '刷新通道状态',
            onPressed: () => ref.invalidate(channelInstancesProvider),
            icon: const Icon(Icons.refresh_rounded, color: StitchTokens.onSurface),
          ),
        ],
      ),
      body: instancesAsync.when(
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
              '加载通道列表失败: $err',
              style: const TextStyle(fontSize: 13.0, color: Color(0xFF991B1B)),
            ),
          ),
        ),
        data: (instances) => RefreshIndicator(
          onRefresh: () async => ref.invalidate(channelInstancesProvider),
          child: ListView.separated(
            padding: const EdgeInsets.all(16.0),
            itemCount: instances.length,
            separatorBuilder: (_, __) => const SizedBox(height: 12.0),
            itemBuilder: (context, idx) =>
                _ChannelInstanceCard(instance: instances[idx]),
          ),
        ),
      ),
    );
  }
}

class _ChannelInstanceCard extends ConsumerStatefulWidget {
  final ChannelInstanceModel instance;

  const _ChannelInstanceCard({required this.instance});

  @override
  ConsumerState<_ChannelInstanceCard> createState() =>
      _ChannelInstanceCardState();
}

class _ChannelInstanceCardState extends ConsumerState<_ChannelInstanceCard> {
  bool _toggling = false;

  ({IconData icon, Color fg, Color bg}) _channelStyle(String type) {
    switch (type) {
      case 'wecom_bot':
        return (
          icon: Icons.business_center_outlined,
          fg: const Color(0xFF0D9488),
          bg: const Color(0xFFF0FDFA),
        );
      case 'feishu':
        return (
          icon: Icons.send_outlined,
          fg: const Color(0xFF059669),
          bg: const Color(0xFFECFDF5),
        );
      case 'dingtalk':
        return (
          icon: Icons.bolt_rounded,
          fg: const Color(0xFF2563EB),
          bg: const Color(0xFFEFF6FF),
        );
      case 'qq':
        return (
          icon: Icons.forum_outlined,
          fg: const Color(0xFF3B82F6),
          bg: const Color(0xFFEFF6FF),
        );
      default:
        return (
          icon: Icons.chat_bubble_outline_rounded,
          fg: const Color(0xFF10B981),
          bg: const Color(0xFFECFDF5),
        );
    }
  }

  Future<void> _handleToggle() async {
    final id = widget.instance.id;
    if (id == null) return;
    if (widget.instance.channelType == 'weixin' && !widget.instance.isConnected) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('微信 iLink 扫码登录请在 Web 端「智能助理」弹窗完成')),
      );
      return;
    }

    setState(() => _toggling = true);
    try {
      await ref
          .read(orchestrationRepositoryProvider)
          .toggleInstance(id, !widget.instance.isConnected);
      ref.invalidate(channelInstancesProvider);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('操作失败: $e'),
            backgroundColor: StitchTokens.crimsonStop,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _toggling = false);
    }
  }

  void _openConfigSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _ChannelConfigSheet(instance: widget.instance),
    );
  }

  void _openAuditSheet() {
    if (widget.instance.id == null) return;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _ChannelAuditSheet(instance: widget.instance),
    );
  }

  @override
  Widget build(BuildContext context) {
    final inst = widget.instance;
    final style = _channelStyle(inst.channelType);
    final workflows = ref.watch(publishedWorkflowsProvider).valueOrNull ?? const [];
    String? boundWorkflowName;
    if (inst.workflowId != null) {
      for (final wf in workflows) {
        if (wf.id == inst.workflowId) {
          boundWorkflowName = wf.name;
          break;
        }
      }
      boundWorkflowName ??= '已绑定工作流';
    }

    final statusColor = inst.isConnected
        ? StitchTokens.playbackEmerald
        : inst.isConnecting
            ? const Color(0xFFD97706)
            : const Color(0xFF94A3B8);
    final statusLabel = inst.isConnected
        ? '已连接'
        : inst.isConnecting
            ? '连接中'
            : '未连接';

    return Container(
      padding: const EdgeInsets.all(14.0),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14.0),
        border: Border.all(
          color: inst.isConnected
              ? const Color(0xFFA7F3D0)
              : const Color(0xFFE2E8F0),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 40.0,
                height: 40.0,
                decoration: BoxDecoration(
                  color: style.bg,
                  borderRadius: BorderRadius.circular(10.0),
                ),
                child: Icon(style.icon, size: 20.0, color: style.fg),
              ),
              const SizedBox(width: 12.0),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      inst.displayName,
                      style: const TextStyle(
                        fontSize: 14.5,
                        fontWeight: FontWeight.w700,
                        color: StitchTokens.onSurface,
                      ),
                    ),
                    const SizedBox(height: 3.0),
                    Row(
                      children: [
                        Container(
                          width: 7.0,
                          height: 7.0,
                          decoration: BoxDecoration(
                            color: statusColor,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 5.0),
                        Text(
                          '$statusLabel · ${inst.channelLabel}',
                          style: const TextStyle(
                            fontSize: 11.5,
                            color: Color(0xFF64748B),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              FilledButton(
                onPressed: _toggling ? null : _handleToggle,
                style: FilledButton.styleFrom(
                  backgroundColor: inst.isConnected
                      ? const Color(0xFFFEF2F2)
                      : StitchTokens.primary,
                  foregroundColor: inst.isConnected
                      ? StitchTokens.crimsonStop
                      : Colors.white,
                  visualDensity: VisualDensity.compact,
                ),
                child: _toggling
                    ? const SizedBox(
                        width: 14.0,
                        height: 14.0,
                        child: CircularProgressIndicator(strokeWidth: 2.0),
                      )
                    : Text(inst.isConnected ? '断开' : '接入'),
              ),
            ],
          ),
          const SizedBox(height: 10.0),
          Wrap(
            spacing: 6.0,
            runSpacing: 6.0,
            children: [
              if (inst.roleName != null && inst.roleName!.isNotEmpty)
                _MetaTag(text: '角色: ${inst.roleName!}', isAccent: true),
              if (boundWorkflowName != null)
                _MetaTag(text: '工作流: $boundWorkflowName', isAccent: true),
              if (inst.boundModelId != null && inst.boundModelId!.isNotEmpty)
                _MetaTag(text: inst.boundModelId!),
            ],
          ),
          if (inst.lastError != null && inst.lastError!.trim().isNotEmpty) ...[
            const SizedBox(height: 8.0),
            Text(
              inst.lastError!,
              style: const TextStyle(fontSize: 11.5, color: StitchTokens.crimsonStop),
            ),
          ],
          const SizedBox(height: 10.0),
          Row(
            children: [
              OutlinedButton.icon(
                onPressed: _openConfigSheet,
                icon: const Icon(Icons.tune_rounded, size: 15.0),
                label: const Text('配置与绑定'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: StitchTokens.onSurface,
                  side: const BorderSide(color: Color(0xFFE2E8F0)),
                  visualDensity: VisualDensity.compact,
                ),
              ),
              const SizedBox(width: 8.0),
              OutlinedButton.icon(
                onPressed: _openAuditSheet,
                icon: const Icon(Icons.history_rounded, size: 15.0),
                label: const Text('会话审计'),
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

class _MetaTag extends StatelessWidget {
  final String text;
  final bool isAccent;

  const _MetaTag({required this.text, this.isAccent = false});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7.0, vertical: 2.5),
      decoration: BoxDecoration(
        color: isAccent ? const Color(0xFFEFF6FF) : const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(5.0),
        border: Border.all(
          color: isAccent ? const Color(0xFFBFDBFE) : const Color(0xFFE2E8F0),
        ),
      ),
      child: Text(
        text,
        style: TextStyle(
          fontSize: 11.0,
          fontWeight: FontWeight.w500,
          color: isAccent ? StitchTokens.primary : const Color(0xFF64748B),
        ),
      ),
    );
  }
}

class _ChannelConfigSheet extends ConsumerStatefulWidget {
  final ChannelInstanceModel instance;

  const _ChannelConfigSheet({required this.instance});

  @override
  ConsumerState<_ChannelConfigSheet> createState() =>
      _ChannelConfigSheetState();
}

class _ChannelConfigSheetState extends ConsumerState<_ChannelConfigSheet> {
  late final TextEditingController _nameCtrl;
  final _key1Ctrl = TextEditingController();
  final _key2Ctrl = TextEditingController();
  String? _roleId;
  String? _workflowId;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _nameCtrl = TextEditingController(text: widget.instance.displayName);
    _roleId = widget.instance.roleId;
    _workflowId = widget.instance.workflowId;
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _key1Ctrl.dispose();
    _key2Ctrl.dispose();
    super.dispose();
  }

  ({String label1, String hint1, String label2, String hint2})?
      _credentialMeta(String type) {
    switch (type) {
      case 'wecom_bot':
        return (
          label1: '企微 Bot ID',
          hint1: widget.instance.credentialsMasked['botId'] ?? '输入企微智能机器人 Bot ID',
          label2: '企微 Bot Secret',
          hint2: widget.instance.credentialsMasked['secret'] != null
              ? '已配置（留空保留原值）'
              : '输入 WebSocket 长连接 Secret',
        );
      case 'feishu':
        return (
          label1: '飞书 App ID',
          hint1: widget.instance.credentialsMasked['appId'] ?? 'cli_xxx',
          label2: '飞书 App Secret',
          hint2: '输入飞书开放平台 App Secret',
        );
      case 'dingtalk':
        return (
          label1: '钉钉 Client ID (AppKey)',
          hint1: widget.instance.credentialsMasked['appId'] ?? '开放平台 AppKey',
          label2: '钉钉 Client Secret',
          hint2: '输入开放平台 AppSecret',
        );
      case 'qq':
        return (
          label1: 'QQ AppID',
          hint1: widget.instance.credentialsMasked['appId'] ?? '开放平台 AppID',
          label2: 'QQ AppSecret',
          hint2: '输入开放平台 AppSecret',
        );
      default:
        return null;
    }
  }

  Future<void> _save() async {
    final id = widget.instance.id;
    if (id == null) return;
    setState(() => _saving = true);

    Map<String, dynamic>? creds;
    final v1 = _key1Ctrl.text.trim();
    final v2 = _key2Ctrl.text.trim();
    if (widget.instance.channelType == 'wecom_bot' && (v1.isNotEmpty || v2.isNotEmpty)) {
      creds = {
        if (v1.isNotEmpty) 'botId': v1,
        if (v2.isNotEmpty) 'secret': v2,
      };
    } else if (widget.instance.channelType != 'weixin' &&
        (v1.isNotEmpty || v2.isNotEmpty)) {
      creds = {
        if (v1.isNotEmpty) 'appId': v1,
        if (v2.isNotEmpty) 'appSecret': v2,
      };
    }

    try {
      await ref.read(orchestrationRepositoryProvider).updateInstanceSettings(
            id,
            instanceName: _nameCtrl.text.trim(),
            roleId: _roleId,
            clearRoleId: _roleId == null,
            workflowId: _workflowId,
            clearWorkflowId: _workflowId == null,
            credentials: creds,
          );
      ref.invalidate(channelInstancesProvider);
      if (mounted) {
        Navigator.of(context).pop();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('通道配置保存成功')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('保存失败: $e'),
            backgroundColor: StitchTokens.crimsonStop,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final roles = ref.watch(agentRolesProvider).valueOrNull ?? const [];
    final workflows = ref.watch(publishedWorkflowsProvider).valueOrNull ?? const [];
    final credMeta = _credentialMeta(widget.instance.channelType);

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
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              '配置 · ${widget.instance.channelLabel}',
              style: const TextStyle(
                fontSize: 16.0,
                fontWeight: FontWeight.w700,
                color: StitchTokens.onSurface,
              ),
            ),
            const SizedBox(height: 12.0),
            const Text('实例备注名称', style: TextStyle(fontSize: 12.0, color: Color(0xFF475569))),
            const SizedBox(height: 4.0),
            TextField(
              controller: _nameCtrl,
              decoration: InputDecoration(
                isDense: true,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10.0)),
              ),
            ),
            const SizedBox(height: 12.0),
            const Text('绑定智能体角色', style: TextStyle(fontSize: 12.0, color: Color(0xFF475569))),
            const SizedBox(height: 4.0),
            DropdownButtonFormField<String?>(
              initialValue: roles.any((r) => r.id == _roleId) ? _roleId : null,
              isExpanded: true,
              decoration: InputDecoration(
                isDense: true,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10.0)),
              ),
              items: [
                const DropdownMenuItem<String?>(
                  value: null,
                  child: Text('不指定（使用默认配置）'),
                ),
                ...roles.map(
                  (r) => DropdownMenuItem<String?>(
                    value: r.id,
                    child: Text(r.isTeam ? '${r.name} (Swarm)' : r.name),
                  ),
                ),
              ],
              onChanged: (val) => setState(() => _roleId = val),
            ),
            const SizedBox(height: 12.0),
            const Text('绑定已发布工作流（优先执行）', style: TextStyle(fontSize: 12.0, color: Color(0xFF475569))),
            const SizedBox(height: 4.0),
            DropdownButtonFormField<String?>(
              initialValue: workflows.any((w) => w.id == _workflowId)
                  ? _workflowId
                  : null,
              isExpanded: true,
              decoration: InputDecoration(
                isDense: true,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10.0)),
              ),
              items: [
                const DropdownMenuItem<String?>(
                  value: null,
                  child: Text('不绑定（走绑定角色）'),
                ),
                ...workflows.map(
                  (WorkflowItemModel w) => DropdownMenuItem<String?>(
                    value: w.id,
                    child: Text('${w.name} (v${w.version})'),
                  ),
                ),
              ],
              onChanged: (val) => setState(() => _workflowId = val),
            ),
            if (credMeta != null) ...[
              const SizedBox(height: 12.0),
              Text(credMeta.label1, style: const TextStyle(fontSize: 12.0, color: Color(0xFF475569))),
              const SizedBox(height: 4.0),
              TextField(
                controller: _key1Ctrl,
                decoration: InputDecoration(
                  isDense: true,
                  hintText: credMeta.hint1,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10.0)),
                ),
              ),
              const SizedBox(height: 10.0),
              Text(credMeta.label2, style: const TextStyle(fontSize: 12.0, color: Color(0xFF475569))),
              const SizedBox(height: 4.0),
              TextField(
                controller: _key2Ctrl,
                obscureText: true,
                decoration: InputDecoration(
                  isDense: true,
                  hintText: credMeta.hint2,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10.0)),
                ),
              ),
            ],
            const SizedBox(height: 16.0),
            FilledButton(
              onPressed: _saving ? null : _save,
              style: FilledButton.styleFrom(backgroundColor: StitchTokens.primary),
              child: Text(_saving ? '保存中...' : '保存通道配置'),
            ),
          ],
        ),
      ),
    );
  }
}

class _ChannelAuditSheet extends ConsumerStatefulWidget {
  final ChannelInstanceModel instance;

  const _ChannelAuditSheet({required this.instance});

  @override
  ConsumerState<_ChannelAuditSheet> createState() => _ChannelAuditSheetState();
}

class _ChannelAuditSheetState extends ConsumerState<_ChannelAuditSheet> {
  bool _loading = true;
  ChannelMetricsModel _metrics = const ChannelMetricsModel();
  List<ChannelAuditSessionModel> _sessions = const [];
  String? _selectedFromId;
  List<ChannelAuditMessageModel> _messages = const [];

  @override
  void initState() {
    super.initState();
    _loadAuditOverview();
  }

  Future<void> _loadAuditOverview() async {
    final id = widget.instance.id;
    if (id == null) return;
    setState(() => _loading = true);
    try {
      final repo = ref.read(orchestrationRepositoryProvider);
      final res = await Future.wait([
        repo.getInstanceMetrics(id),
        repo.getInstanceSessions(id),
      ]);
      if (!mounted) return;
      final metrics = res[0] as ChannelMetricsModel;
      final sessions = res[1] as List<ChannelAuditSessionModel>;
      setState(() {
        _metrics = metrics;
        _sessions = sessions;
        _loading = false;
      });
      if (sessions.isNotEmpty) {
        _loadMessages(sessions.first.fromId);
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadMessages(String fromId) async {
    final id = widget.instance.id;
    if (id == null) return;
    setState(() => _selectedFromId = fromId);
    try {
      final msgs = await ref
          .read(orchestrationRepositoryProvider)
          .getInstanceSessionMessages(id, fromId);
      if (mounted) setState(() => _messages = msgs);
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.85,
      ),
      padding: const EdgeInsets.fromLTRB(16.0, 14.0, 16.0, 20.0),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(StitchTokens.radius2Xl),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            '运行指标与审计 · ${widget.instance.displayName}',
            style: const TextStyle(
              fontSize: 15.5,
              fontWeight: FontWeight.w700,
              color: StitchTokens.onSurface,
            ),
          ),
          const SizedBox(height: 10.0),
          Row(
            children: [
              _AuditKpi('24h请求', '${_metrics.totalRequests}'),
              _AuditKpi('成功率', '${_metrics.successRate.toStringAsFixed(0)}%'),
              _AuditKpi('平均耗时', '${_metrics.avgLatencyMs}ms'),
            ],
          ),
          const SizedBox(height: 12.0),
          if (_loading)
            const Expanded(
              child: Center(child: CircularProgressIndicator(strokeWidth: 2.0)),
            )
          else if (_sessions.isEmpty)
            const Expanded(
              child: Center(
                child: Text(
                  '暂无外部联系人会话审计记录',
                  style: TextStyle(fontSize: 13.0, color: Color(0xFF94A3B8)),
                ),
              ),
            )
          else ...[
            SizedBox(
              height: 40.0,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: _sessions.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8.0),
                itemBuilder: (context, idx) {
                  final s = _sessions[idx];
                  final selected = s.fromId == _selectedFromId;
                  return ChoiceChip(
                    label: Text(
                      s.senderName ?? s.fromId,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    selected: selected,
                    onSelected: (_) => _loadMessages(s.fromId),
                    selectedColor: const Color(0xFFEFF6FF),
                  );
                },
              ),
            ),
            const SizedBox(height: 10.0),
            Expanded(
              child: ListView.separated(
                itemCount: _messages.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8.0),
                itemBuilder: (context, idx) {
                  final m = _messages[idx];
                  return Container(
                    padding: const EdgeInsets.all(10.0),
                    decoration: BoxDecoration(
                      color: m.isUser
                          ? const Color(0xFFEFF6FF)
                          : const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(10.0),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Text(
                              m.isUser ? '外部用户' : (m.senderName ?? '智能助理'),
                              style: TextStyle(
                                fontSize: 11.0,
                                fontWeight: FontWeight.w700,
                                color: m.isUser
                                    ? StitchTokens.primary
                                    : StitchTokens.playbackEmerald,
                              ),
                            ),
                            const Spacer(),
                            if (!m.isUser && m.costCredits > 0)
                              Text(
                                '-${m.costCredits} 积分',
                                style: const TextStyle(
                                  fontSize: 10.5,
                                  color: Color(0xFF64748B),
                                  fontFeatures: [FontFeature.tabularFigures()],
                                ),
                              ),
                          ],
                        ),
                        const SizedBox(height: 4.0),
                        Text(
                          m.content,
                          style: const TextStyle(
                            fontSize: 12.5,
                            color: StitchTokens.onSurface,
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _AuditKpi extends StatelessWidget {
  final String label;
  final String value;

  const _AuditKpi(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        margin: const EdgeInsets.only(right: 6.0),
        padding: const EdgeInsets.symmetric(horizontal: 10.0, vertical: 8.0),
        decoration: BoxDecoration(
          color: const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(10.0),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: const TextStyle(fontSize: 10.5, color: Color(0xFF64748B))),
            const SizedBox(height: 2.0),
            Text(
              value,
              style: const TextStyle(
                fontSize: 14.0,
                fontWeight: FontWeight.w700,
                color: StitchTokens.onSurface,
                fontFeatures: [FontFeature.tabularFigures()],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
