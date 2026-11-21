import 'package:flutter/material.dart';
import '../../domain/chunk_model.dart';

/// 切片正文安全高亮展示组件（基于位置索引切片 TextSpan）
class HighlightedChunkText extends StatelessWidget {
  final String content;
  final List<HighlightSpan> highlights;
  final String? keyword;
  final TextStyle? style;
  final int? maxLines;
  final TextOverflow? overflow;

  const HighlightedChunkText({
    super.key,
    required this.content,
    this.highlights = const [],
    this.keyword,
    this.style,
    this.maxLines,
    this.overflow,
  });

  List<HighlightSpan> _buildKeywordSpans(String text, String query) {
    final cleanKw = query.trim();
    if (cleanKw.isEmpty) return const [];

    final lowerText = text.toLowerCase();
    final lowerKw = cleanKw.toLowerCase();
    final spans = <HighlightSpan>[];
    var from = 0;

    while (from < lowerText.length && spans.length < 30) {
      final idx = lowerText.indexOf(lowerKw, from);
      if (idx == -1) break;
      spans.add(
        HighlightSpan(
          start: idx,
          end: idx + cleanKw.length,
          term: text.substring(idx, idx + cleanKw.length),
        ),
      );
      from = idx + cleanKw.length;
    }
    return spans;
  }

  List<InlineSpan> _buildTextSpans(TextStyle baseStyle) {
    if (content.isEmpty) {
      return [TextSpan(text: '', style: baseStyle)];
    }

    final rawSpans = highlights.isNotEmpty
        ? highlights
        : (keyword != null && keyword!.trim().isNotEmpty
            ? _buildKeywordSpans(content, keyword!)
            : const <HighlightSpan>[]);

    if (rawSpans.isEmpty) {
      return [TextSpan(text: content, style: baseStyle)];
    }

    final sorted = rawSpans
        .map(
          (s) => HighlightSpan(
            start: s.start.clamp(0, content.length),
            end: s.end.clamp(0, content.length),
            term: s.term,
          ),
        )
        .where((s) => s.end > s.start)
        .toList()
      ..sort((a, b) => a.start.compareTo(b.start));

    final result = <InlineSpan>[];
    var cursor = 0;
    final highlightStyle = baseStyle.copyWith(
      backgroundColor: const Color(0xFFFEF3C7),
      color: const Color(0xFF78350F),
      fontWeight: FontWeight.w700,
    );

    for (final span in sorted) {
      final start = span.start < cursor ? cursor : span.start;
      if (start >= span.end) continue;

      if (start > cursor) {
        result.add(TextSpan(text: content.substring(cursor, start), style: baseStyle));
      }
      result.add(TextSpan(text: content.substring(start, span.end), style: highlightStyle));
      cursor = span.end;
    }

    if (cursor < content.length) {
      result.add(TextSpan(text: content.substring(cursor), style: baseStyle));
    }

    return result;
  }

  @override
  Widget build(BuildContext context) {
    final effectiveStyle = style ?? DefaultTextStyle.of(context).style;
    final spans = _buildTextSpans(effectiveStyle);
    final textSpan = TextSpan(style: effectiveStyle, children: spans);

    if (maxLines != null) {
      return Text.rich(
        textSpan,
        maxLines: maxLines,
        overflow: overflow ?? TextOverflow.ellipsis,
      );
    }

    return SelectableText.rich(textSpan);
  }
}
