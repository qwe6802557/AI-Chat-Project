import 'package:flutter_test/flutter_test.dart';
import 'package:ai_chat_mobile/features/chat/presentation/widgets/model_switcher_bottom_sheet.dart';

void main() {
  group('ModelSwitcher Configuration', () {
    test('模型列表完整包含 7 个对话模型、排序与 PC 端一致并严格排除纯生图模型', () {
      final modelIds = kAvailableChatModels.map((m) => m.id).toList();

      // 与 PC 端 PREFERRED_MODEL_ORDER 严格一致的顺序
      expect(modelIds, [
        'grok-chat-fast',
        'grok-4.3',
        'grok-4.5',
        'grok-4.6',
        'grok-4.7',
        'grok-build-0.1',
        'grok-composer-2.5-fast',
      ]);

      // 严格隔离生图专用模型
      expect(modelIds.contains('grok-imagine-image-2.0'), isFalse);

      // 聊天对话统一为 10 算力点
      for (final m in kAvailableChatModels) {
        expect(m.cost, 10);
      }
    });
  });
}
