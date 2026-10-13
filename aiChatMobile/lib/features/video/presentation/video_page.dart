import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/stitch_tokens.dart';
import '../../chat/providers/chat_provider.dart';
import '../domain/video_task_model.dart';
import '../providers/video_provider.dart';
import 'widgets/video_control_bar.dart';
import 'widgets/video_preview_modal.dart';
import 'widgets/video_task_card.dart';

/// AI 视频创作工坊主视图（对齐 PC 端通义万相 2.2 文生视频 / 图生视频全链路）
class VideoPage extends ConsumerStatefulWidget {
  const VideoPage({super.key});

  @override
  ConsumerState<VideoPage> createState() => _VideoPageState();
}

class _VideoPageState extends ConsumerState<VideoPage> {
  final TextEditingController _promptController = TextEditingController();
  final ScrollController _scrollController = ScrollController();

  static const List<String> _samplePrompts = [
    '赛博朋克风格未来都市雨夜，霓虹灯倒映在积水路面，无人机缓缓掠过天际，电影级广角镜头推进',
    '清晨阳光穿透迷雾森林，金色丁达尔光束洒在溪流与苔藓岩石上，微风吹动树叶，4K自然纪录片质感',
    '宇航员漂浮在璀璨星云与巨型环状行星之间，头盔面罩反射银河微光，慢动作环绕运镜，IMAX电影画面',
    '微距慢镜头：一颗晶莹水滴落入平静湖面激起层层涟漪，金色夕阳余晖映照水面，极简唯美风格',
  ];

  @override
  void initState() {
    super.initState();
    final initialPrompt = ref.read(videoProvider).promptText;
    if (initialPrompt.isNotEmpty) {
      _promptController.text = initialPrompt;
    }
  }

