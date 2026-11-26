import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ai_chat_mobile/features/memory/data/memory_repository.dart';
import 'package:ai_chat_mobile/features/memory/domain/memory_models.dart';
import 'package:ai_chat_mobile/features/memory/presentation/memory_vault_page.dart';
import 'package:ai_chat_mobile/features/memory/presentation/widgets/daily_memory_card.dart';
import 'package:ai_chat_mobile/features/memory/providers/memory_providers.dart';

class FakeMemoryRepository implements MemoryRepository {
  AgentCoreProfileModel profile = const AgentCoreProfileModel(
    id: 'cp-1',
    userId: 'u-1',
    preferences: {'code_style': 'concise'},
    facts: {'db': 'pgvector 0.8.7'},
    rawSummary: '偏好极简注释与 TS 严格类型',
    version: 3,
    createdAt: '2026-11-26T00:00:00Z',
    updatedAt: '2026-11-26T08:00:00Z',
  );

  List<AgentDailyMemoryModel> items = [
    const AgentDailyMemoryModel(
      id: 'dm-1',
      userId: 'u-1',
      dateKey: '2026-11-26',
      category: 'decision',
      content: '采用 pgvector HNSW 与 pg_trgm 双路混合下推检索',
      isArchived: false,
      createdAt: '2026-11-26T01:00:00Z',
      updatedAt: '2026-11-26T01:00:00Z',
    ),
    const AgentDailyMemoryModel(
      id: 'dm-2',
      userId: 'u-1',
      dateKey: '2026-11-26',
      category: 'todo',
      content: '完成移动端记忆工坊页面联调',
      isArchived: true,
      createdAt: '2026-11-26T02:00:00Z',
      updatedAt: '2026-11-26T02:00:00Z',
    ),
  ];

  String? lastKeyword;
  String? lastCategory;

  @override
  Future<AgentCoreProfileModel> getCoreProfile() async => profile;

  @override
  Future<AgentCoreProfileModel> updateCoreProfile({
    required String rawSummary,
  }) async {
    profile = AgentCoreProfileModel(
      id: profile.id,
      userId: profile.userId,
      preferences: profile.preferences,
      facts: profile.facts,
      rawSummary: rawSummary,
      version: profile.version + 1,
      createdAt: profile.createdAt,
      updatedAt: '2026-11-26T09:00:00Z',
    );
    return profile;
  }

  @override
  Future<DailyMemoryPageModel> getDailyMemories({
    String? category,
    String? keyword,
    int page = 1,
    int limit = 50,
  }) async {
    lastCategory = category;
    lastKeyword = keyword;

    var filtered = items;
    if (category != null && category.isNotEmpty) {
      filtered = filtered.where((e) => e.category == category).toList();
    }
    if (keyword != null && keyword.trim().isNotEmpty) {
      filtered = filtered
          .map(
            (e) => AgentDailyMemoryModel(
              id: e.id,
              userId: e.userId,
              dateKey: e.dateKey,
              category: e.category,
              content: e.content,
              isArchived: e.isArchived,
              score: 0.89,
              createdAt: e.createdAt,
              updatedAt: e.updatedAt,
            ),
          )
          .toList();
    }
    return DailyMemoryPageModel(
      items: filtered,
      total: filtered.length,
      page: page,
      limit: limit,
      totalPages: filtered.isEmpty ? 0 : 1,
    );
  }

  @override
  Future<UpsertDailyMemoryResult> createDailyMemory({
    required MemoryCategory category,
    required String content,
  }) async {
    final newItem = AgentDailyMemoryModel(
      id: 'dm-3',
      userId: 'u-1',
      dateKey: '2026-11-26',
      category: category.code,
      content: content,
      isArchived: false,
      createdAt: '2026-11-26T03:00:00Z',
      updatedAt: '2026-11-26T03:00:00Z',
    );
    items = [newItem, ...items];
    return UpsertDailyMemoryResult(item: newItem, action: 'created');
  }

  @override
  Future<void> deleteDailyMemory(String id) async {
    items = items.where((e) => e.id != id).toList();
  }

  @override
  Future<AgentCoreProfileModel?> triggerDistill() async {
    profile = AgentCoreProfileModel(
      id: profile.id,
      userId: profile.userId,
      preferences: profile.preferences,
      facts: profile.facts,
      rawSummary: '${profile.rawSummary}\n- 新增蒸馏条目',
      version: profile.version + 1,
      createdAt: profile.createdAt,
      updatedAt: '2026-11-26T09:30:00Z',
    );
    return profile;
  }
}

