import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../../core/theme/stitch_tokens.dart';
import '../../domain/voice_task_model.dart';
import 'voice_audio_player.dart';

/// 任务瀑布流卡片组件
class VoiceTaskCard extends StatelessWidget {
  final VoiceTaskModel task;
  final VoidCallback? onReuse;

  const VoiceTaskCard({
    super.key,
    required this.task,
    this.onReuse,
  });

  String _formatDateTime(DateTime dt) {
    final now = DateTime.now();
    final diff = now.difference(dt);
    if (diff.inMinutes < 1) return '刚刚';
    if (diff.inHours < 1) return '${diff.inMinutes}分钟前';
    if (diff.inDays < 1) return '${diff.inHours}小时前';
    if (diff.inDays < 7) return '${diff.inDays}天前';
    return '${dt.month.toString().padLeft(2, '0')}-${dt.day.toString().padLeft(2, '0')} ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final isTts = task.type == VoiceTaskType.tts;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 6.0),
      padding: const EdgeInsets.all(14.0),
      decoration: BoxDecoration(
        color: StitchTokens.surfaceGlass,
        borderRadius: BorderRadius.circular(StitchTokens.radiusXl),
        border: Border.all(
          color: StitchTokens.outlineVariant.withValues(alpha: 0.3),
          width: 1.0,
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withValues(alpha: 0.03),
            blurRadius: 10.0,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 头部元信息徽标行
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              // 类型胶囊
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7.0, vertical: 3.0),
                decoration: BoxDecoration(
                  color: isTts
                      ? StitchTokens.primary.withValues(alpha: 0.1)
                      : const Color(0xFF7C3AED).withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(StitchTokens.radiusSm),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      isTts ? Icons.volume_up_rounded : Icons.mic_rounded,
                      size: 13.0,
                      color: isTts ? StitchTokens.primary : const Color(0xFF7C3AED),
                    ),
                    const SizedBox(width: 4.0),
                    Text(
                      isTts ? '语音合成' : '语音识别',
                      style: TextStyle(
                        fontSize: 11.0,
                        fontWeight: FontWeight.w600,
                        color: isTts ? StitchTokens.primary : const Color(0xFF7C3AED),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(width: 6.0),

              // 模型胶囊
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6.0, vertical: 2.5),
                decoration: BoxDecoration(
                  color: StitchTokens.surfaceContainer,
                  borderRadius: BorderRadius.circular(StitchTokens.radiusSm),
                ),
                child: Text(
                  task.model,
                  style: const TextStyle(
                    fontSize: 10.5,
                    color: StitchTokens.onSurfaceVariant,
                  ),
                ),
              ),

              // 音色标签
              if (task.voiceId != null && task.voiceId!.isNotEmpty) ...[
                const SizedBox(width: 4.0),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6.0, vertical: 2.5),
                  decoration: BoxDecoration(
                    color: StitchTokens.surfaceContainer,
                    borderRadius: BorderRadius.circular(StitchTokens.radiusSm),
                  ),
                  child: Text(
                    task.voiceId!,
                    style: const TextStyle(
                      fontSize: 10.5,
                      color: StitchTokens.onSurfaceVariant,
                    ),
                  ),
                ),
              ],

              // 语速标签
              if (task.speed != 1.0) ...[
                const SizedBox(width: 4.0),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6.0, vertical: 2.5),
                  decoration: BoxDecoration(
                    color: StitchTokens.surfaceContainer,
                    borderRadius: BorderRadius.circular(StitchTokens.radiusSm),
                  ),
                  child: Text(
                    '${task.speed}x',
                    style: const TextStyle(
                      fontSize: 10.5,
                      color: StitchTokens.onSurfaceVariant,
                    ),
                  ),
                ),
              ],

              // 时长标签
              if (task.duration != null && task.duration! > 0) ...[
                const SizedBox(width: 4.0),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6.0, vertical: 2.5),
                  decoration: BoxDecoration(
                    color: StitchTokens.surfaceContainer,
                    borderRadius: BorderRadius.circular(StitchTokens.radiusSm),
                  ),
                  child: Text(
                    '${task.duration!.toStringAsFixed(1)}s',
                    style: const TextStyle(
                      fontSize: 10.5,
                      color: StitchTokens.onSurfaceVariant,
                    ),
                  ),
                ),
              ],

              const Spacer(),

              // 时间戳
              Text(
                _formatDateTime(task.createdAt),
                style: const TextStyle(
                  fontSize: 11.0,
                  color: StitchTokens.outline,
                ),
              ),
            ],
          ),

          const SizedBox(height: 10.0),

          // 文本内容区域
          SelectableText(
            task.text.isNotEmpty ? task.text : '(无文字内容)',
            style: const TextStyle(
              fontSize: 14.0,
              height: 1.45,
              color: StitchTokens.onSurface,
            ),
          ),

          // 成功状态且带有音频：展示内嵌播放器
          if (task.status == VoiceTaskStatus.success && task.audioUrl != null) ...[
            const SizedBox(height: 10.0),
            VoiceAudioPlayer(
              src: task.audioUrl!,
              duration: task.duration,
              title: task.text.length > 20 ? '${task.text.substring(0, 20)}...' : task.text,
            ),
          ],

          // 失败状态提示
          if (task.status == VoiceTaskStatus.failed) ...[
            const SizedBox(height: 8.0),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10.0, vertical: 6.0),
              decoration: BoxDecoration(
                color: StitchTokens.crimsonStop.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(StitchTokens.radiusMd),
                border: Border.all(
                  color: StitchTokens.crimsonStop.withValues(alpha: 0.25),
                  width: 1.0,
                ),
              ),
              child: Row(
                children: [
                  const Icon(Icons.error_outline_rounded, size: 15.0, color: StitchTokens.crimsonStop),
                  const SizedBox(width: 6.0),
                  Expanded(
                    child: Text(
                      '任务处理失败：${task.errorMessage ?? '未知异常，已自动为您返还积分'}',
                      style: const TextStyle(fontSize: 11.5, color: StitchTokens.crimsonStop),
                    ),
                  ),
                ],
              ),
            ),
          ],

          const SizedBox(height: 8.0),

          // 底部动作行
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              // 复制文本
              InkWell(
                borderRadius: BorderRadius.circular(StitchTokens.radiusSm),
                onTap: () {
                  Clipboard.setData(ClipboardData(text: task.text));
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('已复制文本至剪贴板')),
                  );
                },
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 6.0, vertical: 4.0),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: const [
                      Icon(Icons.content_copy_rounded, size: 13.0, color: StitchTokens.onSurfaceVariant),
                      SizedBox(width: 4.0),
                      Text(
                        '复制文本',
                        style: TextStyle(fontSize: 11.5, color: StitchTokens.onSurfaceVariant),
                      ),
                    ],
                  ),
                ),
              ),

              if (isTts && onReuse != null) ...[
                const SizedBox(width: 12.0),
                // 复用配置
                InkWell(
                  borderRadius: BorderRadius.circular(StitchTokens.radiusSm),
                  onTap: onReuse,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 6.0, vertical: 4.0),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: const [
                        Icon(Icons.refresh_rounded, size: 14.0, color: StitchTokens.primary),
                        SizedBox(width: 4.0),
                        Text(
                          '复用参数',
                          style: TextStyle(fontSize: 11.5, color: StitchTokens.primary, fontWeight: FontWeight.w500),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}
