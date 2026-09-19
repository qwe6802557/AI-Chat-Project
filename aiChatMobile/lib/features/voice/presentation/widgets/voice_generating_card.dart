import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../../../core/theme/stitch_tokens.dart';
import '../../domain/voice_task_model.dart';

/// 生成中 / 识别中动态等宽声波均衡器卡片
class VoiceGeneratingCard extends StatefulWidget {
  final VoiceTaskType type;
  final int elapsedSeconds;
  final VoidCallback? onCancel;

  const VoiceGeneratingCard({
    super.key,
    required this.type,
    required this.elapsedSeconds,
    this.onCancel,
  });

  @override
  State<VoiceGeneratingCard> createState() => _VoiceGeneratingCardState();
}

class _VoiceGeneratingCardState extends State<VoiceGeneratingCard> with SingleTickerProviderStateMixin {
  late final AnimationController _animCtrl;

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat();
  }

  @override
  void dispose() {
    _animCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isTts = widget.type == VoiceTaskType.tts;
    final title = isTts ? '正在合成高保真语音' : '正在解析音频转写文字';
    final elapsedStr = '${widget.elapsedSeconds}s';

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
      padding: const EdgeInsets.all(16.0),
      decoration: BoxDecoration(
        color: StitchTokens.surfaceGlass,
        borderRadius: BorderRadius.circular(StitchTokens.radiusXl),
        border: Border.all(
          color: StitchTokens.primary.withValues(alpha: 0.3),
          width: 1.2,
        ),
        boxShadow: [
          BoxShadow(
            color: StitchTokens.primaryGlow.withValues(alpha: 0.15),
            blurRadius: 16.0,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          // 动态跳动 5 柱声波均衡器
          AnimatedBuilder(
            animation: _animCtrl,
            builder: (context, _) {
              return Container(
                width: 44.0,
                height: 44.0,
                decoration: BoxDecoration(
                  color: StitchTokens.primary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(StitchTokens.radiusLg),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: List.generate(5, (i) {
                    final progress = _animCtrl.value;
                    final phase = (progress * 2 * math.pi) + (i * 0.9);
                    final barHeight = 8.0 + (math.sin(phase).abs() * 18.0);

                    return Container(
                      width: 3.5,
                      height: barHeight,
                      margin: const EdgeInsets.symmetric(horizontal: 1.5),
                      decoration: BoxDecoration(
                        color: StitchTokens.primary,
                        borderRadius: BorderRadius.circular(2.0),
                      ),
                    );
                  }),
                ),
              );
            },
          ),

          const SizedBox(width: 14.0),

          // 文本与秒数跑表
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    const SizedBox(
                      width: 12.0,
                      height: 12.0,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.0,
                        color: StitchTokens.primary,
                      ),
                    ),
                    const SizedBox(width: 8.0),
                    Expanded(
                      child: Text(
                        '$title · 已耗时 $elapsedStr',
                        style: const TextStyle(
                          fontSize: 13.0,
                          fontWeight: FontWeight.w600,
                          color: StitchTokens.onSurface,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4.0),
                const Text(
                  '神经语音模型实时渲染中，请稍候...',
                  style: TextStyle(
                    fontSize: 11.5,
                    color: StitchTokens.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),

          // 取消/中止按钮
          if (widget.onCancel != null)
            IconButton(
              icon: const Icon(Icons.close_rounded, size: 20.0),
              color: StitchTokens.onSurfaceVariant,
              tooltip: '中止任务',
              onPressed: widget.onCancel,
            ),
        ],
      ),
    );
  }
}
