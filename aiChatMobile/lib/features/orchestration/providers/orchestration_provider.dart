import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../auth/providers/auth_provider.dart';
import '../data/orchestration_repository.dart';
import '../domain/channel_model.dart';
import '../domain/trace_model.dart';
import '../domain/workflow_model.dart';

final orchestrationRepositoryProvider = Provider<OrchestrationRepository>((ref) {
  final client = ref.watch(dioClientProvider);
  return OrchestrationRepository(client);
});

/// 已发布工作流列表（用于对话编排选择与通道绑定）
final publishedWorkflowsProvider =
    FutureProvider.autoDispose<List<WorkflowItemModel>>((ref) async {
      final repo = ref.watch(orchestrationRepositoryProvider);
      return repo.getPublishedWorkflows();
    });

/// 全部工作流目录（含草稿与发布态）
final allWorkflowsProvider =
    FutureProvider.autoDispose<List<WorkflowItemModel>>((ref) async {
      final repo = ref.watch(orchestrationRepositoryProvider);
      return repo.getWorkflows();
    });

/// 当前用户智能体角色与 Swarm 团队列表
final agentRolesProvider =
    FutureProvider.autoDispose<List<AgentRoleModel>>((ref) async {
      final repo = ref.watch(orchestrationRepositoryProvider);
      return repo.getRoles();
    });

/// 五大 IM 智能助理通道实例状态列表
final channelInstancesProvider =
    FutureProvider.autoDispose<List<ChannelInstanceModel>>((ref) async {
      final repo = ref.watch(orchestrationRepositoryProvider);
      return repo.getInstances();
    });

/// 单个分布式 Trace 详情与 Span 瀑布流
final traceDetailProvider =
    FutureProvider.autoDispose.family<TraceDetailModel, String>((ref, traceId) async {
      final repo = ref.watch(orchestrationRepositoryProvider);
      return repo.getTraceDetail(traceId);
    });
