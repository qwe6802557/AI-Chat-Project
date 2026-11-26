/// 移动端知识库文档模型与 SSE 解析进度事件
class DocumentModel {
  final String id;
  final String knowledgeBaseId;
  final String title;
  final String fileName;
  final String fileType;
  final int fileSize;
  final String status;
  final String stage;
  final int progress;
  final int? processedChunks;
  final int? totalChunks;
  final String? errorMessage;
  final int chunkCount;
  final int charCount;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  const DocumentModel({
    required this.id,
    required this.knowledgeBaseId,
    required this.title,
    required this.fileName,
    required this.fileType,
    this.fileSize = 0,
    this.status = 'pending',
    this.stage = 'queued',
    this.progress = 0,
    this.processedChunks,
    this.totalChunks,
    this.errorMessage,
    this.chunkCount = 0,
    this.charCount = 0,
    this.createdAt,
    this.updatedAt,
  });

  bool get isCompleted => status == 'completed';
  bool get isProcessing => status == 'processing' || status == 'pending';
  bool get isFailed => status == 'failed';

  /// 当前解析阶段的人类可读标签
  String get stageLabel {
    if (isCompleted) return '就绪';
    if (isFailed) return '失败';
    switch (stage) {
      case 'parsing':
        return '提取文本';
      case 'chunking':
        return '语义切片';
      case 'embedding':
        if (totalChunks != null && totalChunks! > 0) {
          return '向量化 ${processedChunks ?? 0}/$totalChunks';
        }
        return '向量化';
      case 'saving':
        return '写入索引';
      case 'queued':
      default:
        return status == 'processing' ? '解析中' : '排队中';
    }
  }

  /// 格式化文件尺寸展示
  String get formattedSize {
    if (fileSize < 1024) return '$fileSize B';
    if (fileSize < 1024 * 1024) {
      return '${(fileSize / 1024).toStringAsFixed(1)} KB';
    }
    return '${(fileSize / (1024 * 1024)).toStringAsFixed(1)} MB';
  }

