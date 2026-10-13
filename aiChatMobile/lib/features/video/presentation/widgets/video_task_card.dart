import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../../core/theme/stitch_tokens.dart';
import '../../domain/video_task_model.dart';

/// AI 视频任务卡片组件（支持原地流式加载接管、两行省略与 Tooltip 完整提示词预览）
class VideoTaskCard extends StatelessWidget {
  final VideoTaskModel task;
  final bool isLatestGenerating;
  final int elapsedSeconds;
  final bool isDeleting;
  final VoidCallback onSelectPreview;
  final VoidCallback onReuse;
  final VoidCallback onDelete;

  const VideoTaskCard({
    super.key,
    required this.task,
    this.isLatestGenerating = false,
    this.elapsedSeconds = 0,
    this.isDeleting = false,
    required this.onSelectPreview,
    required this.onReuse,
    required this.onDelete,
  });

  String _formatElapsed(int seconds) {
    final m = (seconds ~/ 60).toString().padLeft(2, '0');
    final s = (seconds % 60).toString().padLeft(2, '0');
    return '$m:${s}s';
  }

  String _formatTimestamp(DateTime dt) {
    final h = dt.hour.toString().padLeft(2, '0');
    final m = dt.minute.toString().padLeft(2, '0');
    return '$h:$m';
  }

