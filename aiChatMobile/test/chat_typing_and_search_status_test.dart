import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ai_chat_mobile/features/chat/domain/chat_message_model.dart';
import 'package:ai_chat_mobile/features/chat/presentation/widgets/chat_typing_indicator.dart';
import 'package:ai_chat_mobile/features/chat/presentation/widgets/chat_search_source_gallery.dart';

void main() {
  group('ChatTypingIndicator Widget Tests', () {
    testWidgets('渲染精致打字思考指示器并展示默认文案', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: ChatTypingIndicator(),
          ),
        ),
      );

      expect(find.text('正在深度构思回复...'), findsOneWidget);
      expect(find.byType(ChatTypingIndicator), findsOneWidget);

      // 验证动画正常运转
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.text('正在深度构思回复...'), findsOneWidget);
    });

    testWidgets('支持自定义加载提示文案', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: ChatTypingIndicator(label: '正在检索并准备回复...'),
          ),
        ),
      );

      expect(find.text('正在检索并准备回复...'), findsOneWidget);
    });
  });

  group('ChatSearchSourceGallery Lifecycle & Radar Tests', () {
    testWidgets('仅开启联网搜索时，正确显示“正在检索互联网参考来源...”且不出现知识库字样', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: ChatSearchSourceGallery(
              sources: [],
              searchStatus: 'searching',
              isWebSearchEnabled: true,
              isKnowledgeBaseEnabled: false,
              hasAnswerContent: false,
              isDone: false,
            ),
          ),
        ),
      );

      expect(find.text('正在检索互联网参考来源...'), findsOneWidget);
      expect(find.text('正在检索参考来源与知识库...'), findsNothing);
    });

    testWidgets('仅开启知识库时，正确显示“正在检索知识库文档切片...”且不出现互联网字样', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: ChatSearchSourceGallery(
              sources: [],
              searchStatus: 'searching',
              isWebSearchEnabled: false,
              isKnowledgeBaseEnabled: true,
              hasAnswerContent: false,
              isDone: false,
            ),
          ),
        ),
      );

      expect(find.text('正在检索知识库文档切片...'), findsOneWidget);
      expect(find.text('正在检索参考来源与知识库...'), findsNothing);
    });

    testWidgets('同时开启知识库与联网搜索时，显示完整检索提示', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: ChatSearchSourceGallery(
              sources: [],
              searchStatus: 'searching',
              isWebSearchEnabled: true,
              isKnowledgeBaseEnabled: true,
              hasAnswerContent: false,
              isDone: false,
            ),
          ),
        ),
      );

      expect(find.text('正在检索参考来源与知识库...'), findsOneWidget);
    });

    testWidgets('核心守卫：当已经有正文输出（hasAnswerContent: true）且无来源时，雷达框必须隐去', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: ChatSearchSourceGallery(
              sources: [],
              searchStatus: 'searching',
              isWebSearchEnabled: true,
              isKnowledgeBaseEnabled: false,
              hasAnswerContent: true, // 已经开始吐字
              isDone: false,
            ),
          ),
        ),
      );

      expect(find.text('正在检索互联网参考来源...'), findsNothing);
      expect(find.text('正在检索参考来源与知识库...'), findsNothing);
    });

    testWidgets('核心守卫：当回答已结束（isDone: true）且无来源时，雷达框必须隐去', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: ChatSearchSourceGallery(
              sources: [],
              searchStatus: 'searching',
              isWebSearchEnabled: true,
              isKnowledgeBaseEnabled: true,
              hasAnswerContent: true,
              isDone: true, // 回答结束
            ),
          ),
        ),
      );

      expect(find.text('正在检索参考来源与知识库...'), findsNothing);
    });

    testWidgets('核心守卫：当未开启任何搜索功能时，即使 searchStatus 为 searching 也绝不展示雷达', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: ChatSearchSourceGallery(
              sources: [],
              searchStatus: 'searching',
              isWebSearchEnabled: false,
              isKnowledgeBaseEnabled: false,
              hasAnswerContent: false,
              isDone: false,
            ),
          ),
        ),
      );

      expect(find.text('正在检索参考内容...'), findsNothing);
      expect(find.text('正在检索参考来源与知识库...'), findsNothing);
    });
  });
}
