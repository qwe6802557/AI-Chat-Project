import 'file_attachment_model.dart';

enum MessageStatus { sending, streaming, done, error }

/// 联网搜索来源数据模型
class SearchSourceModel {
  final int id;
  final String title;
  final String url;
  final String sitename;
  final String snippet;
  final String? icon;

  const SearchSourceModel({
    required this.id,
    required this.title,
    required this.url,
    this.sitename = '',
    this.snippet = '',
    this.icon,
  });

  factory SearchSourceModel.fromJson(Map<String, dynamic> json) {
    return SearchSourceModel(
      id: (json['id'] as num?)?.toInt() ?? 0,
      title: json['title'] as String? ?? '',
      url: json['url'] as String? ?? '',
      sitename: json['sitename'] as String? ?? '',
      snippet: json['snippet'] as String? ?? '',
      icon: json['icon'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'title': title,
    'url': url,
    'sitename': sitename,
    'snippet': snippet,
    if (icon != null) 'icon': icon,
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
    );
  }
}
