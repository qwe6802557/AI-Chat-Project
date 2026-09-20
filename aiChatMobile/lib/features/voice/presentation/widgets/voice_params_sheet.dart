import 'package:flutter/material.dart';
import '../../../../core/theme/stitch_tokens.dart';
import '../voice_provider.dart';

/// 底部毛玻璃参数调节抽屉
class VoiceParamsSheet extends StatefulWidget {
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
      useRootNavigator: true,
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
  State<VoiceParamsSheet> createState() => _VoiceParamsSheetState();
}

class _VoiceParamsSheetState extends State<VoiceParamsSheet> {
  late String _selectedVoiceId;
  late double _selectedSpeed;
  late String _selectedLanguage;
  late String _selectedModel;

  @override
  void initState() {
    super.initState();
    _selectedVoiceId = widget.state.ttsVoiceId;
    _selectedSpeed = widget.state.ttsSpeed;
    _selectedLanguage = widget.state.ttsLanguage;
    _selectedModel = widget.state.ttsModel;

    // 若当前未指定音色，且音色库非空，默认选中第一个
    if (_selectedVoiceId.isEmpty && widget.state.voices.isNotEmpty) {
      _selectedVoiceId = widget.state.voices.first.voiceId;
      widget.onVoiceChange(_selectedVoiceId);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.85,
      ),
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
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 顶部拖拽指示器与标题行（固定置顶）
            Padding(
              padding: const EdgeInsets.only(left: 20.0, right: 20.0, top: 12.0, bottom: 8.0),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
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
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const Divider(height: 1.0, color: StitchTokens.outlineVariant),

            // 中间可滚动选项区（适配大量音色与各种机型屏幕高度）
            Flexible(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 14.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
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
                    if (widget.state.voices.isNotEmpty)
                      Wrap(
                        spacing: 8.0,
                        runSpacing: 8.0,
                        children: widget.state.voices.map((voice) {
                          final isSelected = _selectedVoiceId.toLowerCase() == voice.voiceId.toLowerCase() ||
                              (_selectedVoiceId.isNotEmpty && _selectedVoiceId.toLowerCase() == voice.name.toLowerCase());
                          return ChoiceChip(
                            showCheckmark: false,
                            label: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  isSelected ? Icons.check_circle_rounded : Icons.record_voice_over_rounded,
                                  size: 14.0,
                                  color: isSelected ? Colors.white : StitchTokens.primary,
                                ),
                                const SizedBox(width: 4.0),
                                Text(voice.name),
                              ],
                            ),
                            selected: isSelected,
                            selectedColor: StitchTokens.primary,
                            backgroundColor: StitchTokens.surfaceContainerLow,
                            side: BorderSide(
                              color: isSelected ? StitchTokens.primary : StitchTokens.outlineVariant.withValues(alpha: 0.5),
                              width: isSelected ? 1.5 : 1.0,
                            ),
                            labelStyle: TextStyle(
                              color: isSelected ? Colors.white : StitchTokens.onSurface,
                              fontSize: 12.5,
                              fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                            ),
                            onSelected: (_) {
                              setState(() {
                                _selectedVoiceId = voice.voiceId;
                              });
                              widget.onVoiceChange(voice.voiceId);
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
                          '${_selectedSpeed}x',
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
                        final isSelected = (_selectedSpeed - speed).abs() < 0.01;
                        return Expanded(
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 3.0),
                            child: OutlinedButton(
                              style: OutlinedButton.styleFrom(
                                padding: const EdgeInsets.symmetric(vertical: 8.0),
                                backgroundColor: isSelected ? StitchTokens.primary.withValues(alpha: 0.12) : Colors.transparent,
                                side: BorderSide(
                                  color: isSelected ? StitchTokens.primary : StitchTokens.outlineVariant.withValues(alpha: 0.5),
                                  width: isSelected ? 2.0 : 1.0,
                                ),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(StitchTokens.radiusMd)),
                              ),
                              onPressed: () {
                                setState(() {
                                  _selectedSpeed = speed;
                                });
                                widget.onSpeedChange(speed);
                              },
                              child: Text(
                                '${speed}x',
                                style: TextStyle(
                                  fontSize: 12.0,
                                  fontWeight: isSelected ? FontWeight.w700 : FontWeight.normal,
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
                            selected: _selectedLanguage == 'zh',
                            selectedColor: StitchTokens.primary,
                            checkmarkColor: Colors.white,
                            labelStyle: TextStyle(
                              color: _selectedLanguage == 'zh' ? Colors.white : StitchTokens.onSurface,
                              fontSize: 12.5,
                              fontWeight: _selectedLanguage == 'zh' ? FontWeight.w600 : FontWeight.normal,
                            ),
                            onSelected: (_) {
                              setState(() {
                                _selectedLanguage = 'zh';
                              });
                              widget.onLanguageChange('zh');
                            },
                          ),
                        ),
                        const SizedBox(width: 8.0),
                        Expanded(
                          child: ChoiceChip(
                            label: const Center(child: Text('English (en)')),
                            selected: _selectedLanguage == 'en',
                            selectedColor: StitchTokens.primary,
                            checkmarkColor: Colors.white,
                            labelStyle: TextStyle(
                              color: _selectedLanguage == 'en' ? Colors.white : StitchTokens.onSurface,
                              fontSize: 12.5,
                              fontWeight: _selectedLanguage == 'en' ? FontWeight.w600 : FontWeight.normal,
                            ),
                            onSelected: (_) {
                              setState(() {
                                _selectedLanguage = 'en';
                              });
                              widget.onLanguageChange('en');
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
                        final isSelected = _selectedModel == model;
                        return ChoiceChip(
                          label: Text(model),
                          selected: isSelected,
                          selectedColor: StitchTokens.primary,
                          checkmarkColor: Colors.white,
                          labelStyle: TextStyle(
                            color: isSelected ? Colors.white : StitchTokens.onSurface,
                            fontSize: 11.5,
                            fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                          ),
                          onSelected: (_) {
                            setState(() {
                              _selectedModel = model;
                            });
                            widget.onModelChange(model);
                          },
                        );
                      }).toList(),
                    ),
                  ],
                ),
              ),
            ),

            // 底部常驻“确认并应用”操作条
            Container(
              padding: EdgeInsets.only(
                left: 20.0,
                right: 20.0,
                top: 12.0,
                bottom: 12.0 + MediaQuery.of(context).viewInsets.bottom,
              ),
              decoration: BoxDecoration(
                border: Border(
                  top: BorderSide(
                    color: StitchTokens.outlineVariant.withValues(alpha: 0.3),
                  ),
                ),
              ),
              child: SizedBox(
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
                  onPressed: () {
                    widget.onVoiceChange(_selectedVoiceId);
                    widget.onSpeedChange(_selectedSpeed);
                    widget.onLanguageChange(_selectedLanguage);
                    widget.onModelChange(_selectedModel);
                    Navigator.of(context).pop();
                  },
                  child: const Text(
                    '确认并应用',
                    style: TextStyle(fontSize: 14.0, fontWeight: FontWeight.w600),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
