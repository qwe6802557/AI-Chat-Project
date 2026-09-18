import 'package:flutter/material.dart';

/// Stitch Deep Tech Glass Intelligence 设计令牌
class StitchTokens {
  StitchTokens._();

  // 基础与主强调色
  static const Color primary = Color(0xFF0058C3);
  static const Color onPrimary = Color(0xFFFFFFFF);
  static const Color primaryContainer = Color(0xFF1570EF);
  static const Color onPrimaryContainer = Color(0xFF175CD3);
  static const Color primaryGlow = Color(0xFF00F2FE);
  static const Color primaryGlowSubtle = Color(0xFF53B1FD);

  // 背景与表面层级
  static const Color background = Color(0xFFF7F9FB);
  static const Color onBackground = Color(0xFF191C1E);
  static const Color surface = Color(0xFFF7F9FB);
  static const Color onSurface = Color(0xFF191C1E);
  static const Color onSurfaceVariant = Color(0xFF424754);
  static const Color surfaceContainerLowest = Color(0xFFFFFFFF);
  static const Color surfaceContainerLow = Color(0xFFF2F4F6);
  static const Color surfaceContainer = Color(0xFFECEEF0);
  static const Color surfaceVariant = Color(0xFFE0E3E5);

  // 边框与轮廓线
  static const Color outline = Color(0xFF727786);
  static const Color outlineVariant = Color(0xFFC2C6D7);

  // 毛玻璃半透明度
  static const Color surfaceGlass = Color.fromRGBO(255, 255, 255, 0.88);
  static const Color surfaceGlassDark = Color.fromRGBO(15, 23, 42, 0.85);

  // 深度思考 (Reasoning / CoT)
  static const Color thinkingBg = Color.fromRGBO(239, 246, 255, 0.72);
  static const Color thinkingBorder = Color.fromRGBO(21, 112, 239, 0.16);
  static const Color thinkingText = Color(0xFF175CD3);

  // 代码高亮容器
  static const Color codeBg = Color(0xFF282C34);
  static const Color codeHeaderBg = Color.fromRGBO(0, 0, 0, 0.2);

  // 状态色与算力消耗
  static const Color creditAmber = Color(0xFFE6A23C);
  static const Color creditBg = Color(0xFFFDF6EC);
  static const Color creditBorder = Color(0xFFFAECD8);
  static const Color crimsonStop = Color(0xFFEF4444);
  static const Color playbackEmerald = Color(0xFF027A48);

  // 圆角规范
  static const double radiusSm = 4.0;
  static const double radiusMd = 8.0;
  static const double radiusLg = 12.0;
  static const double radiusXl = 16.0;
  static const double radius2Xl = 24.0;
  static const double radiusFull = 9999.0;
}
