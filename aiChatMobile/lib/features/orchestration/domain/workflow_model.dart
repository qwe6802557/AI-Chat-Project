import 'package:ai_chat_mobile/features/chat/domain/swarm_timeline_event_model.dart';

/// DAG 工作流节点模型（供移动端只读拓扑概览与调试状态跟踪使用）
class DagWorkflowNodeModel {
  final String id;
  final String type;
  final String label;
  final String? description;
  final String? modelId;
  final String? roleId;
  final String? toolName;
  final String? defaultInput;
  final double posX;
  final double posY;

  const DagWorkflowNodeModel({
    required this.id,
    required this.type,
    required this.label,
    this.description,
    this.modelId,
    this.roleId,
    this.toolName,
    this.defaultInput,
    this.posX = 0,
    this.posY = 0,
  });

  factory DagWorkflowNodeModel.fromJson(Map<String, dynamic> json) {
    final data = json['data'] is Map<String, dynamic>
        ? json['data'] as Map<String, dynamic>
        : const <String, dynamic>{};
    final pos = json['position'] is Map<String, dynamic>
        ? json['position'] as Map<String, dynamic>
        : const <String, dynamic>{};
    return DagWorkflowNodeModel(
      id: (json['id'] ?? '').toString(),
      type: (json['type'] ?? 'agent').toString(),
      label: (data['label'] ?? json['type'] ?? '节点').toString(),
      description: data['description'] as String?,
      modelId: data['modelId'] as String?,
      roleId: data['roleId'] as String?,
      toolName: data['toolName'] as String?,
      defaultInput: data['defaultInput'] as String?,
      posX: (pos['x'] as num?)?.toDouble() ?? 0,
      posY: (pos['y'] as num?)?.toDouble() ?? 0,
    );
  }
}

/// DAG 工作流边连接模型
class DagWorkflowEdgeModel {
  final String id;
  final String source;
  final String target;
  final String? sourceHandle;
  final String? label;

  const DagWorkflowEdgeModel({
    required this.id,
    required this.source,
    required this.target,
    this.sourceHandle,
    this.label,
  });

  factory DagWorkflowEdgeModel.fromJson(Map<String, dynamic> json) {
    return DagWorkflowEdgeModel(
      id: (json['id'] ?? '').toString(),
      source: (json['source'] ?? '').toString(),
      target: (json['target'] ?? '').toString(),
      sourceHandle: json['sourceHandle'] as String?,
      label: json['label'] as String?,
    );
  }
}

/// DAG 工作流拓扑图模型
class DagWorkflowGraphModel {
  final List<DagWorkflowNodeModel> nodes;
  final List<DagWorkflowEdgeModel> edges;

  const DagWorkflowGraphModel({
    this.nodes = const [],
    this.edges = const [],
  });

  factory DagWorkflowGraphModel.fromJson(Map<String, dynamic>? json) {
    if (json == null) return const DagWorkflowGraphModel();
    final rawNodes = (json['nodes'] as List?) ?? const [];
    final rawEdges = (json['edges'] as List?) ?? const [];
    return DagWorkflowGraphModel(
      nodes: rawNodes
          .whereType<Map<String, dynamic>>()
          .map(DagWorkflowNodeModel.fromJson)
          .toList(),
      edges: rawEdges
          .whereType<Map<String, dynamic>>()
          .map(DagWorkflowEdgeModel.fromJson)
          .toList(),
    );
  }

  /// 按拓扑边依赖顺序生成移动端纵向浏览列表
  List<DagWorkflowNodeModel> get orderedNodes {
    if (nodes.isEmpty) return const [];
    final nodeMap = {for (final n in nodes) n.id: n};
    final inDegree = {for (final n in nodes) n.id: 0};
    final adj = <String, List<String>>{for (final n in nodes) n.id: []};

    for (final e in edges) {
      if (nodeMap.containsKey(e.source) && nodeMap.containsKey(e.target)) {
        adj[e.source]!.add(e.target);
        inDegree[e.target] = (inDegree[e.target] ?? 0) + 1;
      }
    }

    final queue = <String>[
      for (final n in nodes)
        if ((inDegree[n.id] ?? 0) == 0) n.id,
    ];
    final ordered = <DagWorkflowNodeModel>[];
    final visited = <String>{};

    while (queue.isNotEmpty) {
      final curr = queue.removeAt(0);
      if (!visited.add(curr)) continue;
      final node = nodeMap[curr];
      if (node != null) ordered.add(node);
      for (final next in adj[curr] ?? const <String>[]) {
        final nextIn = (inDegree[next] ?? 1) - 1;
        inDegree[next] = nextIn;
        if (nextIn <= 0) queue.add(next);
      }
    }

    for (final n in nodes) {
      if (!visited.contains(n.id)) ordered.add(n);
    }
    return ordered;
  }
}

