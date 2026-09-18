import 'package:flutter/material.dart';
import '../../core/theme/stitch_tokens.dart';

enum CyberButtonVariant { primary, stop, ghost }

/// Stitch 科技微拟态按键
class CyberButton extends StatefulWidget {
  final Widget child;
  final VoidCallback? onPressed;
  final CyberButtonVariant variant;
  final double height;
  final double? width;
  final double borderRadius;

  const CyberButton({
    super.key,
    required this.child,
    this.onPressed,
    this.variant = CyberButtonVariant.primary,
    this.height = 44.0,
    this.width,
    this.borderRadius = StitchTokens.radiusFull,
  });

  @override
  State<CyberButton> createState() => _CyberButtonState();
}

class _CyberButtonState extends State<CyberButton> {
  bool _isPressed = false;

  Color _resolveBackgroundColor() {
    switch (widget.variant) {
      case CyberButtonVariant.primary:
        return StitchTokens.primary;
      case CyberButtonVariant.stop:
        return StitchTokens.crimsonStop;
      case CyberButtonVariant.ghost:
        return Colors.transparent;
    }
  }

  List<BoxShadow> _resolveBoxShadow() {
    if (widget.variant == CyberButtonVariant.ghost || widget.onPressed == null) {
      return [];
    }
    final glowColor = widget.variant == CyberButtonVariant.stop
        ? StitchTokens.crimsonStop.withValues(alpha: 0.25)
        : StitchTokens.primary.withValues(alpha: 0.25);

    return [
      BoxShadow(
        color: glowColor,
        blurRadius: 12.0,
        offset: const Offset(0, 4),
      ),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final enabled = widget.onPressed != null;

    return AnimatedScale(
      scale: _isPressed && enabled ? 0.96 : 1.0,
      duration: const Duration(milliseconds: 100),
      curve: Curves.easeInOut,
      child: Container(
        height: widget.height,
        width: widget.width,
        decoration: BoxDecoration(
          color: enabled ? _resolveBackgroundColor() : StitchTokens.surfaceVariant,
          borderRadius: BorderRadius.circular(widget.borderRadius),
          boxShadow: _resolveBoxShadow(),
          border: widget.variant == CyberButtonVariant.ghost
              ? Border.all(color: StitchTokens.outlineVariant)
              : null,
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            borderRadius: BorderRadius.circular(widget.borderRadius),
            onTap: widget.onPressed,
            onHighlightChanged: (highlighted) {
              setState(() => _isPressed = highlighted);
            },
            child: Center(child: widget.child),
          ),
        ),
      ),
    );
  }
}
