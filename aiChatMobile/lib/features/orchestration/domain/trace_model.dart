/// 分布式执行追踪链路汇总模型
class AgentTraceItemModel {
  final String id;
  final String traceId;
  final String source;
  final String? workflowId;
  final String? sessionId;
  final String? channelInstanceId;
  final String? roleId;
  final String? title;
  final String status;
  final int durationMs;
  final int totalPromptTokens;
  final int totalCompletionTokens;
  final double totalCredits;
  final String? errorSummary;
  final DateTime createdAt;

  const AgentTraceItemModel({
    required this.id,
    required this.traceId,
    required this.source,
    this.workflowId,
    this.sessionId,
    this.channelInstanceId,
    this.roleId,
    this.title,
    required this.status,
    this.durationMs = 0,
    this.totalPromptTokens = 0,
    this.totalCompletionTokens = 0,
    this.totalCredits = 0,
    this.errorSummary,
    required this.createdAt,
  });

  int get totalTokens => totalPromptTokens + totalCompletionTokens;

  String get shortId => traceId.length > 8
      ? traceId.substring(traceId.length - 8)
      : traceId;

  String get sourceLabel {
    switch (source) {
      case 'workflow_debug':
        return '工作流调试';
      case 'workflow_chat':
        return '工作流对话';
      case 'channel':
        return 'IM 通道';
      default:
        return 'Web/App 对话';
    }
  }

  factory AgentTraceItemModel.fromJson(Map<String, dynamic> json) {
    return AgentTraceItemModel(
      id: (json['id'] ?? '').toString(),
      traceId: (json['traceId'] ?? '').toString(),
      source: (json['source'] ?? 'web_chat').toString(),
      workflowId: json['workflowId'] as String?,
      sessionId: json['sessionId'] as String?,
      channelInstanceId: json['channelInstanceId'] as String?,
      roleId: json['roleId'] as String?,
      title: json['title'] as String?,
      status: (json['status'] ?? 'completed').toString(),
      durationMs: (json['durationMs'] as num?)?.toInt() ?? 0,
      totalPromptTokens: (json['totalPromptTokens'] as num?)?.toInt() ?? 0,
      totalCompletionTokens:
          (json['totalCompletionTokens'] as num?)?.toInt() ?? 0,
      totalCredits: (json['totalCredits'] as num?)?.toDouble() ?? 0,
      errorSummary: json['errorSummary'] as String?,
      createdAt:
          DateTime.tryParse((json['createdAt'] ?? '').toString()) ??
          DateTime.now(),
    );
  }
}

/// 分布式追踪子 Span 节点模型
class AgentSpanItemModel {
  final String id;
  final String traceId;
  final String spanId;
  final String? parentSpanId;
  final String? nodeId;
  final String spanType;
  final String name;
  final String? modelId;
  final String status;
  final int startedAt;
  final int durationMs;
  final int promptTokens;
  final int completionTokens;
  final double estimatedCredits;
  final String? inputSummary;
  final String? outputSummary;

  const AgentSpanItemModel({
    required this.id,
    required this.traceId,
    required this.spanId,
    this.parentSpanId,
    this.nodeId,
    required this.spanType,
    required this.name,
    this.modelId,
    required this.status,
    required this.startedAt,
    this.durationMs = 0,
    this.promptTokens = 0,
    this.completionTokens = 0,
    this.estimatedCredits = 0,
    this.inputSummary,
    this.outputSummary,
  });

  int get totalTokens => promptTokens + completionTokens;

  factory AgentSpanItemModel.fromJson(Map<String, dynamic> json) {
    return AgentSpanItemModel(
      id: (json['id'] ?? '').toString(),
      traceId: (json['traceId'] ?? '').toString(),
      spanId: (json['spanId'] ?? '').toString(),
      parentSpanId: json['parentSpanId'] as String?,
      nodeId: json['nodeId'] as String?,
      spanType: (json['spanType'] ?? 'llm').toString(),
      name: (json['name'] ?? 'Span').toString(),
      modelId: json['modelId'] as String?,
      status: (json['status'] ?? 'completed').toString(),
      startedAt: (json['startedAt'] as num?)?.toInt() ?? 0,
      durationMs: (json['durationMs'] as num?)?.toInt() ?? 0,
      promptTokens: (json['promptTokens'] as num?)?.toInt() ?? 0,
      completionTokens: (json['completionTokens'] as num?)?.toInt() ?? 0,
      estimatedCredits: (json['estimatedCredits'] as num?)?.toDouble() ?? 0,
      inputSummary: json['inputSummary'] as String?,
      outputSummary: json['outputSummary'] as String?,
    );
  }
}

/// Trace KPI 聚合统计模型
class TraceStatsSummaryModel {
  final int days;
  final int totalTraces;
  final int completedCount;
  final int failedCount;
  final double successRate;
  final int p95DurationMs;
  final int totalTokens;
  final double totalCredits;

  const TraceStatsSummaryModel({
    this.days = 7,
    this.totalTraces = 0,
    this.completedCount = 0,
    this.failedCount = 0,
    this.successRate = 0,
    this.p95DurationMs = 0,
    this.totalTokens = 0,
    this.totalCredits = 0,
  });

  factory TraceStatsSummaryModel.fromJson(Map<String, dynamic> json) {
    return TraceStatsSummaryModel(
      days: (json['days'] as num?)?.toInt() ?? 7,
      totalTraces: (json['totalTraces'] as num?)?.toInt() ?? 0,
      completedCount: (json['completedCount'] as num?)?.toInt() ?? 0,
      failedCount: (json['failedCount'] as num?)?.toInt() ?? 0,
      successRate: (json['successRate'] as num?)?.toDouble() ?? 0,
      p95DurationMs: (json['p95DurationMs'] as num?)?.toInt() ?? 0,
      totalTokens: (json['totalTokens'] as num?)?.toInt() ?? 0,
      totalCredits: (json['totalCredits'] as num?)?.toDouble() ?? 0,
    );
  }
}

/// Trace 完整详情 + Span 列表
class TraceDetailModel {
  final AgentTraceItemModel trace;
  final List<AgentSpanItemModel> spans;

  const TraceDetailModel({required this.trace, required this.spans});

  factory TraceDetailModel.fromJson(Map<String, dynamic> json) {
    final rawSpans = (json['spans'] as List?) ?? const [];
    return TraceDetailModel(
      trace: AgentTraceItemModel.fromJson(
        (json['trace'] as Map<String, dynamic>?) ?? const {},
      ),
      spans: rawSpans
          .whereType<Map<String, dynamic>>()
          .map(AgentSpanItemModel.fromJson)
          .toList(),
    );
  }
}
