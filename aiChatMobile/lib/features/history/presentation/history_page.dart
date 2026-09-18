import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/stitch_tokens.dart';
import '../../../shared/widgets/glass_card.dart';
import '../providers/chat_provider.dart';

/// Stitch 会话历史管理页面
class HistoryPage extends ConsumerWidget {
  const HistoryPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final chatState = ref.watch(chatProvider);
    final sessions = chatState.sessions;

    return Scaffold(
      backgroundColor: StitchTokens.background,
      appBar: AppBar(
        title: const Text(
          '会话历史',
          style: TextStyle(fontSize: 18.0, fontWeight: FontWeight.w600),
        ),
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.add_rounded, size: 24.0, color: StitchTokens.primary),
            tooltip: '新建对话',
            onPressed: () {
              ref.read(chatProvider.notifier).createNewSession();
              context.go('/chat');
            },
          ),
        ],
      ),
      body: SafeArea(
        child: sessions.isEmpty
            ? Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(
                      Icons.folder_open_rounded,
                      size: 48.0,
                      color: StitchTokens.outlineVariant,
                    ),
                    const SizedBox(height: 16.0),
                    const Text(
                      '暂无历史会话',
                      style: TextStyle(fontSize: 15.0, color: StitchTokens.onSurfaceVariant),
                    ),
                    const SizedBox(height: 16.0),
                    ElevatedButton.icon(
                      onPressed: () {
                        ref.read(chatProvider.notifier).createNewSession();
                        context.go('/chat');
                      },
                      icon: const Icon(Icons.add_rounded, size: 18.0),
                      label: const Text('开启新会话'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: StitchTokens.primary,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(StitchTokens.radiusFull),
                        ),
                      ),
                    ),
                  ],
                ),
              )
            : ListView.builder(
                padding: const EdgeInsets.fromLTRB(16.0, 8.0, 16.0, 88.0),
                itemCount: sessions.length,
                itemBuilder: (context, index) {
                  final session = sessions[index];
                  final isActive = session.id == chatState.activeSessionId;

                  return Dismissible(
                    key: Key(session.id),
                    direction: DismissDirection.endToStart,
                    background: Container(
                      alignment: Alignment.centerRight,
                      padding: const EdgeInsets.only(right: 20.0),
                      decoration: BoxDecoration(
                        color: StitchTokens.crimsonStop,
                        borderRadius: BorderRadius.circular(StitchTokens.radiusXl),
                      ),
                      child: const Icon(Icons.delete_outline_rounded, color: Colors.white),
                    ),
                    onDismissed: (_) {
                      ref.read(chatProvider.notifier).deleteSession(session.id);
                    },
                    child: Container(
                      margin: const EdgeInsets.only(bottom: 10.0),
                      child: GlassCard(
                        padding: const EdgeInsets.all(16.0),
                        backgroundColor: isActive
                            ? StitchTokens.primaryContainer.withValues(alpha: 0.12)
                            : null,
                        border: isActive
                            ? Border.all(color: StitchTokens.primary, width: 1.5)
                            : null,
                        onTap: () {
                          ref.read(chatProvider.notifier).selectSession(session.id);
                          context.go('/chat');
                        },
                        child: Row(
                          children: [
                            Container(
                              width: 40.0,
                              height: 40.0,
                              decoration: BoxDecoration(
                                color: (isActive
                                        ? StitchTokens.primary
                                        : StitchTokens.primaryContainer)
                                    .withValues(alpha: 0.15),
                                borderRadius: BorderRadius.circular(10.0),
                              ),
                              child: Icon(
                                Icons.chat_bubble_outline_rounded,
                                color: isActive ? StitchTokens.primary : StitchTokens.outline,
                                size: 20.0,
                              ),
                            ),
                            const SizedBox(width: 12.0),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    session.title,
                                    style: TextStyle(
                                      fontSize: 15.0,
                                      fontWeight:
                                          isActive ? FontWeight.w700 : FontWeight.w600,
                                      color: StitchTokens.onSurface,
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  const SizedBox(height: 4.0),
                                  Text(
                                    session.lastMessagePreview ?? '暂无消息预览',
                                    style: const TextStyle(
                                      fontSize: 12.0,
                                      color: StitchTokens.onSurfaceVariant,
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ],
                              ),
                            ),
                            const Icon(
                              Icons.chevron_right_rounded,
                              color: StitchTokens.outlineVariant,
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                },
              ),
      ),
    );
  }
}