  @override
  void dispose() {
    _promptController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _handleSubmit() async {
    FocusScope.of(context).unfocus();
    final ok = await ref.read(videoProvider.notifier).submitGenerate();
    if (ok && _scrollController.hasClients) {
      _scrollController.animateTo(
        0,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOutCubic,
      );
    }
  }

  void _openPreview(VideoTaskModel task) {
    VideoPreviewModal.show(
      context,
      task: task,
      onReuse: () => ref.read(videoProvider.notifier).reuseParams(task),
    );
  }

  @override
  Widget build(BuildContext context) {
    final videoState = ref.watch(videoProvider);
    final creditsRemaining = ref.watch(
      chatProvider.select((state) => state.creditsRemaining),
    );

    // 同步外部状态变更（如复用历史参数、填入灵感词、提交后清空）至输入框控制器
    ref.listen<VideoState>(videoProvider, (previous, next) {
      if (next.promptText != _promptController.text) {
        _promptController.value = TextEditingValue(
          text: next.promptText,
          selection: TextSelection.collapsed(offset: next.promptText.length),
        );
      }

      if (next.errorMessage != null && next.errorMessage != previous?.errorMessage) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: const Color(0xFFB91C1C),
            content: Text(next.errorMessage!),
          ),
        );
      } else if (next.noticeMessage != null && next.noticeMessage != previous?.noticeMessage) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: const Color(0xFF0F172A),
            content: Text(next.noticeMessage!),
            duration: const Duration(seconds: 2),
          ),
        );
      }
    });

    final firstRunningId = videoState.tasks
        .where((t) => t.status.isRunning)
        .map((t) => t.id)
        .firstOrNull;

    return Scaffold(
      backgroundColor: StitchTokens.background,
      appBar: AppBar(
        title: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.videocam_rounded,
              size: 20.0,
              color: StitchTokens.primary,
            ),
            SizedBox(width: 6.0),
            Text(
              'AI 视频工坊',
              style: TextStyle(fontSize: 17.5, fontWeight: FontWeight.w700),
            ),
          ],
        ),
        centerTitle: false,
        actions: [
          Container(
            margin: const EdgeInsets.symmetric(vertical: 11.0),
            padding: const EdgeInsets.symmetric(horizontal: 10.0, vertical: 4.0),
            decoration: BoxDecoration(
              color: StitchTokens.creditBg,
              borderRadius: BorderRadius.circular(StitchTokens.radiusFull),
              border: Border.all(color: StitchTokens.creditBorder),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.bolt_rounded,
                  size: 14.0,
                  color: Color(0xFFD97706),
                ),
                const SizedBox(width: 3.0),
                Text(
                  '$creditsRemaining 积分',
                  style: const TextStyle(
                    fontSize: 12.0,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFFB45309),
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            tooltip: '刷新历史记录',
            onPressed: videoState.isLoading
                ? null
                : () => ref.read(videoProvider.notifier).loadHistory(),
            icon: const Icon(Icons.refresh_rounded, size: 20.0),
          ),
          const SizedBox(width: 4.0),
        ],
      ),
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            // 顶部任务展示画廊或空状态灵感区
            Expanded(
              child: _buildGalleryContent(
                videoState: videoState,
                firstRunningId: firstRunningId,
              ),
            ),

            // 底部常驻视频创作控制栏（预留底部悬浮导航栏空间）
            Padding(
              padding: const EdgeInsets.only(top: 6.0, bottom: 84.0),
              child: VideoControlBar(
                promptController: _promptController,
                aspectRatio: videoState.aspectRatio,
                activeModelId: videoState.activeModelId,
                activeModeLabel: videoState.activeModeLabel,
                referenceImageDataUrl: videoState.referenceImageDataUrl,
                referenceImageName: videoState.referenceImageName,
                isGenerating: videoState.isGenerating,
                onPromptChanged: (val) =>
                    ref.read(videoProvider.notifier).setPromptText(val),
                onAspectRatioChanged: (ratio) =>
                    ref.read(videoProvider.notifier).setAspectRatio(ratio),
                onPickReferenceImage: () =>
                    ref.read(videoProvider.notifier).pickReferenceImage(),
                onClearReferenceImage: () =>
                    ref.read(videoProvider.notifier).clearReferenceImage(),
                onSubmit: _handleSubmit,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildGalleryContent({
    required VideoState videoState,
    required String? firstRunningId,
  }) {
    if (videoState.isLoading && videoState.tasks.isEmpty) {
      return const Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircularProgressIndicator(strokeWidth: 2.5),
            SizedBox(height: 12.0),
            Text(
              '正在加载视频创作记录...',
              style: TextStyle(fontSize: 13.0, color: StitchTokens.onSurfaceVariant),
            ),
          ],
        ),
      );
    }

    if (videoState.tasks.isEmpty) {
      return SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16.0, 20.0, 16.0, 16.0),
        child: Container(
          padding: const EdgeInsets.all(20.0),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(StitchTokens.radius2Xl),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Column(
            children: [
              Container(
                width: 56.0,
                height: 56.0,
                decoration: BoxDecoration(
                  color: const Color(0xFFEEF2FF),
                  borderRadius: BorderRadius.circular(18.0),
                ),
                child: const Icon(
                  Icons.movie_filter_rounded,
                  size: 30.0,
                  color: Color(0xFF4F46E5),
                ),
              ),
              const SizedBox(height: 14.0),
              const Text(
                'AI 电影级视频创作工坊',
                style: TextStyle(
                  fontSize: 17.0,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF0F172A),
                ),
              ),
              const SizedBox(height: 6.0),
              const Text(
                '搭载阿里通义万相 Wan2.2-14B 影视级大模型，支持文生视频与首帧参考图生视频。点击下方灵感快速体验：',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 12.5,
                  height: 1.5,
                  color: Color(0xFF64748B),
                ),
              ),
              const SizedBox(height: 16.0),
              ..._samplePrompts.map((sample) {
                return Padding(
                  padding: const EdgeInsets.only(bottom: 8.0),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(StitchTokens.radiusLg),
                    onTap: () =>
                        ref.read(videoProvider.notifier).applySamplePrompt(sample),
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12.0,
                        vertical: 10.0,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(StitchTokens.radiusLg),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Padding(
                            padding: EdgeInsets.only(top: 2.0),
                            child: Icon(
                              Icons.auto_awesome_rounded,
                              size: 14.0,
                              color: Color(0xFF6366F1),
                            ),
                          ),
                          const SizedBox(width: 8.0),
                          Expanded(
                            child: Text(
                              sample,
                              style: const TextStyle(
                                fontSize: 12.0,
                                height: 1.45,
                                color: Color(0xFF334155),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              }),
            ],
          ),
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: () => ref.read(videoProvider.notifier).loadHistory(),
      child: ListView.builder(
        controller: _scrollController,
        padding: const EdgeInsets.only(top: 6.0, bottom: 12.0),
        itemCount: videoState.tasks.length,
        itemBuilder: (context, index) {
          final task = videoState.tasks[index];
          return VideoTaskCard(
            key: ValueKey(task.id),
            task: task,
            isLatestGenerating: task.id == firstRunningId,
            elapsedSeconds: videoState.generatingElapsedSeconds,
            isDeleting: videoState.deletingTaskId == task.id,
            onSelectPreview: () => _openPreview(task),
            onReuse: () => ref.read(videoProvider.notifier).reuseParams(task),
            onDelete: () => ref.read(videoProvider.notifier).deleteTask(task.id),
          );
        },
      ),
    );
  }
}
