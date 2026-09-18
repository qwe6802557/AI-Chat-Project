import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/api_constants.dart';
import '../../auth/providers/auth_provider.dart';
import '../../chat/providers/chat_provider.dart';
import '../data/image_repository.dart';
import '../domain/image_task_model.dart';

class ExploreState {
  final String aspectRatio;
  final String resolution;
  final bool isGenerating;
  final List<ImageTaskModel> tasks;
  final String? errorMessage;

  const ExploreState({
    this.aspectRatio = '1:1',
    this.resolution = '1k',
    this.isGenerating = false,
    this.tasks = const [],
    this.errorMessage,
  });

  ExploreState copyWith({
    String? aspectRatio,
    String? resolution,
    bool? isGenerating,
    List<ImageTaskModel>? tasks,
    String? errorMessage,
  }) {
    return ExploreState(
      aspectRatio: aspectRatio ?? this.aspectRatio,
      resolution: resolution ?? this.resolution,
      isGenerating: isGenerating ?? this.isGenerating,
      tasks: tasks ?? this.tasks,
      errorMessage: errorMessage,
    );
  }
}

final imageRepositoryProvider = Provider<ImageRepository>((ref) {
  final client = ref.watch(dioClientProvider);
  return ImageRepository(client);
});

final exploreProvider = StateNotifierProvider<ExploreNotifier, ExploreState>((ref) {
  final repo = ref.watch(imageRepositoryProvider);
  final chatNotifier = ref.watch(chatProvider.notifier);
  final chatState = ref.watch(chatProvider);

  return ExploreNotifier(repo, chatNotifier, () => chatState.creditsRemaining)..loadHistory();
});

/// 探索与灵感生图状态机
class ExploreNotifier extends StateNotifier<ExploreState> {
  final ImageRepository _repository;
  final ChatNotifier _chatNotifier;
  final int Function() _getCredits;

  ExploreNotifier(
    this._repository,
    this._chatNotifier,
    this._getCredits,
  ) : super(const ExploreState());

  void setAspectRatio(String ratio) {
    state = state.copyWith(aspectRatio: ratio);
  }

  void setResolution(String res) {
    state = state.copyWith(resolution: res);
  }

  Future<void> loadHistory() async {
    try {
      final tasks = await _repository.getImageHistory();
      state = state.copyWith(tasks: tasks);
    } catch (_) {}
  }

  Future<void> generateImage(String prompt) async {
    final trimmed = prompt.trim();
    if (trimmed.isEmpty || state.isGenerating) return;

    // 严格校验生图 100 积分隔离门槛
    final currentCredits = _getCredits();
    if (currentCredits < ApiConstants.imageGenerationCost) {
      state = state.copyWith(errorMessage: '积分不足，生成单张画作需消耗 100 积分');
      return;
    }

    state = state.copyWith(isGenerating: true, errorMessage: null);

    try {
      final task = await _repository.createImageGeneration(
        prompt: trimmed,
        aspectRatio: state.aspectRatio,
        resolution: state.resolution,
      );

      // 扣除 100 积分并同步更新
      _chatNotifier.updateCredits(currentCredits - ApiConstants.imageGenerationCost);

      state = state.copyWith(
        isGenerating: false,
        tasks: [task, ...state.tasks],
      );
    } catch (e) {
      state = state.copyWith(
        isGenerating: false,
        errorMessage: e.toString().replaceAll('Exception: ', ''),
      );
    }
  }
}
