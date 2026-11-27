import 'dart:async';
import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/knowledge_base_repository.dart';
import '../domain/knowledge_base_model.dart';
import '../domain/document_model.dart';
import '../domain/chunk_model.dart';

/// 上传流式进度状态
class UploadProgressState {
  final String fileName;
  final double progress; // 0.0 ~ 1.0
  final bool isUploading;
  final bool isProcessing;
  final String? error;

  const UploadProgressState({
    this.fileName = '',
    this.progress = 0.0,
    this.isUploading = false,
    this.isProcessing = false,
    this.error,
  });

  UploadProgressState copyWith({
    String? fileName,
    double? progress,
    bool? isUploading,
    bool? isProcessing,
    String? error,
  }) {
    return UploadProgressState(
      fileName: fileName ?? this.fileName,
      progress: progress ?? this.progress,
      isUploading: isUploading ?? this.isUploading,
      isProcessing: isProcessing ?? this.isProcessing,
      error: error,
    );
  }
}

/// 知识库列表异步通知器
class KnowledgeBasesNotifier extends AsyncNotifier<List<KnowledgeBaseModel>> {
  @override
  Future<List<KnowledgeBaseModel>> build() async {
    final repo = ref.watch(knowledgeBaseRepositoryProvider);
    return repo.getKnowledgeBases();
  }

  Future<void> refresh() async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() async {
      final repo = ref.read(knowledgeBaseRepositoryProvider);
      return repo.getKnowledgeBases();
    });
  }

  Future<KnowledgeBaseModel> createKnowledgeBase({
    required String name,
    String description = '',
    String avatar = 'auto_stories',
  }) async {
    final repo = ref.read(knowledgeBaseRepositoryProvider);
    final newKb = await repo.createKnowledgeBase(
      name: name,
      description: description,
      avatar: avatar,
    );
    // 乐观刷新或局部注入
    final current = state.valueOrNull ?? [];
    state = AsyncValue.data([newKb, ...current]);
    return newKb;
  }

  Future<KnowledgeBaseModel> updateKnowledgeBase(
    String id, {
    String? name,
    String? description,
    String? avatar,
  }) async {
    final repo = ref.read(knowledgeBaseRepositoryProvider);
    final updated = await repo.updateKnowledgeBase(
      id,
      name: name,
      description: description,
      avatar: avatar,
    );
    final current = state.valueOrNull ?? [];
    state = AsyncValue.data(
      current.map((item) => item.id == id ? updated : item).toList(),
    );
    return updated;
  }

  Future<void> deleteKnowledgeBase(String id) async {
    final repo = ref.read(knowledgeBaseRepositoryProvider);
    await repo.deleteKnowledgeBase(id);
    final current = state.valueOrNull ?? [];
    state = AsyncValue.data(current.where((item) => item.id != id).toList());
  }
}

final knowledgeBasesProvider =
    AsyncNotifierProvider<KnowledgeBasesNotifier, List<KnowledgeBaseModel>>(
  () => KnowledgeBasesNotifier(),
);

/// 知识库文档列表与 SSE 实时进度通知器
class KbDocumentsNotifier extends FamilyAsyncNotifier<List<DocumentModel>, String> {
  StreamSubscription<DocumentProgressEvent>? _eventSub;
  CancelToken? _sseCancelToken;
  Timer? _reconnectTimer;
  bool _disposed = false;
  int _reconnectAttempts = 0;

  @override
  Future<List<DocumentModel>> build(String arg) async {
    ref.onDispose(() {
      _disposed = true;
      _stopEventStream();
    });
    final repo = ref.watch(knowledgeBaseRepositoryProvider);
    final docs = await repo.getDocuments(arg);
    _syncEventStream(docs);
    return docs;
  }

  void _syncEventStream(List<DocumentModel> docs) {
    final hasProcessing = docs.any((d) => d.isProcessing);
    if (hasProcessing && _eventSub == null && _reconnectTimer == null) {
      _startEventStream();
    } else if (!hasProcessing) {
      _stopEventStream();
    }
  }

