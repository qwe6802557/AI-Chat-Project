import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';
import '../../../../core/theme/stitch_tokens.dart';

/// 影院级嵌入式原生硬件加速视频播放器
class EmbeddedVideoPlayer extends StatefulWidget {
  final String videoUrl;
  final String aspectRatio;

  const EmbeddedVideoPlayer({
    super.key,
    required this.videoUrl,
    this.aspectRatio = '16:9',
  });

  @override
  State<EmbeddedVideoPlayer> createState() => _EmbeddedVideoPlayerState();
}

class _EmbeddedVideoPlayerState extends State<EmbeddedVideoPlayer> {
  VideoPlayerController? _controller;
  bool _isInitialized = false;
  bool _hasError = false;
  bool _showControls = true;

  @override
  void initState() {
    super.initState();
    _initializePlayer();
  }

  Future<void> _initializePlayer() async {
    if (widget.videoUrl.isEmpty) {
      if (mounted) setState(() => _hasError = true);
      return;
    }

    try {
      final uri = Uri.parse(widget.videoUrl);
      final controller = VideoPlayerController.networkUrl(uri);
      _controller = controller;

      await controller.initialize();
      if (!mounted) return;

      controller.setLooping(true);
      setState(() {
        _isInitialized = true;
      });
    } catch (e) {
      debugPrint('[EmbeddedVideoPlayer] init error: $e');
      if (mounted) {
        setState(() => _hasError = true);
      }
    }
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  void _togglePlayPause() {
    final controller = _controller;
    if (controller == null || !_isInitialized) return;

    setState(() {
      if (controller.value.isPlaying) {
        controller.pause();
      } else {
        controller.play();
      }
    });
  }

  double _parseAspectRatio() {
    final parts = widget.aspectRatio.split(':');
    if (parts.length == 2) {
      final w = double.tryParse(parts[0]);
      final h = double.tryParse(parts[1]);
      if (w != null && h != null && h > 0) {
        return w / h;
      }
    }
    return 16 / 9;
  }

  String _formatDuration(Duration d) {
    final mm = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final ss = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '$mm:$ss';
  }

  @override
  Widget build(BuildContext context) {
    final targetRatio = _parseAspectRatio();
    final controller = _controller;

    if (_hasError) {
      return Container(
        height: 230.0,
        decoration: const BoxDecoration(
          color: Color(0xFF020617),
        ),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline_rounded, size: 40.0, color: Color(0xFFF87171)),
              const SizedBox(height: 8.0),
              const Text(
                '无法在线加载该视频流',
                style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13.0),
              ),
              const SizedBox(height: 8.0),
              TextButton.icon(
                onPressed: () {
                  setState(() {
                    _hasError = false;
                    _isInitialized = false;
                  });
                  _initializePlayer();
                },
                icon: const Icon(Icons.refresh_rounded, size: 16.0),
                label: const Text('点击重试'),
              ),
            ],
          ),
        ),
      );
    }

    if (!_isInitialized || controller == null) {
      return Container(
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
        child: const Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              SizedBox(
                width: 36.0,
                height: 36.0,
                child: CircularProgressIndicator(
                  strokeWidth: 2.5,
                  valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF818CF8)),
                ),
              ),
              SizedBox(height: 12.0),
              Text(
                '正在初始化原生播放引擎...',
                style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12.5),
              ),
            ],
          ),
        ),
      );
    }

    final isPlaying = controller.value.isPlaying;
    final position = controller.value.position;
    final duration = controller.value.duration;

    return GestureDetector(
      onTap: () {
        setState(() {
          _showControls = !_showControls;
        });
      },
      child: Container(
        height: 240.0,
        color: Colors.black,
        child: Stack(
          alignment: Alignment.center,
          children: [
            Center(
              child: AspectRatio(
                aspectRatio: targetRatio,
                child: VideoPlayer(controller),
              ),
            ),

            if (_showControls || !isPlaying)
              Container(
                color: Colors.black.withValues(alpha: isPlaying ? 0.25 : 0.45),
              ),

            if (_showControls || !isPlaying)
              Center(
                child: GestureDetector(
                  onTap: _togglePlayPause,
                  child: Container(
                    width: 58.0,
                    height: 58.0,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: const Color(0xFF6366F1).withValues(alpha: 0.9),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF6366F1).withValues(alpha: 0.5),
                          blurRadius: 20.0,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Icon(
                      isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded,
                      size: 36.0,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),

            if (_showControls || !isPlaying)
              Positioned(
                bottom: 0,
                left: 0,
                right: 0,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12.0, vertical: 8.0),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.bottomCenter,
                      end: Alignment.topCenter,
                      colors: [
                        Colors.black.withValues(alpha: 0.8),
                        Colors.transparent,
                      ],
                    ),
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      VideoProgressIndicator(
                        controller,
                        allowScrubbing: true,
                        colors: const VideoProgressColors(
                          playedColor: StitchTokens.primary,
                          bufferedColor: Colors.white24,
                          backgroundColor: Colors.white12,
                        ),
                        padding: const EdgeInsets.symmetric(vertical: 4.0),
                      ),
                      const SizedBox(height: 4.0),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            '${_formatDuration(position)} / ${_formatDuration(duration)}',
                            style: const TextStyle(
                              fontSize: 11.0,
                              color: Color(0xFFCBD5E1),
                              fontFamily: 'monospace',
                            ),
                          ),
                          Row(
                            children: [
                              IconButton(
                                icon: Icon(
                                  controller.value.volume > 0
                                      ? Icons.volume_up_rounded
                                      : Icons.volume_off_rounded,
                                  size: 18.0,
                                  color: Colors.white70,
                                ),
                                padding: EdgeInsets.zero,
                                constraints: const BoxConstraints(),
                                onPressed: () {
                                  setState(() {
                                    controller.setVolume(controller.value.volume > 0 ? 0.0 : 1.0);
                                  });
                                },
                              ),
                              const SizedBox(width: 8.0),
                              const Text(
                                'HD 在线直连',
                                style: TextStyle(
                                  fontSize: 10.5,
                                  color: Color(0xFF818CF8),
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
