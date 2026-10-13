import 'dart:async';
import 'dart:convert';
import 'package:cross_file/cross_file.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/api_constants.dart';
import '../../auth/providers/auth_provider.dart';
import '../../chat/providers/chat_provider.dart';
import '../data/video_repository.dart';
import '../domain/video_task_model.dart';

/// 视频创作工作台状态载体
class VideoState {
  final List<VideoTaskModel> tasks;
  final bool isLoading;
  final bool isGenerating;
  final int generatingElapsedSeconds;
  final String? deletingTaskId;
  final String promptText;
  final String aspectRatio;
  final String? referenceImageDataUrl;
  final String? referenceImageName;
  final String? errorMessage;
  final String? noticeMessage;

  const VideoState({
    this.tasks = const [],
    this.isLoading = false,
    this.isGenerating = false,
    this.generatingElapsedSeconds = 0,
    this.deletingTaskId,
    this.promptText = '',
    this.aspectRatio = '16:9',
    this.referenceImageDataUrl,
    this.referenceImageName,
    this.errorMessage,
    this.noticeMessage,
  });

  /// 根据是否挂载参考图自动判定当前使用的通义万相模型
  String get activeModelId => (referenceImageDataUrl != null && referenceImageDataUrl!.isNotEmpty)
      ? 'Wan-AI/Wan2.2-I2V-A14B'
      : 'Wan-AI/Wan2.2-T2V-A14B';

  /// 当前模式简短标签
  String get activeModeLabel => (referenceImageDataUrl != null && referenceImageDataUrl!.isNotEmpty)
      ? '图生视频'
      : '文生视频';

  VideoState copyWith({
    List<VideoTaskModel>? tasks,
    bool? isLoading,
    bool? isGenerating,
    int? generatingElapsedSeconds,
    String? deletingTaskId,
    bool clearDeletingTaskId = false,
    String? promptText,
    String? aspectRatio,
    String? referenceImageDataUrl,
    bool clearReferenceImage = false,
    String? referenceImageName,
    String? errorMessage,
    bool clearErrorMessage = false,
    String? noticeMessage,
    bool clearNoticeMessage = false,
  }) {
    return VideoState(
      tasks: tasks ?? this.tasks,
      isLoading: isLoading ?? this.isLoading,
      isGenerating: isGenerating ?? this.isGenerating,
      generatingElapsedSeconds: generatingElapsedSeconds ?? this.generatingElapsedSeconds,
      deletingTaskId: clearDeletingTaskId ? null : (deletingTaskId ?? this.deletingTaskId),
      promptText: promptText ?? this.promptText,
      aspectRatio: aspectRatio ?? this.aspectRatio,
      referenceImageDataUrl: clearReferenceImage ? null : (referenceImageDataUrl ?? this.referenceImageDataUrl),
      referenceImageName: clearReferenceImage ? null : (referenceImageName ?? this.referenceImageName),
      errorMessage: clearErrorMessage ? null : (errorMessage ?? this.errorMessage),
      noticeMessage: clearNoticeMessage ? null : (noticeMessage ?? this.noticeMessage),
    );
  }
}

final videoRepositoryProvider = Provider<VideoRepository>((ref) {
  final client = ref.watch(dioClientProvider);
  return VideoRepository(client);
});

final videoProvider = StateNotifierProvider<VideoNotifier, VideoState>((ref) {
  final repository = ref.watch(videoRepositoryProvider);
  final chatNotifier = ref.watch(chatProvider.notifier);
  final chatState = ref.watch(chatProvider);

  return VideoNotifier(
    repository,
    chatNotifier,
    () => chatState.creditsRemaining,
  )..loadHistory();
});

/// 视频创作工作台状态机
class VideoNotifier extends StateNotifier<VideoState> {
  final VideoRepository _repository;
  final ChatNotifier _chatNotifier;
  final int Function() _getCredits;

  Timer? _elapsedTimer;
  Timer? _pollingTimer;

  VideoNotifier(
    this._repository,
    this._chatNotifier,
    this._getCredits,
  ) : super(const VideoState());

  void setPromptText(String value) {
    state = state.copyWith(promptText: value);
  }

