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

    test('toJson and fromJson serialization works symmetrically', () {
      const model = ArtifactModel(
        identifier: 'code-1',
        title: '算法脚本',
        type: 'application/vnd.ant.code',
        language: 'dart',
        content: 'void main() {}',
        isComplete: true,
        version: 2,
      );

      final json = model.toJson();
      final restored = ArtifactModel.fromJson(json);

      expect(restored.identifier, equals(model.identifier));
      expect(restored.title, equals(model.title));
      expect(restored.type, equals(model.type));
      expect(restored.language, equals(model.language));
      expect(restored.content, equals(model.content));
      expect(restored.version, equals(2));
    });
  });
}
