import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:flutter_highlighter/flutter_highlighter.dart';
import 'package:flutter_highlighter/themes/atom-one-dark.dart';
import 'package:markdown/markdown.dart' as md;
import '../../../../core/theme/stitch_tokens.dart';
import '../../domain/chat_message_model.dart';
import 'chat_citation_badge.dart';
import 'citation_bottom_sheet.dart';

/// 正则解析器：匹配 [1]、[2] 等角标且不紧跟 ( 的场景
class CitationInlineSyntax extends md.InlineSyntax {
  CitationInlineSyntax() : super(r'\[(\d+)\](?!\()');

  @override
  bool onMatch(md.InlineParser parser, Match match) {
    final rawIndex = match.group(1);
    if (rawIndex == null) return false;
    final element = md.Element('citation', [md.Text(rawIndex)]);
    element.attributes['index'] = rawIndex;
    parser.addNode(element);
    return true;
  }
}

/// 自定义角标渲染构建器
class CitationElementBuilder extends MarkdownElementBuilder {
  final BuildContext context;
  final List<SearchSourceModel> sources;
  final void Function(SearchSourceModel source, int index)? onCitationTap;

  CitationElementBuilder({
    required this.context,
    required this.sources,
    this.onCitationTap,
  });

  @override
  Widget? visitElementAfterWithContext(
    BuildContext context,
    md.Element element,
    TextStyle? preferredStyle,
    TextStyle? parentStyle,
  ) {
    final indexStr = element.attributes['index'] ?? element.textContent;
    final index = int.tryParse(indexStr) ?? 1;

    // 优先依据 sources 中的 id 匹配
    SearchSourceModel? matchedSource;
    for (final s in sources) {
      if (s.id == index) {
        matchedSource = s;
        break;
      }
    }

    // 若未通过 id 找到，平滑回退依据 sources 下标匹配
    if (matchedSource == null && index > 0 && index <= sources.length) {
      matchedSource = sources[index - 1];
    }

    // 构造有效数据载荷
    final resolvedSource = matchedSource ??
        SearchSourceModel(
          id: index,
          title: '参考切片 #$index',
          url: '',
          snippet: '切片参考来源编号 #$index',
          isKnowledgeBase: true,
        );

    return ChatCitationBadge(
      index: index,
      source: resolvedSource,
      onTap: () {
        if (onCitationTap != null) {
          onCitationTap!(resolvedSource, index);
        } else {
          CitationBottomSheet.show(
            context,
            source: resolvedSource,
            index: index,
          );
        }
      },
    );
  }
}

/// 自定义代码块高亮与工具栏构建器
class StitchCodeElementBuilder extends MarkdownElementBuilder {
  final BuildContext context;

  StitchCodeElementBuilder(this.context);