  void setAspectRatio(String ratio) {
    state = state.copyWith(aspectRatio: ratio);
  }

  /// 选取本地首帧参考图片并编码为 Data URL
  Future<void> pickReferenceImage() async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['jpg', 'jpeg', 'png', 'webp'],
        withData: true,
      );

      if (result == null || result.files.isEmpty) return;
      final file = result.files.first;
      Uint8List? bytes = file.bytes;
      if (bytes == null && !kIsWeb && file.path != null) {
        final xFile = XFile(file.path!);
        bytes = await xFile.readAsBytes();
      }
      if (bytes == null) return;

      if (bytes.lengthInBytes > 10 * 1024 * 1024) {
        state = state.copyWith(errorMessage: '参考图片大小不能超过 10MB');
        return;
      }

      final ext = (file.extension ?? 'jpeg').toLowerCase();
      final mime = ext == 'png'
          ? 'image/png'
          : (ext == 'webp' ? 'image/webp' : 'image/jpeg');
      final dataUrl = 'data:$mime;base64,${base64Encode(bytes)}';

      state = state.copyWith(
        referenceImageDataUrl: dataUrl,
        referenceImageName: file.name,
        clearErrorMessage: true,
      );
    } catch (e) {
      state = state.copyWith(errorMessage: '读取参考图片失败: $e');
    }
  }

  /// 移除已挂载的首帧参考图
  void clearReferenceImage() {
    state = state.copyWith(clearReferenceImage: true);
  }

  /// 拉取视频历史记录并自动激活未完结任务轮询
  Future<void> loadHistory() async {
    state = state.copyWith(isLoading: true, clearErrorMessage: true);
    try {
      final list = await _repository.getVideoHistory(page: 1, pageSize: 30);
      state = state.copyWith(tasks: list, isLoading: false);
      _checkAndStartPolling();
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: '加载视频历史记录失败: $e',
      );
    }
  }

  /// 发起视频生成（采用乐观占位卡片与原地流式接管）
  Future<bool> submitGenerate() async {
    final trimmedPrompt = state.promptText.trim();
    if (trimmedPrompt.isEmpty) {
      state = state.copyWith(errorMessage: '请输入视频镜头描述提示词');
      return false;
    }
    if (state.isGenerating) return false;

    final currentCredits = _getCredits();
    if (currentCredits < ApiConstants.videoGenerationCost) {
      state = state.copyWith(
        errorMessage: '积分不足，单次生成视频需 ${ApiConstants.videoGenerationCost} 积分（当前剩余 $currentCredits 积分）',
      );
      return false;
    }

    final modelId = state.activeModelId;
    final aspectRatio = state.aspectRatio;
    final imageParam = state.referenceImageDataUrl;
    final now = DateTime.now();
    final tempId = 'temp_${now.millisecondsSinceEpoch}';

    final optimisticTask = VideoTaskModel(
      id: tempId,
      prompt: trimmedPrompt,
      modelId: modelId,
      imageUrl: imageParam,
      aspectRatio: aspectRatio,
      duration: 5,
      costCredits: ApiConstants.videoGenerationCost,
      status: VideoTaskStatus.pending,
      createdAt: now,
      updatedAt: now,
    );

    state = state.copyWith(
      isGenerating: true,
      generatingElapsedSeconds: 0,
      tasks: [optimisticTask, ...state.tasks],
      promptText: '',
      clearReferenceImage: true,
      clearErrorMessage: true,
      clearNoticeMessage: true,
    );

    _startElapsedTimer();

    try {
      final createdTask = await _repository.generateVideo(
        prompt: trimmedPrompt,
        model: modelId,
        image: imageParam,
        aspectRatio: aspectRatio,
      );

      _chatNotifier.updateCredits(currentCredits - ApiConstants.videoGenerationCost);

      final updatedList = state.tasks.map((t) => t.id == tempId ? createdTask : t).toList();
      state = state.copyWith(
        tasks: updatedList,
        noticeMessage: '视频任务已提交至万相大模型，正在后台渲染',
      );

      _checkAndStartPolling();
      return true;
    } catch (e) {
      _stopElapsedTimer();
      final rollbackList = state.tasks.where((t) => t.id != tempId).toList();
      state = state.copyWith(
        isGenerating: false,
        tasks: rollbackList,
        promptText: trimmedPrompt,
        errorMessage: e.toString().replaceAll('Exception: ', ''),
      );
      return false;
    }
  }

  /// 删除指定视频记录
  Future<void> deleteTask(String taskId) async {
    if (taskId.startsWith('temp_')) return;
    state = state.copyWith(deletingTaskId: taskId, clearErrorMessage: true);
    try {
      await _repository.deleteVideoTask(taskId);
      final remaining = state.tasks.where((t) => t.id != taskId).toList();
      state = state.copyWith(
        tasks: remaining,
        clearDeletingTaskId: true,
        noticeMessage: '视频记录及媒体资源已删除',
      );
    } catch (e) {
      state = state.copyWith(
        clearDeletingTaskId: true,
        errorMessage: e.toString().replaceAll('Exception: ', ''),
      );
    }
  }

  /// 快捷复用历史任务参数
  void reuseParams(VideoTaskModel task) {
    state = state.copyWith(
      promptText: task.prompt,
      aspectRatio: task.aspectRatio,
      referenceImageDataUrl: task.imageUrl,
      referenceImageName: task.imageUrl != null ? '历史参考图' : null,
      clearReferenceImage: task.imageUrl == null || task.imageUrl!.isEmpty,
      noticeMessage: '已将提示词与画幅参数回填至控制栏',
    );
  }

  /// 填入灵感示例提示词
  void applySamplePrompt(String sample) {
    state = state.copyWith(promptText: sample);
  }

  void _checkAndStartPolling() {
    final hasRunning = state.tasks.any((t) => t.status.isRunning && !t.id.startsWith('temp_'));
    if (!hasRunning) {
      _stopPolling();
      return;
    }
    if (_pollingTimer != null) return;

    _pollingTimer = Timer.periodic(const Duration(seconds: 4), (_) async {
      final runningTasks = state.tasks
          .where((t) => t.status.isRunning && !t.id.startsWith('temp_'))
          .toList();
      if (runningTasks.isEmpty) {
        _stopPolling();
        return;
      }

      for (final pending in runningTasks) {
        try {
          final statusRes = await _repository.getVideoStatus(pending.id);
          if (statusRes.status != pending.status || statusRes.videoUrl != pending.videoUrl) {
            final nextTasks = state.tasks.map((item) {
              if (item.id == pending.id) {
                return item.copyWith(
                  status: statusRes.status,
                  videoUrl: statusRes.videoUrl,
                  errorMessage: statusRes.errorMessage,
                  updatedAt: statusRes.updatedAt,
                );
              }
              return item;
            }).toList();

            final stillRunning = nextTasks.any((t) => t.status.isRunning);
            if (!stillRunning) {
              _stopElapsedTimer();
            }

            if (statusRes.status == VideoTaskStatus.success) {
              state = state.copyWith(
                tasks: nextTasks,
                isGenerating: stillRunning,
                noticeMessage: '视频生成完毕，点击卡片即可全屏播放',
              );
            } else if (statusRes.status == VideoTaskStatus.failed) {
              _chatNotifier.updateCredits(_getCredits() + pending.costCredits);
              state = state.copyWith(
                tasks: nextTasks,
                isGenerating: stillRunning,
                errorMessage: '视频生成未完成，${pending.costCredits} 积分已全额退还',
              );
            } else {
              state = state.copyWith(tasks: nextTasks);
            }
          }
        } catch (_) {
          // 单次轮询网络波动静默跳过，等待下一周期重试
        }
      }
    });
  }

  void _stopPolling() {
    _pollingTimer?.cancel();
    _pollingTimer = null;
  }

  void _startElapsedTimer() {
    _elapsedTimer?.cancel();
    _elapsedTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      state = state.copyWith(
        generatingElapsedSeconds: state.generatingElapsedSeconds + 1,
      );
    });
  }

  void _stopElapsedTimer() {
    _elapsedTimer?.cancel();
    _elapsedTimer = null;
  }

  @override
  void dispose() {
    _stopElapsedTimer();
    _stopPolling();
    super.dispose();
  }
}
