import 'dart:async';
import 'dart:convert';
import 'package:dio/dio.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/network/dio_client.dart';
import '../domain/channel_model.dart';
import '../domain/trace_model.dart';
import '../domain/workflow_model.dart';

/// 阶段 4：工作流、Trace 可观测与全渠道智能助理统一仓储
class OrchestrationRepository {
  final DioClient _client;

  OrchestrationRepository(this._client);

  dynamic _unwrap(dynamic raw) {
    if (raw is Map<String, dynamic> && raw.containsKey('code')) {
      if (raw['code'] != 0) {
        throw Exception(raw['message'] ?? '接口请求失败');
      }
      return raw['data'];
    }
    return raw;
  }

  // ================= DAG 工作流 =================

  Future<List<WorkflowItemModel>> getWorkflows() async {
    final resp = await _client.dio.get(ApiConstants.workflows);
    final data = _unwrap(resp.data);
    if (data is! List) return const [];
    return data
        .whereType<Map<String, dynamic>>()
        .map(WorkflowItemModel.fromJson)
        .toList();
  }

  Future<List<WorkflowItemModel>> getPublishedWorkflows() async {
    final resp = await _client.dio.get(ApiConstants.workflowsPublished);
    final data = _unwrap(resp.data);
    if (data is! List) return const [];
    return data
        .whereType<Map<String, dynamic>>()
        .map(WorkflowItemModel.fromJson)
        .toList();
  }

  Future<WorkflowItemModel> getWorkflowDetail(String id) async {
    final resp = await _client.dio.get('${ApiConstants.workflows}/$id');
    final data = _unwrap(resp.data) as Map<String, dynamic>;
    return WorkflowItemModel.fromJson(data);
  }

  Future<WorkflowItemModel> publishWorkflow(String id) async {
    final resp = await _client.dio.post('${ApiConstants.workflows}/$id/publish');
    final data = _unwrap(resp.data) as Map<String, dynamic>;
    return WorkflowItemModel.fromJson(data);
  }

  Future<Stream<DagDebugStreamEventModel>> debugRunWorkflow(
    String workflowId,
    String input, {
    CancelToken? cancelToken,
  }) async {
    final resp = await _client.dio.post<ResponseBody>(
      '${ApiConstants.workflows}/$workflowId/debug-run',
      data: {'input': input},
      options: Options(
        responseType: ResponseType.stream,
        receiveTimeout: const Duration(minutes: 4),
        headers: {'Accept': 'text/event-stream'},
      ),
      cancelToken: cancelToken,
    );

    final byteStream = resp.data?.stream;
    if (byteStream == null) {
      throw Exception('未收到工作流调试事件流');
    }

    return byteStream
        .cast<List<int>>()
        .transform(utf8.decoder)
        .transform(const LineSplitter())
        .transform(
          StreamTransformer<String, DagDebugStreamEventModel>.fromHandlers(
            handleData: (line, sink) {
              final trimmed = line.trim();
              if (!trimmed.startsWith('data:')) return;
              final payload = trimmed.substring(5).trim();
              if (payload.isEmpty || payload == '[DONE]') return;
              try {
                final decoded = jsonDecode(payload);
                if (decoded is Map<String, dynamic>) {
                  sink.add(DagDebugStreamEventModel.fromJson(decoded));
                }
              } catch (_) {}
            },
          ),
        );
  }

  // ================= 分布式 Trace 可观测 =================

  Future<TraceStatsSummaryModel> getTraceStats({
    String? source,
    int days = 7,
  }) async {
    final resp = await _client.dio.get(
      ApiConstants.tracesStats,
      queryParameters: {
        'days': days,
        if (source != null && source.isNotEmpty) 'source': source,
      },
    );
    final data = _unwrap(resp.data);
    if (data is Map<String, dynamic>) {
      return TraceStatsSummaryModel.fromJson(data);
    }
    return const TraceStatsSummaryModel();
  }

  Future<({List<AgentTraceItemModel> items, int total})> getTraceList({
    String? source,
    String? status,
    String? workflowId,
    String? channelInstanceId,
    int days = 7,
    int page = 1,
    int pageSize = 20,
  }) async {
    final resp = await _client.dio.get(
      ApiConstants.traces,
      queryParameters: {
        'days': days,
        'page': page,
        'pageSize': pageSize,
        if (source != null && source.isNotEmpty) 'source': source,
        if (status != null && status.isNotEmpty) 'status': status,
        if (workflowId != null && workflowId.isNotEmpty)
          'workflowId': workflowId,
        if (channelInstanceId != null && channelInstanceId.isNotEmpty)
          'channelInstanceId': channelInstanceId,
      },
    );
    final data = _unwrap(resp.data);
    if (data is! Map<String, dynamic>) {
      return (items: const <AgentTraceItemModel>[], total: 0);
    }
    final rawItems = (data['items'] as List?) ?? const [];
    final items = rawItems
        .whereType<Map<String, dynamic>>()
        .map(AgentTraceItemModel.fromJson)
        .toList();
    return (items: items, total: (data['total'] as num?)?.toInt() ?? items.length);
  }