  @override
  Widget? visitElementAfterWithContext(
    BuildContext context,
    md.Element element,
    TextStyle? preferredStyle,
    TextStyle? parentStyle,
  ) {
    final languageClass = element.attributes['class'] ?? '';
    final isBlock = element.textContent.contains('\n') || languageClass.isNotEmpty;

    if (!isBlock) {
      // 行内小代码片
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 5.0, vertical: 1.5),
        decoration: BoxDecoration(
          color: const Color(0xFFF1F5F9),
          borderRadius: BorderRadius.circular(StitchTokens.radiusSm),
          border: Border.all(color: const Color(0xFFE2E8F0), width: 0.6),
        ),
        child: Text(
          element.textContent,
          style: const TextStyle(
            fontFamily: 'monospace',
            fontSize: 12.5,
            color: Color(0xFF0F172A),
            fontWeight: FontWeight.w600,
          ),
        ),
      );
    }

    // 多行代码块容器
    String lang = 'text';
    if (languageClass.startsWith('language-')) {
      lang = languageClass.substring('language-'.length).trim().toLowerCase();
    }
    if (lang.isEmpty) lang = 'code';

    final codeText = element.textContent.trimRight();

    return Container(
      margin: const EdgeInsets.symmetric(vertical: 8.0),
      decoration: BoxDecoration(
        color: StitchTokens.codeBg,
        borderRadius: BorderRadius.circular(StitchTokens.radiusMd + 2),
        boxShadow: const [
          BoxShadow(
            color: Color.fromRGBO(0, 0, 0, 0.15),
            blurRadius: 8.0,
            offset: Offset(0, 2),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // 代码块顶部工具栏
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12.0, vertical: 6.0),
            color: StitchTokens.codeHeaderBg,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Container(
                      width: 8.0,
                      height: 8.0,
                      decoration: const BoxDecoration(
                        color: Color(0xFFFF5F56),
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 5.0),
                    Container(
                      width: 8.0,
                      height: 8.0,
                      decoration: const BoxDecoration(
                        color: Color(0xFFFFBD2E),
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 5.0),
                    Container(
                      width: 8.0,
                      height: 8.0,
                      decoration: const BoxDecoration(
                        color: Color(0xFF27C93F),
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 10.0),
                    Text(
                      lang,
                      style: const TextStyle(
                        color: Color(0xFF94A3B8),
                        fontSize: 11.0,
                        fontWeight: FontWeight.w600,
                        fontFamily: 'monospace',
                      ),
                    ),
                  ],
                ),
                GestureDetector(
                  onTap: () {
                    Clipboard.setData(ClipboardData(text: codeText));
                    try {
                      HapticFeedback.selectionClick();
                    } catch (_) {}
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('代码已复制到剪贴板'),
                        duration: Duration(seconds: 1),
                      ),
                    );
                  },
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: const [
                      Icon(Icons.copy_rounded, size: 13.0, color: Color(0xFF94A3B8)),
                      SizedBox(width: 4.0),
                      Text(
                        '复制',
                        style: TextStyle(
                          color: Color(0xFF94A3B8),
                          fontSize: 11.0,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          // 语法高亮代码主体
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            physics: const BouncingScrollPhysics(),
            padding: const EdgeInsets.all(12.0),
            child: HighlightView(
              codeText,
              language: lang,
              theme: atomOneDarkTheme,
              textStyle: const TextStyle(
                fontFamily: 'monospace',
                fontSize: 12.0,
                height: 1.5,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// 移动端 Stitch 风格高质感 Markdown 渲染组件
class StitchMarkdownView extends StatelessWidget {
  final String data;
  final List<SearchSourceModel> sources;
  final void Function(SearchSourceModel source, int index)? onCitationTap;

  const StitchMarkdownView({
    super.key,
    required this.data,
    this.sources = const [],
    this.onCitationTap,
  });

  @override
  Widget build(BuildContext context) {
    final themeData = MarkdownStyleSheet(
      p: const TextStyle(
        fontSize: 14.5,
        height: 1.6,
        color: StitchTokens.onSurface,
        letterSpacing: -0.15,
      ),
      h1: const TextStyle(
        fontSize: 20.0,
        fontWeight: FontWeight.w800,
        color: StitchTokens.onSurface,
        height: 1.4,
      ),
      h2: const TextStyle(
        fontSize: 17.5,
        fontWeight: FontWeight.w700,
        color: StitchTokens.onSurface,
        height: 1.4,
      ),
      h3: const TextStyle(
        fontSize: 15.5,
        fontWeight: FontWeight.w700,
        color: StitchTokens.onSurface,
        height: 1.35,
      ),
      strong: const TextStyle(
        fontWeight: FontWeight.w700,
        color: StitchTokens.onSurface,
      ),
      blockquote: const TextStyle(
        fontSize: 13.5,
        height: 1.5,
        color: Color(0xFF475569),
        fontStyle: FontStyle.italic,
      ),
      blockquoteDecoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(StitchTokens.radiusSm),
        border: const Border(
          left: BorderSide(color: StitchTokens.primary, width: 3.0),
        ),
      ),
      listBullet: const TextStyle(
        fontSize: 14.0,
        color: StitchTokens.primary,
        fontWeight: FontWeight.w700,
      ),
      tableBorder: TableBorder.all(
        color: const Color(0xFFE2E8F0),
        width: 0.8,
        borderRadius: BorderRadius.circular(StitchTokens.radiusSm),
      ),
      tableHead: const TextStyle(
        fontSize: 13.0,
        fontWeight: FontWeight.w700,
        color: StitchTokens.onSurface,
      ),
      tableBody: const TextStyle(
        fontSize: 12.5,
        color: StitchTokens.onSurfaceVariant,
      ),
      horizontalRuleDecoration: BoxDecoration(
        border: Border(
          top: BorderSide(
            color: const Color(0xFFE2E8F0),
            width: 0.8,
          ),
        ),
      ),
    );

    return MarkdownBody(
      data: data,
      selectable: false,
      shrinkWrap: true,
      styleSheet: themeData,
      extensionSet: md.ExtensionSet.gitHubFlavored,
      inlineSyntaxes: [
        CitationInlineSyntax(),
      ],
      builders: {
        'citation': CitationElementBuilder(
          context: context,
          sources: sources,
          onCitationTap: onCitationTap,
        ),
        'code': StitchCodeElementBuilder(context),
      },
    );
  }
}
