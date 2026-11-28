import '../../../core/constants/api_constants.dart';
import '../../knowledge_base/domain/chunk_model.dart';
import 'file_attachment_model.dart';
import 'swarm_timeline_event_model.dart';
import 'tool_model.dart';

enum MessageStatus { sending, streaming, done, error, failedOffline }

/// 联网搜索来源数据模型
class SearchSourceModel {
  final int id;
  final String title;
  final String url;
  final String sitename;
  final String snippet;
  final String? icon;
  final bool isKnowledgeBase;
  final double? score;
  final String? knowledgeBaseId;
  final String? documentId;
  final String? chunkId;
  final int? chunkIndex;
  final String? hitSource;
  final double? denseScore;
  final double? rerankScore;
  final List<String> matchedTerms;
  final List<HighlightSpan> highlights;
  final String? chunkType;
  final String? assetId;
  final String? assetType;
  final String? visualType;
  final int? pageNumber;
  final String? visualAssetUrl;
  final bool visualInjected;

  const SearchSourceModel({
    required this.id,
    required this.title,
    required this.url,
    this.sitename = '',
    this.snippet = '',
    this.icon,
    this.isKnowledgeBase = false,
    this.score,
    this.knowledgeBaseId,
    this.documentId,
    this.chunkId,
    this.chunkIndex,
    this.hitSource,
    this.denseScore,
    this.rerankScore,
    this.matchedTerms = const [],
    this.highlights = const [],
    this.chunkType,
    this.assetId,
    this.assetType,
    this.visualType,
    this.pageNumber,
    this.visualAssetUrl,
    this.visualInjected = false,
  });

  /// 解析可供原生网络组件直接加载的视觉资产绝对 URL
  String? get resolvedVisualAssetUrl =>
      ApiConstants.resolveUrl(visualAssetUrl);

