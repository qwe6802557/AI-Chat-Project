import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';

/// 全屏高清图片灯箱预览组件（支持手势缩放、双击与拖拽退出，兼容 Web 与 Native）
class ChatImageLightbox extends StatelessWidget {
  final String imageUrl;
  final String? localPath;
  final Uint8List? bytes;
  final String? heroTag;

  const ChatImageLightbox({
    super.key,
    required this.imageUrl,
    this.localPath,
    this.bytes,
    this.heroTag,
  });

  static Future<void> show(
    BuildContext context, {
    required String imageUrl,
    String? localPath,
    Uint8List? bytes,
    String? heroTag,
  }) {
    return Navigator.of(context).push(
      PageRouteBuilder(
        opaque: false,
        barrierDismissible: true,
        barrierColor: Colors.black.withValues(alpha: 0.88),
        pageBuilder: (context, _, __) => ChatImageLightbox(
          imageUrl: imageUrl,
          localPath: localPath,
          bytes: bytes,
          heroTag: heroTag,
        ),
      ),
    );
  }

  Widget _buildImage() {
    if (bytes != null) {
      return Image.memory(
        bytes!,
        fit: BoxFit.contain,
      );
    }
    if (!kIsWeb && localPath != null && File(localPath!).existsSync()) {
      return Image.file(
        File(localPath!),
        fit: BoxFit.contain,
      );
    }
    return Image.network(
      imageUrl,
      fit: BoxFit.contain,
      loadingBuilder: (context, child, progress) {
        if (progress == null) return child;
        return const Center(
          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.0),
        );
      },
      errorBuilder: (context, _, __) => const Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.broken_image_rounded, color: Colors.white54, size: 48.0),
            SizedBox(height: 8.0),
            Text('图片加载失败', style: TextStyle(color: Colors.white54, fontSize: 13.0)),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    Widget content = InteractiveViewer(
      minScale: 0.5,
      maxScale: 5.0,
      child: Center(
        child: heroTag != null
            ? Hero(tag: heroTag!, child: _buildImage())
            : _buildImage(),
      ),
    );

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: Stack(
        children: [
          GestureDetector(
            onTap: () => Navigator.of(context).pop(),
            child: content,
          ),
          SafeArea(
            child: Align(
              alignment: Alignment.topRight,
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: IconButton(
                  style: IconButton.styleFrom(
                    backgroundColor: Colors.black45,
                    foregroundColor: Colors.white,
                  ),
                  icon: const Icon(Icons.close_rounded, size: 24.0),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
