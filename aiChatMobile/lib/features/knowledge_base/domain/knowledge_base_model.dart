/// 移动端知识库领域模型 (Stitch Clean Architecture)
class KnowledgeBaseModel {
  final String id;
  final String name;
  final String description;
  final String avatar;
  final String status;
  final int documentCount;
  final int chunkCount;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  const KnowledgeBaseModel({
    required this.id,
    required this.name,
    this.description = '',
    this.avatar = 'auto_stories',
    this.status = 'active',
    this.documentCount = 0,
    this.chunkCount = 0,
    this.createdAt,
    this.updatedAt,
  });

  bool get isActive => status == 'active';

  factory KnowledgeBaseModel.fromJson(Map<String, dynamic> json) {
    final bool isActive = json['isActive'] is bool
        ? json['isActive'] as bool
        : json['status'] != 'disabled';

    DateTime? parseDate(dynamic val) {
      if (val == null) return null;
      if (val is String) return DateTime.tryParse(val);
      return null;
    }

    return KnowledgeBaseModel(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      description: json['description'] as String? ?? '',
      avatar: json['avatar'] as String? ?? 'auto_stories',
      status: isActive ? 'active' : 'disabled',
      documentCount: (json['documentCount'] as num?)?.toInt() ?? 0,
      chunkCount: (json['chunkCount'] as num?)?.toInt() ?? 0,
      createdAt: parseDate(json['createdAt']),
      updatedAt: parseDate(json['updatedAt']),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'description': description,
      'avatar': avatar,
      'status': status,
      'documentCount': documentCount,
      'chunkCount': chunkCount,
      if (createdAt != null) 'createdAt': createdAt!.toIso8601String(),
      if (updatedAt != null) 'updatedAt': updatedAt!.toIso8601String(),
    };
  }

  KnowledgeBaseModel copyWith({
    String? id,
    String? name,
    String? description,
    String? avatar,
    String? status,
    int? documentCount,
    int? chunkCount,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return KnowledgeBaseModel(
      id: id ?? this.id,
      name: name ?? this.name,
      description: description ?? this.description,
      avatar: avatar ?? this.avatar,
      status: status ?? this.status,
      documentCount: documentCount ?? this.documentCount,
      chunkCount: chunkCount ?? this.chunkCount,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}
