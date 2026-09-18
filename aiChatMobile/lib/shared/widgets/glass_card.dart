import 'dart:ui';
import 'package:flutter/material.dart';
import '../../core/theme/stitch_tokens.dart';

/// Stitch 毛玻璃拟态容器
class GlassCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;
  final double borderRadius;
  final double blur;
  final Color? backgroundColor;
  final Border? border;
  final VoidCallback? onTap;

  const GlassCard({
    super.key,
    required this.child,
    this.padding,
    this.margin,
    this.borderRadius = StitchTokens.radiusXl,
    this.blur = 16.0,
    this.backgroundColor,
    this.border,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    Widget content = Container(
      padding: padding,
      decoration: BoxDecoration(
        color: backgroundColor ?? StitchTokens.surfaceGlass,
        borderRadius: BorderRadius.circular(borderRadius),
        border: border ??
            Border.all(
              color: Colors.white.withValues(alpha: 0.6),
              width: 1.0,
            ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withValues(alpha: 0.04),
            blurRadius: 16.0,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: child,
    );

    if (onTap != null) {
      content = Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(borderRadius),
        child: InkWell(
          borderRadius: BorderRadius.circular(borderRadius),
          onTap: onTap,
          child: content,
        ),
      );
    }

    return Container(
      margin: margin,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(borderRadius),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: blur, sigmaY: blur),
          child: content,
        ),
      ),
    );
  }
}
