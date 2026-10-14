import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';
import '../../../../core/theme/stitch_tokens.dart';
import '../../domain/video_task_model.dart';
import 'embedded_video_player.dart';

/// 影院级沉浸式视频详情预览弹窗
class VideoPreviewModal extends StatefulWidget {
  final VideoTaskModel task;
  final VoidCallback onReuse;

  const VideoPreviewModal({
    super.key,
    required this.task,
    required this.onReuse,
  });

  static Future<void> show(
    BuildContext context, {
    required VideoTaskModel task,
    required VoidCallback onReuse,
  }) {
    return showDialog<void>(
      context: context,
      useRootNavigator: true,
      barrierColor: const Color(0xFF020617).withValues(alpha: 0.82),
      builder: (_) => VideoPreviewModal(
        task: task,
        onReuse: onReuse,
      ),
    );
  }

  @override
  State<VideoPreviewModal> createState() => _VideoPreviewModalState();
}

class _VideoPreviewModalState extends State<VideoPreviewModal> {
  bool _isDownloading = false;
  double _downloadProgress = 0.0;

  String _formatDateTime(DateTime dt) {
    final y = dt.year;
    final m = dt.month.toString().padLeft(2, '0');
    final d = dt.day.toString().padLeft(2, '0');
    final hh = dt.hour.toString().padLeft(2, '0');
    final mm = dt.minute.toString().padLeft(2, '0');
    return '$y-$m-$d $hh:$mm';
  }

