/// 移动端知识库切片明细模型
class ChunkModel {
  final String id;
  final String knowledgeBaseId;
  final String documentId;
  final int chunkIndex;
  final String content;
  final int charCount;
  final double? score;
  final Map<String, dynamic>? metadata;
  final DateTime? createdAt;

  const ChunkModel({
    required this.id,
    required this.knowledgeBaseId,
    required this.documentId,
    required this.chunkIndex,
    required this.content,
    this.charCount = 0,
    this.score,
    this.metadata,
    this.createdAt,
  });

  factory ChunkModel.fromJson(Map<String, dynamic> json) {
    DateTime? parseDate(dynamic val) {
      if (val == null) return null;
      if (val is String) return DateTime.tryParse(val);
      return null;
    }

    return ChunkModel(
      id: json['id'] as String? ?? '',
      knowledgeBaseId: json['knowledgeBaseId'] as String? ?? '',
      documentId: json['documentId'] as String? ?? '',
      chunkIndex: (json['chunkIndex'] as num?)?.toInt() ?? 0,
      content: json['content'] as String? ?? '',
      charCount: (json['charCount'] as num?)?.toInt() ?? (json['content'] as String? ?? '').length,
      score: (json['score'] as num?)?.toDouble() ?? (json['similarity'] as num?)?.toDouble(),
      metadata: json['metadata'] is Map<String, dynamic> ? json['metadata'] as Map<String, dynamic> : null,
      createdAt: parseDate(json['createdAt']),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'knowledgeBaseId': knowledgeBaseId,
      'documentId': documentId,
      'chunkIndex': chunkIndex,
      'content': content,
      'charCount': charCount,
      if (score != null) 'score': score,
      if (metadata != null) 'metadata': metadata,
      if (createdAt != null) 'createdAt': createdAt!.toIso8601String(),
    };
  }
}
