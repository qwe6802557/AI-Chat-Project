/// 会话列表项领域实体
class ChatSessionModel {
  final String id;
  final String title;
  final String? lastMessagePreview;
  final String? lastModel;
  final int messageCount;
  final List<String> knowledgeBaseIds;
  final DateTime createdAt;
  final DateTime updatedAt;

  const ChatSessionModel({
    required this.id,
    required this.title,
    this.lastMessagePreview,
    this.lastModel,
    this.messageCount = 0,
    this.knowledgeBaseIds = const [],
    required this.createdAt,
    required this.updatedAt,
  });

  factory ChatSessionModel.fromJson(Map<String, dynamic> json) {
    final rawKbIds = json['knowledgeBaseIds'];
    final List<String> kbIds = rawKbIds is List
        ? rawKbIds.map((e) => e.toString()).toList()
        : const [];

    return ChatSessionModel(
      id: json['id'] as String,
      title: (json['title'] as String?) ?? '新对话',
      lastMessagePreview: json['lastMessagePreview'] as String?,
      lastModel: (json['usageSummary'] as Map<String, dynamic>?)?['lastModel'] as String?,
      messageCount: (json['messageCount'] as num?)?.toInt() ?? 0,
      knowledgeBaseIds: kbIds,
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '') ?? DateTime.now(),
      updatedAt: DateTime.tryParse(json['updatedAt'] as String? ?? '') ?? DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'title': title,
    'lastMessagePreview': lastMessagePreview,
    if (lastModel != null) 'usageSummary': {'lastModel': lastModel},
    'messageCount': messageCount,
    'knowledgeBaseIds': knowledgeBaseIds,
    'createdAt': createdAt.toIso8601String(),
    'updatedAt': updatedAt.toIso8601String(),
  };
}