  Future<void> _downloadVideoLocally(BuildContext context) async {
    final messenger = ScaffoldMessenger.of(context);
    final url = widget.task.resolvedVideoUrl;
    if (url == null || url.isEmpty) {
      messenger.showSnackBar(
        const SnackBar(content: Text('视频地址为空，无法下载')),
      );
      return;
    }

    if (_isDownloading) return;

    setState(() {
      _isDownloading = true;
      _downloadProgress = 0.0;
    });

    try {
      final dir = await getTemporaryDirectory();
      final filename = 'video_${widget.task.id}_${DateTime.now().millisecondsSinceEpoch}.mp4';
      final savePath = '${dir.path}/$filename';

      final dio = Dio();
      final response = await dio.download(
        url,
        savePath,
        onReceiveProgress: (received, total) {
          if (total > 0 && mounted) {
            setState(() {
              _downloadProgress = received / total;
            });
          }
        },
      );

      if (response.statusCode == 200 && mounted) {
        final file = File(savePath);
        final sizeMb = ((await file.length()) / (1024 * 1024)).toStringAsFixed(2);
        messenger.showSnackBar(
          SnackBar(
            content: Text('视频已成功下载至本地 ($sizeMb MB)'),
            backgroundColor: StitchTokens.primary,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        messenger.showSnackBar(
          SnackBar(
            content: Text('下载失败: $e'),
            backgroundColor: StitchTokens.crimsonStop,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isDownloading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final task = widget.task;

    return Dialog(
      backgroundColor: Colors.transparent,
      elevation: 0,
      insetPadding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 28.0),
      child: Container(
        decoration: BoxDecoration(
          color: const Color(0xFF0B1120),
          borderRadius: BorderRadius.circular(StitchTokens.radius2Xl),
          border: Border.all(
            color: Colors.white.withValues(alpha: 0.12),
            width: 1.0,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.65),
              blurRadius: 40.0,
              offset: const Offset(0, 20),
            ),
          ],
        ),
        clipBehavior: Clip.antiAlias,
        child: Stack(
          children: [
            Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // 顶部暗黑影院原生流式播放舞台
                EmbeddedVideoPlayer(
                  videoUrl: task.resolvedVideoUrl ?? '',
                  aspectRatio: task.aspectRatio,
                ),

                // 详情参数与完整提示词区
                Flexible(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.fromLTRB(20.0, 18.0, 20.0, 20.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          '生成提示词 PROMPT',
                          style: TextStyle(
                            fontSize: 11.0,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 0.8,
                            color: Color(0xFF64748B),
                          ),
                        ),
                        const SizedBox(height: 8.0),
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(12.0),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.04),
                            borderRadius: BorderRadius.circular(StitchTokens.radiusLg),
                            border: Border.all(
                              color: Colors.white.withValues(alpha: 0.08),
                            ),
                          ),
                          child: SelectableText(
                            task.prompt,
                            style: const TextStyle(
                              fontSize: 13.5,
                              height: 1.6,
                              color: Color(0xFFF1F5F9),
                            ),
                          ),
                        ),

                        const SizedBox(height: 14.0),

                        // 参数胶囊阵列
                        Wrap(
                          spacing: 8.0,
                          runSpacing: 8.0,
                          children: [
                            _MetaBadge(
                              label: '模型',
                              value: task.modelId,
                              valueColor: const Color(0xFF818CF8),
                            ),
                            _MetaBadge(
                              label: '画幅',
                              value: task.aspectRatio,
                            ),
                            _MetaBadge(
                              label: '时长',
                              value: '${task.duration}s',
                            ),
                            _MetaBadge(
                              label: '消耗',
                              value: '${task.costCredits} 积分',
                              valueColor: const Color(0xFFFBBF24),
                            ),
                            _MetaBadge(
                              label: '时间',
                              value: _formatDateTime(task.createdAt),
                            ),
                          ],
                        ),

                        const SizedBox(height: 18.0),

                        // 底部操作按钮行
                        Row(
                          children: [
                            Expanded(
                              child: OutlinedButton.icon(
                                onPressed: () {
                                  Clipboard.setData(ClipboardData(text: task.prompt));
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(content: Text('提示词已复制到剪贴板')),
                                  );
                                },
                                style: OutlinedButton.styleFrom(
                                  foregroundColor: const Color(0xFFE2E8F0),
                                  side: BorderSide(color: Colors.white.withValues(alpha: 0.16)),
                                  padding: const EdgeInsets.symmetric(vertical: 11.0),
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(StitchTokens.radiusMd),
                                  ),
                                ),
                                icon: const Icon(Icons.content_copy_rounded, size: 15.0),
                                label: const Text('复制提示词', style: TextStyle(fontSize: 12.5)),
                              ),
                            ),
                            const SizedBox(width: 10.0),
                            Expanded(
                              child: OutlinedButton.icon(
                                onPressed: () {
                                  Navigator.of(context).pop();
                                  widget.onReuse();
                                },
                                style: OutlinedButton.styleFrom(
                                  foregroundColor: const Color(0xFFE2E8F0),
                                  side: BorderSide(color: Colors.white.withValues(alpha: 0.16)),
                                  padding: const EdgeInsets.symmetric(vertical: 11.0),
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(StitchTokens.radiusMd),
                                  ),
                                ),
                                icon: const Icon(Icons.refresh_rounded, size: 15.0),
                                label: const Text('复用参数', style: TextStyle(fontSize: 12.5)),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10.0),
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton.icon(
                            onPressed: _isDownloading ? null : () => _downloadVideoLocally(context),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF4F46E5),
                              foregroundColor: Colors.white,
                              elevation: 0,
                              padding: const EdgeInsets.symmetric(vertical: 12.0),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(StitchTokens.radiusMd),
                              ),
                            ),
                            icon: _isDownloading
                                ? const SizedBox(
                                    width: 16.0,
                                    height: 16.0,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2.0,
                                      valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                                    ),
                                  )
                                : const Icon(Icons.download_rounded, size: 17.0),
                            label: Text(
                              _isDownloading
                                  ? '正在下载 ${(_downloadProgress * 100).toInt()}%'
                                  : '流式播放 / 下载高清 MP4',
                              style: const TextStyle(fontSize: 13.0, fontWeight: FontWeight.w600),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),

            // 右上角高对比度毛玻璃圆形关闭按钮
            Positioned(
              top: 14.0,
              right: 14.0,
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  borderRadius: BorderRadius.circular(StitchTokens.radiusFull),
                  onTap: () => Navigator.of(context).pop(),
                  child: Container(
                    width: 34.0,
                    height: 34.0,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: Colors.white.withValues(alpha: 0.14),
                      border: Border.all(
                        color: Colors.white.withValues(alpha: 0.24),
                        width: 1.0,
                      ),
                    ),
                    child: const Icon(
                      Icons.close_rounded,
                      size: 18.0,
                      color: Color(0xFFF8FAFC),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MetaBadge extends StatelessWidget {
  final String label;
  final String value;
  final Color valueColor;

  const _MetaBadge({
    required this.label,
    required this.value,
    this.valueColor = const Color(0xFFE2E8F0),
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10.0, vertical: 5.0),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(StitchTokens.radiusMd),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            '$label ',
            style: const TextStyle(
              fontSize: 11.5,
              color: Color(0xFF94A3B8),
            ),
          ),
          Text(
            value,
            style: TextStyle(
              fontSize: 11.5,
              fontFamily: 'monospace',
              fontWeight: FontWeight.w600,
              color: valueColor,
            ),
          ),
        ],
      ),
    );
  }
}
