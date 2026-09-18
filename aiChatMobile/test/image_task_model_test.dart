import 'package:flutter_test/flutter_test.dart';
import 'package:ai_chat_mobile/features/explore/domain/image_task_model.dart';

void main() {
  group('ImageTaskModel', () {
    test('正确解析后端返回的生图任务结构', () {
      final json = {
        'id': 'task-999',
        'prompt': 'A cybernetic laboratory with glowing glassware',
        'model': 'grok-imagine-image-2.0',
        'aspect_ratio': '16:9',
        'resolution': '2k',
        'imageUrls': [
          'https://aichat.yanggenbwebsite.site/images/media/sample.jpg',
        ],
        'status': 'completed',
        'createdAt': '2026-09-18T12:00:00.000Z',
      };

      final model = ImageTaskModel.fromJson(json);

      expect(model.id, 'task-999');
      expect(model.prompt, 'A cybernetic laboratory with glowing glassware');
      expect(model.model, 'grok-imagine-image-2.0');
      expect(model.aspectRatio, '16:9');
      expect(model.resolution, '2k');
      expect(model.imageUrls.length, 1);
      expect(model.status, 'completed');
    });
  });
}
