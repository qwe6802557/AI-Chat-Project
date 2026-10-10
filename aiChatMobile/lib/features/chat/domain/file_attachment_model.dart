import 'dart:typed_data';

enum AttachmentUploadStatus { pending, uploading, success, error }

/// 聊天附件项数据实体（支持图片与多格式文档，跨平台兼容 Web 与 Native）
class AttachmentItem {
  final String id;
  final String? localPath;
  final Uint8List? bytes;
  final String name;
  final int sizeBytes;
  final bool isImage;
  final String? mimeType;
  final String? serverFileId;
  final String? serverUrl;
  final int? charCount;
  final String? textContent;
  final AttachmentUploadStatus status;
  final String? errorMessage;

  const AttachmentItem({
    required this.id,
    this.localPath,
    this.bytes,
    required this.name,
    required this.sizeBytes,
    required this.isImage,
    this.mimeType,
    this.serverFileId,
    this.serverUrl,
    this.charCount,
    this.textContent,
    this.status = AttachmentUploadStatus.pending,
    this.errorMessage,
  });

  AttachmentItem copyWith({
    String? id,
    String? localPath,
    Uint8List? bytes,
    String? name,
    int? sizeBytes,
    bool? isImage,
    String? mimeType,
    String? serverFileId,
    String? serverUrl,
    int? charCount,
    String? textContent,
    AttachmentUploadStatus? status,
    String? errorMessage,
  }) {
    return AttachmentItem(
      id: id ?? this.id,
      localPath: localPath ?? this.localPath,
      bytes: bytes ?? this.bytes,
      name: name ?? this.name,
      sizeBytes: sizeBytes ?? this.sizeBytes,
      isImage: isImage ?? this.isImage,
      mimeType: mimeType ?? this.mimeType,
      serverFileId: serverFileId ?? this.serverFileId,
      serverUrl: serverUrl ?? this.serverUrl,
      charCount: charCount ?? this.charCount,
      textContent: textContent ?? this.textContent,
      status: status ?? this.status,
      errorMessage: errorMessage ?? this.errorMessage,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'localPath': localPath,
      'name': name,
      'sizeBytes': sizeBytes,
      'isImage': isImage,
      'mimeType': mimeType,
      'serverFileId': serverFileId,
      'serverUrl': serverUrl,
      'charCount': charCount,
      'textContent': textContent,
      'status': status.name,
      'errorMessage': errorMessage,
    };
  }

  factory AttachmentItem.fromJson(Map<String, dynamic> json) {
    return AttachmentItem(
      id: json['id'] as String? ?? '',
      localPath: json['localPath'] as String?,
      name: json['name'] as String? ?? '',
      sizeBytes: (json['sizeBytes'] as num?)?.toInt() ?? 0,
      isImage: json['isImage'] as bool? ?? false,
      mimeType: json['mimeType'] as String?,
      serverFileId: json['serverFileId'] as String?,
      serverUrl: json['serverUrl'] as String?,
      charCount: (json['charCount'] as num?)?.toInt(),
      textContent: json['textContent'] as String?,
      status: AttachmentUploadStatus.values.firstWhere(
        (e) => e.name == json['status'],
        orElse: () => AttachmentUploadStatus.pending,
      ),
      errorMessage: json['errorMessage'] as String?,
    );
  }

  String get badgeLabel {
    final dotIndex = name.lastIndexOf('.');
    if (dotIndex != -1 && dotIndex < name.length - 1) {
      final ext = name.substring(dotIndex + 1).toUpperCase();
      if (ext == 'MARKDOWN') return 'MD';
      return ext.length > 5 ? ext.substring(0, 5) : ext;
    }
    if (mimeType == 'application/pdf') return 'PDF';
    return 'DOC';
  }

  String get formattedSize {
    if (sizeBytes < 1024) return '$sizeBytes B';
    if (sizeBytes < 1024 * 1024) {
      return '${(sizeBytes / 1024).toStringAsFixed(1)} KB';
    }
    return '${(sizeBytes / (1024 * 1024)).toStringAsFixed(1)} MB';
  }

  String get formattedMeta {
    final effectiveChars = charCount ?? textContent?.length;
    if (effectiveChars != null && effectiveChars > 0) {
      return '$formattedSize · 已解析 $effectiveChars 字';
    }
    return formattedSize;
  }
}
