import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'stitch_tokens.dart';

/// Stitch 全局主题扩展
class StitchThemeExtension extends ThemeExtension<StitchThemeExtension> {
  final Color primaryGlow;
  final Color surfaceGlass;
  final Color surfaceGlassDark;
  final Color thinkingBg;
  final Color thinkingBorder;
  final Color thinkingText;
  final Color codeBg;
  final Color codeHeaderBg;
  final Color creditAmber;
  final Color creditBg;
  final Color creditBorder;
  final Color crimsonStop;
  final Color playbackEmerald;

  const StitchThemeExtension({
    required this.primaryGlow,
    required this.surfaceGlass,
    required this.surfaceGlassDark,
    required this.thinkingBg,
    required this.thinkingBorder,
    required this.thinkingText,
    required this.codeBg,
    required this.codeHeaderBg,
    required this.creditAmber,
    required this.creditBg,
    required this.creditBorder,
    required this.crimsonStop,
    required this.playbackEmerald,
  });

  @override
  ThemeExtension<StitchThemeExtension> copyWith({
    Color? primaryGlow,
    Color? surfaceGlass,
    Color? surfaceGlassDark,
    Color? thinkingBg,
    Color? thinkingBorder,
    Color? thinkingText,
    Color? codeBg,
    Color? codeHeaderBg,
    Color? creditAmber,
    Color? creditBg,
    Color? creditBorder,
    Color? crimsonStop,
    Color? playbackEmerald,
  }) {
    return StitchThemeExtension(
      primaryGlow: primaryGlow ?? this.primaryGlow,
      surfaceGlass: surfaceGlass ?? this.surfaceGlass,
      surfaceGlassDark: surfaceGlassDark ?? this.surfaceGlassDark,
      thinkingBg: thinkingBg ?? this.thinkingBg,
      thinkingBorder: thinkingBorder ?? this.thinkingBorder,
      thinkingText: thinkingText ?? this.thinkingText,
      codeBg: codeBg ?? this.codeBg,
      codeHeaderBg: codeHeaderBg ?? this.codeHeaderBg,
      creditAmber: creditAmber ?? this.creditAmber,
      creditBg: creditBg ?? this.creditBg,
      creditBorder: creditBorder ?? this.creditBorder,
      crimsonStop: crimsonStop ?? this.crimsonStop,
      playbackEmerald: playbackEmerald ?? this.playbackEmerald,
    );
  }

  @override
  ThemeExtension<StitchThemeExtension> lerp(
    covariant ThemeExtension<StitchThemeExtension>? other,
    double t,
  ) {
    if (other is! StitchThemeExtension) return this;
    return StitchThemeExtension(
      primaryGlow: Color.lerp(primaryGlow, other.primaryGlow, t)!,
      surfaceGlass: Color.lerp(surfaceGlass, other.surfaceGlass, t)!,
      surfaceGlassDark: Color.lerp(surfaceGlassDark, other.surfaceGlassDark, t)!,
      thinkingBg: Color.lerp(thinkingBg, other.thinkingBg, t)!,
      thinkingBorder: Color.lerp(thinkingBorder, other.thinkingBorder, t)!,
      thinkingText: Color.lerp(thinkingText, other.thinkingText, t)!,
      codeBg: Color.lerp(codeBg, other.codeBg, t)!,
      codeHeaderBg: Color.lerp(codeHeaderBg, other.codeHeaderBg, t)!,
      creditAmber: Color.lerp(creditAmber, other.creditAmber, t)!,
      creditBg: Color.lerp(creditBg, other.creditBg, t)!,
      creditBorder: Color.lerp(creditBorder, other.creditBorder, t)!,
      crimsonStop: Color.lerp(crimsonStop, other.crimsonStop, t)!,
      playbackEmerald: Color.lerp(playbackEmerald, other.playbackEmerald, t)!,
    );
  }
}

/// Stitch 主题装配工厂
class StitchTheme {
  StitchTheme._();

  static ThemeData get lightTheme {
    const colorScheme = ColorScheme(
      brightness: Brightness.light,
      primary: StitchTokens.primary,
      onPrimary: StitchTokens.onPrimary,
      primaryContainer: StitchTokens.primaryContainer,
      onPrimaryContainer: StitchTokens.onPrimaryContainer,
      secondary: StitchTokens.onSurfaceVariant,
      onSecondary: StitchTokens.surfaceContainerLowest,
      error: StitchTokens.crimsonStop,
      onError: Colors.white,
      surface: StitchTokens.surface,
      onSurface: StitchTokens.onSurface,
      outline: StitchTokens.outline,
      outlineVariant: StitchTokens.outlineVariant,
    );

    return ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: StitchTokens.background,
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.transparent,
        elevation: 0,
        systemOverlayStyle: SystemUiOverlayStyle.dark,
      ),
      extensions: const [
        StitchThemeExtension(
          primaryGlow: StitchTokens.primaryGlow,
          surfaceGlass: StitchTokens.surfaceGlass,
          surfaceGlassDark: StitchTokens.surfaceGlassDark,
          thinkingBg: StitchTokens.thinkingBg,
          thinkingBorder: StitchTokens.thinkingBorder,
          thinkingText: StitchTokens.thinkingText,
          codeBg: StitchTokens.codeBg,
          codeHeaderBg: StitchTokens.codeHeaderBg,
          creditAmber: StitchTokens.creditAmber,
          creditBg: StitchTokens.creditBg,
          creditBorder: StitchTokens.creditBorder,
          crimsonStop: StitchTokens.crimsonStop,
          playbackEmerald: StitchTokens.playbackEmerald,
        ),
      ],
    );
  }
}
