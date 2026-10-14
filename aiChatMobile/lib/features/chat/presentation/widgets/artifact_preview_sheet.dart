import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:flutter_highlighter/flutter_highlighter.dart';
import 'package:flutter_highlighter/themes/atom-one-dark.dart';
import '../../../../core/theme/stitch_tokens.dart';
import '../../domain/artifact_model.dart';

/// 移动端沉浸式 Artifact 产物预览抽屉
/// 支持全屏模态根导航器挂载、预览与代码双视图无缝切换
class ArtifactPreviewSheet extends StatefulWidget {
  final ArtifactModel artifact;

  const ArtifactPreviewSheet({
    super.key,
    required this.artifact,
  });

  static Future<void> show(BuildContext context, ArtifactModel artifact) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useRootNavigator: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ArtifactPreviewSheet(artifact: artifact),
    );
  }

  @override
  State<ArtifactPreviewSheet> createState() => _ArtifactPreviewSheetState();
}

class _ArtifactPreviewSheetState extends State<ArtifactPreviewSheet> {
  int _selectedTabIndex = 0; // 0: 预览, 1: 源码

  bool get _isSvg =>
      widget.artifact.type.contains('svg') ||
      widget.artifact.content.trim().startsWith('<svg');

  @override
  Widget build(BuildContext context) {
    final maxHeight = MediaQuery.of(context).size.height * 0.85;

    return Container(
      constraints: BoxConstraints(maxHeight: maxHeight),
      decoration: const BoxDecoration(
        color: StitchTokens.surfaceContainerLowest,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24.0)),
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // 顶部拖拽手柄
            Center(
              child: Container(
                margin: const EdgeInsets.only(top: 10.0, bottom: 8.0),
                width: 36.0,
                height: 4.0,
                decoration: BoxDecoration(
                  color: StitchTokens.outlineVariant,
                  borderRadius: BorderRadius.circular(999.0),
                ),
              ),
            ),

            // 顶栏信息与操作
            Padding(
              padding: const EdgeInsets.fromLTRB(20.0, 4.0, 16.0, 12.0),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          widget.artifact.title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 16.0,
                            fontWeight: FontWeight.w700,
                            color: StitchTokens.onSurface,
                            letterSpacing: -0.3,
                          ),
                        ),
                        const SizedBox(height: 2.0),
                        Row(
                          children: [
                            Text(
                              widget.artifact.identifier,
                              style: TextStyle(
                                fontSize: 11.0,
                                color: StitchTokens.onSurfaceVariant.withValues(alpha: 0.7),
                                fontFamily: 'monospace',
                              ),
                            ),
                            const SizedBox(width: 8.0),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 5.0, vertical: 1.0),
                              decoration: BoxDecoration(
                                color: StitchTokens.surfaceContainer,
                                borderRadius: BorderRadius.circular(4.0),
                              ),
                              child: Text(
                                'v${widget.artifact.version}',
                                style: const TextStyle(
                                  fontSize: 10.0,
                                  fontWeight: FontWeight.w600,
                                  color: StitchTokens.onSurface,
                                  fontFamily: 'monospace',
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),

                  // 复制按钮
                  IconButton(
                    onPressed: _handleCopy,
                    icon: const Icon(Icons.copy_rounded, size: 20.0),
                    tooltip: '复制代码',
                    color: StitchTokens.onSurfaceVariant,
                  ),

                  // 关闭按钮
                  IconButton(
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(Icons.close_rounded, size: 22.0),
                    tooltip: '关闭',
                    color: StitchTokens.onSurfaceVariant,
                  ),
                ],
              ),
            ),

            // 预览 / 源码 Tab 切换器
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20.0),
              child: Container(
                padding: const EdgeInsets.all(3.0),
                decoration: BoxDecoration(
                  color: StitchTokens.surfaceContainerLow,
                  borderRadius: BorderRadius.circular(StitchTokens.radiusMd),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: GestureDetector(
                        onTap: () => setState(() => _selectedTabIndex = 0),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 8.0),
                          decoration: BoxDecoration(
                            color: _selectedTabIndex == 0
                                ? StitchTokens.surfaceContainerLowest
                                : Colors.transparent,
                            borderRadius: BorderRadius.circular(6.0),
                            boxShadow: _selectedTabIndex == 0
                                ? [
                                    BoxShadow(
                                      color: Colors.black.withValues(alpha: 0.05),
                                      blurRadius: 2.0,
                                      offset: const Offset(0, 1),
                                    )
                                  ]
                                : null,
                          ),
                          alignment: Alignment.center,
                          child: Text(
                            '效果预览',
                            style: TextStyle(
                              fontSize: 13.0,
                              fontWeight: _selectedTabIndex == 0
                                  ? FontWeight.w600
                                  : FontWeight.w500,
                              color: _selectedTabIndex == 0
                                  ? StitchTokens.onSurface
                                  : StitchTokens.onSurfaceVariant,
                            ),
                          ),
                        ),
                      ),
                    ),
                    Expanded(
                      child: GestureDetector(
                        onTap: () => setState(() => _selectedTabIndex = 1),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 8.0),
                          decoration: BoxDecoration(
                            color: _selectedTabIndex == 1
                                ? StitchTokens.surfaceContainerLowest
                                : Colors.transparent,
                            borderRadius: BorderRadius.circular(6.0),
                            boxShadow: _selectedTabIndex == 1
                                ? [
                                    BoxShadow(
                                      color: Colors.black.withValues(alpha: 0.05),
                                      blurRadius: 2.0,
                                      offset: const Offset(0, 1),
                                    )
                                  ]
                                : null,
                          ),
                          alignment: Alignment.center,
                          child: Text(
                            '产物源码',
                            style: TextStyle(
                              fontSize: 13.0,
                              fontWeight: _selectedTabIndex == 1
                                  ? FontWeight.w600
                                  : FontWeight.w500,
                              color: _selectedTabIndex == 1
                                  ? StitchTokens.onSurface
                                  : StitchTokens.onSurfaceVariant,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 12.0),

            // 主展示区域
            Expanded(
              child: Container(
                margin: const EdgeInsets.fromLTRB(16.0, 0, 16.0, 16.0),
                decoration: BoxDecoration(
                  color: _selectedTabIndex == 1 ? const Color(0xFF282C34) : StitchTokens.surfaceContainerLow,
                  borderRadius: BorderRadius.circular(StitchTokens.radiusLg),
                  border: Border.all(
                    color: StitchTokens.outlineVariant.withValues(alpha: 0.4),
                  ),
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(StitchTokens.radiusLg),
                  child: _selectedTabIndex == 0 ? _buildPreviewStage() : _buildCodeStage(),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPreviewStage() {
    if (_isSvg) {
      return Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: SvgPicture.string(
            widget.artifact.content,
            placeholderBuilder: (_) => const Center(
              child: CircularProgressIndicator(strokeWidth: 2.0),
            ),
          ),
        ),
      );
    }

    // HTML / 其它格式：移动端以精致格式化预览卡呈现
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.all(12.0),
            decoration: BoxDecoration(
              color: StitchTokens.surfaceContainerLowest,
              borderRadius: BorderRadius.circular(StitchTokens.radiusMd),
            ),
            child: Row(
              children: [
                const Icon(Icons.info_outline_rounded, size: 16.0, color: StitchTokens.primary),
                const SizedBox(width: 8.0),
                Expanded(
                  child: Text(
                    '该产物为 ${widget.artifact.type}，在移动端可查看结构并在 PC 端沙箱直接交互运行。',
                    style: const TextStyle(
                      fontSize: 12.0,
                      color: StitchTokens.onSurfaceVariant,
                      height: 1.4,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16.0),
          SelectableText(
            widget.artifact.content,
            style: const TextStyle(
              fontSize: 13.0,
              height: 1.5,
              color: StitchTokens.onSurface,
              fontFamily: 'monospace',
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCodeStage() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(12.0),
      child: HighlightView(
        widget.artifact.content,
        language: widget.artifact.language ?? 'xml',
        theme: atomOneDarkTheme,
        padding: const EdgeInsets.all(8.0),
        textStyle: const TextStyle(
          fontFamily: 'monospace',
          fontSize: 12.0,
          height: 1.5,
        ),
      ),
    );
  }

  void _handleCopy() {
    Clipboard.setData(ClipboardData(text: widget.artifact.content));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('已成功复制产物源码到剪贴板'),
        behavior: SnackBarBehavior.floating,
        duration: Duration(seconds: 2),
      ),
    );
  }
}
