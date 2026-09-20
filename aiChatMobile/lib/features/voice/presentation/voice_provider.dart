import 'dart:async';
import 'package:cross_file/cross_file.dart';
import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';
import '../../../core/constants/api_constants.dart';
import '../../auth/providers/auth_provider.dart';
import '../../chat/providers/chat_provider.dart';
import '../data/voice_repository.dart';
import '../domain/voice_task_model.dart';

/// 历史流筛选枚举
enum VoiceFilter {
  all,
  tts,
  stt;

  String get label {
    switch (this) {
      case VoiceFilter.all:
        return '全部';
      case VoiceFilter.tts:
        return '语音合成 TTS';
      case VoiceFilter.stt:
        return '语音识别 STT';
    }
  }
}

/// STT 输入方式
enum SttInputMethod {
  record,
  upload;
}

/// Voice 状态载体
class VoiceState {
  final List<VoiceTaskModel> tasks;
  final List<VoiceInfoModel> voices;
  final bool isLoading;
  final bool isGenerating;
  final VoiceTaskType generatingType;
  final int generatingElapsedSeconds;
  final VoiceFilter currentFilter;
  final VoiceTaskType currentMode;

  // TTS 参数
  final String ttsText;
  final String ttsVoiceId;
  final double ttsSpeed;
  final String ttsLanguage;
  final String ttsModel;

  // STT 参数与音频录制/上传
  final SttInputMethod sttMethod;
  final String sttLanguage;
  final String sttModel;
  final bool isRecording;
  final int recordingElapsedSeconds;
  final String? recordedFilePath;
  final Uint8List? recordedFileBytes;
  final String? selectedFileName;
  final Uint8List? selectedFileBytes;
  final int? selectedFileSize;

  final String? errorMessage;

  const VoiceState({
    this.tasks = const [],
    this.voices = const [],
    this.isLoading = false,
    this.isGenerating = false,
    this.generatingType = VoiceTaskType.tts,
    this.generatingElapsedSeconds = 0,
    this.currentFilter = VoiceFilter.all,
    this.currentMode = VoiceTaskType.tts,
    this.ttsText = '',
    this.ttsVoiceId = '',
    this.ttsSpeed = 1.0,
    this.ttsLanguage = 'zh',
    this.ttsModel = 'grok-voice-think-fast-1.0',
    this.sttMethod = SttInputMethod.record,
    this.sttLanguage = 'zh',
    this.sttModel = 'grok-stt',
    this.isRecording = false,
    this.recordingElapsedSeconds = 0,
    this.recordedFilePath,
    this.recordedFileBytes,
    this.selectedFileName,
    this.selectedFileBytes,
    this.selectedFileSize,
    this.errorMessage,
  });

  VoiceState copyWith({
    List<VoiceTaskModel>? tasks,
    List<VoiceInfoModel>? voices,
    bool? isLoading,
    bool? isGenerating,
    VoiceTaskType? generatingType,
    int? generatingElapsedSeconds,
    VoiceFilter? currentFilter,
    VoiceTaskType? currentMode,
    String? ttsText,
    String? ttsVoiceId,
    double? ttsSpeed,
    String? ttsLanguage,
    String? ttsModel,
    SttInputMethod? sttMethod,
    String? sttLanguage,
    String? sttModel,
    bool? isRecording,
    int? recordingElapsedSeconds,
    String? recordedFilePath,
    bool clearRecordedFilePath = false,
    Uint8List? recordedFileBytes,
    bool clearRecordedFileBytes = false,
    String? selectedFileName,
    bool clearSelectedFileName = false,
    Uint8List? selectedFileBytes,
    bool clearSelectedFileBytes = false,
    int? selectedFileSize,
    bool clearSelectedFileSize = false,
    String? errorMessage,
    bool clearErrorMessage = false,
  }) {
    return VoiceState(
      tasks: tasks ?? this.tasks,
      voices: voices ?? this.voices,
      isLoading: isLoading ?? this.isLoading,
      isGenerating: isGenerating ?? this.isGenerating,
      generatingType: generatingType ?? this.generatingType,
      generatingElapsedSeconds: generatingElapsedSeconds ?? this.generatingElapsedSeconds,
      currentFilter: currentFilter ?? this.currentFilter,
      currentMode: currentMode ?? this.currentMode,
      ttsText: ttsText ?? this.ttsText,
      ttsVoiceId: ttsVoiceId ?? this.ttsVoiceId,
      ttsSpeed: ttsSpeed ?? this.ttsSpeed,
      ttsLanguage: ttsLanguage ?? this.ttsLanguage,
      ttsModel: ttsModel ?? this.ttsModel,
      sttMethod: sttMethod ?? this.sttMethod,
      sttLanguage: sttLanguage ?? this.sttLanguage,
      sttModel: sttModel ?? this.sttModel,
      isRecording: isRecording ?? this.isRecording,
      recordingElapsedSeconds: recordingElapsedSeconds ?? this.recordingElapsedSeconds,
      recordedFilePath: clearRecordedFilePath ? null : (recordedFilePath ?? this.recordedFilePath),
      recordedFileBytes: clearRecordedFileBytes ? null : (recordedFileBytes ?? this.recordedFileBytes),
      selectedFileName: clearSelectedFileName ? null : (selectedFileName ?? this.selectedFileName),
      selectedFileBytes: clearSelectedFileBytes ? null : (selectedFileBytes ?? this.selectedFileBytes),
      selectedFileSize: clearSelectedFileSize ? null : (selectedFileSize ?? this.selectedFileSize),
      errorMessage: clearErrorMessage ? null : (errorMessage ?? this.errorMessage),
    );
  }
}

