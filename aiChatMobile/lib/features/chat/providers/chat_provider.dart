import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';
import '../../../core/constants/api_constants.dart';
import '../../auth/providers/auth_provider.dart';
import '../data/chat_repository.dart';
import '../data/file_upload_repository.dart';
import '../domain/chat_message_model.dart';
import '../domain/chat_session_model.dart';
import '../domain/file_attachment_model.dart';

class ChatState {
  final String? activeSessionId;
  final List<ChatSessionModel> sessions;
  final List<ChatMessageModel> messages;
  final bool isGenerating;
  final String selectedModel;
  final int creditsRemaining;
  final String? errorMessage;
  final List<AttachmentItem> pendingAttachments;

  const ChatState({
    this.activeSessionId,
    this.sessions = const [],
    this.messages = const [],
    this.isGenerating = false,
    this.selectedModel = ApiConstants.defaultChatModel,
    this.creditsRemaining = 1000,
    this.errorMessage,
    this.pendingAttachments = const [],
  });

  ChatState copyWith({
    String? activeSessionId,
    List<ChatSessionModel>? sessions,
    List<ChatMessageModel>? messages,
    bool? isGenerating,
    String? selectedModel,
    int? creditsRemaining,
    String? errorMessage,
    List<AttachmentItem>? pendingAttachments,
  }) {
    return ChatState(
      activeSessionId: activeSessionId ?? this.activeSessionId,
      sessions: sessions ?? this.sessions,
      messages: messages ?? this.messages,
      isGenerating: isGenerating ?? this.isGenerating,
      selectedModel: selectedModel ?? this.selectedModel,
      creditsRemaining: creditsRemaining ?? this.creditsRemaining,
      errorMessage: errorMessage,
      pendingAttachments: pendingAttachments ?? this.pendingAttachments,
    );
  }
}

final chatRepositoryProvider = Provider<ChatRepository>((ref) {
  final client = ref.watch(dioClientProvider);
  return ChatRepository(client);
});

final chatProvider = StateNotifierProvider<ChatNotifier, ChatState>((ref) {
  final repo = ref.watch(chatRepositoryProvider);
  final fileUploadRepo = ref.watch(fileUploadRepositoryProvider);
  final authState = ref.watch(authProvider);
  final notifier = ChatNotifier(repo, fileUploadRepo, authState.user?.id);
  if (authState.user != null) {
    notifier.updateCredits(authState.user!.credits.remaining);
    notifier.loadSessions();
  }
  return notifier;
});

/// 聊天核心业务状态机
class ChatNotifier extends StateNotifier<ChatState> {
  final ChatRepository _repository;
  final FileUploadRepository _fileUploadRepo;
  final String? _currentUserId;
  CancelToken? _cancelToken;
  StreamSubscription? _streamSubscription;

  ChatNotifier(this._repository, this._fileUploadRepo, this._currentUserId) : super(const ChatState());

  void updateCredits(int remaining) {
    state = state.copyWith(creditsRemaining: remaining);
  }

  void setModel(String model) {
    state = state.copyWith(selectedModel: model);
  }

  Future<void> pickAndUploadImages() async {
    if (state.isGenerating) return;

    final currentImages = state.pendingAttachments.where((a) => a.isImage).length;
    if (currentImages >= 4) {
      state = state.copyWith(errorMessage: '最多只能同时添加 4 张图片附件');
      return;
    }

    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.image,
        allowMultiple: true,
        withData: true,
      );

      if (result == null || result.files.isEmpty) return;

      final validFiles = <PlatformFile>[];
      for (final f in result.files) {
        if (f.size > 5 * 1024 * 1024) {
          state = state.copyWith(errorMessage: '图片 ${f.name} 超过 5MB 限制');
          continue;
        }
        validFiles.add(f);
      }

      final availableSlots = 4 - currentImages;
      final filesToUpload = validFiles.take(availableSlots).toList();
      if (filesToUpload.isEmpty) return;

      final newItems = <AttachmentItem>[];
      for (final f in filesToUpload) {
        Uint8List? fileBytes = f.bytes;
        String? filePath;
        if (!kIsWeb) {
          filePath = f.path;
          if (fileBytes == null && filePath != null) {
            fileBytes = await File(filePath).readAsBytes();
          }
        }

        newItems.add(
          AttachmentItem(
            id: const Uuid().v4(),
            localPath: filePath,
            bytes: fileBytes,
            name: f.name,
            sizeBytes: f.size,
            isImage: true,
            status: AttachmentUploadStatus.uploading,
          ),
        );
      }

      state = state.copyWith(
        pendingAttachments: [...state.pendingAttachments, ...newItems],
        errorMessage: null,
      );

