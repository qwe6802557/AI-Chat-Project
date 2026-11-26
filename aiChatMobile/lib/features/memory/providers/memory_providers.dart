import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/memory_repository.dart';
import '../domain/memory_models.dart';

/// 记忆工坊 UI 聚合状态
class MemoryVaultState {
  final AgentCoreProfileModel? profile;
  final List<AgentDailyMemoryModel> dailyItems;
  final int dailyTotal;
  final String? selectedCategory;
  final String searchKeyword;
  final bool profileLoading;
  final bool dailyLoading;
  final bool isSavingProfile;
  final bool isCreatingMemory;
  final bool isDistilling;
  final String? errorMessage;

  const MemoryVaultState({
    this.profile,
    this.dailyItems = const [],
    this.dailyTotal = 0,
    this.selectedCategory,
    this.searchKeyword = '',
    this.profileLoading = false,
    this.dailyLoading = false,
    this.isSavingProfile = false,
    this.isCreatingMemory = false,
    this.isDistilling = false,
    this.errorMessage,
  });

  MemoryVaultState copyWith({
    AgentCoreProfileModel? profile,
    List<AgentDailyMemoryModel>? dailyItems,
    int? dailyTotal,
    String? selectedCategory,
    bool clearCategory = false,
    String? searchKeyword,
    bool? profileLoading,
    bool? dailyLoading,
    bool? isSavingProfile,
    bool? isCreatingMemory,
    bool? isDistilling,
    String? errorMessage,
    bool clearError = false,
  }) {
    return MemoryVaultState(
      profile: profile ?? this.profile,
      dailyItems: dailyItems ?? this.dailyItems,
      dailyTotal: dailyTotal ?? this.dailyTotal,
      selectedCategory:
          clearCategory ? null : (selectedCategory ?? this.selectedCategory),
      searchKeyword: searchKeyword ?? this.searchKeyword,
      profileLoading: profileLoading ?? this.profileLoading,
      dailyLoading: dailyLoading ?? this.dailyLoading,
      isSavingProfile: isSavingProfile ?? this.isSavingProfile,
      isCreatingMemory: isCreatingMemory ?? this.isCreatingMemory,
      isDistilling: isDistilling ?? this.isDistilling,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}

/// 记忆工坊状态通知器
class MemoryVaultNotifier extends Notifier<MemoryVaultState> {
  Timer? _searchDebounce;

  @override
  MemoryVaultState build() {
    ref.onDispose(() {
      _searchDebounce?.cancel();
    });
    return const MemoryVaultState();
  }

  Future<void> loadAll() async {
    await Future.wait([loadProfile(), loadDailyMemories()]);
  }

  Future<void> loadProfile() async {
    state = state.copyWith(profileLoading: true, clearError: true);
    try {
      final repo = ref.read(memoryRepositoryProvider);
      final profile = await repo.getCoreProfile();
      state = state.copyWith(profile: profile, profileLoading: false);
    } catch (e) {
      state = state.copyWith(
        profileLoading: false,
        errorMessage: '获取核心画像失败: $e',
      );
    }
  }

  Future<void> loadDailyMemories() async {
    state = state.copyWith(dailyLoading: true, clearError: true);
    try {
      final repo = ref.read(memoryRepositoryProvider);
      final res = await repo.getDailyMemories(
        category: state.selectedCategory,
        keyword: state.searchKeyword,
        limit: 50,
      );
      state = state.copyWith(
        dailyItems: res.items,
        dailyTotal: res.total,
        dailyLoading: false,
      );
    } catch (e) {
      state = state.copyWith(
        dailyLoading: false,
        errorMessage: '获取情境记忆失败: $e',
      );
    }
  }

  Future<void> setCategory(String? category) async {
    if (category == null || category.isEmpty) {
      state = state.copyWith(clearCategory: true);
    } else {
      state = state.copyWith(selectedCategory: category);
    }
    await loadDailyMemories();
  }

  void setSearchKeyword(String keyword) {
    state = state.copyWith(searchKeyword: keyword);
    _searchDebounce?.cancel();
    _searchDebounce = Timer(const Duration(milliseconds: 300), () {
      loadDailyMemories();
    });
  }

  Future<void> searchImmediately(String keyword) async {
    _searchDebounce?.cancel();
    state = state.copyWith(searchKeyword: keyword);
    await loadDailyMemories();
  }

  Future<bool> saveProfileSummary(String rawSummary) async {
    state = state.copyWith(isSavingProfile: true, clearError: true);
    try {
      final repo = ref.read(memoryRepositoryProvider);
      final updated = await repo.updateCoreProfile(rawSummary: rawSummary);
      state = state.copyWith(profile: updated, isSavingProfile: false);
      return true;
    } catch (e) {
      state = state.copyWith(
        isSavingProfile: false,
        errorMessage: '保存核心画像失败: $e',
      );
      return false;
    }
  }

  Future<UpsertDailyMemoryResult?> createMemory({
    required MemoryCategory category,
    required String content,
  }) async {
    state = state.copyWith(isCreatingMemory: true, clearError: true);
    try {
      final repo = ref.read(memoryRepositoryProvider);
      final result = await repo.createDailyMemory(
        category: category,
        content: content,
      );
      state = state.copyWith(isCreatingMemory: false);
      await loadDailyMemories();
      return result;
    } catch (e) {
      state = state.copyWith(
        isCreatingMemory: false,
        errorMessage: '保存记忆失败: $e',
      );
      return null;
    }
  }

  Future<bool> deleteMemory(String id) async {
    final prevItems = List<AgentDailyMemoryModel>.from(state.dailyItems);
    final prevTotal = state.dailyTotal;
    state = state.copyWith(
      dailyItems: prevItems.where((item) => item.id != id).toList(),
      dailyTotal: prevTotal > 0 ? prevTotal - 1 : 0,
      clearError: true,
    );
    try {
      final repo = ref.read(memoryRepositoryProvider);
      await repo.deleteDailyMemory(id);
      return true;
    } catch (e) {
      state = state.copyWith(
        dailyItems: prevItems,
        dailyTotal: prevTotal,
        errorMessage: '删除记忆失败: $e',
      );
      return false;
    }
  }

  Future<bool> triggerDistill() async {
    state = state.copyWith(isDistilling: true, clearError: true);
    try {
      final repo = ref.read(memoryRepositoryProvider);
      final updated = await repo.triggerDistill();
      state = state.copyWith(
        profile: updated ?? state.profile,
        isDistilling: false,
      );
      await loadDailyMemories();
      return true;
    } catch (e) {
      state = state.copyWith(
        isDistilling: false,
        errorMessage: '增量蒸馏失败: $e',
      );
      return false;
    }
  }
}

final memoryVaultProvider =
    NotifierProvider<MemoryVaultNotifier, MemoryVaultState>(
  () => MemoryVaultNotifier(),
);
