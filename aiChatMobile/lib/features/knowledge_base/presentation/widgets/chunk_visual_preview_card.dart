import 'package:flutter/material.dart';
import '../../../../core/theme/stitch_tokens.dart';
import '../../../chat/presentation/widgets/chat_image_lightbox.dart';

/// 移动端知识库视觉切片缩略图与原图灯箱预览卡片
class ChunkVisualPreviewCard extends StatefulWidget {
  final String imageUrl;
  final String? visualType;
  final int? pageNumber;
  final bool visualInjected;
  final double height;
  final String? heroTag;

  const ChunkVisualPreviewCard({
    super.key,
    required this.imageUrl,
    this.visualType,
    this.pageNumber,
    this.visualInjected = false,
    this.height = 136.0,
    this.heroTag,
  });

  @override
  State<ChunkVisualPreviewCard> createState() => _ChunkVisualPreviewCardState();
}

class _ChunkVisualPreviewCardState extends State<ChunkVisualPreviewCard> {
  static const Map<String, String> _visualTypeLabels = {
    'chart': '数据图表',
    'table': '结构表格',
    'diagram': '架构图示',
    'screenshot': '界面截图',
    'document_page': '文档页面',
    'photo': '实拍图片',
  };

  bool _loadFailed = false;

  @override
  void didUpdateWidget(covariant ChunkVisualPreviewCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.imageUrl != widget.imageUrl && _loadFailed) {
      _loadFailed = false;
    }
  }

  String get _visualTypeLabel {
    if (widget.visualType == null || widget.visualType!.isEmpty) return '视觉原图';
    return _visualTypeLabels[widget.visualType!] ?? '视觉原图';
  }

  /// 图片加载失败时的降级占位提示
  Widget _buildErrorFallback() {
    return const Center(
      child: Padding(
        padding: EdgeInsets.symmetric(horizontal: 12.0),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.broken_image_outlined,
              color: StitchTokens.outline,
              size: 26.0,
            ),
            SizedBox(height: 6.0),
            Text(
              '视觉原图暂不可用',
              style: TextStyle(
                fontSize: 11.5,
                fontWeight: FontWeight.w500,
                color: StitchTokens.outline,
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final trimmedUrl = widget.imageUrl.trim();
    if (trimmedUrl.isEmpty) {
      return const SizedBox.shrink();
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 8.0),
      padding: const EdgeInsets.all(8.0),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(StitchTokens.radiusMd),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          GestureDetector(
            onTap: _loadFailed
                ? null
                : () => ChatImageLightbox.show(
                      context,
                      imageUrl: trimmedUrl,
                      heroTag: widget.heroTag,
                    ),
            child: Stack(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(6.0),
                  child: Container(
                    width: double.infinity,
                    height: widget.height,
                    color: const Color(0xFFF8FAFC),
                    child: _loadFailed
                        ? _buildErrorFallback()
                        : Image.network(
                            trimmedUrl,
                            fit: BoxFit.contain,
                            loadingBuilder: (context, child, progress) {
                              if (progress == null) return child;
                              return const Center(
                                child: SizedBox(
                                  width: 18.0,
                                  height: 18.0,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2.0,
                                    valueColor:
                                        AlwaysStoppedAnimation(StitchTokens.primary),
                                  ),
                                ),
                              );
                            },
                            errorBuilder: (_, __, ___) {
                              WidgetsBinding.instance.addPostFrameCallback((_) {
                                if (mounted && !_loadFailed) {
                                  setState(() => _loadFailed = true);
                                }
                              });
                              return _buildErrorFallback();
                            },
                          ),
                  ),
                ),
                if (!_loadFailed)
                  Positioned(
                    right: 6.0,
                    bottom: 6.0,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6.0, vertical: 3.0),
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.56),
                        borderRadius: BorderRadius.circular(4.0),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.zoom_in_rounded, color: Colors.white, size: 12.0),
                          SizedBox(width: 2.0),
                          Text(
                            '放大',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 10.0,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 6.0),
          Wrap(
            spacing: 6.0,
            runSpacing: 4.0,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6.0, vertical: 2.0),
                decoration: BoxDecoration(
                  color: const Color(0xFFEFF6FF),
                  borderRadius: BorderRadius.circular(4.0),
                  border: Border.all(color: const Color(0xFFBFDBFE)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(
                      Icons.image_outlined,
                      size: 11.0,
                      color: Color(0xFF1D4ED8),
                    ),
                    const SizedBox(width: 3.0),
                    Text(
                      _visualTypeLabel,
                      style: const TextStyle(
                        fontSize: 10.5,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF1D4ED8),
                      ),
                    ),
                  ],
                ),
              ),
              if (widget.pageNumber != null && widget.pageNumber! > 0)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6.0, vertical: 2.0),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(4.0),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Text(
                    'P.${widget.pageNumber}',
                    style: const TextStyle(
                      fontSize: 10.5,
                      fontWeight: FontWeight.w600,
                      fontFamily: 'monospace',
                      color: Color(0xFF475569),
                    ),
                  ),
                ),
              if (widget.visualInjected)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6.0, vertical: 2.0),
                  decoration: BoxDecoration(
                    color: const Color(0xFFECFDF5),
                    borderRadius: BorderRadius.circular(4.0),
                    border: Border.all(color: const Color(0xFFA7F3D0)),
                  ),
                  child: const Text(
                    '已直连视觉模型',
                    style: TextStyle(
                      fontSize: 10.5,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF059669),
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}