      // 执行后台预上传
      try {
        final uploadPayloads = newItems.map((item) {
          return UploadFileInput(
            name: item.name,
            bytes: item.bytes,
            filePath: item.localPath,
          );
        }).toList();

        final uploadResults = await _fileUploadRepo.uploadImages(uploadPayloads);
        if (uploadResults.isEmpty) {
          throw Exception('服务器未返回有效上传数据');
        }

        final updatedList = List<AttachmentItem>.from(state.pendingAttachments);
        for (var i = 0; i < newItems.length && i < uploadResults.length; i++) {
          final targetIndex = updatedList.indexWhere((item) => item.id == newItems[i].id);
          if (targetIndex != -1) {
            updatedList[targetIndex] = updatedList[targetIndex].copyWith(
              serverFileId: uploadResults[i].id,
              serverUrl: uploadResults[i].url,
              mimeType: uploadResults[i].mime,
              status: AttachmentUploadStatus.success,
            );
          }
        }
        state = state.copyWith(pendingAttachments: updatedList);
      } catch (e) {
        final updatedList = state.pendingAttachments.map((item) {
          if (newItems.any((ni) => ni.id == item.id)) {
            return item.copyWith(
              status: AttachmentUploadStatus.error,
              errorMessage: e.toString().replaceAll('Exception: ', ''),
            );
          }
          return item;
        }).toList();
        state = state.copyWith(
          pendingAttachments: updatedList,
          errorMessage: '图片上传失败: ${e.toString().replaceAll('Exception: ', '')}',
        );
      }
    } catch (e) {
      state = state.copyWith(errorMessage: '选取图片失败: $e');
    }
  }

  Future<void> pickDocument() async {
    if (state.isGenerating) return;

    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: [
          'txt', 'md', 'json', 'yaml', 'yml', 'py', 'js', 'ts', 'dart',
          'html', 'css', 'sql', 'xml', 'log', 'csv', 'env', 'sh'
        ],
        withData: true,
      );

      if (result == null || result.files.isEmpty) return;
      final file = result.files.first;

      if (file.size > 2 * 1024 * 1024) {
        state = state.copyWith(errorMessage: '文本附件不能超过 2MB');
        return;
      }

      Uint8List? fileBytes = file.bytes;
      String? filePath;
      if (!kIsWeb) {
        filePath = file.path;
      }

      String content = '';
      if (fileBytes != null) {
        content = utf8.decode(fileBytes, allowMalformed: true);
      } else if (!kIsWeb && filePath != null) {
        content = await File(filePath).readAsString();
      } else {
        throw Exception('无法读取文件内容');
      }

      final item = AttachmentItem(
        id: const Uuid().v4(),
        localPath: filePath,
        bytes: fileBytes,
        name: file.name,
        sizeBytes: file.size,
        isImage: false,
        textContent: content,
        status: AttachmentUploadStatus.success,
      );

      state = state.copyWith(
        pendingAttachments: [...state.pendingAttachments, item],
        errorMessage: null,
      );
    } catch (e) {
      state = state.copyWith(errorMessage: '读取文本文件失败: $e');
    }
  }

  void removeAttachment(String id) {
    state = state.copyWith(
      pendingAttachments: state.pendingAttachments.where((a) => a.id != id).toList(),
    );
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
      pendingAttachments: [],
    );
  }

  Future<void> sendMessage(String text) async {
    final attachmentsToSend = List<AttachmentItem>.from(state.pendingAttachments);
    final trimmed = text.trim();
    if ((trimmed.isEmpty && attachmentsToSend.isEmpty) || state.isGenerating) return;

    // 检查积分门槛 (单次 10 积分)
    if (state.creditsRemaining < ApiConstants.chatMessageCost) {
      state = state.copyWith(errorMessage: '积分余额不足，单次对话需消耗 10 积分');
      return;
    }

    // 检查是否存在正在上传中的图片
    final hasPendingUpload = attachmentsToSend.any(
      (a) => a.isImage && a.status == AttachmentUploadStatus.uploading,
    );
    if (hasPendingUpload) {
      state = state.copyWith(errorMessage: '图片正在上传中，请稍候再发送');
      return;
    }

    final fileIds = attachmentsToSend
        .where((a) => a.isImage && a.serverFileId != null)
        .map((a) => a.serverFileId!)
        .toList();

    // 若用户未手动输入文字，针对图片或文档提供基础提示词以通过后端非空校验
    final effectiveText = trimmed.isNotEmpty
        ? trimmed
        : (attachmentsToSend.any((a) => a.isImage) ? '请分析我发送的图片' : '请查看附件内容');

    // 整合文档附件到 Prompt
    final promptBuffer = StringBuffer(effectiveText);
    for (final doc in attachmentsToSend.where((a) => !a.isImage && a.textContent != null)) {
      promptBuffer.write('\n\n[附件: ${doc.name}]\n```\n${doc.textContent}\n```');
    }
    final fullMessage = promptBuffer.toString();

    final clientRequestId = const Uuid().v4();
    final userMessage = ChatMessageModel(
      id: const Uuid().v4(),
      sessionId: state.activeSessionId ?? '',
      role: 'user',
      content: trimmed.isNotEmpty ? trimmed : '',
      createdAt: DateTime.now(),
      attachments: attachmentsToSend,
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
      pendingAttachments: [],
      isGenerating: true,
      errorMessage: null,
    );

    _cancelToken = CancelToken();
    final stopwatch = Stopwatch()..start();
    final contentBuffer = StringBuffer();
    final reasoningBuffer = StringBuffer();

    try {
      final stream = await _repository.sendStreamMessage(
        message: fullMessage,
        model: state.selectedModel,
        clientRequestId: clientRequestId,
        sessionId: state.activeSessionId,
        fileIds: fileIds,
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