  DocumentModel copyWith({
    String? id,
    String? knowledgeBaseId,
    String? title,
    String? fileName,
    String? fileType,
    int? fileSize,
    String? status,
    String? stage,
    int? progress,
    int? processedChunks,
    int? totalChunks,
    String? errorMessage,
    bool clearErrorMessage = false,
    int? chunkCount,
    int? charCount,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return DocumentModel(
      id: id ?? this.id,
      knowledgeBaseId: knowledgeBaseId ?? this.knowledgeBaseId,
      title: title ?? this.title,
      fileName: fileName ?? this.fileName,
      fileType: fileType ?? this.fileType,
      fileSize: fileSize ?? this.fileSize,
      status: status ?? this.status,
      stage: stage ?? this.stage,
      progress: progress ?? this.progress,
      processedChunks: processedChunks ?? this.processedChunks,
      totalChunks: totalChunks ?? this.totalChunks,
      errorMessage: clearErrorMessage ? null : (errorMessage ?? this.errorMessage),
      chunkCount: chunkCount ?? this.chunkCount,
      charCount: charCount ?? this.charCount,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  factory DocumentModel.fromJson(Map<String, dynamic> json) {
    DateTime? parseDate(dynamic val) {
      if (val == null) return null;
      if (val is String) return DateTime.tryParse(val);
      return null;
    }

    final statusVal = json['status'] as String? ?? 'pending';
    final defaultStage = statusVal == 'completed'
        ? 'completed'
        : statusVal == 'failed'
            ? 'failed'
            : 'queued';

    return DocumentModel(
      id: json['id'] as String? ?? '',
      knowledgeBaseId: json['knowledgeBaseId'] as String? ?? '',
      title: json['title'] as String? ?? json['fileName'] as String? ?? '',
      fileName: json['fileName'] as String? ?? '',
      fileType: json['fileType'] as String? ?? '',
      fileSize: (json['fileSize'] as num?)?.toInt() ?? 0,
      status: statusVal,
      stage: json['stage'] as String? ?? defaultStage,
      progress: (json['progress'] as num?)?.toInt() ??
          (statusVal == 'completed' ? 100 : 0),
      processedChunks: (json['processedChunks'] as num?)?.toInt(),
      totalChunks: (json['totalChunks'] as num?)?.toInt(),
      errorMessage: json['errorMessage'] as String?,
      chunkCount: (json['chunkCount'] as num?)?.toInt() ?? 0,
      charCount: (json['charCount'] as num?)?.toInt() ?? 0,
      createdAt: parseDate(json['createdAt']),
      updatedAt: parseDate(json['updatedAt']),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'knowledgeBaseId': knowledgeBaseId,
      'title': title,
      'fileName': fileName,
      'fileType': fileType,
      'fileSize': fileSize,
      'status': status,
      'stage': stage,
      'progress': progress,
      if (processedChunks != null) 'processedChunks': processedChunks,
      if (totalChunks != null) 'totalChunks': totalChunks,
      if (errorMessage != null) 'errorMessage': errorMessage,
      'chunkCount': chunkCount,
      'charCount': charCount,
      if (createdAt != null) 'createdAt': createdAt!.toIso8601String(),
      if (updatedAt != null) 'updatedAt': updatedAt!.toIso8601String(),
    };
  }
}

/// 知识库 SSE 文档解析快照条目
class DocumentProgressSnapshotItem {
  final String documentId;
  final String knowledgeBaseId;
  final String status;
  final String stage;
  final int progress;
  final int? chunkCount;
  final int? charCount;
  final String? errorMessage;

  const DocumentProgressSnapshotItem({
    required this.documentId,
    required this.knowledgeBaseId,
    required this.status,
    required this.stage,
    required this.progress,
    this.chunkCount,
    this.charCount,
    this.errorMessage,
  });

  factory DocumentProgressSnapshotItem.fromJson(Map<String, dynamic> json) {
    return DocumentProgressSnapshotItem(
      documentId: json['documentId'] as String? ?? '',
      knowledgeBaseId: json['knowledgeBaseId'] as String? ?? '',
      status: json['status'] as String? ?? 'pending',
      stage: json['stage'] as String? ?? 'queued',
      progress: (json['progress'] as num?)?.toInt() ?? 0,
      chunkCount: (json['chunkCount'] as num?)?.toInt(),
      charCount: (json['charCount'] as num?)?.toInt(),
      errorMessage: json['errorMessage'] as String?,
    );
  }
}

/// 知识库 SSE 文档解析流式事件
class DocumentProgressEvent {
  final String type;
  final String? documentId;
  final String knowledgeBaseId;
  final String? status;
  final String? stage;
  final int? progress;
  final int? processedChunks;
  final int? totalChunks;
  final int? chunkCount;
  final int? charCount;
  final String? errorMessage;
  final List<DocumentProgressSnapshotItem> documents;

  const DocumentProgressEvent({
    required this.type,
    this.documentId,
    required this.knowledgeBaseId,
    this.status,
    this.stage,
    this.progress,
    this.processedChunks,
    this.totalChunks,
    this.chunkCount,
    this.charCount,
    this.errorMessage,
    this.documents = const [],
  });

  factory DocumentProgressEvent.fromJson(Map<String, dynamic> json) {
    final rawDocs = json['documents'] as List?;
    return DocumentProgressEvent(
      type: json['type'] as String? ?? 'progress',
      documentId: json['documentId'] as String?,
      knowledgeBaseId: json['knowledgeBaseId'] as String? ?? '',
      status: json['status'] as String?,
      stage: json['stage'] as String?,
      progress: (json['progress'] as num?)?.toInt(),
      processedChunks: (json['processedChunks'] as num?)?.toInt(),
      totalChunks: (json['totalChunks'] as num?)?.toInt(),
      chunkCount: (json['chunkCount'] as num?)?.toInt(),
      charCount: (json['charCount'] as num?)?.toInt(),
      errorMessage: json['errorMessage'] as String?,
      documents: rawDocs == null
          ? const []
          : rawDocs
              .whereType<Map<String, dynamic>>()
              .map(DocumentProgressSnapshotItem.fromJson)
              .toList(),
    );
  }
}
