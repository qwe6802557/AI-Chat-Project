import 'package:flutter/material.dart';
import '../../../../core/constants/api_constants.dart';
import '../../../../core/theme/stitch_tokens.dart';
import '../../../../shared/widgets/glass_card.dart';
import '../../domain/voice_task_model.dart';
import '../voice_provider.dart';
import 'voice_params_sheet.dart';

/// 底部常驻悬浮控制台组件
class VoiceControlBar extends StatelessWidget {
  final VoiceState state;
  final VoiceNotifier notifier;

  const VoiceControlBar({
    super.key,
    required this.state,
    required this.notifier,
  });

  String _formatTimer(int seconds) {
    final m = (seconds ~/ 60).toString().padLeft(2, '0');
    final s = (seconds % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  String _formatFileSize(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
  }

  void _openParamsSheet(BuildContext context) {
    VoiceParamsSheet.show(
      context,
      state: state,
      onVoiceChange: notifier.setTtsVoiceId,
      onSpeedChange: notifier.setTtsSpeed,
      onLanguageChange: notifier.setTtsLanguage,
      onModelChange: notifier.setTtsModel,
    );
  }

  @override
  Widget build(BuildContext context) {
    final isTts = state.currentMode == VoiceTaskType.tts;
    final canSubmitTts = state.ttsText.trim().isNotEmpty && !state.isGenerating;
    final canSubmitStt = ((state.sttMethod == SttInputMethod.record && state.recordedFileBytes != null) ||
            (state.sttMethod == SttInputMethod.upload && state.selectedFileBytes != null)) &&
        !state.isGenerating;

    return Container(
      padding: const EdgeInsets.fromLTRB(14.0, 4.0, 14.0, 84.0),
      child: GlassCard(
        padding: const EdgeInsets.all(12.0),
        borderRadius: StitchTokens.radius2Xl,
        border: Border.all(
          color: StitchTokens.outlineVariant.withValues(alpha: 0.35),
          width: 1.0,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // 顶部模式胶囊切换行与算力提示
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              // 模式切换胶囊
              Container(
                decoration: BoxDecoration(
                  color: StitchTokens.surfaceContainer,
                  borderRadius: BorderRadius.circular(StitchTokens.radiusFull),
                ),
                padding: const EdgeInsets.all(2.5),
                child: Row(
                  children: [
                    _ModePillButton(
                      title: '合成语音 (TTS)',
                      icon: Icons.volume_up_rounded,
                      isActive: isTts,
                      onTap: () => notifier.setMode(VoiceTaskType.tts),
                    ),
                    _ModePillButton(
                      title: '识别语音 (STT)',
                      icon: Icons.mic_rounded,
                      isActive: !isTts,
                      onTap: () => notifier.setMode(VoiceTaskType.stt),
                    ),
                  ],
                ),
              ),

              // 积分消耗提示
              Row(
                mainAxisSize: MainAxisSize.min,
                children: const [
                  Icon(Icons.bolt_rounded, size: 14.0, color: StitchTokens.creditAmber),
                  SizedBox(width: 2.0),
                  Text(
                    '${ApiConstants.voiceUnitCost} 积分/次',
                    style: TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w600,
                      color: StitchTokens.creditAmber,
                    ),
                  ),
                ],
              ),
            ],
          ),

          const SizedBox(height: 10.0),

          // 核心控制交互区
          if (isTts) ...[
            // TTS 文本输入行与提交按钮
            Container(
              decoration: BoxDecoration(
                color: StitchTokens.surfaceContainerLow,
                borderRadius: BorderRadius.circular(StitchTokens.radiusLg),
                border: Border.all(
                  color: StitchTokens.outlineVariant.withValues(alpha: 0.4),
                  width: 1.0,
                ),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 10.0, vertical: 4.0),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Expanded(
                    child: TextField(
                      controller: TextEditingController.fromValue(
                        TextEditingValue(
                          text: state.ttsText,
                          selection: TextSelection.collapsed(offset: state.ttsText.length),
                        ),
                      ),
                      onChanged: notifier.setTtsText,
                      minLines: 1,
                      maxLines: 4,
                      maxLength: 2000,
                      buildCounter: (_, {required currentLength, required isFocused, maxLength}) => null,
                      style: const TextStyle(fontSize: 13.5, color: StitchTokens.onSurface),
                      decoration: const InputDecoration(
                        hintText: '输入要合成语音的文本内容（最长 2000 字）...',
                        hintStyle: TextStyle(fontSize: 13.0, color: StitchTokens.outline),
                        border: InputBorder.none,
                        isDense: true,
                        contentPadding: EdgeInsets.symmetric(vertical: 8.0),
                      ),
                    ),
                  ),
                  const SizedBox(width: 6.0),
                  // 发送 / 停止按钮
                  GestureDetector(
                    onTap: () {
                      if (state.isGenerating) {
                        notifier.stopGeneration();
                      } else if (canSubmitTts) {
                        notifier.submitTts();
                      }
                    },
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      width: 34.0,
                      height: 34.0,
                      margin: const EdgeInsets.only(bottom: 4.0),
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: state.isGenerating
                            ? StitchTokens.crimsonStop
                            : (canSubmitTts ? StitchTokens.primary : StitchTokens.surfaceContainer),
                      ),
                      child: Center(
                        child: state.isGenerating
                            ? Container(
                                width: 12.0,
                                height: 12.0,
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(2.0),
                                ),
                              )
                            : Icon(
                                Icons.arrow_upward_rounded,
                                color: canSubmitTts ? Colors.white : StitchTokens.outline,
                                size: 18.0,
                              ),
                      ),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 8.0),

            // TTS 参数快捷调节胶囊与字数统计
            Row(
              children: [
                Expanded(
                  child: SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        // 音色选择胶囊 (点击呼出抽屉)
                        _ParamChip(
                          icon: Icons.record_voice_over_rounded,
                          label: state.voices.firstWhere(
                            (v) => v.voiceId == state.ttsVoiceId,
                            orElse: () => const VoiceInfoModel(voiceId: '', name: '音色', language: 'zh'),
                          ).name,
                          onTap: () => _openParamsSheet(context),
                        ),
                        const SizedBox(width: 6.0),
                        // 语速胶囊
                        _ParamChip(
                          icon: Icons.speed_rounded,
                          label: '${state.ttsSpeed}x',
                          onTap: () => _openParamsSheet(context),
                        ),
                        const SizedBox(width: 6.0),
                        // 语言胶囊
                        _ParamChip(
                          icon: Icons.language_rounded,
                          label: state.ttsLanguage == 'zh' ? '中文' : 'English',
                          onTap: () => _openParamsSheet(context),
                        ),
                        const SizedBox(width: 6.0),
                        // 模型配置胶囊
                        _ParamChip(
                          icon: Icons.auto_awesome_rounded,
                          label: state.ttsModel,
                          onTap: () => _openParamsSheet(context),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 8.0),
                Text(
                  '${state.ttsText.length}/2000',
                  style: const TextStyle(
                    fontSize: 11.0,
                    color: StitchTokens.outline,
                  ),
                ),
              ],
            ),
          ] else ...[
            // STT 模式交互区
            Container(
              padding: const EdgeInsets.all(12.0),
              decoration: BoxDecoration(
                color: StitchTokens.surfaceContainerLow,
                borderRadius: BorderRadius.circular(StitchTokens.radiusLg),
                border: Border.all(
                  color: StitchTokens.outlineVariant.withValues(alpha: 0.4),
                  width: 1.0,
                ),
              ),
              child: Column(
                children: [
                  // STT 输入方式切换
                  Row(
                    children: [
                      _SttSubMethodTab(
                        title: '麦克风录音',
                        icon: Icons.mic_rounded,
                        isSelected: state.sttMethod == SttInputMethod.record,
                        onTap: () => notifier.setSttMethod(SttInputMethod.record),
                      ),
                      const SizedBox(width: 8.0),
                      _SttSubMethodTab(
                        title: '本地音频上传',
                        icon: Icons.upload_file_rounded,
                        isSelected: state.sttMethod == SttInputMethod.upload,
                        onTap: () => notifier.setSttMethod(SttInputMethod.upload),
                      ),
                    ],
                  ),

                  const SizedBox(height: 12.0),

                  // 录音 / 上传具体内容面板
                  if (state.sttMethod == SttInputMethod.record) ...[
                    if (!state.isRecording && state.recordedFileBytes == null)
                      // 未录制空闲态
                      InkWell(
                        borderRadius: BorderRadius.circular(StitchTokens.radiusMd),
                        onTap: notifier.startRecording,
                        child: Padding(
                          padding: const EdgeInsets.symmetric(vertical: 8.0),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: const [
                              Icon(Icons.mic_rounded, size: 22.0, color: StitchTokens.primary),
                              SizedBox(width: 6.0),
                              Text(
                                '点击开始录制现场语音',
                                style: TextStyle(
                                  fontSize: 13.5,
                                  fontWeight: FontWeight.w600,
                                  color: StitchTokens.primary,
                                ),
                              ),
                            ],
                          ),
                        ),
                      )
                    else if (state.isRecording)
                      // 录音进行中
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          GestureDetector(
                            onTap: notifier.stopRecording,
                            child: Container(
                              width: 36.0,
                              height: 36.0,
                              decoration: const BoxDecoration(
                                shape: BoxShape.circle,
                                color: StitchTokens.crimsonStop,
                              ),
                              child: Center(
                                child: Container(
                                  width: 14.0,
                                  height: 14.0,
                                  decoration: BoxDecoration(
                                    color: Colors.white,
                                    borderRadius: BorderRadius.circular(2.0),
                                  ),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 12.0),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                '录音中 · ${_formatTimer(state.recordingElapsedSeconds)}',
                                style: const TextStyle(
                                  fontSize: 13.0,
                                  fontWeight: FontWeight.w600,
                                  color: StitchTokens.crimsonStop,
                                ),
                              ),
                              const Text(
                                '点击红色按钮完成录制',
                                style: TextStyle(fontSize: 11.0, color: StitchTokens.outline),
                              ),
                            ],
                          ),
                        ],
                      )
                    else
                      // 录音已就绪 (可重录或预览)
                      Row(
                        children: [
                          const Icon(Icons.check_circle_rounded, size: 18.0, color: StitchTokens.playbackEmerald),
                          const SizedBox(width: 6.0),
                          const Expanded(
                            child: Text(
                              '录音完成，可直接发起识别',
                              style: TextStyle(fontSize: 12.5, color: StitchTokens.onSurface),
                            ),
                          ),
                          TextButton.icon(
                            style: TextButton.styleFrom(
                              foregroundColor: StitchTokens.primary,
                              padding: const EdgeInsets.symmetric(horizontal: 8.0),
                            ),
                            icon: const Icon(Icons.refresh_rounded, size: 16.0),
                            label: const Text('重录', style: TextStyle(fontSize: 12.0)),
                            onPressed: notifier.resetRecording,
                          ),
                        ],
                      ),
                  ] else ...[
                    // 上传本地文件面板
                    if (state.selectedFileBytes == null)
                      InkWell(
                        borderRadius: BorderRadius.circular(StitchTokens.radiusMd),
                        onTap: notifier.pickAudioFile,
                        child: Container(
                          width: double.infinity,
                          padding: const EdgeInsets.symmetric(vertical: 12.0),
                          decoration: BoxDecoration(
                            border: Border.all(
                              color: StitchTokens.outlineVariant.withValues(alpha: 0.6),
                              style: BorderStyle.solid,
                              width: 1.0,
                            ),
                            borderRadius: BorderRadius.circular(StitchTokens.radiusMd),
                          ),
                          child: Column(
                            children: const [
                              Icon(Icons.cloud_upload_outlined, size: 26.0, color: StitchTokens.primary),
                              SizedBox(height: 4.0),
                              Text(
                                '点击选取音频文件',
                                style: TextStyle(fontSize: 13.0, fontWeight: FontWeight.w600, color: StitchTokens.primary),
                              ),
                              SizedBox(height: 2.0),
                              Text(
                                '支持 MP3 / WAV / M4A / WEBM / OGG，单个文件不超过 50MB',
                                style: TextStyle(fontSize: 10.5, color: StitchTokens.outline),
                              ),
                            ],
                          ),
                        ),
                      )
                    else
                      Row(
                        children: [
                          const Icon(Icons.audio_file_rounded, size: 22.0, color: StitchTokens.primary),
                          const SizedBox(width: 8.0),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  state.selectedFileName ?? '已选音频',
                                  style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                if (state.selectedFileSize != null)
                                  Text(
                                    _formatFileSize(state.selectedFileSize!),
                                    style: const TextStyle(fontSize: 10.5, color: StitchTokens.outline),
                                  ),
                              ],
                            ),
                          ),
                          IconButton(
                            icon: const Icon(Icons.close_rounded, size: 18.0),
                            onPressed: notifier.clearSelectedFile,
                          ),
                        ],
                      ),
                  ],

                  const SizedBox(height: 10.0),

                  // 识别操作提交行
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      // 识别语言切换
                      Row(
                        children: [
                          const Text('识别语言: ', style: TextStyle(fontSize: 11.5, color: StitchTokens.onSurfaceVariant)),
                          DropdownButton<String>(
                            value: state.sttLanguage,
                            isDense: true,
                            underline: const SizedBox.shrink(),
                            style: const TextStyle(fontSize: 12.0, color: StitchTokens.primary, fontWeight: FontWeight.w600),
                            items: const [
                              DropdownMenuItem(value: 'zh', child: Text('中文')),
                              DropdownMenuItem(value: 'en', child: Text('English')),
                            ],
                            onChanged: (val) {
                              if (val != null) notifier.setSttLanguage(val);
                            },
                          ),
                        ],
                      ),

                      // 发起识别按钮
                      ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: state.isGenerating
                              ? StitchTokens.crimsonStop
                              : (canSubmitStt ? StitchTokens.primary : StitchTokens.surfaceContainer),
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(horizontal: 14.0, vertical: 8.0),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(StitchTokens.radiusFull)),
                        ),
                        onPressed: () {
                          if (state.isGenerating) {
                            notifier.stopGeneration();
                          } else if (canSubmitStt) {
                            notifier.submitStt();
                          }
                        },
                        icon: state.isGenerating
                            ? Container(
                                width: 10.0,
                                height: 10.0,
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(2.0),
                                ),
                              )
                            : const Icon(Icons.arrow_upward_rounded, size: 16.0),
                        label: Text(
                          state.isGenerating ? '中止识别' : '开始转写',
                          style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    ),
  );
}
}