void main() {
  group('Memory Models Serialization Tests', () {
    test('DailyMemoryPageModel 与 UpsertDailyMemoryResult 正确反序列化', () {
      final page = DailyMemoryPageModel.fromJson({
        'items': [
          {
            'id': 'dm-10',
            'userId': 'u-1',
            'dateKey': '2026-11-26',
            'category': 'todo',
            'content': '回归验证移动端',
            'isArchived': false,
            'score': 0.9234,
          },
        ],
        'total': 1,
        'page': 1,
        'limit': 50,
        'totalPages': 1,
      });

      expect(page.items, hasLength(1));
      expect(page.items.first.categoryBadge, 'TODO');
      expect(page.items.first.score, closeTo(0.9234, 0.0001));

      final upsert = UpsertDailyMemoryResult.fromJson({
        'action': 'merged',
        'similarity': 0.9412,
        'item': {
          'id': 'dm-10',
          'userId': 'u-1',
          'dateKey': '2026-11-26',
          'category': 'todo',
          'content': '回归验证移动端',
          'isArchived': false,
        },
      });
      expect(upsert.isMerged, true);
      expect(upsert.similarity, closeTo(0.9412, 0.0001));
    });
  });

  group('MemoryVaultNotifier State Tests', () {
    test('支持加载画像、关键词检索、手动创建与乐观删除', () async {
      final fakeRepo = FakeMemoryRepository();
      final container = ProviderContainer(
        overrides: [memoryRepositoryProvider.overrideWithValue(fakeRepo)],
      );
      addTearDown(container.dispose);

      final notifier = container.read(memoryVaultProvider.notifier);
      await notifier.loadAll();

      var state = container.read(memoryVaultProvider);
      expect(state.profile?.version, 3);
      expect(state.dailyItems, hasLength(2));

      await notifier.searchImmediately('pgvector');
      state = container.read(memoryVaultProvider);
      expect(fakeRepo.lastKeyword, 'pgvector');
      expect(state.dailyItems.first.score, closeTo(0.89, 0.001));

      final created = await notifier.createMemory(
        category: MemoryCategory.fact,
        content: '后端使用 BullMQ 处理知识库解析',
      );
      expect(created?.isMerged, false);
      expect(container.read(memoryVaultProvider).dailyItems, hasLength(3));

      await notifier.deleteMemory('dm-1');
      expect(
        container
            .read(memoryVaultProvider)
            .dailyItems
            .any((e) => e.id == 'dm-1'),
        false,
      );
    });
  });

  group('MemoryVaultPage & DailyMemoryCard Widget Tests', () {
    testWidgets('DailyMemoryCard 正确渲染相关度徽标与已蒸馏标签', (tester) async {
      var deleted = false;
      const item = AgentDailyMemoryModel(
        id: 'dm-card',
        userId: 'u-1',
        dateKey: '2026-11-26',
        category: 'preference',
        content: '界面严禁多余装饰边框',
        isArchived: true,
        score: 0.87,
        createdAt: '2026-11-26T00:00:00Z',
        updatedAt: '2026-11-26T00:00:00Z',
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: DailyMemoryCard(
              item: item,
              showScore: true,
              onDelete: () => deleted = true,
            ),
          ),
        ),
      );

      expect(find.text('PREFERENCE'), findsOneWidget);
      expect(find.text('已蒸馏'), findsOneWidget);
      expect(find.text('相关度 87%'), findsOneWidget);

      await tester.tap(find.byIcon(Icons.delete_outline_rounded));
      expect(deleted, true);
    });

    testWidgets('MemoryVaultPage 加载并展示核心画像与每日情境页签', (tester) async {
      final fakeRepo = FakeMemoryRepository();
      await tester.pumpWidget(
        ProviderScope(
          overrides: [memoryRepositoryProvider.overrideWithValue(fakeRepo)],
          child: const MaterialApp(
            home: MemoryVaultPage(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('记忆工坊'), findsOneWidget);
      expect(find.text('v3'), findsOneWidget);
      expect(find.text('核心画像 (Layer 3)'), findsOneWidget);
      expect(find.text('每日情境 (2)'), findsOneWidget);

      await tester.tap(find.text('每日情境 (2)'));
      await tester.pumpAndSettle();

      expect(find.text('采用 pgvector HNSW 与 pg_trgm 双路混合下推检索'), findsOneWidget);
      expect(find.text('记一条'), findsOneWidget);
    });
  });
}
