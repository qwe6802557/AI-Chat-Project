import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../../core/theme/stitch_tokens.dart';
import '../../domain/chat_message_model.dart';

/// 移动端 Stitch 风格证据切片与来源抽屉
class CitationBottomSheet extends StatelessWidget {
  final SearchSourceModel source;
  final int? index;

  const CitationBottomSheet({
    super.key,
    required this.source,
    this.index,
  });

  /// 便捷静态唤起方法
  static Future<void> show(
    BuildContext context, {
    required SearchSourceModel source,
    int? index,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useRootNavigator: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => CitationBottomSheet(
        source: source,
        index: index,
      ),
    );
  }

  Future<void> _openExternalUrl(BuildContext context, String url) async {
    final uri = Uri.tryParse(url);
    if (uri != null) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('无法打开链接')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isKb = source.isKnowledgeBase;
    final displayIndex = index ?? source.id;
    final hasUrl = source.url.isNotEmpty;

    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(StitchTokens.radius2Xl),
        ),
        boxShadow: [
          BoxShadow(
            color: Color.fromRGBO(0, 0, 0, 0.12),
            blurRadius: 24.0,
            offset: Offset(0, -6),
          ),
        ],
      ),
      padding: EdgeInsets.fromLTRB(
        20.0,
        12.0,
        20.0,
        MediaQuery.of(context).padding.bottom + 20.0,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // 顶部拖拽指示条
          Center(
            child: Container(
              width: 38.0,
              height: 4.5,
              decoration: BoxDecoration(
                color: const Color(0xFFE2E8F0),
                borderRadius: BorderRadius.circular(StitchTokens.radiusFull),
              ),
            ),
          ),
          const SizedBox(height: 16.0),

          // 头部信息栏
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Container(
                width: 38.0,
                height: 38.0,
                decoration: BoxDecoration(
                  color: isKb ? const Color(0xFFEFF6FF) : const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(StitchTokens.radiusMd),
                  border: Border.all(
                    color: isKb ? const Color(0xFFBFDBFE) : const Color(0xFFCBD5E1),
                    width: 0.8,
                  ),
                ),
                child: Icon(
                  isKb ? Icons.menu_book_rounded : Icons.language_rounded,
                  size: 20.0,
                  color: isKb ? StitchTokens.primary : const Color(0xFF475569),
                ),
              ),
              const SizedBox(width: 12.0),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            source.title.isNotEmpty
                                ? source.title
                                : (isKb ? '知识库切片' : '网页参考来源'),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 15.0,
                              fontWeight: FontWeight.w700,
                              color: StitchTokens.onSurface,
                              letterSpacing: -0.2,
                            ),
                          ),
                        ),
                        const SizedBox(width: 6.0),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 5.5, vertical: 1.0),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF1F5F9),
                            borderRadius: BorderRadius.circular(StitchTokens.radiusSm),
                          ),
                          child: Text(
                            '#$displayIndex',
                            style: const TextStyle(
                              fontSize: 10.5,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF64748B),
                              fontFamily: 'monospace',
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 3.0),
                    Row(
                      children: [
                        Text(
                          isKb
                              ? '切片 #${(source.chunkIndex ?? 0) + 1}'
                              : (source.sitename.isNotEmpty ? source.sitename : '外部网页'),
                          style: const TextStyle(
                            fontSize: 12.0,
                            color: StitchTokens.outline,
                          ),
                        ),
                        if (source.score != null) ...[
                          const SizedBox(width: 8.0),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6.0, vertical: 1.0),
                            decoration: BoxDecoration(
                              color: const Color(0xFFECFDF5),
                              borderRadius: BorderRadius.circular(StitchTokens.radiusFull),
                              border: Border.all(
                                color: const Color(0xFFA7F3D0),
                                width: 0.6,
                              ),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(
                                  Icons.bolt_rounded,
                                  size: 11.0,
                                  color: Color(0xFF027A48),
                                ),
                                const SizedBox(width: 2.0),
                                Text(
                                  '置信度 ${(source.score! * 100).toInt()}%',
                                  style: const TextStyle(
                                    fontSize: 10.5,
                                    fontWeight: FontWeight.w700,
                                    color: Color(0xFF027A48),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
              // 复制切片按钮
              IconButton(
                tooltip: '复制内容',
                icon: const Icon(Icons.copy_rounded, size: 19.0),
                color: StitchTokens.primary,
                onPressed: () {
                  Clipboard.setData(ClipboardData(text: source.snippet));
                  HapticFeedback.selectionClick();
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('已复制切片正文到剪贴板'),
                      duration: Duration(seconds: 1),
                    ),
                  );
                },
              ),
              // 若有外链则显示打开外链按钮
              if (hasUrl)
                IconButton(
                  tooltip: '在浏览器中打开',
                  icon: const Icon(Icons.open_in_new_rounded, size: 19.0),
                  color: const Color(0xFF64748B),
                  onPressed: () => _openExternalUrl(context, source.url),
                ),
            ],
          ),
          const SizedBox(height: 14.0),

          // 切片正文展示区
          ConstrainedBox(
            constraints: const BoxConstraints(maxHeight: 380.0),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14.0),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(StitchTokens.radiusLg),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: SingleChildScrollView(
                physics: const BouncingScrollPhysics(),
                child: SelectableText(
                  source.snippet.isNotEmpty ? source.snippet : '（无预览内容）',
                  style: const TextStyle(
                    fontSize: 13.5,
                    height: 1.65,
                    color: Color(0xFF1E293B),
                    letterSpacing: -0.1,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
