import 'dart:typed_data';
import 'package:flutter_test/flutter_test.dart';
import 'package:ai_chat_mobile/features/chat/domain/file_attachment_model.dart';
import 'package:ai_chat_mobile/features/chat/domain/chat_message_model.dart';

void main() {
  group('AttachmentItem & FileAttachmentModel Tests', () {
    test('formattedSize 格式化文件大小准确', () {
      const small = AttachmentItem(
        id: '1',
        name: 'test.txt',
        sizeBytes: 512,
        isImage: false,
      );
      expect(small.formattedSize, '512 B');

      const medium = AttachmentItem(
        id: '2',
        name: 'image.png',
        sizeBytes: 2048,
        isImage: true,
      );
      expect(medium.formattedSize, '2.0 KB');

      const large = AttachmentItem(
        id: '3',
        name: 'big.jpg',
        sizeBytes: 3 * 1024 * 1024,
        isImage: true,
      );
      expect(large.formattedSize, '3.0 MB');
    });

    test('toJson 和 fromJson 互转序列化一致性', () {
      const item = AttachmentItem(
        id: 'att-101',
        localPath: '/storage/emulated/0/photo.jpg',
        name: 'photo.jpg',
        sizeBytes: 1048576,
        isImage: true,
        mimeType: 'image/jpeg',
        serverFileId: 'srv-file-999',
        serverUrl: 'http://localhost:3000/uploads/photo.jpg',
        status: AttachmentUploadStatus.success,
      );

      final json = item.toJson();
      expect(json['id'], 'att-101');
      expect(json['serverFileId'], 'srv-file-999');
      expect(json['status'], 'success');

      final reconstructed = AttachmentItem.fromJson(json);
      expect(reconstructed.id, item.id);
      expect(reconstructed.localPath, item.localPath);
      expect(reconstructed.name, item.name);
      expect(reconstructed.sizeBytes, item.sizeBytes);
      expect(reconstructed.isImage, item.isImage);
      expect(reconstructed.mimeType, item.mimeType);
      expect(reconstructed.serverFileId, item.serverFileId);
      expect(reconstructed.serverUrl, item.serverUrl);
      expect(reconstructed.status, AttachmentUploadStatus.success);
    });

    test('copyWith 正确覆盖与维护状态', () {
      const initial = AttachmentItem(
        id: 'att-1',
        name: 'code.dart',
        sizeBytes: 1024,
        isImage: false,
        status: AttachmentUploadStatus.pending,
      );

      final updated = initial.copyWith(
        status: AttachmentUploadStatus.uploading,
        textContent: 'void main() {}',
      );

      expect(updated.id, 'att-1');
      expect(updated.name, 'code.dart');
      expect(updated.status, AttachmentUploadStatus.uploading);
      expect(updated.textContent, 'void main() {}');
    });

    test('ChatMessageModel 成功携带 attachments 并支持 copyWith', () {
      const item = AttachmentItem(
        id: 'att-2',
        name: 'avatar.png',
        sizeBytes: 4096,
        isImage: true,
      );

      final now = DateTime.now();
      final msg = ChatMessageModel(
        id: 'msg-1',
        sessionId: 'session-1',
        role: 'user',
        content: '这是我的图片',
        createdAt: now,
        attachments: const [item],
      );

      expect(msg.attachments.length, 1);
      expect(msg.attachments.first.name, 'avatar.png');

      final copied = msg.copyWith(content: '新文本');
      expect(copied.content, '新文本');
      expect(copied.attachments.length, 1);
      expect(copied.attachments.first.id, 'att-2');
    });

    test('AttachmentItem 支持内存字节 Uint8List 并能在 copyWith 中传递', () {
      final sampleBytes = Uint8List.fromList([1, 2, 3, 4]);
      final item = AttachmentItem(
        id: 'att-bytes',
        name: 'web_image.png',
        bytes: sampleBytes,
        sizeBytes: 4,
        isImage: true,
      );

      expect(item.bytes, sampleBytes);
      expect(item.localPath, isNull);

      final updated = item.copyWith(serverFileId: 'uploaded-123');
      expect(updated.bytes, sampleBytes);
      expect(updated.serverFileId, 'uploaded-123');
    });
  });
}
