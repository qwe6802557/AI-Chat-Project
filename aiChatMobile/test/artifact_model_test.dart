import 'package:flutter_test/flutter_test.dart';
import 'package:ai_chat_mobile/features/chat/domain/artifact_model.dart';

void main() {
  group('ArtifactModel Tests', () {
    test('extractFromText parses complete antArtifact tags and cleans text', () {
      const raw = '为您生成了如下应用：\n<antArtifact identifier="todo-mobile" type="text/html" title="待办看板">\n<div>Todo App</div>\n</antArtifact>\n请点击查看。';
      final result = ArtifactModel.extractFromText(raw);

      expect(result.cleanedText, equals('为您生成了如下应用：\n\n请点击查看。'));
      expect(result.artifacts.length, equals(1));
      expect(result.artifacts.first.identifier, equals('todo-mobile'));
      expect(result.artifacts.first.type, equals('text/html'));
      expect(result.artifacts.first.title, equals('待办看板'));
      expect(result.artifacts.first.content, equals('<div>Todo App</div>'));
      expect(result.artifacts.first.isComplete, isTrue);
    });

    test('extractFromText handles streaming unclosed antArtifact tag', () {
      const raw = '正在生成：\n<antArtifact identifier="chart-widget" type="image/svg+xml" title="矢量图表">\n<svg width="200">';
      final result = ArtifactModel.extractFromText(raw);

      expect(result.cleanedText, equals('正在生成：'));
      expect(result.artifacts.length, equals(1));
      expect(result.artifacts.first.identifier, equals('chart-widget'));
      expect(result.artifacts.first.isComplete, isFalse);
    });

    test('extractFromText promotes regular markdown code blocks into artifacts', () {
      const raw = '这是为您编写的页面代码：\n```html\n<div class="box">Card</div>\n```\n可以直接在画布中预览。';
      final result = ArtifactModel.extractFromText(raw);

      expect(result.artifacts.length, equals(1));
      expect(result.artifacts.first.identifier, equals('snippet-1'));
      expect(result.artifacts.first.type, equals('text/html'));
      expect(result.artifacts.first.title, equals('HTML 交互应用'));
      expect(result.artifacts.first.content, equals('<div class="box">Card</div>'));
      expect(result.artifacts.first.isComplete, isTrue);
    });

    test('extractFromText returns empty artifacts when text has no code blocks or tags', () {
      const raw = '这是一段普通的文本回复，没有任何代码块或标签。';
      final result = ArtifactModel.extractFromText(raw);

      expect(result.cleanedText, equals(raw));
      expect(result.artifacts, isEmpty);
    });

    test('extractFromText aggregates multiple revisions of identical identifier into versions list', () {
      const raw = '''
第1版：
<antArtifact identifier="counter-app" type="text/html" title="计数器 v1">
<div>Count: 0</div>
</antArtifact>

更新第2版：
<antArtifact identifier="counter-app" type="text/html" title="计数器 v2">
<div>Count: 1 (Updated)</div>
</antArtifact>
''';
      final result = ArtifactModel.extractFromText(raw);

      expect(result.artifacts.length, equals(1));
      final mainArtifact = result.artifacts.first;
      expect(mainArtifact.identifier, equals('counter-app'));
      expect(mainArtifact.version, equals(2));
      expect(mainArtifact.title, equals('计数器 v2'));
      expect(mainArtifact.content, equals('<div>Count: 1 (Updated)</div>'));
      expect(mainArtifact.effectiveVersions.length, equals(2));
      expect(mainArtifact.effectiveVersions[0].version, equals(1));
      expect(mainArtifact.effectiveVersions[0].content, equals('<div>Count: 0</div>'));
      expect(mainArtifact.effectiveVersions[1].version, equals(2));
      expect(mainArtifact.effectiveVersions[1].content, equals('<div>Count: 1 (Updated)</div>'));
    });

    test('toJson and fromJson serialization works symmetrically with versions', () {
      const v1 = ArtifactModel(
        identifier: 'code-1',
        title: '算法脚本 v1',
        type: 'application/vnd.ant.code',
        language: 'dart',
        content: 'void main() { print(1); }',
        isComplete: true,
        version: 1,
      );
      final model = ArtifactModel(
        identifier: 'code-1',
        title: '算法脚本 v2',
        type: 'application/vnd.ant.code',
        language: 'dart',
        content: 'void main() { print(2); }',
        isComplete: true,
        version: 2,
        versions: [v1],
      );

      final json = model.toJson();
      final restored = ArtifactModel.fromJson(json);

      expect(restored.identifier, equals(model.identifier));
      expect(restored.title, equals(model.title));
      expect(restored.type, equals(model.type));
      expect(restored.language, equals(model.language));
      expect(restored.content, equals(model.content));
      expect(restored.version, equals(2));
      expect(restored.effectiveVersions.length, equals(1));
      expect(restored.effectiveVersions.first.version, equals(1));
    });
  });
}