/// 智能体 DAG 工作流定义实体
class WorkflowItemModel {
  final String id;
  final String name;
  final String? description;
  final String status;
  final int version;
  final DagWorkflowGraphModel draftGraph;
  final DagWorkflowGraphModel? publishedGraph;
  final DateTime? publishedAt;
  final DateTime? updatedAt;

  const WorkflowItemModel({
    required this.id,
    required this.name,
    this.description,
    this.status = 'draft',
    this.version = 1,
    this.draftGraph = const DagWorkflowGraphModel(),
    this.publishedGraph,
    this.publishedAt,
    this.updatedAt,
  });

  bool get isPublished => status == 'published';

  DagWorkflowGraphModel get displayGraph => publishedGraph ?? draftGraph;

  factory WorkflowItemModel.fromJson(Map<String, dynamic> json) {
    return WorkflowItemModel(
      id: (json['id'] ?? '').toString(),
      name: (json['name'] ?? '未命名工作流').toString(),
      description: json['description'] as String?,
      status: (json['status'] ?? 'draft').toString(),
      version: (json['version'] as num?)?.toInt() ?? 1,
      draftGraph: DagWorkflowGraphModel.fromJson(
        json['draftGraph'] as Map<String, dynamic>?,
      ),
      publishedGraph: json['publishedGraph'] is Map<String, dynamic>
          ? DagWorkflowGraphModel.fromJson(
              json['publishedGraph'] as Map<String, dynamic>,
            )
          : null,
      publishedAt: json['publishedAt'] != null
          ? DateTime.tryParse(json['publishedAt'].toString())
          : null,
      updatedAt: json['updatedAt'] != null
          ? DateTime.tryParse(json['updatedAt'].toString())
          : null,
    );
  }
}

/// DAG 工作流流式调试事件模型
class DagDebugStreamEventModel {
  final String type;
  final String? traceId;
  final String? nodeId;
  final String? nodeType;
  final String? label;
  final String? status;
  final String? modelId;
  final int? durationMs;
  final String? outputSnippet;
  final String? content;
  final String? error;
  final SwarmTimelineEventModel? timelineEvent;
  final List<SwarmTimelineEventModel> timeline;

  const DagDebugStreamEventModel({
    required this.type,
    this.traceId,
    this.nodeId,
    this.nodeType,
    this.label,
    this.status,
    this.modelId,
    this.durationMs,
    this.outputSnippet,
    this.content,
    this.error,
    this.timelineEvent,
    this.timeline = const [],
  });

  factory DagDebugStreamEventModel.fromJson(Map<String, dynamic> json) {
    final rawList = (json['timeline'] as List?) ?? const [];
    return DagDebugStreamEventModel(
      type: (json['type'] ?? '').toString(),
      traceId: json['traceId'] as String?,
      nodeId: json['nodeId'] as String?,
      nodeType: json['nodeType'] as String?,
      label: json['label'] as String?,
      status: json['status'] as String?,
      modelId: json['modelId'] as String?,
      durationMs: (json['durationMs'] as num?)?.toInt(),
      outputSnippet: json['outputSnippet'] as String?,
      content: (json['content'] ?? json['message']) as String?,
      error: json['error'] as String?,
      timelineEvent: json['timelineEvent'] is Map<String, dynamic>
          ? SwarmTimelineEventModel.fromJson(
              json['timelineEvent'] as Map<String, dynamic>,
            )
          : null,
      timeline: rawList
          .whereType<Map<String, dynamic>>()
          .map(SwarmTimelineEventModel.fromJson)
          .toList(),
    );
  }
}