  Future<TraceDetailModel> getTraceDetail(String traceId) async {
    final resp = await _client.dio.get('${ApiConstants.traces}/$traceId');
    final data = _unwrap(resp.data) as Map<String, dynamic>;
    return TraceDetailModel.fromJson(data);
  }

  // ================= 角色与全 IM 通道台 =================

  Future<List<AgentRoleModel>> getRoles() async {
    final resp = await _client.dio.get(ApiConstants.channelRoles);
    final data = _unwrap(resp.data);
    if (data is! List) return const [];
    return data
        .whereType<Map<String, dynamic>>()
        .map(AgentRoleModel.fromJson)
        .toList();
  }

  Future<List<ChannelInstanceModel>> getInstances() async {
    final resp = await _client.dio.get(ApiConstants.channelInstances);
    final data = _unwrap(resp.data);
    if (data is! List) return const [];
    return data
        .whereType<Map<String, dynamic>>()
        .map(ChannelInstanceModel.fromJson)
        .toList();
  }

  Future<ChannelInstanceModel> toggleInstance(
    String instanceId,
    bool enabled,
  ) async {
    final resp = await _client.dio.post(
      '${ApiConstants.channelInstances}/$instanceId/toggle',
      data: {'enabled': enabled},
    );
    final data = _unwrap(resp.data) as Map<String, dynamic>;
    return ChannelInstanceModel.fromJson(data);
  }

  Future<ChannelInstanceModel> updateInstanceSettings(
    String instanceId, {
    String? instanceName,
    String? roleId,
    bool clearRoleId = false,
    String? workflowId,
    bool clearWorkflowId = false,
    Map<String, dynamic>? credentials,
  }) async {
    final resp = await _client.dio.patch(
      '${ApiConstants.channelInstances}/$instanceId/settings',
      data: {
        if (instanceName != null) 'instanceName': instanceName,
        if (clearRoleId)
          'roleId': null
        else if (roleId != null)
          'roleId': roleId,
        if (clearWorkflowId)
          'workflowId': null
        else if (workflowId != null)
          'workflowId': workflowId,
        if (credentials != null && credentials.isNotEmpty)
          'credentials': credentials,
      },
    );
    final data = _unwrap(resp.data) as Map<String, dynamic>;
    return ChannelInstanceModel.fromJson(data);
  }

  Future<ChannelMetricsModel> getInstanceMetrics(String instanceId) async {
    final resp = await _client.dio.get(
      '${ApiConstants.channelInstances}/$instanceId/metrics',
    );
    final data = _unwrap(resp.data);
    if (data is Map<String, dynamic>) {
      return ChannelMetricsModel.fromJson(data);
    }
    return const ChannelMetricsModel();
  }

  Future<List<ChannelAuditSessionModel>> getInstanceSessions(
    String instanceId, {
    String? search,
  }) async {
    final resp = await _client.dio.get(
      '${ApiConstants.channelInstances}/$instanceId/sessions',
      queryParameters: {
        if (search != null && search.trim().isNotEmpty) 'search': search.trim(),
        'limit': 50,
      },
    );
    final data = _unwrap(resp.data);
    if (data is! List) return const [];
    return data
        .whereType<Map<String, dynamic>>()
        .map(ChannelAuditSessionModel.fromJson)
        .toList();
  }

  Future<List<ChannelAuditMessageModel>> getInstanceSessionMessages(
    String instanceId,
    String fromId,
  ) async {
    final encodedFromId = Uri.encodeComponent(fromId);
    final resp = await _client.dio.get(
      '${ApiConstants.channelInstances}/$instanceId/sessions/$encodedFromId/messages',
      queryParameters: {'page': 1, 'limit': 50},
    );
    final data = _unwrap(resp.data);
    if (data is! Map<String, dynamic>) return const [];
    final list = (data['list'] as List?) ?? const [];
    return list
        .whereType<Map<String, dynamic>>()
        .map(ChannelAuditMessageModel.fromJson)
        .toList();
  }
}
