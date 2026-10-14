import 'file_attachment_model.dart';
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
  final int? chunkIndex;

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
    this.chunkIndex,
  });

  factory SearchSourceModel.fromJson(Map<String, dynamic> json) {
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
      chunkIndex: (json['chunkIndex'] as num?)?.toInt(),
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
    if (chunkIndex != null) 'chunkIndex': chunkIndex,
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
  });

  bool get isUser => role == 'user';
  bool get isAssistant => role == 'assistant';

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

    final statusName = json['status'] as String? ?? 'done';
    final status = MessageStatus.values.firstWhere(
      (e) => e.name == statusName,
      orElse: () => MessageStatus.done,
    );

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
    );
  }
}
