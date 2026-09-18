import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';
import '../../../core/constants/api_constants.dart';
import '../../auth/providers/auth_provider.dart';
import '../data/chat_repository.dart';
import '../domain/chat_message_model.dart';
import '../domain/chat_session_model.dart';

class ChatState {
  final String? activeSessionId;
  final List<ChatSessionModel> sessions;
  final List<ChatMessageModel> messages;
  final bool isGenerating;
  final String selectedModel;
  final int creditsRemaining;
  final String? errorMessage;

  const ChatState({
    this.activeSessionId,
    this.sessions = const [],
    this.messages = const [],
    this.isGenerating = false,
    this.selectedModel = ApiConstants.defaultChatModel,
    this.creditsRemaining = 1000,
    this.errorMessage,
  });

  ChatState copyWith({
    String? activeSessionId,
    List<ChatSessionModel>? sessions,
    List<ChatMessageModel>? messages,
    bool? isGenerating,
    String? selectedModel,
    int? creditsRemaining,
    String? errorMessage,
  }) {
    return ChatState(
      activeSessionId: activeSessionId ?? this.activeSessionId,
      sessions: sessions ?? this.sessions,
      messages: messages ?? this.messages,
      isGenerating: isGenerating ?? this.isGenerating,
      selectedModel: selectedModel ?? this.selectedModel,
      creditsRemaining: creditsRemaining ?? this.creditsRemaining,
      errorMessage: errorMessage,
    );
  }
}

final chatRepositoryProvider = Provider<ChatRepository>((ref) {
  final client = ref.watch(dioClientProvider);
  return ChatRepository(client);
});

final chatProvider = StateNotifierProvider<ChatNotifier, ChatState>((ref) {
  final repo = ref.watch(chatRepositoryProvider);
  final authState = ref.watch(authProvider);
  final notifier = ChatNotifier(repo, authState.user?.id);
  if (authState.user != null) {
    notifier.updateCredits(authState.user!.credits.remaining);
    notifier.loadSessions();
  }
  return notifier;
});

/// 聊天核心业务状态机
class ChatNotifier extends StateNotifier<ChatState> {
  final ChatRepository _repository;
  final String? _currentUserId;
  CancelToken? _cancelToken;
  StreamSubscription? _streamSubscription;

  ChatNotifier(this._repository, this._currentUserId) : super(const ChatState());

  void updateCredits(int remaining) {
    state = state.copyWith(creditsRemaining: remaining);
  }

  void setModel(String model) {
    state = state.copyWith(selectedModel: model);
  }

  Future<void> loadSessions() async {
    if (_currentUserId == null) return;
    try {
      final sessions = await _repository.getSessions(_currentUserId);
      state = state.copyWith(sessions: sessions);
      if (sessions.isNotEmpty && state.activeSessionId == null) {
        selectSession(sessions.first.id);
      }
    } catch (_) {}
  }

  Future<void> selectSession(String sessionId) async {
    state = state.copyWith(activeSessionId: sessionId);
    try {
      final messages = await _repository.getSessionMessages(sessionId);
      state = state.copyWith(messages: messages);
    } catch (_) {}
  }

  Future<void> createNewSession() async {
    state = state.copyWith(
      activeSessionId: null,
      messages: [],
    );
  }