  void _startEventStream() {
    if (_disposed) return;
    _stopEventStream();

    final cancelToken = CancelToken();
    _sseCancelToken = cancelToken;
    final repo = ref.read(knowledgeBaseRepositoryProvider);

    _eventSub = repo
        .watchDocumentEvents(arg, cancelToken: cancelToken)
        .listen(
      (event) {
        _reconnectAttempts = 0;
        _applyProgressEvent(event);
      },
      onError: (Object err) {
        if (_disposed || cancelToken.isCancelled) return;
        _eventSub = null;
        _sseCancelToken = null;
        _scheduleReconnect();
      },
      onDone: () {
        if (_disposed || cancelToken.isCancelled) return;
        _eventSub = null;
        _sseCancelToken = null;
        final docs = state.valueOrNull ?? const [];
        if (docs.any((d) => d.isProcessing)) {
          _scheduleReconnect();
        }
      },
    );
  }

  void _scheduleReconnect() {
    if (_disposed || _reconnectTimer != null) return;
    final currentDocs = state.valueOrNull ?? const [];
    if (!currentDocs.any((d) => d.isProcessing)) return;

    final delaySec = (_reconnectAttempts + 1) * 2;
    final clampedSec = delaySec > 12 ? 12 : delaySec;
    _reconnectAttempts += 1;

    _reconnectTimer = Timer(Duration(seconds: clampedSec), () async {
      _reconnectTimer = null;
      if (_disposed) return;
      try {
        await refresh();
      } catch (_) {
        _scheduleReconnect();
      }
    });
  }

  void _applyProgressEvent(DocumentProgressEvent event) {
    if (event.type == 'error') return;
    final current = state.valueOrNull;
    if (current == null) return;

    if (event.type == 'snapshot') {
      if (event.documents.isEmpty) return;
      final snapMap = {for (final d in event.documents) d.documentId: d};
      final updated = current.map((doc) {
        final snap = snapMap[doc.id];
        if (snap == null) return doc;
        return doc.copyWith(
          status: snap.status,
          stage: snap.stage,
          progress: snap.progress,
          chunkCount: snap.chunkCount,
          charCount: snap.charCount,
          errorMessage: snap.errorMessage,
          clearErrorMessage: snap.errorMessage == null,
        );
      }).toList();
      state = AsyncValue.data(updated);
      _syncEventStream(updated);
      return;
    }

    final targetId = event.documentId;
    if (targetId == null || targetId.isEmpty) return;

    final exists = current.any((d) => d.id == targetId);
    if (!exists) {
      unawaited(refresh());
      return;
    }

    final updated = current.map((doc) {
      if (doc.id != targetId) return doc;
      return doc.copyWith(
        status: event.status ?? doc.status,
        stage: event.stage ?? doc.stage,
        progress: event.progress ?? doc.progress,
        processedChunks: event.processedChunks,
        totalChunks: event.totalChunks,
        processedVisuals: event.processedVisuals,
        totalVisuals: event.totalVisuals,
        chunkCount: event.chunkCount ?? doc.chunkCount,
        charCount: event.charCount ?? doc.charCount,
        errorMessage: event.errorMessage,
        clearErrorMessage: event.type != 'failed' && event.errorMessage == null,
      );
    }).toList();

    state = AsyncValue.data(updated);
    if (event.type == 'completed') {
      ref.read(knowledgeBasesProvider.notifier).refresh();
    }
    _syncEventStream(updated);
  }

  void _stopEventStream() {
    _reconnectTimer?.cancel();
    _reconnectTimer = null;
    _sseCancelToken?.cancel('disposed');
    _sseCancelToken = null;
    _eventSub?.cancel();
    _eventSub = null;
  }

  Future<void> refresh() async {
    final repo = ref.read(knowledgeBaseRepositoryProvider);
    final docs = await repo.getDocuments(arg);
    if (_disposed) return;
    state = AsyncValue.data(docs);
    _syncEventStream(docs);
  }

