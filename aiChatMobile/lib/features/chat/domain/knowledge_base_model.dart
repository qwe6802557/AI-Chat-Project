/// 知识库移动端领域模型
class KnowledgeBaseModel {
  final String id;
  final String name;
  final String description;
  final int documentCount;
  final int chunkCount;
  final String status;

  const KnowledgeBaseModel({
    required this.id,
    required this.name,
    this.description = '',
    this.documentCount = 0,
    this.chunkCount = 0,
    this.status = 'active',
  });

  factory KnowledgeBaseModel.fromJson(Map<String, dynamic> json) {
    final bool isActive = json['isActive'] is bool
        ? json['isActive'] as bool
        : json['status'] != 'disabled';
    return KnowledgeBaseModel(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      description: json['description'] as String? ?? '',
      documentCount: (json['documentCount'] as num?)?.toInt() ?? 0,
      chunkCount: (json['chunkCount'] as num?)?.toInt() ?? 0,
      status: isActive ? 'active' : 'disabled',
    );
  }
}