  Future<void> sendMessage(String text) async {
    final trimmed = text.trim();
    if (trimmed.isEmpty || state.isGenerating) return;

    // 检查积分门槛 (单次 10 积分)
    if (state.creditsRemaining < ApiConstants.chatMessageCost) {
      state = state.copyWith(errorMessage: '积分余额不足，单次对话需消耗 10 积分');
      return;
    }

    final clientRequestId = const Uuid().v4();
    final userMessage = ChatMessageModel(
      id: const Uuid().v4(),
      sessionId: state.activeSessionId ?? '',
      role: 'user',
      content: trimmed,
      createdAt: DateTime.now(),
    );

    final assistantMessageId = const Uuid().v4();
    final assistantPlaceholder = ChatMessageModel(
      id: assistantMessageId,
      sessionId: state.activeSessionId ?? '',
      role: 'assistant',
      content: '',
      model: state.selectedModel,
      status: MessageStatus.streaming,
      createdAt: DateTime.now(),
    );

    state = state.copyWith(
      messages: [...state.messages, userMessage, assistantPlaceholder],
      isGenerating: true,
      errorMessage: null,
    );

    _cancelToken = CancelToken();
    final stopwatch = Stopwatch()..start();
    final contentBuffer = StringBuffer();
    final reasoningBuffer = StringBuffer();

    try {
      final stream = await _repository.sendStreamMessage(
        message: trimmed,
        model: state.selectedModel,
        clientRequestId: clientRequestId,
        sessionId: state.activeSessionId,
        cancelToken: _cancelToken,
      );

      _streamSubscription = stream.listen(
        (chunk) {
          if (chunk.sessionId != null && state.activeSessionId == null) {
            state = state.copyWith(activeSessionId: chunk.sessionId);
          }

          if (chunk.error != null && chunk.error!.isNotEmpty) {
            _handleStreamError(assistantMessageId, chunk.error!);
            return;
          }

          if (chunk.reasoningDelta != null) {
            reasoningBuffer.write(chunk.reasoningDelta);
          }

          if (chunk.delta != null) {
            contentBuffer.write(chunk.delta);
          }

          final updatedMessages = state.messages.map((msg) {
            if (msg.id == assistantMessageId) {
              return msg.copyWith(
                content: contentBuffer.toString(),
                reasoningContent: reasoningBuffer.isNotEmpty ? reasoningBuffer.toString() : null,
                reasoningDurationSeconds: stopwatch.elapsed.inSeconds,
                status: chunk.finishReason != null ? MessageStatus.done : MessageStatus.streaming,
              );
            }
            return msg;
          }).toList();

          state = state.copyWith(messages: updatedMessages);
        },
        onDone: () {
          stopwatch.stop();
          _finalizeStreaming(assistantMessageId);
        },
        onError: (err) {
          stopwatch.stop();
          if (err is DioException && CancelToken.isCancel(err)) {
            _finalizeStreaming(assistantMessageId);
          } else {
            _handleStreamError(assistantMessageId, err.toString());
          }
        },
      );
    } catch (e) {
      stopwatch.stop();
      _handleStreamError(assistantMessageId, e.toString().replaceAll('Exception: ', ''));
    }
  }

  void stopGeneration() {
    _cancelToken?.cancel('User stopped generation');
    _streamSubscription?.cancel();
    state = state.copyWith(isGenerating: false);
  }

  void _finalizeStreaming(String assistantMessageId) {
    state = state.copyWith(
      isGenerating: false,
      creditsRemaining: state.creditsRemaining - ApiConstants.chatMessageCost,
      messages: state.messages.map((msg) {
        if (msg.id == assistantMessageId) {
          return msg.copyWith(status: MessageStatus.done);
        }
        return msg;
      }).toList(),
    );
  }

  void _handleStreamError(String assistantMessageId, String error) {
    state = state.copyWith(
      isGenerating: false,
      messages: state.messages.map((msg) {
        if (msg.id == assistantMessageId) {
          return msg.copyWith(
            status: MessageStatus.error,
            errorMessage: error,
          );
        }
        return msg;
      }).toList(),
    );
  }

  Future<void> deleteSession(String sessionId) async {
    await _repository.deleteSession(sessionId);
    state = state.copyWith(
      sessions: state.sessions.where((s) => s.id != sessionId).toList(),
      activeSessionId: state.activeSessionId == sessionId ? null : state.activeSessionId,
      messages: state.activeSessionId == sessionId ? [] : state.messages,
    );
  }

  @override
  void dispose() {
    _cancelToken?.cancel();
    _streamSubscription?.cancel();
    super.dispose();
  }
}