class _ModePillButton extends StatelessWidget {
  final String title;
  final IconData icon;
  final bool isActive;
  final VoidCallback onTap;

  const _ModePillButton({
    required this.title,
    required this.icon,
    required this.isActive,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 10.0, vertical: 5.0),
        decoration: BoxDecoration(
          color: isActive ? Colors.white : Colors.transparent,
          borderRadius: BorderRadius.circular(StitchTokens.radiusFull),
          boxShadow: isActive
              ? [
                  BoxShadow(
                    color: const Color(0xFF0F172A).withValues(alpha: 0.08),
                    blurRadius: 6.0,
                    offset: const Offset(0, 2),
                  ),
                ]
              : null,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 14.0,
              color: isActive ? StitchTokens.primary : StitchTokens.onSurfaceVariant,
            ),
            const SizedBox(width: 4.0),
            Text(
              title,
              style: TextStyle(
                fontSize: 11.5,
                fontWeight: isActive ? FontWeight.w600 : FontWeight.normal,
                color: isActive ? StitchTokens.primary : StitchTokens.onSurfaceVariant,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SttSubMethodTab extends StatelessWidget {
  final String title;
  final IconData icon;
  final bool isSelected;
  final VoidCallback onTap;

  const _SttSubMethodTab({
    required this.title,
    required this.icon,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: InkWell(
        borderRadius: BorderRadius.circular(StitchTokens.radiusMd),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 6.0),
          decoration: BoxDecoration(
            color: isSelected ? StitchTokens.primary.withValues(alpha: 0.1) : Colors.transparent,
            borderRadius: BorderRadius.circular(StitchTokens.radiusMd),
            border: Border.all(
              color: isSelected ? StitchTokens.primary : StitchTokens.outlineVariant.withValues(alpha: 0.4),
              width: 1.0,
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                icon,
                size: 15.0,
                color: isSelected ? StitchTokens.primary : StitchTokens.onSurfaceVariant,
              ),
              const SizedBox(width: 4.0),
              Text(
                title,
                style: TextStyle(
                  fontSize: 12.0,
                  fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                  color: isSelected ? StitchTokens.primary : StitchTokens.onSurfaceVariant,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ParamChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _ParamChip({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(StitchTokens.radiusSm),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 7.0, vertical: 3.5),
        decoration: BoxDecoration(
          color: StitchTokens.surfaceContainer,
          borderRadius: BorderRadius.circular(StitchTokens.radiusSm),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 12.0, color: StitchTokens.primary),
            const SizedBox(width: 4.0),
            Text(
              label,
              style: const TextStyle(
                fontSize: 11.0,
                color: StitchTokens.onSurfaceVariant,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
