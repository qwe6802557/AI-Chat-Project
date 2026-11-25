import 'package:flutter/material.dart';
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

    testWidgets('无启用 Gemini 模型时隐藏顶部分组 Tab 并直接展示可用模型', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ModelSwitcherBottomSheet(
              currentModel: 'grok-chat-fast',
              availableModels: const [
                ModelInfo(
                  id: 'grok-chat-fast',
                  name: 'Grok Chat Fast',
                  category: '代码极速',
                  tag: '默认推荐',
                  description: '快速聊天模型',
                  latency: '50ms',
                  contextWindow: '128k',
                  cost: 10,
                  icon: Icons.bolt_rounded,
                  isDefault: true,
                ),
                ModelInfo(
                  id: 'spark-x2.6-4b',
                  name: 'Spark-X2.6-4B (轻量开源)',
                  category: '深度推理 (Reasoning)',
                  tag: '免费推理',
                  description: '端侧轻量高效语言模型',
                  latency: '50ms',
                  contextWindow: '1M',
                  cost: 0,
                  icon: Icons.psychology_alt_rounded,
                ),
              ],
              onModelSelected: (_) {},
            ),
          ),
        ),
      );

      expect(find.text('Gemini 系列'), findsNothing);
      expect(find.text('其它模型'), findsNothing);
      expect(find.text('Spark-X2.6-4B (轻量开源)'), findsOneWidget);
    });

    testWidgets('启用 Gemini 模型时展示分组 Tab，并在动态停用后即时隐藏', (tester) async {
      const geminiModel = ModelInfo(
        id: 'gemini-3.8-flash-medium',
        name: 'Gemini 3.8 Flash (Medium 思考)',
        category: '通用全能',
        tag: '在线可用',
        description: 'Gemini Flash',
        latency: '50ms',
        contextWindow: '1M',
        cost: 10,
        icon: Icons.auto_awesome_rounded,
      );
      const grokModel = ModelInfo(
        id: 'grok-chat-fast',
        name: 'Grok Chat Fast',
        category: '代码极速',
        tag: '默认推荐',
        description: '快速聊天模型',
        latency: '50ms',
        contextWindow: '128k',
        cost: 10,
        icon: Icons.bolt_rounded,
        isDefault: true,
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ModelSwitcherBottomSheet(
              currentModel: 'gemini-3.8-flash-medium',
              availableModels: const [geminiModel, grokModel],
              onModelSelected: (_) {},
            ),
          ),
        ),
      );

      expect(find.text('Gemini 系列'), findsOneWidget);
      expect(find.text('其它模型'), findsOneWidget);

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ModelSwitcherBottomSheet(
              currentModel: 'grok-chat-fast',
              availableModels: const [grokModel],
              onModelSelected: (_) {},
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Gemini 系列'), findsNothing);
      expect(find.text('其它模型'), findsNothing);
      expect(find.text('Grok Chat Fast'), findsOneWidget);
    });
  });
}
