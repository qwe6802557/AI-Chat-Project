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
  final List<ArtifactModel> versions;

  const ArtifactModel({
    required this.identifier,
    required this.title,
    required this.type,
    this.language,
    required this.content,
    this.isComplete = true,
    this.version = 1,
    this.versions = const [],
  });

  List<ArtifactModel> get effectiveVersions => versions.isNotEmpty ? versions : [this];

  factory ArtifactModel.fromJson(Map<String, dynamic> json) {
    final rawVersions = json['versions'] as List<dynamic>?;
    final versionsList = rawVersions != null
        ? rawVersions.map((e) => ArtifactModel.fromJson(e as Map<String, dynamic>)).toList()
        : const <ArtifactModel>[];

    return ArtifactModel(
      identifier: json['identifier'] as String? ?? 'artifact',
      title: json['title'] as String? ?? '生成产物',
      type: json['type'] as String? ?? 'application/vnd.ant.code',
      language: json['language'] as String?,
      content: json['content'] as String? ?? '',
      isComplete: json['isComplete'] as bool? ?? true,
      version: (json['version'] as num?)?.toInt() ?? 1,
      versions: versionsList,
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
    if (versions.isNotEmpty) 'versions': versions.map((v) => v.toJson()).toList(),
  };

  ArtifactModel copyWith({
    String? identifier,
    String? title,
    String? type,
    String? language,
    String? content,
    bool? isComplete,
    int? version,
    List<ArtifactModel>? versions,
  }) {
    return ArtifactModel(
      identifier: identifier ?? this.identifier,
      title: title ?? this.title,
      type: type ?? this.type,
      language: language ?? this.language,
      content: content ?? this.content,
      isComplete: isComplete ?? this.isComplete,
      version: version ?? this.version,
      versions: versions ?? this.versions,
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

      final identifier = attrs['identifier'] ?? 'artifact-${artifacts.length + 1}';
      final title = attrs['title'] ?? '代码生成产物';
      final type = attrs['type'] ?? 'application/vnd.ant.code';
      final language = attrs['language'];

      final closeMatch = closeTagRegex.firstMatch(remaining.substring(contentStartIndex));
      if (closeMatch == null) {
        // 未闭合（流式输出中）
        final partialContent = remaining.substring(contentStartIndex);
        final existingIndex = artifacts.indexWhere((a) => a.identifier == identifier);
        if (existingIndex >= 0) {
          final existing = artifacts[existingIndex];
          artifacts[existingIndex] = existing.copyWith(
            content: partialContent,
            isComplete: false,
          );
        } else {
          final initial = ArtifactModel(
            identifier: identifier,
            title: title,
            type: type,
            language: language,
            content: partialContent,
            isComplete: false,
            version: 1,
          );
          artifacts.add(initial.copyWith(versions: [initial]));
        }
        break;
      }

      final content = remaining.substring(contentStartIndex, contentStartIndex + closeMatch.start);
      final existingIndex = artifacts.indexWhere((a) => a.identifier == identifier);
      if (existingIndex >= 0) {
        final existing = artifacts[existingIndex];
        final nextVer = existing.versions.length + 1;
        final newModel = ArtifactModel(
          identifier: identifier,
          title: title,
          type: type,
          language: language,
          content: content.trim(),
          isComplete: true,
          version: nextVer,
        );
        final updatedVersions = [...existing.versions, newModel];
        artifacts[existingIndex] = newModel.copyWith(
          versions: updatedVersions,
          version: nextVer,
        );
      } else {
        final initial = ArtifactModel(
          identifier: identifier,
          title: title,
          type: type,
          language: language,
          content: content.trim(),
          isComplete: true,
          version: 1,
        );
        artifacts.add(initial.copyWith(versions: [initial]));
      }

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
