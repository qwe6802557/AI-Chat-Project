import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/stitch_tokens.dart';
import '../../chat/providers/chat_provider.dart';
import '../domain/voice_task_model.dart';
import 'voice_provider.dart';
import 'widgets/voice_control_bar.dart';
import 'widgets/voice_generating_card.dart';
import 'widgets/voice_task_card.dart';

/// Stitch AI 语音工作台页面
class VoicePage extends ConsumerStatefulWidget {
  const VoicePage({super.key});

  @override
  ConsumerState<VoicePage> createState() => _VoicePageState();
}

class _VoicePageState extends ConsumerState<VoicePage> {
  final ScrollController _scrollController = ScrollController();

  static const List<String> _presetPrompts = [
    '早上好！今天也是充满灵感与活力的一天，准备好开启新的工作旅程了吗？',
    'Welcome to the future of AI voice intelligence, where technology meets human emotion.',
    '在群山环绕的古老小镇上，微风拂过松林，一扇沉寂百年的木门被悄然推开...',
  ];

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _scrollToTop() {
    if (_scrollController.hasClients) {
      _scrollController.animateTo(
        0,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(voiceProvider);
    final notifier = ref.watch(voiceProvider.notifier);
    final chatState = ref.watch(chatProvider);

    // 错误通知监听
    ref.listen<VoiceState>(voiceProvider, (prev, next) {
      if (next.errorMessage != null && next.errorMessage != prev?.errorMessage) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(next.errorMessage!),
            backgroundColor: StitchTokens.crimsonStop,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
      // 新任务生成完成后滚动置顶
      if (prev != null && prev.isGenerating && !next.isGenerating && next.tasks.length > prev.tasks.length) {
        _scrollToTop();
      }
    });

    // 计算各筛选维度的任务统计数
    final totalCount = state.tasks.length;
    final ttsCount = state.tasks.where((t) => t.type == VoiceTaskType.tts).length;
    final sttCount = state.tasks.where((t) => t.type == VoiceTaskType.stt).length;

    // 过滤任务列表
    final filteredTasks = state.tasks.where((t) {
      if (state.currentFilter == VoiceFilter.tts) return t.type == VoiceTaskType.tts;
      if (state.currentFilter == VoiceFilter.stt) return t.type == VoiceTaskType.stt;
      return true;
    }).toList();

    return Scaffold(
      backgroundColor: StitchTokens.background,
      appBar: AppBar(
        title: const Text(
          'AI 语音工作台',
          style: TextStyle(fontSize: 17.0, fontWeight: FontWeight.w700),
        ),
        centerTitle: true,
        backgroundColor: StitchTokens.surfaceGlass,
        elevation: 0,
        actions: [
          // 积分余额显示
          Container(
            margin: const EdgeInsets.only(right: 14.0),
            padding: const EdgeInsets.symmetric(horizontal: 9.0, vertical: 4.5),
            decoration: BoxDecoration(
              color: StitchTokens.creditBg,
              borderRadius: BorderRadius.circular(StitchTokens.radiusFull),
              border: Border.all(color: StitchTokens.creditBorder),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.bolt_rounded, size: 14.0, color: StitchTokens.creditAmber),
                const SizedBox(width: 3.0),
                Text(
                  '${chatState.creditsRemaining} 积分',
                  style: const TextStyle(
                    fontSize: 12.0,
                    fontWeight: FontWeight.w600,
                    color: StitchTokens.creditAmber,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            // 顶部分类筛选胶囊
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    _FilterTabChip(
                      label: '全部 ($totalCount)',
                      isSelected: state.currentFilter == VoiceFilter.all,
                      onTap: () => notifier.setFilter(VoiceFilter.all),
                    ),
                    const SizedBox(width: 8.0),
                    _FilterTabChip(
                      label: '语音合成 TTS ($ttsCount)',
                      isSelected: state.currentFilter == VoiceFilter.tts,
                      onTap: () => notifier.setFilter(VoiceFilter.tts),
                    ),
                    const SizedBox(width: 8.0),
                    _FilterTabChip(
                      label: '语音识别 STT ($sttCount)',
                      isSelected: state.currentFilter == VoiceFilter.stt,
                      onTap: () => notifier.setFilter(VoiceFilter.stt),
                    ),
                  ],
                ),
              ),
            ),

            // 主工作区内容：任务瀑布流或空状态引导
            Expanded(
              child: RefreshIndicator(
                color: StitchTokens.primary,
                onRefresh: notifier.fetchHistory,
                child: ListView(
                  controller: _scrollController,
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.only(bottom: 16.0),
                  children: [
                    // 生成/转写中动态声波卡片
                    if (state.isGenerating)
                      VoiceGeneratingCard(
                        type: state.generatingType,
                        elapsedSeconds: state.generatingElapsedSeconds,
                        onCancel: notifier.stopGeneration,
                      ),

                    // 任务历史列表
                    if (filteredTasks.isNotEmpty) ...[
                      ...filteredTasks.map((task) => VoiceTaskCard(
                            key: ValueKey(task.id),
                            task: task,
                            onReuse: () => notifier.reuseParams(task),
                          )),
                    ] else if (!state.isGenerating) ...[
                      // 空状态引导
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 36.0),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Container(
                              width: 64.0,
                              height: 64.0,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: StitchTokens.primary.withValues(alpha: 0.08),
                              ),
                              child: const Center(
                                child: Icon(
                                  Icons.graphic_eq_rounded,
                                  size: 32.0,
                                  color: StitchTokens.primary,
                                ),
                              ),
                            ),
                            const SizedBox(height: 16.0),
                            const Text(
                              '开启您的 AI 语音创作',
                              style: TextStyle(
                                fontSize: 16.0,
                                fontWeight: FontWeight.w700,
                                color: StitchTokens.onSurface,
                              ),
                            ),
                            const SizedBox(height: 6.0),
                            const Text(
                              '输入文字即可一键合成高保真语音，或录入/上传音频进行精准文字识别',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 12.5,
                                height: 1.4,
                                color: StitchTokens.onSurfaceVariant,
                              ),
                            ),
                            const SizedBox(height: 24.0),

                            // 预设灵感提示词
                            const Align(
                              alignment: Alignment.centerLeft,
                              child: Text(
                                '💡 快速灵感预设：',
                                style: TextStyle(
                                  fontSize: 12.5,
                                  fontWeight: FontWeight.w600,
                                  color: StitchTokens.onSurfaceVariant,
                                ),
                              ),
                            ),
                            const SizedBox(height: 8.0),
                            ..._presetPrompts.map((preset) => Padding(
                                  padding: const EdgeInsets.only(bottom: 8.0),
                                  child: InkWell(
                                    borderRadius: BorderRadius.circular(StitchTokens.radiusLg),
                                    onTap: () => notifier.applyPresetPrompt(preset),
                                    child: Container(
                                      width: double.infinity,
                                      padding: const EdgeInsets.symmetric(horizontal: 12.0, vertical: 10.0),
                                      decoration: BoxDecoration(
                                        color: StitchTokens.surfaceContainerLow,
                                        borderRadius: BorderRadius.circular(StitchTokens.radiusLg),
                                        border: Border.all(
                                          color: StitchTokens.outlineVariant.withValues(alpha: 0.4),
                                        ),
                                      ),
                                      child: Row(
                                        children: [
                                          const Icon(
                                            Icons.auto_awesome_rounded,
                                            size: 14.0,
                                            color: StitchTokens.primary,
                                          ),
                                          const SizedBox(width: 8.0),
                                          Expanded(
                                            child: Text(
                                              preset,
                                              style: const TextStyle(
                                                fontSize: 12.0,
                                                color: StitchTokens.onSurface,
                                              ),
                                              maxLines: 2,
                                              overflow: TextOverflow.ellipsis,
                                            ),
                                          ),
                                          const Icon(
                                            Icons.chevron_right_rounded,
                                            size: 16.0,
                                            color: StitchTokens.outline,
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                )),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),

            // 底部常驻悬浮控制台
            VoiceControlBar(
              state: state,
              notifier: notifier,
            ),
          ],
        ),
      ),
    );
  }
}

class _FilterTabChip extends StatelessWidget {
  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  const _FilterTabChip({
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(StitchTokens.radiusFull),
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 14.0, vertical: 6.0),
        decoration: BoxDecoration(
          color: isSelected ? StitchTokens.primary : StitchTokens.surfaceContainerLow,
          borderRadius: BorderRadius.circular(StitchTokens.radiusFull),
          border: Border.all(
            color: isSelected ? StitchTokens.primary : StitchTokens.outlineVariant.withValues(alpha: 0.4),
            width: 1.0,
          ),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: StitchTokens.primary.withValues(alpha: 0.25),
                    blurRadius: 8.0,
                    offset: const Offset(0, 2),
                  ),
                ]
              : null,
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12.0,
            fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
            color: isSelected ? Colors.white : StitchTokens.onSurfaceVariant,
          ),
        ),
      ),
    );
  }
}
