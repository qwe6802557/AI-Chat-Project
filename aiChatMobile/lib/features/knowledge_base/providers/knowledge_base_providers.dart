import 'dart:async';
import 'dart:typed_data';
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

/// 知识库文档列表与流式轮询通知器
class KbDocumentsNotifier extends FamilyAsyncNotifier<List<DocumentModel>, String> {
  Timer? _pollingTimer;

  @override
  Future<List<DocumentModel>> build(String arg) async {
    final repo = ref.watch(knowledgeBaseRepositoryProvider);
    final docs = await repo.getDocuments(arg);
    _checkPolling(docs);
    return docs;
  }

  void _checkPolling(List<DocumentModel> docs) {
    final hasProcessing = docs.any((d) => d.isProcessing);
    if (hasProcessing && _pollingTimer == null) {
      _startPolling();
    } else if (!hasProcessing && _pollingTimer != null) {
      _stopPolling();
    }
  }

  void _startPolling() {
    _pollingTimer?.cancel();
    _pollingTimer = Timer.periodic(const Duration(seconds: 2), (_) async {
      try {
        final repo = ref.read(knowledgeBaseRepositoryProvider);
        final latestDocs = await repo.getDocuments(arg);
        state = AsyncValue.data(latestDocs);
        _checkPolling(latestDocs);
        // 如果文档解析完毕，联动刷新知识库主列表以更新切片计数
        if (!latestDocs.any((d) => d.isProcessing)) {
          ref.read(knowledgeBasesProvider.notifier).refresh();
        }
      } catch (_) {}
    });
  }

  void _stopPolling() {
    _pollingTimer?.cancel();
    _pollingTimer = null;
  }

  Future<void> refresh() async {
    final repo = ref.read(knowledgeBaseRepositoryProvider);
    final docs = await repo.getDocuments(arg);
    state = AsyncValue.data(docs);
    _checkPolling(docs);
  }

  Future<void> uploadDocument({
    required String fileName,
    Uint8List? bytes,
    String? filePath,
    void Function(double progress)? onProgress,
  }) async {
    final repo = ref.read(knowledgeBaseRepositoryProvider);
    await repo.uploadDocument(
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

    // 上传成功后立即触发列表刷新与轮询检测
    await refresh();
  }

  Future<void> deleteDocument(String docId) async {
    final repo = ref.read(knowledgeBaseRepositoryProvider);
    await repo.deleteDocument(docId);
    final current = state.valueOrNull ?? [];
    state = AsyncValue.data(current.where((d) => d.id != docId).toList());
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
  final List<ChunkModel> results;
  final String? error;

  const SearchTestState({
    this.isLoading = false,
    this.query = '',
    this.results = const [],
    this.error,
  });
}

class SearchTestNotifier extends StateNotifier<SearchTestState> {
  final KnowledgeBaseRepository _repo;

  SearchTestNotifier(this._repo) : super(const SearchTestState());

  Future<void> runSearch({
    required String query,
    required List<String> knowledgeBaseIds,
  }) async {
    if (query.trim().isEmpty) return;
    state = SearchTestState(isLoading: true, query: query, results: state.results);
    try {
      final items = await _repo.searchKnowledgeBase(
        query: query,
        knowledgeBaseIds: knowledgeBaseIds,
        limit: 5,
      );
      state = SearchTestState(isLoading: false, query: query, results: items);
    } catch (e) {
      state = SearchTestState(isLoading: false, query: query, results: [], error: e.toString());
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
