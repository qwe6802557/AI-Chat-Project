import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../../core/theme/stitch_tokens.dart';
import '../../domain/video_task_model.dart';

/// 影院级沉浸式视频详情预览弹窗
class VideoPreviewModal extends StatelessWidget {
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

  String _formatDateTime(DateTime dt) {
    final y = dt.year;
    final m = dt.month.toString().padLeft(2, '0');
    final d = dt.day.toString().padLeft(2, '0');
    final hh = dt.hour.toString().padLeft(2, '0');
    final mm = dt.minute.toString().padLeft(2, '0');
    return '$y-$m-$d $hh:$mm';
  }

  Future<void> _openVideoExternally(BuildContext context) async {
    final url = task.resolvedVideoUrl;
    if (url == null || url.isEmpty) return;
    final uri = Uri.tryParse(url);
    if (uri == null) return;
    final launched = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!launched && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('无法唤起系统播放器打开该视频链接')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
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
                // 顶部暗黑影院播放舞台
                GestureDetector(
                  onTap: () => _openVideoExternally(context),
                  child: Container(
                    height: 230.0,
                    decoration: const BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [
                          Color(0xFF020617),
                          Color(0xFF1E1B4B),
                          Color(0xFF0F172A),
                        ],
                      ),
                    ),
                    child: Stack(
                      alignment: Alignment.center,
                      children: [
                        Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 60.0,
                              height: 60.0,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: const Color(0xFF6366F1).withValues(alpha: 0.9),
                                boxShadow: [
                                  BoxShadow(
                                    color: const Color(0xFF6366F1).withValues(alpha: 0.45),
                                    blurRadius: 20.0,
                                    offset: const Offset(0, 6),
                                  ),
                                ],
                              ),
                              child: const Icon(
                                Icons.play_arrow_rounded,
                                size: 36.0,
                                color: Colors.white,
                              ),
                            ),
                            const SizedBox(height: 12.0),
                            const Text(
                              '点击唤起原生硬件加速播放器全屏观看',
                              style: TextStyle(
                                fontSize: 13.0,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFFF8FAFC),
                              ),
                            ),
                            const SizedBox(height: 4.0),
                            Text(
                              '画幅 ${task.aspectRatio} · 时长 ${task.duration}s · H.264 MP4',
                              style: const TextStyle(
                                fontSize: 11.5,
                                fontFamily: 'monospace',
                                color: Color(0xFF94A3B8),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
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
                                  onReuse();
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
                            onPressed: () => _openVideoExternally(context),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF4F46E5),
                              foregroundColor: Colors.white,
                              elevation: 0,
                              padding: const EdgeInsets.symmetric(vertical: 12.0),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(StitchTokens.radiusMd),
                              ),
                            ),
                            icon: const Icon(Icons.download_rounded, size: 17.0),
                            label: const Text(
                              '流式播放 / 下载高清 MP4',
                              style: TextStyle(fontSize: 13.0, fontWeight: FontWeight.w600),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),

            // 右上角高对比度毛玻璃圆形关闭按钮（完全置于圆角容器内部，杜绝裁切遮挡）
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
