import 'package:flutter/material.dart';

/// Stitch 分支切换 150ms 优雅淡入过渡容器组件
///
/// 配合 StatefulShellRoute.indexedStack 实现零重排、零白屏、常驻内存并附带平滑淡入质感
class AnimatedBranchFade extends StatefulWidget {
  final int currentIndex;
  final Widget child;
  final Duration duration;

  const AnimatedBranchFade({
    super.key,
    required this.currentIndex,
    required this.child,
    this.duration = const Duration(milliseconds: 150),
  });

  @override
  State<AnimatedBranchFade> createState() => _AnimatedBranchFadeState();
}

class _AnimatedBranchFadeState extends State<AnimatedBranchFade>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: widget.duration,
    );
    _animation = CurvedAnimation(
      parent: _controller,
      curve: Curves.easeIn,
    );
    _controller.value = 1.0;
  }

  @override
  void didUpdateWidget(covariant AnimatedBranchFade oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.currentIndex != widget.currentIndex) {
      _controller.forward(from: 0.0);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _animation,
      child: widget.child,
    );
  }
}
