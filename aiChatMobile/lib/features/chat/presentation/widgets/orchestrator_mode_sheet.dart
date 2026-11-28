import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/stitch_tokens.dart';
import '../../../orchestration/providers/orchestration_provider.dart';

/// 对话输入区「编排模式」切换弹窗（标准 ReAct / 已发布工作流 / 智能体角色 & Swarm 团队）
class OrchestratorModeSheet extends ConsumerWidget {
  final String? selectedWorkflowId;
  final String? selectedRoleId;
  final VoidCallback onSelectStandard;
  final ValueChanged<String> onSelectWorkflow;
  final ValueChanged<String> onSelectRole;
  final VoidCallback onOpenWorkflowDirectory;

  const OrchestratorModeSheet({
    super.key,
    required this.selectedWorkflowId,
    required this.selectedRoleId,
    required this.onSelectStandard,
    required this.onSelectWorkflow,
    required this.onSelectRole,
    required this.onOpenWorkflowDirectory,
  });

  static Future<void> show(
    BuildContext context, {
    required String? selectedWorkflowId,
    required String? selectedRoleId,
    required VoidCallback onSelectStandard,
    required ValueChanged<String> onSelectWorkflow,
    required ValueChanged<String> onSelectRole,
    required VoidCallback onOpenWorkflowDirectory,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useRootNavigator: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => OrchestratorModeSheet(
        selectedWorkflowId: selectedWorkflowId,
        selectedRoleId: selectedRoleId,
        onSelectStandard: onSelectStandard,
        onSelectWorkflow: onSelectWorkflow,
        onSelectRole: onSelectRole,
        onOpenWorkflowDirectory: onOpenWorkflowDirectory,
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final workflowsAsync = ref.watch(publishedWorkflowsProvider);
    final rolesAsync = ref.watch(agentRolesProvider);
    final isStandardSelected =
        (selectedWorkflowId == null || selectedWorkflowId!.isEmpty) &&
        (selectedRoleId == null || selectedRoleId!.isEmpty);

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.78,
      ),
      decoration: const BoxDecoration(
        color: StitchTokens.surfaceContainerLowest,
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(StitchTokens.radius2Xl),
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(height: 10.0),
          Container(
            width: 36.0,
            height: 4.0,
            decoration: BoxDecoration(
              color: const Color(0xFFCBD5E1),
              borderRadius: BorderRadius.circular(2.0),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16.0, 12.0, 12.0, 10.0),
            child: Row(
              children: [
                const Text(
                  '执行编排模式',
                  style: TextStyle(
                    fontSize: 16.0,
                    fontWeight: FontWeight.w700,
                    color: StitchTokens.onSurface,
                  ),
                ),
                const Spacer(),
                TextButton.icon(
                  onPressed: () {
                    Navigator.of(context).pop();
                    onOpenWorkflowDirectory();
                  },
                  icon: const Icon(Icons.account_tree_outlined, size: 15.0),
                  label: const Text('工作流目录', style: TextStyle(fontSize: 12.5)),
                  style: TextButton.styleFrom(
                    foregroundColor: StitchTokens.primary,
                    padding: const EdgeInsets.symmetric(horizontal: 10.0),
                  ),
                ),
              ],
            ),
          ),
          const Divider(height: 1.0, color: Color(0xFFF1F5F9)),
          Flexible(
            child: ListView(
              shrinkWrap: true,
              padding: const EdgeInsets.fromLTRB(16.0, 12.0, 16.0, 20.0),
              children: [
                _buildOptionTile(
                  context,
                  icon: Icons.bolt_rounded,
                  title: '标准 ReAct 对话',
                  subtitle: '直连当前模型、工具插件与知识库检索',
                  selected: isStandardSelected,
                  onTap: () {
                    onSelectStandard();
                    Navigator.of(context).pop();
                  },
                ),
                const SizedBox(height: 14.0),
                const _SectionLabel('已发布 DAG 工作流'),
                const SizedBox(height: 6.0),
                workflowsAsync.when(
                  data: (list) {
                    if (list.isEmpty) {
                      return const _EmptyHint('暂无已发布的工作流，可在工作流目录中查看');
                    }
                    return Column(
                      children: list.map((wf) {
                        final isSelected = selectedWorkflowId == wf.id;
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 8.0),
                          child: _buildOptionTile(
                            context,
                            icon: Icons.account_tree_outlined,
                            title: wf.name,
                            subtitle:
                                'v${wf.version} · ${wf.displayGraph.nodes.length} 节点拓扑编排',
                            selected: isSelected,
                            onTap: () {
                              onSelectWorkflow(wf.id);
                              Navigator.of(context).pop();
                            },
                          ),
                        );
                      }).toList(),
                    );
                  },
                  loading: () => const Padding(
                    padding: EdgeInsets.symmetric(vertical: 12.0),
                    child: Center(
                      child: SizedBox(
                        width: 20.0,
                        height: 20.0,
                        child: CircularProgressIndicator(strokeWidth: 2.0),
                      ),
                    ),
                  ),
                  error: (_, __) => const _EmptyHint('工作流列表加载失败'),
                ),
                const SizedBox(height: 12.0),
                const _SectionLabel('智能体角色 / Swarm 协同团队'),
                const SizedBox(height: 6.0),
                rolesAsync.when(
                  data: (roles) {
                    if (roles.isEmpty) {
                      return const _EmptyHint('暂无自定义智能体角色');
                    }
                    return Column(
                      children: roles.map((role) {
                        final isSelected = selectedRoleId == role.id;
                        final desc = role.isTeam
                            ? 'Swarm 多智能体团队 (${role.subAgentRoleIds.length} 位协作者)'
                            : (role.description?.trim().isNotEmpty == true
                                  ? role.description!.trim()
                                  : '定制人设、模型绑定与专属工具集');
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 8.0),
                          child: _buildOptionTile(
                            context,
                            icon: role.isTeam
                                ? Icons.hub_outlined
                                : Icons.smart_toy_outlined,
                            title: role.name,
                            subtitle: desc,
                            selected: isSelected,
                            onTap: () {
                              onSelectRole(role.id);
                              Navigator.of(context).pop();
                            },
                          ),
                        );
                      }).toList(),
                    );
                  },
                  loading: () => const Padding(
                    padding: EdgeInsets.symmetric(vertical: 12.0),
                    child: Center(
                      child: SizedBox(
                        width: 20.0,
                        height: 20.0,
                        child: CircularProgressIndicator(strokeWidth: 2.0),
                      ),
                    ),
                  ),
                  error: (_, __) => const _EmptyHint('角色列表加载失败'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildOptionTile(
    BuildContext context, {
    required IconData icon,
    required String title,
    required String subtitle,
    required bool selected,
    required VoidCallback onTap,
  }) {
    return Material(
      color: selected ? const Color(0xFFEFF6FF) : const Color(0xFFF8FAFC),
      borderRadius: BorderRadius.circular(12.0),
      child: InkWell(
        borderRadius: BorderRadius.circular(12.0),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12.0, vertical: 11.0),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12.0),
            border: Border.all(
              color: selected
                  ? const Color(0xFF93C5FD)
                  : const Color(0xFFE2E8F0),
            ),
          ),
          child: Row(
            children: [
              Container(
                width: 32.0,
                height: 32.0,
                decoration: BoxDecoration(
                  color: selected ? Colors.white : const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(8.0),
                ),
                child: Icon(
                  icon,
                  size: 17.0,
                  color: selected ? StitchTokens.primary : const Color(0xFF475569),
                ),
              ),
              const SizedBox(width: 10.0),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: TextStyle(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w600,
                        color: selected
                            ? StitchTokens.primary
                            : StitchTokens.onSurface,
                      ),
                    ),
                    const SizedBox(height: 2.0),
                    Text(
                      subtitle,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 11.5,
                        color: Color(0xFF64748B),
                      ),
                    ),
                  ],
                ),
              ),
              if (selected)
                const Icon(
                  Icons.check_circle_rounded,
                  size: 18.0,
                  color: StitchTokens.primary,
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  final String text;
  const _SectionLabel(this.text);

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: const TextStyle(
        fontSize: 11.5,
        fontWeight: FontWeight.w600,
        color: Color(0xFF64748B),
      ),
    );
  }
}

class _EmptyHint extends StatelessWidget {
  final String text;
  const _EmptyHint(this.text);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6.0),
      child: Text(
        text,
        style: const TextStyle(fontSize: 12.0, color: Color(0xFF94A3B8)),
      ),
    );
  }
}
