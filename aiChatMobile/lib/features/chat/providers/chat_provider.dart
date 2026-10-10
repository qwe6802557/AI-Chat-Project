import 'dart:async';
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
import '../domain/tool_model.dart';

class ChatState {
  final String? activeSessionId;
  final List<ChatSessionModel> sessions;
  final List<ChatMessageModel> messages;
  final bool isGenerating;
  final String selectedModel;
  final int creditsRemaining;
  final String? errorMessage;
  final List<AttachmentItem> pendingAttachments;
  final bool isWebSearchEnabled;
  final List<String> enabledTools;

  const ChatState({
    this.activeSessionId,
    this.sessions = const [],
    this.messages = const [],
    this.isGenerating = false,
    this.selectedModel = ApiConstants.defaultChatModel,
    this.creditsRemaining = 1000,
    this.errorMessage,
    this.pendingAttachments = const [],
    this.isWebSearchEnabled = true,
    this.enabledTools = const ['web_search_v2'],
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
    bool? isWebSearchEnabled,
    List<String>? enabledTools,
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
      isWebSearchEnabled: isWebSearchEnabled ?? this.isWebSearchEnabled,
      enabledTools: enabledTools ?? this.enabledTools,
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

  void toggleWebSearch() {
    toggleTool('web_search_v2');
  }

  void toggleTool(String toolId) {
    final list = List<String>.from(state.enabledTools);
    if (list.contains(toolId)) {
      list.remove(toolId);
    } else {
      list.add(toolId);
    }
    state = state.copyWith(
      enabledTools: list,
      isWebSearchEnabled: list.contains('web_search_v2'),
    );
  }

  void enableTool(String toolId) {
    if (!state.enabledTools.contains(toolId)) {
      final list = [...state.enabledTools, toolId];
      state = state.copyWith(
        enabledTools: list,
        isWebSearchEnabled: list.contains('web_search_v2'),
      );
    }
  }

  void disableTool(String toolId) {
    if (state.enabledTools.contains(toolId)) {
      final list = state.enabledTools.where((id) => id != toolId).toList();
      state = state.copyWith(
        enabledTools: list,
        isWebSearchEnabled: list.contains('web_search_v2'),
      );
    }
  }

  void setEnabledTools(List<String> tools) {
    state = state.copyWith(
      enabledTools: tools,
      isWebSearchEnabled: tools.contains('web_search_v2'),
    );
  }

  Future<void> pickAndUploadImages() async {
    if (state.isGenerating) return;

    final currentTotal = state.pendingAttachments.length;
    if (currentTotal >= 4) {
      state = state.copyWith(errorMessage: '最多只能同时添加 4 个附件');
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
        if (f.size > 10 * 1024 * 1024) {
          state = state.copyWith(errorMessage: '图片 ${f.name} 超过 10MB 限制');
          continue;
        }
        validFiles.add(f);
      }

      final availableSlots = 4 - currentTotal;
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

    final currentTotal = state.pendingAttachments.length;
    if (currentTotal >= 4) {
      state = state.copyWith(errorMessage: '最多只能同时添加 4 个附件');
      return;
    }

    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowMultiple: true,
        allowedExtensions: [
          'pdf', 'docx', 'txt', 'md', 'markdown', 'csv', 'json', 'xml',
          'yaml', 'yml', 'log', 'ts', 'tsx', 'js', 'jsx', 'vue', 'py',
          'dart', 'java', 'go', 'rs', 'c', 'cpp', 'h', 'sql', 'sh',
          'html', 'css', 'scss', 'env'
        ],
        withData: true,
      );

      if (result == null || result.files.isEmpty) return;

      final validFiles = <PlatformFile>[];
      for (final f in result.files) {
        if (f.size > 10 * 1024 * 1024) {
          state = state.copyWith(errorMessage: '文档 ${f.name} 超过 10MB 限制');
          continue;
        }
        validFiles.add(f);
      }

      final availableSlots = 4 - currentTotal;
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
            isImage: false,
            status: AttachmentUploadStatus.uploading,
          ),
        );
      }

      state = state.copyWith(
        pendingAttachments: [...state.pendingAttachments, ...newItems],
        errorMessage: null,
      );

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
          throw Exception('服务器未返回有效文档解析数据');
        }

        final updatedList = List<AttachmentItem>.from(state.pendingAttachments);
        for (var i = 0; i < newItems.length && i < uploadResults.length; i++) {
          final targetIndex = updatedList.indexWhere((item) => item.id == newItems[i].id);
          if (targetIndex != -1) {
            updatedList[targetIndex] = updatedList[targetIndex].copyWith(
              serverFileId: uploadResults[i].id,
              serverUrl: uploadResults[i].url,
              mimeType: uploadResults[i].mime,
              charCount: uploadResults[i].charCount,
              textContent: uploadResults[i].extractedText,
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
          errorMessage: '文档上传解析失败: ${e.toString().replaceAll('Exception: ', '')}',
        );
      }
    } catch (e) {
      state = state.copyWith(errorMessage: '选取文档失败: $e');
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

    if (state.creditsRemaining < ApiConstants.chatMessageCost) {
      state = state.copyWith(errorMessage: '积分余额不足，单次对话需消耗 10 积分');
      return;
    }

    final hasPendingUpload = attachmentsToSend.any(
      (a) => a.status == AttachmentUploadStatus.uploading,
    );
    if (hasPendingUpload) {
      state = state.copyWith(errorMessage: '附件正在上传解析中，请稍候再发送');
      return;
    }

    final fileIds = attachmentsToSend
        .where((a) => a.serverFileId != null)
        .map((a) => a.serverFileId!)
        .toList();

    final effectiveText = trimmed.isNotEmpty
        ? trimmed
        : (attachmentsToSend.any((a) => a.isImage) ? '请分析我发送的图片' : '请阅读并分析我上传的文档内容');

    final promptBuffer = StringBuffer(effectiveText);
    for (final doc in attachmentsToSend.where(
      (a) => !a.isImage && a.serverFileId == null && a.textContent != null,
    )) {
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
      searchStatus: state.isWebSearchEnabled ? 'searching' : null,
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
    final currentToolCalls = <ToolExecutionRecordModel>[];
    String? currentSearchStatus = state.isWebSearchEnabled ? 'searching' : null;
    List<SearchSourceModel>? currentSources;

    try {
      final stream = await _repository.sendStreamMessage(
        message: fullMessage,
        model: state.selectedModel,
        clientRequestId: clientRequestId,
        sessionId: state.activeSessionId,
        fileIds: fileIds,
        webSearch: state.isWebSearchEnabled,
        enabledTools: state.enabledTools,
        cancelToken: _cancelToken,
      );

      _streamSubscription = stream.listen(
        (chunk) {
          if (chunk.type == 'search_start') {
            currentSearchStatus = 'searching';
          } else if (chunk.type == 'search_sources' || (chunk.type == 'done' && chunk.rawSources != null)) {
            if (chunk.rawSources != null && chunk.rawSources!.isNotEmpty) {
              currentSources = chunk.rawSources!
                  .map((s) => SearchSourceModel.fromJson(s))
                  .toList();
            }
            currentSearchStatus = 'done';
          }

          if (chunk.type == 'tool_result' && chunk.rawTool != null) {
            try {
              final toolRecord = ToolExecutionRecordModel.fromJson(chunk.rawTool!);
              if (!currentToolCalls.any((t) => t.id == toolRecord.id)) {
                currentToolCalls.add(toolRecord);
              }
            } catch (_) {}
          }

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
                searchStatus: currentSearchStatus,
                sources: currentSources ?? msg.sources,
                toolCalls: List<ToolExecutionRecordModel>.from(currentToolCalls),
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
          return msg.copyWith(
            status: MessageStatus.done,
            searchStatus: msg.sources.isNotEmpty ? 'done' : null,
          );
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
