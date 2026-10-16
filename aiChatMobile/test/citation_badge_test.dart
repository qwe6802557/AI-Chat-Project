import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_highlighter/flutter_highlighter.dart';
import 'package:ai_chat_mobile/features/chat/domain/chat_message_model.dart';
import 'package:ai_chat_mobile/features/chat/presentation/widgets/chat_citation_badge.dart';
import 'package:ai_chat_mobile/features/chat/presentation/widgets/citation_bottom_sheet.dart';
import 'package:ai_chat_mobile/features/chat/presentation/widgets/stitch_markdown_view.dart';

void main() {
  group('ChatCitationBadge & CitationBottomSheet Widget Tests', () {
    testWidgets('ChatCitationBadge 正常渲染知识库角标与序号', (tester) async {
      bool tapped = false;
      const source = SearchSourceModel(
        id: 1,
        title: '测试文档2026',
        url: '',
        snippet: '这是测试切片正文',
        isKnowledgeBase: true,
        score: 0.85,
        chunkIndex: 0,
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Center(
              child: ChatCitationBadge(
                index: 1,
                source: source,
                onTap: () => tapped = true,
              ),
            ),
          ),
        ),
      );

      // 验证序号与知识库图标
      expect(find.text('1'), findsOneWidget);
      expect(find.byIcon(Icons.menu_book_rounded), findsOneWidget);

      // 模拟轻触
      await tester.tap(find.byType(ChatCitationBadge));
      await tester.pumpAndSettle();

      expect(tapped, isTrue);
    });

    testWidgets('CitationBottomSheet 正常展示切片信息、置信度与复制按钮', (tester) async {
      const source = SearchSourceModel(
        id: 1,
        title: '微电网与全固态电池规范2026',
        url: 'https://example.com/doc',
        snippet: '单体能量密度需达到 550 Wh/kg，且在 -20℃ 极寒工况下容量保持率不低于 92%。',
        isKnowledgeBase: true,
        score: 0.82,
        chunkIndex: 0,
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (ctx) => ElevatedButton(
                onPressed: () => CitationBottomSheet.show(ctx, source: source, index: 1),
                child: const Text('Open Sheet'),
              ),
            ),
          ),
        ),
      );

      // 点击打开抽屉
      await tester.tap(find.text('Open Sheet'));
      await tester.pumpAndSettle();

      // 验证抽屉内标题、切片号、置信度与正文
      expect(find.text('微电网与全固态电池规范2026'), findsOneWidget);
      expect(find.text('#1'), findsOneWidget);
      expect(find.text('切片 #1'), findsOneWidget);
      expect(find.text('置信度 82%'), findsOneWidget);
      expect(find.textContaining('550 Wh/kg'), findsOneWidget);
      expect(find.byIcon(Icons.copy_rounded), findsOneWidget);
      expect(find.byIcon(Icons.open_in_new_rounded), findsOneWidget);
    });
  });

  group('StitchMarkdownView RAG Citation Integration Tests', () {
    testWidgets('StitchMarkdownView 成功将正文 [1] 转换为交互式 ChatCitationBadge', (tester) async {
      SearchSourceModel? tappedSource;
      int? tappedIndex;

      const sources = [
        SearchSourceModel(
          id: 1,
          title: '微电网规范',
          url: '',
          snippet: '能量密度550Wh/kg',
          isKnowledgeBase: true,
          score: 0.82,
          chunkIndex: 0,
        ),
      ];

      const markdownText = '全固态电池能量密度为 550 Wh/kg [1]，极寒表现优异。';

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: StitchMarkdownView(
              data: markdownText,
              sources: sources,
              onCitationTap: (src, idx) {
                tappedSource = src;
                tappedIndex = idx;
              },
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // 验证角标组件已渲染
      expect(find.byType(ChatCitationBadge), findsOneWidget);
      expect(find.text('1'), findsOneWidget);

      // 点击角标
      await tester.tap(find.byType(ChatCitationBadge));
      await tester.pumpAndSettle();

      expect(tappedIndex, equals(1));
      expect(tappedSource?.title, equals('微电网规范'));
    });

    testWidgets('StitchMarkdownView 正确处理多角标 [1] [2]', (tester) async {
      final tappedIndices = <int>[];

      const sources = [
        SearchSourceModel(id: 1, title: '来源1', url: '', snippet: '内容1'),
        SearchSourceModel(id: 2, title: '来源2', url: '', snippet: '内容2'),
      ];

      const markdownText = '结论参考了切片A [1] 和切片B [2]。';

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: StitchMarkdownView(
              data: markdownText,
              sources: sources,
              onCitationTap: (src, idx) => tappedIndices.add(idx),
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.byType(ChatCitationBadge), findsNWidgets(2));
      expect(find.text('1'), findsOneWidget);
      expect(find.text('2'), findsOneWidget);

      await tester.tap(find.text('1'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('2'));
      await tester.pumpAndSettle();

      expect(tappedIndices, equals([1, 2]));
    });

    testWidgets('StitchMarkdownView 正常渲染代码块与复制按钮', (tester) async {
      const markdownCode = '''
```python
def hello():
    print("AI Chat Mobile")
```
''';

      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: StitchMarkdownView(data: markdownCode),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // 验证语言标识和复制按钮
      expect(find.text('python'), findsOneWidget);
      expect(find.text('复制'), findsOneWidget);
      expect(find.byType(HighlightView), findsOneWidget);
    });
  });
}
