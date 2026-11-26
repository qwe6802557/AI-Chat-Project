/// 日常情境记忆分类（与后端 MemoryCategory 严格对齐）
enum MemoryCategory {
  fact('fact', '事实', 'FACT'),
  preference('preference', '偏好', 'PREFERENCE'),
  decision('decision', '决策', 'DECISION'),
  todo('todo', '待办', 'TODO');

  final String code;
  final String label;
  final String badge;

  const MemoryCategory(this.code, this.label, this.badge);

  static MemoryCategory fromCode(String? raw) {
    for (final cat in MemoryCategory.values) {
      if (cat.code == raw) return cat;
    }
    return MemoryCategory.fact;
  }
}

/// Layer 3 长期核心画像模型
class AgentCoreProfileModel {
  final String id;
  final String userId;
  final Map<String, dynamic> preferences;
  final Map<String, dynamic> facts;
  final String rawSummary;
  final int version;
  final String createdAt;
  final String updatedAt;

  const AgentCoreProfileModel({
    required this.id,
    required this.userId,
    required this.preferences,
    required this.facts,
    required this.rawSummary,
    required this.version,
    required this.createdAt,
    required this.updatedAt,
  });

  factory AgentCoreProfileModel.fromJson(Map<String, dynamic> json) {
    return AgentCoreProfileModel(
      id: (json['id'] ?? '').toString(),
      userId: (json['userId'] ?? '').toString(),
      preferences: json['preferences'] is Map
          ? Map<String, dynamic>.from(json['preferences'] as Map)
          : const {},
      facts: json['facts'] is Map
          ? Map<String, dynamic>.from(json['facts'] as Map)
          : const {},
      rawSummary: (json['rawSummary'] ?? '').toString(),
      version: (json['version'] is num) ? (json['version'] as num).toInt() : 1,
      createdAt: (json['createdAt'] ?? '').toString(),
      updatedAt: (json['updatedAt'] ?? '').toString(),
    );
  }
}

/// Layer 2 日常情境记忆条目模型
class AgentDailyMemoryModel {
  final String id;
  final String userId;
  final String? sessionId;
  final String dateKey;
  final String category;
  final String content;
  final bool isArchived;
  final double? score;
  final String createdAt;
  final String updatedAt;

  const AgentDailyMemoryModel({
    required this.id,
    required this.userId,
    this.sessionId,
    required this.dateKey,
    required this.category,
    required this.content,
    required this.isArchived,
    this.score,
    required this.createdAt,
    required this.updatedAt,
  });

  String get categoryBadge {
    for (final cat in MemoryCategory.values) {
      if (cat.code == category) return cat.badge;
    }
    return category.toUpperCase();
  }

  factory AgentDailyMemoryModel.fromJson(Map<String, dynamic> json) {
    final rawScore = json['score'];
    return AgentDailyMemoryModel(
      id: (json['id'] ?? '').toString(),
      userId: (json['userId'] ?? '').toString(),
      sessionId: json['sessionId']?.toString(),
      dateKey: (json['dateKey'] ?? '').toString(),
      category: (json['category'] ?? 'fact').toString(),
      content: (json['content'] ?? '').toString(),
      isArchived: json['isArchived'] == true,
      score: rawScore is num ? rawScore.toDouble() : null,
      createdAt: (json['createdAt'] ?? '').toString(),
      updatedAt: (json['updatedAt'] ?? '').toString(),
    );
  }
}

/// 日常记忆分页与检索结果
class DailyMemoryPageModel {
  final List<AgentDailyMemoryModel> items;
  final int total;
  final int page;
  final int limit;
  final int totalPages;

  const DailyMemoryPageModel({
    required this.items,
    required this.total,
    required this.page,
    required this.limit,
    required this.totalPages,
  });

  factory DailyMemoryPageModel.fromJson(Map<String, dynamic> json) {
    final rawItems = json['items'] is List ? json['items'] as List : const [];
    return DailyMemoryPageModel(
      items: rawItems
          .whereType<Map>()
          .map((e) => AgentDailyMemoryModel.fromJson(Map<String, dynamic>.from(e)))
          .toList(),
      total: (json['total'] is num) ? (json['total'] as num).toInt() : 0,
      page: (json['page'] is num) ? (json['page'] as num).toInt() : 1,
      limit: (json['limit'] is num) ? (json['limit'] as num).toInt() : 20,
      totalPages:
          (json['totalPages'] is num) ? (json['totalPages'] as num).toInt() : 0,
    );
  }
}

/// 手动录入或语义去重写入响应
class UpsertDailyMemoryResult {
  final AgentDailyMemoryModel item;
  final String action;
  final double? similarity;

  const UpsertDailyMemoryResult({
    required this.item,
    required this.action,
    this.similarity,
  });

  bool get isMerged => action == 'merged';

  factory UpsertDailyMemoryResult.fromJson(Map<String, dynamic> json) {
    final rawItem = json['item'] is Map
        ? Map<String, dynamic>.from(json['item'] as Map)
        : <String, dynamic>{};
    final rawSimilarity = json['similarity'];
    return UpsertDailyMemoryResult(
      item: AgentDailyMemoryModel.fromJson(rawItem),
      action: (json['action'] ?? 'created').toString(),
      similarity: rawSimilarity is num ? rawSimilarity.toDouble() : null,
    );
  }
}
