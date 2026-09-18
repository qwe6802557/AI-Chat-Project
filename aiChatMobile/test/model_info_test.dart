import 'package:flutter_test/flutter_test.dart';
import 'package:ai_chat_mobile/features/chat/presentation/widgets/model_switcher_bottom_sheet.dart';

void main() {
  group('ModelSwitcher Configuration', () {
    test('模型列表完整包含对话模型并严格排除纯生图模型', () {
      final modelIds = kAvailableChatModels.map((m) => m.id).toList();

      expect(modelIds.contains('grok-chat-fast'), isTrue);
      expect(modelIds.contains('DeepSeek-R1'), isTrue);
      expect(modelIds.contains('grok-4.5'), isTrue);
      expect(modelIds.contains('GLM-5'), isTrue);
      expect(modelIds.contains('claude-opus-4-5'), isTrue);

      // 严格隔离生图专用模型
      expect(modelIds.contains('grok-imagine-image-2.0'), isFalse);

      // 聊天对话统一为 10 算力点
      for (final m in kAvailableChatModels) {
        expect(m.cost, 10);
      }
    });
  });
}
