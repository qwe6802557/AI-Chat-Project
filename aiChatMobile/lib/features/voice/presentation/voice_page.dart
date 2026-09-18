import 'package:flutter/material.dart';
import '../../../core/theme/stitch_tokens.dart';
import '../../../shared/widgets/glass_card.dart';

/// Stitch AI 语音交互控制台
class VoicePage extends StatelessWidget {
  const VoicePage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: StitchTokens.background,
      appBar: AppBar(
        title: const Text(
          'AI 语音助手',
          style: TextStyle(fontSize: 18.0, fontWeight: FontWeight.w600),
        ),
        centerTitle: true,
      ),
      body: SafeArea(
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 120.0,
                height: 120.0,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: StitchTokens.primary.withValues(alpha: 0.1),
                  boxShadow: [
                    BoxShadow(
                      color: StitchTokens.primaryGlow.withValues(alpha: 0.2),
                      blurRadius: 32.0,
                    ),
                  ],
                ),
                child: Center(
                  child: Container(
                    width: 80.0,
                    height: 80.0,
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      color: StitchTokens.primary,
                    ),
                    child: const Icon(
                      Icons.mic_rounded,
                      color: Colors.white,
                      size: 40.0,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 32.0),
              const Text(
                '点击麦克风开始实时对话',
                style: TextStyle(
                  fontSize: 16.0,
                  fontWeight: FontWeight.w600,
                  color: StitchTokens.onSurface,
                ),
              ),
              const SizedBox(height: 8.0),
              const Text(
                '支持双工实时语音打断与高拟真音色合成',
                style: TextStyle(
                  fontSize: 13.0,
                  color: StitchTokens.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 48.0),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 32.0),
                child: GlassCard(
                  padding: const EdgeInsets.all(16.0),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: const [
                      Icon(Icons.auto_awesome_rounded, size: 16.0, color: StitchTokens.primary),
                      SizedBox(width: 8.0),
                      Text(
                        '当前已就绪：Grok-Voice 引擎',
                        style: TextStyle(fontSize: 13.0, color: StitchTokens.onSurfaceVariant),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
