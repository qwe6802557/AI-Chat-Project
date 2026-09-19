import 'dart:async';
import 'dart:math' as math;
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../../core/theme/stitch_tokens.dart';

/// 嵌入式轻量音频播放器组件
class VoiceAudioPlayer extends StatefulWidget {
  final String src;
  final double? duration;
  final String? title;

  const VoiceAudioPlayer({
    super.key,
    required this.src,
    this.duration,
    this.title,
  });

  @override
  State<VoiceAudioPlayer> createState() => _VoiceAudioPlayerState();
}

class _VoiceAudioPlayerState extends State<VoiceAudioPlayer> with SingleTickerProviderStateMixin {
  late final AudioPlayer _player;
  bool _isPlaying = false;
  Duration _position = Duration.zero;
  Duration _totalDuration = Duration.zero;
  bool _hasError = false;

  late final AnimationController _waveAnimCtrl;
  StreamSubscription? _stateSub;
  StreamSubscription? _posSub;
  StreamSubscription? _durationSub;
  StreamSubscription? _completeSub;

  // 伪波形数据高度列表（20 根柱子）
  late final List<double> _waveBars;

  @override
  void initState() {
    super.initState();
    _player = AudioPlayer();

    if (widget.duration != null && widget.duration! > 0) {
      _totalDuration = Duration(milliseconds: (widget.duration! * 1000).round());
    }

    _waveBars = List.generate(20, (i) {
      return math.max(6.0, math.min(22.0, (math.sin(i * 0.6) * 8 + 12 + ((i % 3) * 2))));
    });

    _waveAnimCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );

    _stateSub = _player.onPlayerStateChanged.listen((state) {
      if (!mounted) return;
      final playing = state == PlayerState.playing;
      setState(() => _isPlaying = playing);
      if (playing) {
        _waveAnimCtrl.repeat(reverse: true);
      } else {
        _waveAnimCtrl.stop();
      }
    });

    _posSub = _player.onPositionChanged.listen((pos) {
      if (!mounted) return;
      setState(() => _position = pos);
    });

    _durationSub = _player.onDurationChanged.listen((dur) {
      if (!mounted) return;
      setState(() => _totalDuration = dur);
    });

    _completeSub = _player.onPlayerComplete.listen((_) {
      if (!mounted) return;
      setState(() {
        _isPlaying = false;
        _position = Duration.zero;
      });
      _waveAnimCtrl.stop();
    });
  }

  @override
  void didUpdateWidget(VoiceAudioPlayer oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.src != widget.src) {
      _player.stop();
      _position = Duration.zero;
      _isPlaying = false;
      if (widget.duration != null && widget.duration! > 0) {
        _totalDuration = Duration(milliseconds: (widget.duration! * 1000).round());
      }
    }
  }

  Future<void> _togglePlay() async {
    if (widget.src.isEmpty) return;
    try {
      if (_isPlaying) {
        await _player.pause();
      } else {
        setState(() => _hasError = false);
        await _player.play(UrlSource(widget.src));
      }
    } catch (e) {
      debugPrint('播放音频失败: $e');
      if (mounted) {
        setState(() => _hasError = true);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('音频播放失败: $e')),
        );
      }
    }
  }

  void _seek(double progressRatio) {
    if (_totalDuration.inMilliseconds <= 0) return;
    final targetMs = (_totalDuration.inMilliseconds * progressRatio).clamp(0, _totalDuration.inMilliseconds).toInt();
    _player.seek(Duration(milliseconds: targetMs));
  }

  String _formatDuration(Duration d) {
    final minutes = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final seconds = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '$minutes:$seconds';
  }

  @override
  void dispose() {
    _waveAnimCtrl.dispose();
    _stateSub?.cancel();
    _posSub?.cancel();
    _durationSub?.cancel();
    _completeSub?.cancel();
    _player.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final totalMs = _totalDuration.inMilliseconds;
    final currentMs = _position.inMilliseconds;
    final progress = totalMs > 0 ? (currentMs / totalMs).clamp(0.0, 1.0) : 0.0;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12.0, vertical: 10.0),
      decoration: BoxDecoration(
        color: StitchTokens.surfaceContainerLow,
        borderRadius: BorderRadius.circular(StitchTokens.radiusLg),
        border: Border.all(
          color: StitchTokens.primary.withValues(alpha: 0.12),
          width: 1.0,
        ),
      ),
      child: Row(
        children: [
          // 播放 / 暂停圆形按钮
          GestureDetector(
            onTap: _togglePlay,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              width: 38.0,
              height: 38.0,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: LinearGradient(
                  colors: _isPlaying
                      ? [StitchTokens.primary, StitchTokens.primaryContainer]
                      : [StitchTokens.primary.withValues(alpha: 0.85), StitchTokens.primary],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                boxShadow: [
                  BoxShadow(
                    color: StitchTokens.primary.withValues(alpha: _isPlaying ? 0.35 : 0.15),
                    blurRadius: _isPlaying ? 10.0 : 4.0,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Center(
                child: Icon(
                  _hasError
                      ? Icons.error_outline_rounded
                      : (_isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded),
                  color: Colors.white,
                  size: 22.0,
                ),
              ),
            ),
          ),

          const SizedBox(width: 12.0),

          // 中间波形与进度条
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                // 伪波形条
                GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTapDown: (details) {
                    final box = context.findRenderObject() as RenderBox?;
                    if (box != null) {
                      final local = details.localPosition;
                      _seek(local.dx / 180.0);
                    }
                  },
                  child: AnimatedBuilder(
                    animation: _waveAnimCtrl,
                    builder: (context, _) {
                      return SizedBox(
                        height: 24.0,
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: List.generate(_waveBars.length, (idx) {
                            final barProgress = (idx + 1) / _waveBars.length;
                            final isPassed = barProgress <= progress;

                            // 动态跳动倍率
                            double waveHeight = _waveBars[idx];
                            if (_isPlaying) {
                              final waveOffset = math.sin((_waveAnimCtrl.value * 2 * math.pi) + idx * 0.4);
                              waveHeight = (waveHeight + waveOffset * 4.0).clamp(4.0, 24.0);
                            }

                            return Container(
                              width: 3.0,
                              height: waveHeight,
                              decoration: BoxDecoration(
                                color: isPassed
                                    ? StitchTokens.primary
                                    : StitchTokens.outlineVariant.withValues(alpha: 0.5),
                                borderRadius: BorderRadius.circular(2.0),
                              ),
                            );
                          }),
                        ),
                      );
                    },
                  ),
                ),

                const SizedBox(height: 4.0),

                // 进度滑块与时间
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      _formatDuration(_position),
                      style: const TextStyle(
                        fontSize: 11.0,
                        fontWeight: FontWeight.w600,
                        color: StitchTokens.primary,
                        fontFeatures: [FontFeature.tabularFigures()],
                      ),
                    ),
                    Text(
                      _formatDuration(_totalDuration),
                      style: const TextStyle(
                        fontSize: 11.0,
                        color: StitchTokens.onSurfaceVariant,
                        fontFeatures: [FontFeature.tabularFigures()],
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),

          const SizedBox(width: 8.0),

          // 复制音频链接按钮
          IconButton(
            icon: const Icon(Icons.copy_rounded, size: 18.0),
            color: StitchTokens.onSurfaceVariant,
            tooltip: '复制音频链接',
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 32.0, minHeight: 32.0),
            onPressed: () {
              Clipboard.setData(ClipboardData(text: widget.src));
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('已复制音频链接至剪贴板')),
              );
            },
          ),
        ],
      ),
    );
  }
}
