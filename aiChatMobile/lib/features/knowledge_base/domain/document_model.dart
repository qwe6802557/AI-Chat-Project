/// 移动端知识库文档模型
class DocumentModel {
  final String id;
  final String knowledgeBaseId;
  final String title;
  final String fileName;
  final String fileType;
  final int fileSize;
  final String status;
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
    this.errorMessage,
    this.chunkCount = 0,
    this.charCount = 0,
    this.createdAt,
    this.updatedAt,
  });

  bool get isCompleted => status == 'completed';
  bool get isProcessing => status == 'processing' || status == 'pending';
  bool get isFailed => status == 'failed';

  /// 格式化文件尺寸展示
  String get formattedSize {
    if (fileSize < 1024) return '$fileSize B';
    if (fileSize < 1024 * 1024) {
      return '${(fileSize / 1024).toStringAsFixed(1)} KB';
    }
    return '${(fileSize / (1024 * 1024)).toStringAsFixed(1)} MB';
  }

  factory DocumentModel.fromJson(Map<String, dynamic> json) {
    DateTime? parseDate(dynamic val) {
      if (val == null) return null;
      if (val is String) return DateTime.tryParse(val);
      return null;
    }

    return DocumentModel(
      id: json['id'] as String? ?? '',
      knowledgeBaseId: json['knowledgeBaseId'] as String? ?? '',
      title: json['title'] as String? ?? json['fileName'] as String? ?? '',
      fileName: json['fileName'] as String? ?? '',
      fileType: json['fileType'] as String? ?? '',
      fileSize: (json['fileSize'] as num?)?.toInt() ?? 0,
      status: json['status'] as String? ?? 'pending',
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
      if (errorMessage != null) 'errorMessage': errorMessage,
      'chunkCount': chunkCount,
      'charCount': charCount,
      if (createdAt != null) 'createdAt': createdAt!.toIso8601String(),
      if (updatedAt != null) 'updatedAt': updatedAt!.toIso8601String(),
    };
  }
}
