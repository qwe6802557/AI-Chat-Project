/// 会话列表项领域实体
class ChatSessionModel {
  final String id;
  final String title;
  final String? lastMessagePreview;
  final String? lastModel;
  final int messageCount;
  final DateTime createdAt;
  final DateTime updatedAt;

  const ChatSessionModel({
    required this.id,
    required this.title,
    this.lastMessagePreview,
    this.lastModel,
    this.messageCount = 0,
    required this.createdAt,
    required this.updatedAt,
  });

  factory ChatSessionModel.fromJson(Map<String, dynamic> json) {
    return ChatSessionModel(
      id: json['id'] as String,
      title: (json['title'] as String?) ?? '新对话',
      lastMessagePreview: json['lastMessagePreview'] as String?,
      lastModel: (json['usageSummary'] as Map<String, dynamic>?)?['lastModel'] as String?,
      messageCount: (json['messageCount'] as num?)?.toInt() ?? 0,
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '') ?? DateTime.now(),
      updatedAt: DateTime.tryParse(json['updatedAt'] as String? ?? '') ?? DateTime.now(),
    );
  }
}