  factory SearchSourceModel.fromJson(Map<String, dynamic> json) {
    final rawHighlights = json['highlights'] as List? ?? [];
    final rawTerms = json['matchedTerms'] as List? ?? [];

    return SearchSourceModel(
      id: (json['id'] as num?)?.toInt() ?? 0,
      title: json['title'] as String? ?? '',
      url: json['url'] as String? ?? '',
      sitename: json['sitename'] as String? ?? '',
      snippet: json['snippet'] as String? ?? '',
      icon: json['icon'] as String?,
      isKnowledgeBase: json['isKnowledgeBase'] as bool? ?? false,
      score: (json['score'] as num?)?.toDouble(),
      knowledgeBaseId: json['knowledgeBaseId'] as String?,
      documentId: json['documentId'] as String?,
      chunkId: json['chunkId'] as String?,
      chunkIndex: (json['chunkIndex'] as num?)?.toInt(),
      hitSource: json['hitSource'] as String?,
      denseScore: (json['denseScore'] as num?)?.toDouble(),
      rerankScore: (json['rerankScore'] as num?)?.toDouble(),
      matchedTerms: rawTerms.whereType<String>().toList(),
      highlights: rawHighlights
          .whereType<Map<String, dynamic>>()
          .map(HighlightSpan.fromJson)
          .toList(),
      chunkType: json['chunkType'] as String?,
      assetId: json['assetId'] as String?,
      assetType: json['assetType'] as String?,
      visualType: json['visualType'] as String?,
      pageNumber: (json['pageNumber'] as num?)?.toInt(),
      visualAssetUrl: json['visualAssetUrl'] as String?,
      visualInjected: json['visualInjected'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'title': title,
    'url': url,
    'sitename': sitename,
    'snippet': snippet,
    if (icon != null) 'icon': icon,
    'isKnowledgeBase': isKnowledgeBase,
    if (score != null) 'score': score,
    if (knowledgeBaseId != null) 'knowledgeBaseId': knowledgeBaseId,
    if (documentId != null) 'documentId': documentId,
    if (chunkId != null) 'chunkId': chunkId,
    if (chunkIndex != null) 'chunkIndex': chunkIndex,
    if (hitSource != null) 'hitSource': hitSource,
    if (denseScore != null) 'denseScore': denseScore,
    if (rerankScore != null) 'rerankScore': rerankScore,
    if (matchedTerms.isNotEmpty) 'matchedTerms': matchedTerms,
    if (highlights.isNotEmpty) 'highlights': highlights.map((h) => h.toJson()).toList(),
    if (chunkType != null) 'chunkType': chunkType,
    if (assetId != null) 'assetId': assetId,
    if (assetType != null) 'assetType': assetType,
    if (visualType != null) 'visualType': visualType,
    if (pageNumber != null) 'pageNumber': pageNumber,
    if (visualAssetUrl != null) 'visualAssetUrl': visualAssetUrl,
    if (visualInjected) 'visualInjected': visualInjected,
  };
}

/// 对话消息领域实体
class ChatMessageModel {
  final String id;
  final String sessionId;
  final String role;
  final String content;
  final String? reasoningContent;
  final int reasoningDurationSeconds;
  final String? model;
  final MessageStatus status;
  final String? errorMessage;
  final DateTime createdAt;
  final List<AttachmentItem> attachments;
  final String? searchStatus;
  final List<SearchSourceModel> sources;
  final List<ToolExecutionRecordModel> toolCalls;
  final List<SwarmTimelineEventModel> agentTimeline;
  final String? traceId;
  final int? durationMs;
  final int? totalTokens;
  final bool? isKnowledgeBaseEnabled;
  final bool? isWebSearchEnabled;

  const ChatMessageModel({
    required this.id,
    required this.sessionId,
    required this.role,
    required this.content,
    this.reasoningContent,
    this.reasoningDurationSeconds = 0,
    this.model,
    this.status = MessageStatus.done,
    this.errorMessage,
    required this.createdAt,
    this.attachments = const [],
    this.searchStatus,
    this.sources = const [],
    this.toolCalls = const [],
    this.agentTimeline = const [],
    this.traceId,
    this.durationMs,
    this.totalTokens,
    this.isKnowledgeBaseEnabled,
    this.isWebSearchEnabled,
  });

  bool get isUser => role == 'user';
  bool get isAssistant => role == 'assistant';
  bool get hasContent => content.trim().isNotEmpty;
  bool get hasSources => sources.isNotEmpty;
  bool get hasAgentTimeline => agentTimeline.isNotEmpty;

  ChatMessageModel copyWith({
    String? id,
    String? sessionId,
    String? role,
    String? content,
    String? reasoningContent,
    int? reasoningDurationSeconds,
    String? model,
    MessageStatus? status,
    String? errorMessage,
    DateTime? createdAt,
    List<AttachmentItem>? attachments,
    String? searchStatus,
    List<SearchSourceModel>? sources,
    List<ToolExecutionRecordModel>? toolCalls,
    List<SwarmTimelineEventModel>? agentTimeline,
    String? traceId,
    int? durationMs,
    int? totalTokens,
    bool? isKnowledgeBaseEnabled,
    bool? isWebSearchEnabled,
  }) {
    return ChatMessageModel(
      id: id ?? this.id,
      sessionId: sessionId ?? this.sessionId,
      role: role ?? this.role,
      content: content ?? this.content,
      reasoningContent: reasoningContent ?? this.reasoningContent,
      reasoningDurationSeconds: reasoningDurationSeconds ?? this.reasoningDurationSeconds,
      model: model ?? this.model,
      status: status ?? this.status,
      errorMessage: errorMessage ?? this.errorMessage,
      createdAt: createdAt ?? this.createdAt,
      attachments: attachments ?? this.attachments,
      searchStatus: searchStatus ?? this.searchStatus,
      sources: sources ?? this.sources,
      toolCalls: toolCalls ?? this.toolCalls,
      agentTimeline: agentTimeline ?? this.agentTimeline,
      traceId: traceId ?? this.traceId,
      durationMs: durationMs ?? this.durationMs,
      totalTokens: totalTokens ?? this.totalTokens,
      isKnowledgeBaseEnabled: isKnowledgeBaseEnabled ?? this.isKnowledgeBaseEnabled,
      isWebSearchEnabled: isWebSearchEnabled ?? this.isWebSearchEnabled,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'sessionId': sessionId,
    'role': role,
    'content': content,
    if (reasoningContent != null) 'reasoningContent': reasoningContent,
    'reasoningDurationSeconds': reasoningDurationSeconds,
    if (model != null) 'model': model,
    'status': status.name,
    if (errorMessage != null) 'errorMessage': errorMessage,
    'createdAt': createdAt.toIso8601String(),
    'attachments': attachments.map((a) => a.toJson()).toList(),
    if (searchStatus != null) 'searchStatus': searchStatus,
    'sources': sources.map((s) => s.toJson()).toList(),
    'toolCalls': toolCalls.map((t) => t.toJson()).toList(),
    if (agentTimeline.isNotEmpty)
      'agentTimeline': agentTimeline.map((e) => e.toJson()).toList(),
    if (traceId != null) 'traceId': traceId,
    if (durationMs != null) 'durationMs': durationMs,
    if (totalTokens != null) 'totalTokens': totalTokens,
    if (isKnowledgeBaseEnabled != null) 'isKnowledgeBaseEnabled': isKnowledgeBaseEnabled,
    if (isWebSearchEnabled != null) 'isWebSearchEnabled': isWebSearchEnabled,
  };

  factory ChatMessageModel.fromJson(Map<String, dynamic> json) {
    final rawAttachments = json['attachments'] as List? ?? [];
    final attachments = rawAttachments
        .whereType<Map<String, dynamic>>()
        .map((a) => AttachmentItem.fromJson(a))
        .toList();

    final rawSources = json['sources'] as List? ?? [];
    final sources = rawSources
        .whereType<Map<String, dynamic>>()
        .map((s) => SearchSourceModel.fromJson(s))
        .toList();

    final rawToolCalls = json['toolCalls'] as List? ?? [];
    final toolCalls = rawToolCalls
        .whereType<Map<String, dynamic>>()
        .map((t) => ToolExecutionRecordModel.fromJson(t))
        .toList();

    final rawTimeline = json['agentTimeline'] as List? ?? [];
    final agentTimeline = rawTimeline
        .whereType<Map<String, dynamic>>()
        .map((e) => SwarmTimelineEventModel.fromJson(e))
        .toList();

    final statusName = json['status'] as String? ?? 'done';
    final status = MessageStatus.values.firstWhere(
      (e) => e.name == statusName,
      orElse: () => MessageStatus.done,
    );

    final rawUsage = json['usage'];
    final tokens = (json['totalTokens'] as num?)?.toInt() ??
        (rawUsage is Map<String, dynamic>
            ? (rawUsage['totalTokens'] as num?)?.toInt()
            : null);

    return ChatMessageModel(
      id: json['id'] as String? ?? '',
      sessionId: json['sessionId'] as String? ?? '',
      role: json['role'] as String? ?? 'user',
      content: json['content'] as String? ?? '',
      reasoningContent: json['reasoningContent'] as String?,
      reasoningDurationSeconds: (json['reasoningDurationSeconds'] as num?)?.toInt() ?? 0,
      model: json['model'] as String?,
      status: status,
      errorMessage: json['errorMessage'] as String?,
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '') ?? DateTime.now(),
      attachments: attachments,
      searchStatus: json['searchStatus'] as String?,
      sources: sources,
      toolCalls: toolCalls,
      agentTimeline: agentTimeline,
      traceId: json['traceId'] as String?,
      durationMs: (json['durationMs'] as num?)?.toInt(),
      totalTokens: tokens,
      isKnowledgeBaseEnabled: json['isKnowledgeBaseEnabled'] as bool?,
      isWebSearchEnabled: json['isWebSearchEnabled'] as bool?,
    );
  }
}
