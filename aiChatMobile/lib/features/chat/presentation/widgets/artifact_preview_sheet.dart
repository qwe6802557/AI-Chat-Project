import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:flutter_highlighter/flutter_highlighter.dart';
import 'package:flutter_highlighter/themes/atom-one-dark.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:webview_flutter/webview_flutter.dart';
import '../../../../core/theme/stitch_tokens.dart';
import '../../domain/artifact_model.dart';

/// 移动端沉浸式 Artifact 产物预览抽屉
/// 支持全屏模态根导航器挂载、多版本回溯切换、效果预览与代码双视图、系统级原生分享
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
  late int _selectedVersionIndex;
  WebViewController? _webViewController;
  bool _isLoadingWeb = true;

  ArtifactModel get _currentArtifact {
    final versions = widget.artifact.effectiveVersions;
    if (_selectedVersionIndex >= 0 && _selectedVersionIndex < versions.length) {
      return versions[_selectedVersionIndex];
    }
    return widget.artifact;
  }

  bool get _isSvg =>
      _currentArtifact.type.contains('svg') ||
      _currentArtifact.content.trim().startsWith('<svg');

  bool get _isHtml =>
      _currentArtifact.type.contains('html') ||
      (_currentArtifact.language?.toLowerCase() == 'html') ||
      _currentArtifact.content.trim().startsWith('<!DOCTYPE') ||
      _currentArtifact.content.trim().startsWith('<html');

  @override
  void initState() {
    super.initState();
    _selectedVersionIndex = widget.artifact.effectiveVersions.isNotEmpty
        ? widget.artifact.effectiveVersions.length - 1
        : 0;
    if (!_isSvg && !_isHtml) {
      _selectedTabIndex = 1;
    } else if (_isHtml) {
      _initWebViewController();
    }
  }

  void _initWebViewController() {
    try {
      _webViewController = WebViewController()
        ..setJavaScriptMode(JavaScriptMode.unrestricted)
        ..setBackgroundColor(Colors.white)
        ..setNavigationDelegate(
          NavigationDelegate(
            onPageStarted: (_) {
              if (mounted) setState(() => _isLoadingWeb = true);
            },
            onPageFinished: (_) {
              if (mounted) setState(() => _isLoadingWeb = false);
            },
            onWebResourceError: (_) {
              if (mounted) setState(() => _isLoadingWeb = false);
            },
          ),
        )
        ..loadHtmlString(_currentArtifact.content);
    } catch (_) {
      _isLoadingWeb = false;
    }
  }

  void _selectVersion(int index) {
    if (_selectedVersionIndex == index) return;
    setState(() {
      _selectedVersionIndex = index;
      if (!_isSvg && !_isHtml) {
        _selectedTabIndex = 1;
      }
    });
    if (_isHtml && _webViewController != null) {
      _webViewController!.loadHtmlString(_currentArtifact.content);
    }
  }

  Future<void> _handleShare() async {
    try {
      final tempDir = await getTemporaryDirectory();
      final ext = _resolveFileExtension();
      final safeTitle = _currentArtifact.title.replaceAll(RegExp(r'[\\/:*?"<>|]'), '_');
      final fileName = '${safeTitle}_v${_currentArtifact.version}.$ext';
      final file = File('${tempDir.path}/$fileName');
      await file.writeAsString(_currentArtifact.content);

      await SharePlus.instance.share(
        ShareParams(
          files: [XFile(file.path)],
          subject: _currentArtifact.title,
          text: '来自 AI Chat 的 Artifact: ${_currentArtifact.title}',
        ),
      );
    } catch (_) {
      if (!mounted) return;
      try {
        await SharePlus.instance.share(
          ShareParams(
            text: _currentArtifact.content,
            subject: _currentArtifact.title,
          ),
        );
      } catch (_) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('分享失败，请重试'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  String _resolveFileExtension() {
    final lang = _currentArtifact.language?.toLowerCase() ?? '';
    final type = _currentArtifact.type.toLowerCase();
    if (type.contains('svg') || _isSvg) return 'svg';
    if (type.contains('html') || _isHtml) return 'html';
    if (type.contains('markdown') || lang == 'md' || lang == 'markdown') return 'md';
    if (lang == 'js' || lang == 'javascript') return 'js';
    if (lang == 'ts' || lang == 'typescript') return 'ts';
    if (lang == 'json') return 'json';
    if (lang == 'dart') return 'dart';
    if (lang == 'python' || lang == 'py') return 'py';
    if (lang == 'vue') return 'vue';
    if (lang == 'css') return 'css';
    return 'txt';
  }

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
                          _currentArtifact.title,
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
                              _currentArtifact.identifier,
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
                                'v${_currentArtifact.version}',
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

                  // 分享按钮
                  IconButton(
                    onPressed: _handleShare,
                    icon: const Icon(Icons.share_rounded, size: 20.0),
                    tooltip: '分享产物',
                    color: StitchTokens.onSurfaceVariant,
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

            // 多版本选择药丸切换器
            if (widget.artifact.effectiveVersions.length > 1)
              Padding(
                padding: const EdgeInsets.fromLTRB(20.0, 0, 20.0, 10.0),
                child: SizedBox(
                  height: 30.0,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: widget.artifact.effectiveVersions.length,
                    separatorBuilder: (_, __) => const SizedBox(width: 8.0),
                    itemBuilder: (context, index) {
                      final item = widget.artifact.effectiveVersions[index];
                      final isSelected = index == _selectedVersionIndex;
                      final isLatest = index == widget.artifact.effectiveVersions.length - 1;
                      return GestureDetector(
                        onTap: () => _selectVersion(index),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10.0, vertical: 4.0),
                          decoration: BoxDecoration(
                            color: isSelected ? StitchTokens.primaryContainer : StitchTokens.surfaceContainerLow,
                            borderRadius: BorderRadius.circular(StitchTokens.radiusSm),
                            border: Border.all(
                              color: isSelected ? StitchTokens.primary : StitchTokens.outlineVariant.withValues(alpha: 0.3),
                            ),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.history_rounded,
                                size: 13.0,
                                color: isSelected ? StitchTokens.onPrimaryContainer : StitchTokens.onSurfaceVariant,
                              ),
                              const SizedBox(width: 4.0),
                              Text(
                                'v${item.version}${isLatest ? ' (最新)' : ''}',
                                style: TextStyle(
                                  fontSize: 11.0,
                                  fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                                  color: isSelected ? StitchTokens.onPrimaryContainer : StitchTokens.onSurfaceVariant,
                                  fontFamily: 'monospace',
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
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
            _currentArtifact.content,
            placeholderBuilder: (_) => const Center(
              child: CircularProgressIndicator(strokeWidth: 2.0),
            ),
          ),
        ),
      );
    }

    if (_isHtml) {
      if (_webViewController == null) {
        return SingleChildScrollView(
          padding: const EdgeInsets.all(16.0),
          child: SelectableText(
            _currentArtifact.content,
            style: const TextStyle(
              fontSize: 13.0,
              height: 1.5,
              color: StitchTokens.onSurface,
              fontFamily: 'monospace',
            ),
          ),
        );
      }

      return Stack(
        children: [
          WebViewWidget(controller: _webViewController!),
          if (_isLoadingWeb)
            const Center(
              child: CircularProgressIndicator(
                strokeWidth: 2.0,
                color: StitchTokens.primary,
              ),
            ),
        ],
      );
    }

    // 纯代码等非直接预览格式
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.all(14.0),
            decoration: BoxDecoration(
              color: StitchTokens.surfaceContainerLowest,
              borderRadius: BorderRadius.circular(StitchTokens.radiusMd),
              border: Border.all(
                color: StitchTokens.outlineVariant.withValues(alpha: 0.5),
              ),
            ),
            child: Row(
              children: [
                const Icon(Icons.code_rounded, size: 18.0, color: StitchTokens.primary),
                const SizedBox(width: 8.0),
                Expanded(
                  child: Text(
                    '当前产物为 ${_currentArtifact.language?.toUpperCase() ?? 'CODE'} 纯逻辑源码，可在【产物源码】Tab 查看语法高亮与复制。',
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
            _currentArtifact.content,
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
        _currentArtifact.content,
        language: _currentArtifact.language ?? 'xml',
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
    Clipboard.setData(ClipboardData(text: _currentArtifact.content));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('已成功复制产物源码到剪贴板'),
        behavior: SnackBarBehavior.floating,
        duration: Duration(seconds: 2),
      ),
    );
  }
}