final voiceRepositoryProvider = Provider<VoiceRepository>((ref) {
  final client = ref.watch(dioClientProvider);
  return VoiceRepository(client);
});

final voiceProvider = StateNotifierProvider<VoiceNotifier, VoiceState>((ref) {
  final repository = ref.watch(voiceRepositoryProvider);
  final chatNotifier = ref.watch(chatProvider.notifier);
  final chatState = ref.watch(chatProvider);

  return VoiceNotifier(
    repository,
    chatNotifier,
    () => chatState.creditsRemaining,
  )..init();
});

/// 语音工作台状态机
class VoiceNotifier extends StateNotifier<VoiceState> {
  final VoiceRepository _repository;
  final ChatNotifier _chatNotifier;
  final int Function() _getCredits;

  final AudioRecorder _audioRecorder = AudioRecorder();
  Timer? _generatingTimer;
  Timer? _recordingTimer;
  CancelToken? _activeCancelToken;

  VoiceNotifier(
    this._repository,
    this._chatNotifier,
    this._getCredits,
  ) : super(const VoiceState());

  Future<void> init() async {
    await Future.wait([
      fetchVoices(),
      fetchHistory(),
    ]);
  }

  /// 获取音色列表
  Future<void> fetchVoices() async {
    try {
      final list = await _repository.getVoices();
      if (list.isNotEmpty) {
        state = state.copyWith(
          voices: list,
          ttsVoiceId: state.ttsVoiceId.isEmpty ? list.first.voiceId : state.ttsVoiceId,
        );
      }
    } catch (e) {
      debugPrint('获取音色列表失败: $e');
    }
  }

