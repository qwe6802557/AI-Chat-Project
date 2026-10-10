import 'package:flutter_test/flutter_test.dart';
import 'package:ai_chat_mobile/features/chat/data/file_upload_repository.dart';
import 'package:ai_chat_mobile/features/chat/domain/file_attachment_model.dart';

void main() {
  group('AttachmentItem & UploadedImageResult', () {
    test('parses UploadedImageResult document metadata from backend json', () {
      final result = UploadedImageResult.fromJson({
        'id': 'doc-101',
        'url': '/files/doc-101',
        'name': 'architecture.pdf',
        'mime': 'application/pdf',
        'category': 'pdf',
        'sizeBytes': 4096,
        'charCount': 1280,
        'extractedText': 'PDF parsed text content',
      });

      expect(result.id, 'doc-101');
      expect(result.category, 'pdf');
      expect(result.sizeBytes, 4096);
      expect(result.charCount, 1280);
      expect(result.extractedText, 'PDF parsed text content');
    });

    test('computes badgeLabel and formattedMeta for PDF and Markdown attachments', () {
      const pdfAttachment = AttachmentItem(
        id: 'att-1',
        name: 'report.pdf',
        sizeBytes: 2048,
        isImage: false,
        charCount: 960,
        textContent: 'Report body',
        status: AttachmentUploadStatus.success,
      );

      expect(pdfAttachment.badgeLabel, 'PDF');
      expect(pdfAttachment.formattedSize, '2.0 KB');
      expect(pdfAttachment.formattedMeta, '2.0 KB · 已解析 960 字');

      const mdAttachment = AttachmentItem(
        id: 'att-2',
        name: 'README.markdown',
        sizeBytes: 512,
        isImage: false,
        textContent: 'Hello world',
        status: AttachmentUploadStatus.success,
      );

      expect(mdAttachment.badgeLabel, 'MD');
      expect(mdAttachment.formattedMeta, '512 B · 已解析 11 字');
    });
  });
}
