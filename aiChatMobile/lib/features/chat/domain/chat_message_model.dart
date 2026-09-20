import 'file_attachment_model.dart';

enum MessageStatus { sending, streaming, done, error }

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
    );
  }
}
