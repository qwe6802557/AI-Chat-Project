/// 多智能体与 DAG 协同编排时间线节点事件模型（对齐后端 SwarmTimelineEvent）
class SwarmTimelineEventModel {
  final String id;
  final String type;
  final int timestamp;
  final String fromAgent;
  final String toAgent;
  final String? nodeId;
  final String? modelId;
  final String? task;
  final String? outputSnippet;
  final int? durationMs;
  final String status;

  const SwarmTimelineEventModel({
    required this.id,
    required this.type,
    required this.timestamp,
    required this.fromAgent,
    required this.toAgent,
    this.nodeId,
    this.modelId,
    this.task,
    this.outputSnippet,
    this.durationMs,
    this.status = 'completed',
  });

  bool get isRunning => status == 'running';
  bool get isCompleted => status == 'completed';
  bool get isFailed => status == 'failed';
  bool get isSkipped => status == 'skipped';

  factory SwarmTimelineEventModel.fromJson(Map<String, dynamic> json) {
    return SwarmTimelineEventModel(
      id: (json['id'] ?? '').toString(),
      type: (json['type'] ?? 'subagent_execution').toString(),
      timestamp: (json['timestamp'] as num?)?.toInt() ?? 0,
      fromAgent: (json['fromAgent'] ?? '系统调度').toString(),
      toAgent: (json['toAgent'] ?? '智能体').toString(),
      nodeId: json['nodeId'] as String?,
      modelId: json['modelId'] as String?,
      task: json['task'] as String?,
      outputSnippet: json['outputSnippet'] as String?,
      durationMs: (json['durationMs'] as num?)?.toInt(),
      status: (json['status'] ?? 'completed').toString(),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'type': type,
    'timestamp': timestamp,
    'fromAgent': fromAgent,
    'toAgent': toAgent,
    if (nodeId != null) 'nodeId': nodeId,
    if (modelId != null) 'modelId': modelId,
    if (task != null) 'task': task,
    if (outputSnippet != null) 'outputSnippet': outputSnippet,
    if (durationMs != null) 'durationMs': durationMs,
    'status': status,
  };
}
