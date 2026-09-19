import 'package:flutter/material.dart';
import '../../../../core/theme/stitch_tokens.dart';
import '../voice_provider.dart';

/// 底部毛玻璃参数调节抽屉
class VoiceParamsSheet extends StatelessWidget {
  final VoiceState state;
  final ValueChanged<String> onVoiceChange;
  final ValueChanged<double> onSpeedChange;
  final ValueChanged<String> onLanguageChange;
  final ValueChanged<String> onModelChange;

  const VoiceParamsSheet({
    super.key,
    required this.state,
    required this.onVoiceChange,
    required this.onSpeedChange,
    required this.onLanguageChange,
    required this.onModelChange,
  });

  static void show(
    BuildContext context, {
    required VoiceState state,
    required ValueChanged<String> onVoiceChange,
    required ValueChanged<double> onSpeedChange,
    required ValueChanged<String> onLanguageChange,
    required ValueChanged<String> onModelChange,
  }) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => VoiceParamsSheet(
        state: state,
        onVoiceChange: onVoiceChange,
        onSpeedChange: onSpeedChange,
        onLanguageChange: onLanguageChange,
        onModelChange: onModelChange,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: StitchTokens.surfaceGlass,
        borderRadius: BorderRadius.vertical(top: Radius.circular(StitchTokens.radius2Xl)),
        boxShadow: [
          BoxShadow(
            color: Color(0xFF0F172A),
            blurRadius: 24.0,
            offset: Offset(0, -4),
          ),
        ],
      ),
      padding: EdgeInsets.only(
        left: 20.0,
        right: 20.0,
        top: 16.0,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24.0,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 顶部拖拽指示器
          Center(
            child: Container(
              width: 36.0,
              height: 4.0,
              decoration: BoxDecoration(
                color: StitchTokens.outlineVariant,
                borderRadius: BorderRadius.circular(2.0),
              ),
            ),
          ),

          const SizedBox(height: 12.0),

          // 标题行
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                '语音合成参数微调',
                style: TextStyle(
                  fontSize: 16.0,
                  fontWeight: FontWeight.w700,
                  color: StitchTokens.onSurface,
                ),
              ),
              IconButton(
                icon: const Icon(Icons.close_rounded, size: 20.0),
                onPressed: () => Navigator.of(context).pop(),
              ),
            ],
          ),

          const SizedBox(height: 12.0),

          // 1. 音色选择
          const Text(
            '选择发音音色',
            style: TextStyle(
              fontSize: 13.0,
              fontWeight: FontWeight.w600,
              color: StitchTokens.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 8.0),
          if (state.voices.isNotEmpty)
            Wrap(
              spacing: 8.0,
              runSpacing: 8.0,
              children: state.voices.map((voice) {
                final isSelected = state.ttsVoiceId == voice.voiceId;
                return ChoiceChip(
                  label: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.record_voice_over_rounded,
                        size: 14.0,
                        color: isSelected ? Colors.white : StitchTokens.primary,
                      ),
                      const SizedBox(width: 4.0),
                      Text(voice.name),
                    ],
                  ),
                  selected: isSelected,
                  selectedColor: StitchTokens.primary,
                  labelStyle: TextStyle(
                    color: isSelected ? Colors.white : StitchTokens.onSurface,
                    fontSize: 12.5,
                    fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                  ),
                  backgroundColor: StitchTokens.surfaceContainerLow,
                  onSelected: (selected) {
                    if (selected) onVoiceChange(voice.voiceId);
                  },
                );
              }).toList(),
            )
          else
            const Text(
              '加载默认音色库中...',
              style: TextStyle(fontSize: 12.0, color: StitchTokens.outline),
            ),

          const SizedBox(height: 16.0),

          // 2. 语速选择
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                '朗读语速',
                style: TextStyle(
                  fontSize: 13.0,
                  fontWeight: FontWeight.w600,
                  color: StitchTokens.onSurfaceVariant,
                ),
              ),
              Text(
                '${state.ttsSpeed}x',
                style: const TextStyle(
                  fontSize: 13.0,
                  fontWeight: FontWeight.w700,
                  color: StitchTokens.primary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6.0),
          Row(
            children: [0.75, 1.0, 1.25, 1.5].map((speed) {
              final isSelected = state.ttsSpeed == speed;
              return Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 3.0),
                  child: OutlinedButton(
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 8.0),
                      backgroundColor: isSelected ? StitchTokens.primary.withValues(alpha: 0.1) : Colors.transparent,
                      side: BorderSide(
                        color: isSelected ? StitchTokens.primary : StitchTokens.outlineVariant.withValues(alpha: 0.5),
                        width: isSelected ? 1.5 : 1.0,
                      ),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(StitchTokens.radiusMd)),
                    ),
                    onPressed: () => onSpeedChange(speed),
                    child: Text(
                      '${speed}x',
                      style: TextStyle(
                        fontSize: 12.0,
                        fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                        color: isSelected ? StitchTokens.primary : StitchTokens.onSurface,
                      ),
                    ),
                  ),
                ),
              );
            }).toList(),
          ),

          const SizedBox(height: 16.0),

          // 3. 语言选择
          const Text(
            '目标合成语言',
            style: TextStyle(
              fontSize: 13.0,
              fontWeight: FontWeight.w600,
              color: StitchTokens.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 6.0),
          Row(
            children: [
              Expanded(
                child: ChoiceChip(
                  label: const Center(child: Text('中文 (zh)')),
                  selected: state.ttsLanguage == 'zh',
                  selectedColor: StitchTokens.primary,
                  labelStyle: TextStyle(
                    color: state.ttsLanguage == 'zh' ? Colors.white : StitchTokens.onSurface,
                    fontSize: 12.5,
                  ),
                  onSelected: (val) {
                    if (val) onLanguageChange('zh');
                  },
                ),
              ),
              const SizedBox(width: 8.0),
              Expanded(
                child: ChoiceChip(
                  label: const Center(child: Text('English (en)')),
                  selected: state.ttsLanguage == 'en',
                  selectedColor: StitchTokens.primary,
                  labelStyle: TextStyle(
                    color: state.ttsLanguage == 'en' ? Colors.white : StitchTokens.onSurface,
                    fontSize: 12.5,
                  ),
                  onSelected: (val) {
                    if (val) onLanguageChange('en');
                  },
                ),
              ),
            ],
          ),

          const SizedBox(height: 16.0),

          // 4. 模型选择
          const Text(
            '神经语音模型',
            style: TextStyle(
              fontSize: 13.0,
              fontWeight: FontWeight.w600,
              color: StitchTokens.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 6.0),
          Wrap(
            spacing: 8.0,
            runSpacing: 6.0,
            children: [
              'grok-voice-think-fast-1.0',
              'grok-voice-think-fast-2.0',
              'grok-voice-latest',
            ].map((model) {
              final isSelected = state.ttsModel == model;
              return ChoiceChip(
                label: Text(model),
                selected: isSelected,
                selectedColor: StitchTokens.primary,
                labelStyle: TextStyle(
                  color: isSelected ? Colors.white : StitchTokens.onSurface,
                  fontSize: 11.5,
                ),
                onSelected: (val) {
                  if (val) onModelChange(model);
                },
              );
            }).toList(),
          ),

          const SizedBox(height: 20.0),

          // 确认完成按钮
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: StitchTokens.primary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 13.0),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(StitchTokens.radiusLg),
                ),
              ),
              onPressed: () => Navigator.of(context).pop(),
              child: const Text(
                '确认并应用',
                style: TextStyle(fontSize: 14.0, fontWeight: FontWeight.w600),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
