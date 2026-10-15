// 移动端 Artifact 产物领域模型与标签解析工具
// 遵循 stitch-design-taste 与组件化开发模式

class ArtifactModel {
  final String identifier;
  final String title;
  final String type;
  final String? language;
  final String content;
  final bool isComplete;
  final int version;

  const ArtifactModel({
    required this.identifier,
    required this.title,
    required this.type,
    this.language,
    required this.content,
    this.isComplete = true,
    this.version = 1,
  });

  factory ArtifactModel.fromJson(Map<String, dynamic> json) {
    return ArtifactModel(
      identifier: json['identifier'] as String? ?? 'artifact',
      title: json['title'] as String? ?? '生成产物',
      type: json['type'] as String? ?? 'application/vnd.ant.code',
      language: json['language'] as String?,
      content: json['content'] as String? ?? '',
      isComplete: json['isComplete'] as bool? ?? true,
      version: (json['version'] as num?)?.toInt() ?? 1,
    );
  }

  Map<String, dynamic> toJson() => {
    'identifier': identifier,
    'title': title,
    'type': type,
    if (language != null) 'language': language,
    'content': content,
    'isComplete': isComplete,
    'version': version,
  };

  ArtifactModel copyWith({
    String? identifier,
    String? title,
    String? type,
    String? language,
    String? content,
    bool? isComplete,
    int? version,
  }) {
    return ArtifactModel(
      identifier: identifier ?? this.identifier,
      title: title ?? this.title,
      type: type ?? this.type,
      language: language ?? this.language,
      content: content ?? this.content,
      isComplete: isComplete ?? this.isComplete,
      version: version ?? this.version,
    );
  }

  /// 从纯文本中提取常规 Markdown 代码块升格为候选产物（当未显式包含 antArtifact 时）
  static List<ArtifactModel> extractPromotableCodeBlocks(String rawText) {
    if (rawText.contains('<antArtifact')) {
      return const [];
    }

    final codeBlockRegex = RegExp(r'```([a-zA-Z0-9_-]*)\r?\n([\s\S]*?)```');
    final matches = codeBlockRegex.allMatches(rawText);
    if (matches.isEmpty) return const [];

    final artifacts = <ArtifactModel>[];
    for (final match in matches) {
      final lang = (match.group(1) ?? '').trim().toLowerCase();
      final content = (match.group(2) ?? '').trim();
      if (content.isEmpty) continue;

      String type = 'application/vnd.ant.code';
      String title = '${lang.isEmpty ? 'CODE' : lang.toUpperCase()} 产物';

      if (lang == 'html' || lang == 'htm' || content.startsWith('<!DOCTYPE') || content.startsWith('<html')) {
        type = 'text/html';
        title = 'HTML 交互应用';
      } else if (lang == 'svg' || content.startsWith('<svg')) {
        type = 'image/svg+xml';
        title = 'SVG 矢量图形';
      } else if (lang == 'mermaid' || content.startsWith('graph') || content.startsWith('flowchart')) {
        type = 'application/vnd.ant.mermaid';
        title = 'Mermaid 架构图';
      }

      artifacts.add(ArtifactModel(
        identifier: 'snippet-${artifacts.length + 1}',
        title: title,
        type: type,
        language: lang.isEmpty ? null : lang,
        content: content,
        isComplete: true,
      ));
    }
    return artifacts;
  }

  /// 从助手的文本中提取出全部 `<antArtifact>` 标签及清洗后的纯正文
  static ExtractedArtifactsResult extractFromText(String rawText) {
    if (!rawText.contains('<antArtifact')) {
      final promotable = extractPromotableCodeBlocks(rawText);
      return ExtractedArtifactsResult(cleanedText: rawText, artifacts: promotable);
    }

    final artifacts = <ArtifactModel>[];
    var remaining = rawText;
    final cleanedBuffer = StringBuffer();
    final openTagRegex = RegExp(r'<antArtifact\b([^>]*)>', caseSensitive: false);
    final closeTagRegex = RegExp(r'<\/antArtifact>', caseSensitive: false);

    while (remaining.isNotEmpty) {
      final match = openTagRegex.firstMatch(remaining);
      if (match == null) {
        cleanedBuffer.write(remaining);
        break;
      }

      cleanedBuffer.write(remaining.substring(0, match.start));
      final attrString = match.group(1) ?? '';
      final attrs = _parseAttributes(attrString);
      final contentStartIndex = match.end;

      final closeMatch = closeTagRegex.firstMatch(remaining.substring(contentStartIndex));
      if (closeMatch == null) {
        // 未闭合（流式输出中）
        final partialContent = remaining.substring(contentStartIndex);
        artifacts.add(ArtifactModel(
          identifier: attrs['identifier'] ?? 'artifact-${artifacts.length + 1}',
          title: attrs['title'] ?? '代码生成产物',
          type: attrs['type'] ?? 'application/vnd.ant.code',
          language: attrs['language'],
          content: partialContent,
          isComplete: false,
        ));
        break;
      }

      final content = remaining.substring(contentStartIndex, contentStartIndex + closeMatch.start);
      artifacts.add(ArtifactModel(
        identifier: attrs['identifier'] ?? 'artifact-${artifacts.length + 1}',
        title: attrs['title'] ?? '代码生成产物',
        type: attrs['type'] ?? 'application/vnd.ant.code',
        language: attrs['language'],
        content: content.trim(),
        isComplete: true,
      ));

      final tagEnd = contentStartIndex + closeMatch.end;
      remaining = remaining.substring(tagEnd);
    }

    return ExtractedArtifactsResult(
      cleanedText: cleanedBuffer.toString().trim(),
      artifacts: artifacts,
    );
  }

  static Map<String, String> _parseAttributes(String rawAttrs) {
    final map = <String, String>{};
    final regex = RegExp(r'''([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)')''');
    for (final match in regex.allMatches(rawAttrs)) {
      final key = match.group(1);
      final val = match.group(2) ?? match.group(3) ?? '';
      if (key != null) {
        map[key] = val;
      }
    }
    return map;
  }
}

class ExtractedArtifactsResult {
  final String cleanedText;
  final List<ArtifactModel> artifacts;

  const ExtractedArtifactsResult({
    required this.cleanedText,
    required this.artifacts,
  });
}