  /// 获取历史任务
  Future<void> fetchHistory() async {
    state = state.copyWith(isLoading: true, clearErrorMessage: true);
    try {
      final filterString = state.currentFilter == VoiceFilter.all
          ? 'all'
          : (state.currentFilter == VoiceFilter.tts ? 'tts' : 'stt');
      final tasks = await _repository.getVoiceHistory(page: 1, pageSize: 50, type: filterString);
      state = state.copyWith(tasks: tasks, isLoading: false);
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: '获取历史记录失败: $e',
      );
    }
  }

  /// 模式切换 (TTS / STT)
  void setMode(VoiceTaskType mode) {
    state = state.copyWith(currentMode: mode);
  }

  /// 筛选器切换 (全部 / TTS / STT)
  void setFilter(VoiceFilter filter) {
    state = state.copyWith(currentFilter: filter);
    fetchHistory();
  }

  /// 更新 TTS 文本
  void setTtsText(String text) {
    state = state.copyWith(ttsText: text);
  }

  /// 更新音色
  void setTtsVoiceId(String voiceId) {
    state = state.copyWith(ttsVoiceId: voiceId);
  }

  /// 更新语速
  void setTtsSpeed(double speed) {
    state = state.copyWith(ttsSpeed: speed);
  }

  /// 更新 TTS 语言
  void setTtsLanguage(String language) {
    state = state.copyWith(ttsLanguage: language);
  }

  /// 更新 TTS 模型
  void setTtsModel(String model) {
    state = state.copyWith(ttsModel: model);
  }

  /// 更新 STT 输入模式 (录音 / 上传)
  void setSttMethod(SttInputMethod method) {
    state = state.copyWith(sttMethod: method);
  }

  /// 更新 STT 语言
  void setSttLanguage(String language) {
    state = state.copyWith(sttLanguage: language);
  }

  /// 开始录音
  Future<void> startRecording() async {
    try {
      if (!await _audioRecorder.hasPermission()) {
        state = state.copyWith(errorMessage: '请授予麦克风录音权限');
        return;
      }

      String path = '';
      if (!kIsWeb) {
        final dir = await getTemporaryDirectory();
        path = '${dir.path}/voice_record_${DateTime.now().millisecondsSinceEpoch}.m4a';
      }

      await _audioRecorder.start(
        const RecordConfig(encoder: AudioEncoder.aacLc),
        path: path,
      );

      _recordingTimer?.cancel();
      state = state.copyWith(
        isRecording: true,
        recordingElapsedSeconds: 0,
        clearRecordedFilePath: true,
        clearRecordedFileBytes: true,
        clearErrorMessage: true,
      );

      _recordingTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
        state = state.copyWith(
          recordingElapsedSeconds: state.recordingElapsedSeconds + 1,
        );
      });
    } catch (e) {
      state = state.copyWith(errorMessage: '启动录音失败: $e');
    }
  }

  /// 停止录音并缓存音频数据
  Future<void> stopRecording() async {
    if (!state.isRecording) return;
    _recordingTimer?.cancel();

    try {
      final path = await _audioRecorder.stop();
      if (path != null && path.isNotEmpty) {
        final xFile = XFile(path);
        final bytes = await xFile.readAsBytes();

        state = state.copyWith(
          isRecording: false,
          recordedFilePath: path,
          recordedFileBytes: bytes,
        );
      } else {
        state = state.copyWith(isRecording: false);
      }
    } catch (e) {
      state = state.copyWith(isRecording: false, errorMessage: '处理录音文件失败: $e');
    }
  }

  /// 重置录音
  Future<void> resetRecording() async {
    _recordingTimer?.cancel();
    try {
      if (await _audioRecorder.isRecording()) {
        await _audioRecorder.stop();
      }
    } catch (_) {}

    state = state.copyWith(
      isRecording: false,
      recordingElapsedSeconds: 0,
      clearRecordedFilePath: true,
      clearRecordedFileBytes: true,
    );
  }

  /// 选取本地音频文件
  Future<void> pickAudioFile() async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['mp3', 'wav', 'm4a', 'webm', 'ogg'],
        withData: true,
      );

      if (result != null && result.files.isNotEmpty) {
        final file = result.files.first;
        Uint8List? bytes = file.bytes;
        if (bytes == null && !kIsWeb && file.path != null) {
          final xFile = XFile(file.path!);
          bytes = await xFile.readAsBytes();
        }

        if (bytes != null) {
          state = state.copyWith(
            selectedFileName: file.name,
            selectedFileBytes: bytes,
            selectedFileSize: file.size,
            clearErrorMessage: true,
          );
        }
      }
    } catch (e) {
      state = state.copyWith(errorMessage: '选取文件失败: $e');
    }
  }

  /// 清除已选音频文件
  void clearSelectedFile() {
    state = state.copyWith(
      clearSelectedFileName: true,
      clearSelectedFileBytes: true,
      clearSelectedFileSize: true,
    );
  }

  /// 发起 TTS 合成
  Future<bool> submitTts() async {
    final text = state.ttsText.trim();
    if (text.isEmpty) {
      state = state.copyWith(errorMessage: '请输入要合成的文本内容');
      return false;
    }

    final credits = _getCredits();
    if (credits < ApiConstants.voiceUnitCost) {
      state = state.copyWith(errorMessage: '积分余额不足，需 ${ApiConstants.voiceUnitCost} 算力点');
      return false;
    }

    final voiceId = state.ttsVoiceId.isNotEmpty
        ? state.ttsVoiceId
        : (state.voices.isNotEmpty ? state.voices.first.voiceId : 'voice_xiaoyan');

    state = state.copyWith(
      isGenerating: true,
      generatingType: VoiceTaskType.tts,
      generatingElapsedSeconds: 0,
      clearErrorMessage: true,
    );

    _activeCancelToken = CancelToken();
    _startGeneratingTimer();

    try {
      final task = await _repository.generateTts(
        text: text,
        voiceId: voiceId,
        model: state.ttsModel,
        language: state.ttsLanguage,
        speed: state.ttsSpeed,
        cancelToken: _activeCancelToken,
      );

      _stopGeneratingTimer();
      _chatNotifier.updateCredits(credits - ApiConstants.voiceUnitCost);

      state = state.copyWith(
        isGenerating: false,
        tasks: [task, ...state.tasks],
        ttsText: '', // 清空已提交的输入文本
      );
      return true;
    } on DioException catch (e) {
      _stopGeneratingTimer();
      if (CancelToken.isCancel(e)) {
        state = state.copyWith(isGenerating: false, errorMessage: '已中止语音合成');
        return false;
      }
      final msg = e.response?.data is Map
          ? (e.response?.data['message'] ?? e.message)
          : e.message;
      state = state.copyWith(isGenerating: false, errorMessage: '语音合成失败: $msg');
      return false;
    } catch (e) {
      _stopGeneratingTimer();
      state = state.copyWith(isGenerating: false, errorMessage: '语音合成异常: $e');
      return false;
    }
  }

  /// 发起 STT 识别
  Future<bool> submitStt() async {
    Uint8List? fileBytes;
    String filename = 'audio.m4a';

    if (state.sttMethod == SttInputMethod.record) {
      if (state.recordedFileBytes == null) {
        state = state.copyWith(errorMessage: '请先完成麦克风录音');
        return false;
      }
      fileBytes = state.recordedFileBytes;
      filename = 'recording_${DateTime.now().millisecondsSinceEpoch}.m4a';
    } else {
      if (state.selectedFileBytes == null) {
        state = state.copyWith(errorMessage: '请选择要识别的音频文件');
        return false;
      }
      fileBytes = state.selectedFileBytes;
      filename = state.selectedFileName ?? 'upload_${DateTime.now().millisecondsSinceEpoch}.mp3';
    }

    final credits = _getCredits();
    if (credits < ApiConstants.voiceUnitCost) {
      state = state.copyWith(errorMessage: '积分余额不足，需 ${ApiConstants.voiceUnitCost} 算力点');
      return false;
    }

    state = state.copyWith(
      isGenerating: true,
      generatingType: VoiceTaskType.stt,
      generatingElapsedSeconds: 0,
      clearErrorMessage: true,
    );

    _activeCancelToken = CancelToken();
    _startGeneratingTimer();

    try {
      final task = await _repository.transcribeStt(
        fileBytes: fileBytes,
        filename: filename,
        language: state.sttLanguage,
        cancelToken: _activeCancelToken,
      );

      _stopGeneratingTimer();
      _chatNotifier.updateCredits(credits - ApiConstants.voiceUnitCost);

      // 清空录音或上传文件状态
      state = state.copyWith(
        isGenerating: false,
        tasks: [task, ...state.tasks],
        clearRecordedFilePath: true,
        clearRecordedFileBytes: true,
        clearSelectedFileName: true,
        clearSelectedFileBytes: true,
        clearSelectedFileSize: true,
      );
      return true;
    } on DioException catch (e) {
      _stopGeneratingTimer();
      if (CancelToken.isCancel(e)) {
        state = state.copyWith(isGenerating: false, errorMessage: '已中止语音识别');
        return false;
      }
      final msg = e.response?.data is Map
          ? (e.response?.data['message'] ?? e.message)
          : e.message;
      state = state.copyWith(isGenerating: false, errorMessage: '语音识别失败: $msg');
      return false;
    } catch (e) {
      _stopGeneratingTimer();
      state = state.copyWith(isGenerating: false, errorMessage: '语音识别异常: $e');
      return false;
    }
  }

  /// 中止当前生成任务
  void stopGeneration() {
    if (_activeCancelToken != null && !_activeCancelToken!.isCancelled) {
      _activeCancelToken!.cancel('用户手动取消任务');
      _activeCancelToken = null;
    }
    _stopGeneratingTimer();
    state = state.copyWith(isGenerating: false);
  }

  /// 复用历史任务参数
  void reuseParams(VoiceTaskModel task) {
    if (task.type == VoiceTaskType.tts) {
      state = state.copyWith(
        currentMode: VoiceTaskType.tts,
        ttsText: task.text,
        ttsVoiceId: task.voiceId ?? state.ttsVoiceId,
        ttsSpeed: task.speed,
        ttsLanguage: task.language,
        ttsModel: task.model,
      );
    } else {
      state = state.copyWith(
        currentMode: VoiceTaskType.stt,
        sttLanguage: task.language,
      );
    }
  }

  /// 应用预设提示词
  void applyPresetPrompt(String text) {
    state = state.copyWith(
      currentMode: VoiceTaskType.tts,
      ttsText: text,
    );
  }

  void _startGeneratingTimer() {
    _generatingTimer?.cancel();
    _generatingTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      state = state.copyWith(
        generatingElapsedSeconds: state.generatingElapsedSeconds + 1,
      );
    });
  }

  void _stopGeneratingTimer() {
    _generatingTimer?.cancel();
    _generatingTimer = null;
  }

  @override
  void dispose() {
    _generatingTimer?.cancel();
    _recordingTimer?.cancel();
    _activeCancelToken?.cancel();
    _audioRecorder.dispose();
    super.dispose();
  }
}