  Future<void> uploadDocument({
    required String fileName,
    Uint8List? bytes,
    String? filePath,
    void Function(double progress)? onProgress,
  }) async {
    final repo = ref.read(knowledgeBaseRepositoryProvider);
    final created = await repo.uploadDocument(
      arg,
      fileName: fileName,
      bytes: bytes,
      filePath: filePath,
      onProgress: (sent, total) {
        if (total > 0 && onProgress != null) {
          onProgress(sent / total);
        }
      },
    );

    final current = state.valueOrNull ?? [];
    final next = [
      created,
      ...current.where((d) => d.id != created.id),
    ];
    state = AsyncValue.data(next);
    _syncEventStream(next);
  }

  Future<void> retryDocument(String docId) async {
    final repo = ref.read(knowledgeBaseRepositoryProvider);
    final retried = await repo.retryDocument(docId);
    final current = state.valueOrNull ?? [];
    final next = current.map((d) => d.id == docId ? retried : d).toList();
    state = AsyncValue.data(next);
    _syncEventStream(next);
  }

  Future<void> deleteDocument(String docId) async {
    final repo = ref.read(knowledgeBaseRepositoryProvider);
    await repo.deleteDocument(docId);
    final current = state.valueOrNull ?? [];
    final next = current.where((d) => d.id != docId).toList();
    state = AsyncValue.data(next);
    _syncEventStream(next);
    ref.read(knowledgeBasesProvider.notifier).refresh();
  }
}

final kbDocumentsProvider =
    AsyncNotifierProvider.family<KbDocumentsNotifier, List<DocumentModel>, String>(
  () => KbDocumentsNotifier(),
);

/// 上传进度全局状态
final kbUploadProgressProvider = StateProvider<UploadProgressState>((ref) {
  return const UploadProgressState();
});

/// 检索测试状态
class SearchTestState {
  final bool isLoading;
  final String query;
  final String mode;
  final bool enableRerank;
  final double minScore;
  final List<ChunkModel> results;
  final String? error;

  const SearchTestState({
    this.isLoading = false,
    this.query = '',
    this.mode = 'hybrid',
    this.enableRerank = true,
    this.minScore = 0.0,
    this.results = const [],
    this.error,
  });

  SearchTestState copyWith({
    bool? isLoading,
    String? query,
    String? mode,
    bool? enableRerank,
    double? minScore,
    List<ChunkModel>? results,
    String? error,
  }) {
    return SearchTestState(
      isLoading: isLoading ?? this.isLoading,
      query: query ?? this.query,
      mode: mode ?? this.mode,
      enableRerank: enableRerank ?? this.enableRerank,
      minScore: minScore ?? this.minScore,
      results: results ?? this.results,
      error: error,
    );
  }
}

class SearchTestNotifier extends StateNotifier<SearchTestState> {
  final KnowledgeBaseRepository _repo;

  SearchTestNotifier(this._repo) : super(const SearchTestState());

  void setMode(String mode) {
    state = state.copyWith(mode: mode, error: state.error);
  }

  void setEnableRerank(bool enabled) {
    state = state.copyWith(enableRerank: enabled, error: state.error);
  }

  Future<void> runSearch({
    required String query,
    required List<String> knowledgeBaseIds,
  }) async {
    if (query.trim().isEmpty) return;
    state = state.copyWith(isLoading: true, query: query, error: null);
    try {
      final items = await _repo.searchKnowledgeBase(
        query: query,
        knowledgeBaseIds: knowledgeBaseIds,
        limit: 6,
        mode: state.mode,
        minScore: state.minScore > 0 ? state.minScore : null,
        enableRerank: state.enableRerank,
      );
      state = state.copyWith(isLoading: false, query: query, results: items, error: null);
    } catch (e) {
      state = state.copyWith(isLoading: false, query: query, results: [], error: e.toString());
    }
  }

  void reset() {
    state = const SearchTestState();
  }
}

final kbSearchTestProvider =
    StateNotifierProvider.autoDispose<SearchTestNotifier, SearchTestState>((ref) {
  final repo = ref.watch(knowledgeBaseRepositoryProvider);
  return SearchTestNotifier(repo);
});
