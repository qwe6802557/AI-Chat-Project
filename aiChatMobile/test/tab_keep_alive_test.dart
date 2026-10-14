import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:ai_chat_mobile/features/chat/providers/chat_provider.dart';
import 'package:ai_chat_mobile/shared/widgets/animated_branch_fade.dart';
import 'package:ai_chat_mobile/shared/widgets/floating_glass_nav_bar.dart';

void main() {
  group('AnimatedBranchFade Component Tests', () {
    testWidgets('Renders child and handles index change with 150ms fade', (tester) async {
      int currentIndex = 0;

      await tester.pumpWidget(
        MaterialApp(
          home: StatefulBuilder(
            builder: (context, setState) {
              return Scaffold(
                body: AnimatedBranchFade(
                  currentIndex: currentIndex,
                  child: Text('Content for index $currentIndex'),
                ),
                floatingActionButton: FloatingActionButton(
                  onPressed: () => setState(() => currentIndex = 1),
                  child: const Icon(Icons.swap_horiz),
                ),
              );
            },
          ),
        ),
      );

      expect(find.text('Content for index 0'), findsOneWidget);

      // Trigger index switch
      await tester.tap(find.byType(FloatingActionButton));
      await tester.pump(); // first frame of fade animation
      expect(find.text('Content for index 1'), findsOneWidget);

      await tester.pump(const Duration(milliseconds: 160));
      expect(find.text('Content for index 1'), findsOneWidget);
    });
  });

  group('StatefulShellRoute Tab Keep-Alive Tests', () {
    testWidgets('Switching branches keeps widgets alive without unmounting', (tester) async {
      int chatInitCount = 0;
      int chatDisposeCount = 0;

      final router = GoRouter(
        initialLocation: '/chat',
        routes: [
          StatefulShellRoute.indexedStack(
            builder: (context, state, navigationShell) {
              return Scaffold(
                body: AnimatedBranchFade(
                  currentIndex: navigationShell.currentIndex,
                  child: navigationShell,
                ),
                bottomNavigationBar: FloatingGlassNavBar(
                  currentIndex: navigationShell.currentIndex,
                  onTabSelected: (index) {
                    navigationShell.goBranch(
                      index,
                      initialLocation: index == navigationShell.currentIndex,
                    );
                  },
                ),
              );
            },
            branches: [
              StatefulShellBranch(
                routes: [
                  GoRoute(
                    path: '/chat',
                    builder: (context, state) => _StateTrackerWidget(
                      title: 'Chat Branch',
                      onInit: () => chatInitCount++,
                      onDispose: () => chatDisposeCount++,
                    ),
                  ),
                ],
              ),
              StatefulShellBranch(
                routes: [
                  GoRoute(
                    path: '/history',
                    builder: (context, state) => const Text('History Branch'),
                  ),
                ],
              ),
              StatefulShellBranch(
                routes: [
                  GoRoute(
                    path: '/video',
                    builder: (context, state) => const Text('Video Branch'),
                  ),
                ],
              ),
              StatefulShellBranch(
                routes: [
                  GoRoute(
                    path: '/voice',
                    builder: (context, state) => const Text('Voice Branch'),
                  ),
                ],
              ),
              StatefulShellBranch(
                routes: [
                  GoRoute(
                    path: '/explore',
                    builder: (context, state) => const Text('Explore Branch'),
                  ),
                ],
              ),
            ],
          ),
        ],
      );

      await tester.pumpWidget(MaterialApp.router(routerConfig: router));
      expect(find.text('Chat Branch'), findsOneWidget);
      expect(chatInitCount, 1);
      expect(chatDisposeCount, 0);

      // Switch to History tab (index 1)
      await tester.tap(find.text('历史'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 160));
      expect(find.text('History Branch'), findsOneWidget);
      // Chat widget MUST NOT be disposed!
      expect(chatDisposeCount, 0);

      // Switch to Video tab (index 2)
      await tester.tap(find.text('视频'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 160));
      expect(find.text('Video Branch'), findsOneWidget);
      expect(chatDisposeCount, 0);

      // Switch back to Chat tab (index 0)
      await tester.tap(find.text('对话'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 160));
      expect(find.text('Chat Branch'), findsOneWidget);

      // Chat widget was kept alive! Init count is STILL 1, Dispose count is 0!
      expect(chatInitCount, 1);
      expect(chatDisposeCount, 0);
    });

    testWidgets('Re-tapping active Chat tab triggers chatScrollToBottomTriggerProvider', (tester) async {
      int reTapTriggerCount = 0;

      final container = ProviderContainer();
      container.listen<int>(chatScrollToBottomTriggerProvider, (_, next) {
        reTapTriggerCount = next;
      });

      final router = GoRouter(
        initialLocation: '/chat',
        routes: [
          StatefulShellRoute.indexedStack(
            builder: (context, state, navigationShell) {
              return Scaffold(
                body: navigationShell,
                bottomNavigationBar: FloatingGlassNavBar(
                  currentIndex: navigationShell.currentIndex,
                  onTabSelected: (index) {
                    if (index == navigationShell.currentIndex) {
                      if (index == 0) {
                        container.read(chatScrollToBottomTriggerProvider.notifier).state++;
                      }
                    } else {
                      navigationShell.goBranch(index);
                    }
                  },
                ),
              );
            },
            branches: [
              StatefulShellBranch(
                routes: [
                  GoRoute(
                    path: '/chat',
                    builder: (context, state) => const Text('Chat Page'),
                  ),
                ],
              ),
              StatefulShellBranch(
                routes: [
                  GoRoute(
                    path: '/history',
                    builder: (context, state) => const Text('History Page'),
                  ),
                ],
              ),
            ],
          ),
        ],
      );

      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: MaterialApp.router(routerConfig: router),
        ),
      );

      expect(reTapTriggerCount, 0);

      // Re-tap Chat tab while already on Chat
      await tester.tap(find.text('对话'));
      await tester.pump();
      expect(reTapTriggerCount, 1);

      // Re-tap again
      await tester.tap(find.text('对话'));
      await tester.pump();
      expect(reTapTriggerCount, 2);
    });
  });
}

class _StateTrackerWidget extends StatefulWidget {
  final String title;
  final VoidCallback onInit;
  final VoidCallback onDispose;

  const _StateTrackerWidget({
    required this.title,
    required this.onInit,
    required this.onDispose,
  });

  @override
  State<_StateTrackerWidget> createState() => _StateTrackerWidgetState();
}

class _StateTrackerWidgetState extends State<_StateTrackerWidget> with AutomaticKeepAliveClientMixin {
  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    widget.onInit();
  }

  @override
  void dispose() {
    widget.onDispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    return Text(widget.title);
  }
}