  Future<void> _handleDownloadOrOpen(BuildContext context) async {
    final url = task.resolvedVideoUrl;
    if (url == null || url.isEmpty) return;
    final uri = Uri.tryParse(url);
    if (uri == null) return;
    final launched = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!launched && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('无法打开视频链接')),
      );
    }
  }

  Future<void> _confirmDelete(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(StitchTokens.radiusXl),
        ),
        title: const Text(
          '确认删除视频',
          style: TextStyle(fontSize: 16.0, fontWeight: FontWeight.w700),
        ),
        content: const Text(
          '确定要删除该条视频记录及对应的媒体文件吗？此操作不可恢复。',
          style: TextStyle(fontSize: 13.5, color: StitchTokens.onSurfaceVariant),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('取消', style: TextStyle(color: StitchTokens.outline)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: StitchTokens.crimsonStop,
              foregroundColor: Colors.white,
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(StitchTokens.radiusMd),
              ),
            ),
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('删除'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      onDelete();
    }
  }

  @override
  Widget build(BuildContext context) {
    final isRunning = task.status.isRunning;
    final isFailed = task.status == VideoTaskStatus.failed;
    final isSuccess = task.status == VideoTaskStatus.success && task.resolvedVideoUrl != null;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 7.0),
      decoration: BoxDecoration(
        color: isFailed ? const Color(0xFFFFFAFA) : Colors.white,
        borderRadius: BorderRadius.circular(StitchTokens.radiusXl),
        border: Border.all(
          color: isFailed
              ? const Color(0xFFFECACA)
              : (isRunning ? const Color(0xFFC7D2FE) : const Color(0xFFE2E8F0)),
          width: 1.0,
        ),
        boxShadow: [
          BoxShadow(
            color: isRunning
                ? const Color(0xFF6366F1).withValues(alpha: 0.12)
                : const Color(0xFF0F172A).withValues(alpha: 0.04),
            blurRadius: isRunning ? 20.0 : 14.0,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 视频主体画面或流式占位区
          GestureDetector(
            onTap: isSuccess ? onSelectPreview : null,
            child: ConstrainedBox(
              constraints: BoxConstraints(
                maxHeight: task.aspectRatio == '9:16' ? 320.0 : 240.0,
                minHeight: 180.0,
              ),
              child: Container(
                width: double.infinity,
                color: isFailed ? const Color(0xFFFFF5F5) : const Color(0xFF0F172A),
                child: AspectRatio(
                  aspectRatio: task.aspectRatioValue,
                  child: _buildMediaContent(
                    isRunning: isRunning,
                    isFailed: isFailed,
                    isSuccess: isSuccess,
                  ),
                ),
              ),
            ),
          ),

          // 任务信息与操作控制栏
          Padding(
            padding: const EdgeInsets.fromLTRB(14.0, 12.0, 14.0, 12.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // 提示词区域：最大两行，超出省略号，点击或长按通过 Tooltip 显示全部提示词
                Tooltip(
                  message: task.prompt,
                  triggerMode: TooltipTriggerMode.tap,
                  preferBelow: false,
                  margin: const EdgeInsets.symmetric(horizontal: 20.0),
                  padding: const EdgeInsets.symmetric(horizontal: 12.0, vertical: 8.0),
                  decoration: BoxDecoration(
                    color: const Color(0xFF0F172A).withValues(alpha: 0.94),
                    borderRadius: BorderRadius.circular(StitchTokens.radiusMd),
                  ),
                  textStyle: const TextStyle(
                    color: Colors.white,
                    fontSize: 12.5,
                    height: 1.45,
                  ),
                  child: SizedBox(
                    width: double.infinity,
                    child: Text(
                      task.prompt,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 13.0,
                        height: 1.5,
                        color: Color(0xFF0F172A),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ),

                const SizedBox(height: 10.0),
                const Divider(height: 1.0, thickness: 1.0, color: Color(0xFFF1F5F9)),
                const SizedBox(height: 8.0),

                // 元信息胶囊与动作按钮组
                Row(
                  children: [
                    // 模型标签
                    Flexible(
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6.0, vertical: 2.0),
                        decoration: BoxDecoration(
                          color: const Color(0xFFEEF2FF),
                          borderRadius: BorderRadius.circular(4.0),
                        ),
                        child: Text(
                          task.modelId,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 10.5,
                            fontFamily: 'monospace',
                            color: Color(0xFF4F46E5),
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 6.0),

                    // 积分消耗标签
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6.0, vertical: 2.0),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEF3C7),
                        borderRadius: BorderRadius.circular(4.0),
                      ),
                      child: Text(
                        '消耗 ${task.costCredits} 积分',
                        style: const TextStyle(
                          fontSize: 10.5,
                          color: Color(0xFFB45309),
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    const SizedBox(width: 6.0),

                    // 时间戳
                    Text(
                      _formatTimestamp(task.createdAt),
                      style: const TextStyle(
                        fontSize: 11.0,
                        color: Color(0xFF94A3B8),
                      ),
                    ),

                    const Spacer(),

                    // 快捷操作按钮行
                    if (isSuccess) ...[
                      _ActionIconButton(
                        icon: Icons.visibility_outlined,
                        tooltip: '影院预览',
                        onTap: onSelectPreview,
                      ),
                      const SizedBox(width: 2.0),
                      _ActionIconButton(
                        icon: Icons.download_rounded,
                        tooltip: '下载 MP4',
                        onTap: () => _handleDownloadOrOpen(context),
                      ),
                      const SizedBox(width: 2.0),
                    ],
                    _ActionIconButton(
                      icon: Icons.content_copy_rounded,
                      tooltip: '复制提示词',
                      onTap: () {
                        Clipboard.setData(ClipboardData(text: task.prompt));
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('提示词已复制到剪贴板'),
                            duration: Duration(seconds: 2),
                          ),
                        );
                      },
                    ),
                    const SizedBox(width: 2.0),
                    _ActionIconButton(
                      icon: Icons.refresh_rounded,
                      tooltip: '复用参数',
                      onTap: onReuse,
                    ),
                    const SizedBox(width: 2.0),
                    _ActionIconButton(
                      icon: isDeleting ? Icons.hourglass_top_rounded : Icons.delete_outline_rounded,
                      tooltip: '删除记录',
                      isDanger: true,
                      disabled: isDeleting || task.id.startsWith('temp_'),
                      onTap: () => _confirmDelete(context),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMediaContent({
    required bool isRunning,
    required bool isFailed,
    required bool isSuccess,
  }) {
    if (isRunning) {
      return Container(
        padding: const EdgeInsets.all(20.0),
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFF0F172A), Color(0xFF1E1B4B)],
          ),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 48.0,
              height: 48.0,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: const Color(0xFF6366F1).withValues(alpha: 0.16),
                border: Border.all(
                  color: const Color(0xFF6366F1).withValues(alpha: 0.38),
                ),
              ),
              child: const Center(
                child: SizedBox(
                  width: 22.0,
                  height: 22.0,
                  child: CircularProgressIndicator(
                    strokeWidth: 2.4,
                    valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF818CF8)),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 12.0),
            Text(
              isLatestGenerating
                  ? '万相视频渲染中 · ${_formatElapsed(elapsedSeconds)}'
                  : '万相视频渲染中...',
              style: const TextStyle(
                fontSize: 13.5,
                fontWeight: FontWeight.w600,
                fontFamily: 'monospace',
                color: Color(0xFFF1F5F9),
              ),
            ),
            const SizedBox(height: 4.0),
            const Text(
              '上游正在计算扩散帧序列 (通常需 30~90s)',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 11.5,
                color: Color(0xFF94A3B8),
              ),
            ),
          ],
        ),
      );
    }

    if (isFailed) {
      return Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(
              Icons.cancel_outlined,
              size: 30.0,
              color: Color(0xFFEF4444),
            ),
            const SizedBox(height: 6.0),
            const Text(
              '生成未能完成',
              style: TextStyle(
                fontSize: 14.0,
                fontWeight: FontWeight.w600,
                color: Color(0xFFB91C1C),
              ),
            ),
            const SizedBox(height: 4.0),
            Text(
              task.errorMessage ?? '上游渲染超时或中断',
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 12.0,
                color: Color(0xFFEF4444),
              ),
            ),
            const SizedBox(height: 8.0),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 3.0),
              decoration: BoxDecoration(
                color: const Color(0xFFFEF2F2),
                borderRadius: BorderRadius.circular(4.0),
                border: Border.all(color: const Color(0xFFFECACA)),
              ),
              child: const Text(
                '200 积分已全额退还',
                style: TextStyle(
                  fontSize: 11.0,
                  color: Color(0xFFDC2626),
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ],
        ),
      );
    }

    // 成功状态：展示电影级胶片视觉卡片与全屏播放入口
    return Stack(
      fit: StackFit.expand,
      children: [
        Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                Color(0xFF090D16),
                Color(0xFF1E293B),
                Color(0xFF0F172A),
              ],
            ),
          ),
        ),

        // 中心播放触发器
        Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 48.0,
                height: 48.0,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.white.withValues(alpha: 0.92),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.3),
                      blurRadius: 12.0,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: const Icon(
                  Icons.play_arrow_rounded,
                  size: 28.0,
                  color: Color(0xFF0F172A),
                ),
              ),
              const SizedBox(height: 8.0),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10.0, vertical: 3.5),
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.55),
                  borderRadius: BorderRadius.circular(6.0),
                ),
                child: const Text(
                  '点击全屏沉浸播放',
                  style: TextStyle(
                    fontSize: 11.0,
                    color: Colors.white,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ],
          ),
        ),

        // 左上角画幅比例徽标
        Positioned(
          top: 10.0,
          left: 10.0,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 7.0, vertical: 2.5),
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.6),
              borderRadius: BorderRadius.circular(4.0),
            ),
            child: Text(
              task.aspectRatio,
              style: const TextStyle(
                fontSize: 11.0,
                fontFamily: 'monospace',
                color: Colors.white,
              ),
            ),
          ),
        ),

        // 右上角时长徽标
        Positioned(
          top: 10.0,
          right: 10.0,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 7.0, vertical: 2.5),
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.6),
              borderRadius: BorderRadius.circular(4.0),
            ),
            child: Text(
              '${task.duration}s',
              style: const TextStyle(
                fontSize: 11.0,
                fontFamily: 'monospace',
                color: Colors.white,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _ActionIconButton extends StatelessWidget {
  final IconData icon;
  final String tooltip;
  final VoidCallback onTap;
  final bool isDanger;
  final bool disabled;

  const _ActionIconButton({
    required this.icon,
    required this.tooltip,
    required this.onTap,
    this.isDanger = false,
    this.disabled = false,
  });

  @override
  Widget build(BuildContext context) {
    final color = disabled
        ? const Color(0xFFCBD5E1)
        : (isDanger ? const Color(0xFFEF4444) : const Color(0xFF64748B));

    return Tooltip(
      message: tooltip,
      child: InkWell(
        borderRadius: BorderRadius.circular(6.0),
        onTap: disabled ? null : onTap,
        child: Padding(
          padding: const EdgeInsets.all(5.5),
          child: Icon(icon, size: 16.0, color: color),
        ),
      ),
    );
  }
}
