import '../../../core/constants/api_constants.dart';

/// 高亮匹配字符区间
class HighlightSpan {
  final int start;
  final int end;
  final String term;

  const HighlightSpan({
    required this.start,
    required this.end,
    required this.term,
  });

  factory HighlightSpan.fromJson(Map<String, dynamic> json) {
    return HighlightSpan(
      start: (json['start'] as num?)?.toInt() ?? 0,
      end: (json['end'] as num?)?.toInt() ?? 0,
      term: json['term'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() => {
    'start': start,
    'end': end,
    'term': term,
  };
}

/// 移动端知识库切片明细模型
class ChunkModel {
  final String id;
  final String knowledgeBaseId;
  final String documentId;
  final String? documentTitle;
  final int chunkIndex;
  final String content;
  final int charCount;
  final bool isEnabled;
  final double? score;
  final String? hitSource;
  final double? denseScore;
  final int? denseRank;
  final int? sparseRank;
  final double? rerankScore;
  final bool rerankApplied;
  final List<String> matchedTerms;
  final List<HighlightSpan> highlights;
  final String? chunkType;
  final String? assetId;
  final String? assetType;
  final String? visualType;
  final int? pageNumber;
  final String? visualAssetUrl;
  final Map<String, dynamic>? metadata;
  final DateTime? createdAt;

  const ChunkModel({
    required this.id,
    required this.knowledgeBaseId,
    required this.documentId,
    this.documentTitle,
    required this.chunkIndex,
    required this.content,
    this.charCount = 0,
    this.isEnabled = true,
    this.score,
    this.hitSource,
    this.denseScore,
    this.denseRank,
    this.sparseRank,
    this.rerankScore,
    this.rerankApplied = false,
    this.matchedTerms = const [],
    this.highlights = const [],
    this.chunkType,
    this.assetId,
    this.assetType,
    this.visualType,
    this.pageNumber,
    this.visualAssetUrl,
    this.metadata,
    this.createdAt,
  });

  /// 解析可供原生网络组件直接加载的视觉资产绝对 URL
  String? get resolvedVisualAssetUrl {
    final raw = visualAssetUrl;
    if (raw == null || raw.isEmpty) return null;
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      return raw;
    }
    return '${ApiConstants.baseUrl}$raw';
  }

  ChunkModel copyWith({
    String? content,
    int? charCount,
    bool? isEnabled,
    double? score,
    List<HighlightSpan>? highlights,
  }) {
    return ChunkModel(
      id: id,
      knowledgeBaseId: knowledgeBaseId,
      documentId: documentId,
      documentTitle: documentTitle,
      chunkIndex: chunkIndex,
      content: content ?? this.content,
      charCount: charCount ?? this.charCount,
      isEnabled: isEnabled ?? this.isEnabled,
      score: score ?? this.score,
      hitSource: hitSource,
      denseScore: denseScore,
      denseRank: denseRank,
      sparseRank: sparseRank,
      rerankScore: rerankScore,
      rerankApplied: rerankApplied,
      matchedTerms: matchedTerms,
      highlights: highlights ?? this.highlights,
      chunkType: chunkType,
      assetId: assetId,
      assetType: assetType,
      visualType: visualType,
      pageNumber: pageNumber,
      visualAssetUrl: visualAssetUrl,
      metadata: metadata,
      createdAt: createdAt,
    );
  }

  factory ChunkModel.fromJson(Map<String, dynamic> json) {
    DateTime? parseDate(dynamic val) {
      if (val == null) return null;
      if (val is String) return DateTime.tryParse(val);
      return null;
    }

    final rawHighlights = json['highlights'] as List? ?? [];
    final highlights = rawHighlights
        .whereType<Map<String, dynamic>>()
        .map(HighlightSpan.fromJson)
        .toList();

    final rawTerms = json['matchedTerms'] as List? ?? [];
    final matchedTerms = rawTerms.whereType<String>().toList();

    return ChunkModel(
      id: json['id'] as String? ?? json['chunkId'] as String? ?? '',
      knowledgeBaseId: json['knowledgeBaseId'] as String? ?? '',
      documentId: json['documentId'] as String? ?? '',
      documentTitle: json['documentTitle'] as String?,
      chunkIndex: (json['chunkIndex'] as num?)?.toInt() ?? 0,
      content: json['content'] as String? ?? '',
      charCount: (json['charCount'] as num?)?.toInt() ?? (json['content'] as String? ?? '').length,
      isEnabled: json['isEnabled'] as bool? ?? true,
      score: (json['score'] as num?)?.toDouble() ?? (json['similarity'] as num?)?.toDouble(),
      hitSource: json['hitSource'] as String?,
      denseScore: (json['denseScore'] as num?)?.toDouble(),
      denseRank: (json['denseRank'] as num?)?.toInt(),
      sparseRank: (json['sparseRank'] as num?)?.toInt(),
      rerankScore: (json['rerankScore'] as num?)?.toDouble(),
      rerankApplied: json['rerankApplied'] as bool? ?? false,
      matchedTerms: matchedTerms,
      highlights: highlights,
      chunkType: json['chunkType'] as String?,
      assetId: json['assetId'] as String?,
      assetType: json['assetType'] as String?,
      visualType: json['visualType'] as String?,
      pageNumber: (json['pageNumber'] as num?)?.toInt(),
      visualAssetUrl: json['visualAssetUrl'] as String?,
      metadata: json['metadata'] is Map<String, dynamic> ? json['metadata'] as Map<String, dynamic> : null,
      createdAt: parseDate(json['createdAt']),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'knowledgeBaseId': knowledgeBaseId,
      'documentId': documentId,
      if (documentTitle != null) 'documentTitle': documentTitle,
      'chunkIndex': chunkIndex,
      'content': content,
      'charCount': charCount,
      'isEnabled': isEnabled,
      if (score != null) 'score': score,
      if (hitSource != null) 'hitSource': hitSource,
      if (denseScore != null) 'denseScore': denseScore,
      if (denseRank != null) 'denseRank': denseRank,
      if (sparseRank != null) 'sparseRank': sparseRank,
      if (rerankScore != null) 'rerankScore': rerankScore,
      'rerankApplied': rerankApplied,
      if (matchedTerms.isNotEmpty) 'matchedTerms': matchedTerms,
      if (highlights.isNotEmpty) 'highlights': highlights.map((h) => h.toJson()).toList(),
      if (chunkType != null) 'chunkType': chunkType,
      if (assetId != null) 'assetId': assetId,
      if (assetType != null) 'assetType': assetType,
      if (visualType != null) 'visualType': visualType,
      if (pageNumber != null) 'pageNumber': pageNumber,
      if (visualAssetUrl != null) 'visualAssetUrl': visualAssetUrl,
      if (metadata != null) 'metadata': metadata,
      if (createdAt != null) 'createdAt': createdAt!.toIso8601String(),
    };
  }
}

/// 上下文窗口所属文档元信息
class ChunkContextDocument {
  final String id;
  final String knowledgeBaseId;
  final String title;
  final String fileName;
  final String fileType;
  final int chunkCount;
  final int charCount;

  const ChunkContextDocument({
    required this.id,
    required this.knowledgeBaseId,
    required this.title,
    required this.fileName,
    required this.fileType,
    this.chunkCount = 0,
    this.charCount = 0,
  });

  factory ChunkContextDocument.fromJson(Map<String, dynamic> json) {
    return ChunkContextDocument(
      id: json['id'] as String? ?? '',
      knowledgeBaseId: json['knowledgeBaseId'] as String? ?? '',
      title: json['title'] as String? ?? '',
      fileName: json['fileName'] as String? ?? '',
      fileType: json['fileType'] as String? ?? '',
      chunkCount: (json['chunkCount'] as num?)?.toInt() ?? 0,
      charCount: (json['charCount'] as num?)?.toInt() ?? 0,
    );
  }
}

/// 命中切片前后邻接上下文响应模型
class ChunkContextModel {
  final ChunkContextDocument document;
  final ChunkModel targetChunk;
  final List<ChunkModel> prevChunks;
  final List<ChunkModel> nextChunks;
  final int window;

  const ChunkContextModel({
    required this.document,
    required this.targetChunk,
    this.prevChunks = const [],
    this.nextChunks = const [],
    this.window = 1,
  });

  factory ChunkContextModel.fromJson(Map<String, dynamic> json) {
    final docJson = json['document'] as Map<String, dynamic>? ?? const {};
    final targetJson = json['targetChunk'] as Map<String, dynamic>? ?? const {};
    final prevRaw = json['prevChunks'] as List? ?? [];
    final nextRaw = json['nextChunks'] as List? ?? [];

    return ChunkContextModel(
      document: ChunkContextDocument.fromJson(docJson),
      targetChunk: ChunkModel.fromJson(targetJson),
      prevChunks: prevRaw
          .whereType<Map<String, dynamic>>()
          .map(ChunkModel.fromJson)
          .toList(),
      nextChunks: nextRaw
          .whereType<Map<String, dynamic>>()
          .map(ChunkModel.fromJson)
          .toList(),
      window: (json['window'] as num?)?.toInt() ?? 1,
    );
  }
}
