import 'package:flutter_test/flutter_test.dart';
import 'package:ai_chat_mobile/features/chat/presentation/widgets/model_switcher_bottom_sheet.dart';

void main() {
  group('ModelSwitcher Configuration', () {
    test('模型列表完整包含 4 个对话模型、排序与 PC 端一致并严格排除纯生图模型', () {
      final modelIds = kAvailableChatModels.map((m) => m.id).toList();

      // 与 PC 端 PREFERRED_MODEL_ORDER 严格一致的顺序
      expect(modelIds, [
        'grok-chat-fast',
        'glm-4-flash',
        'deepseek-ai/DeepSeek-R1-Distill-Qwen-7B',
        'Qwen/Qwen2.5-Coder-7B-Instruct',
      ]);

      // 严格隔离生图专用模型
      expect(modelIds.contains('grok-imagine-image-lite'), isFalse);
      expect(modelIds.contains('grok-imagine-image-2.0'), isFalse);

      // 聊天对话统一为 10 算力点
      for (final m in kAvailableChatModels) {
        expect(m.cost, 10);
      }
    });
  });
}
