import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../features/auth/presentation/login_page.dart';
import '../../features/auth/providers/auth_provider.dart';
import '../../features/chat/presentation/chat_page.dart';
import '../../features/history/presentation/history_page.dart';
import '../../features/video/presentation/video_page.dart';
import '../../features/voice/presentation/voice_page.dart';
import '../../features/explore/presentation/explore_page.dart';
import '../../features/profile/presentation/profile_page.dart';
import '../../features/chat/providers/chat_provider.dart';
import '../../shared/widgets/animated_branch_fade.dart';
import '../../shared/widgets/floating_glass_nav_bar.dart';

final GlobalKey<NavigatorState> rootNavigatorKey = GlobalKey<NavigatorState>();

/// 路由监听器：桥接 Riverpod 认证状态与 GoRouter 的 refreshListenable 机制
class RouterNotifier extends ChangeNotifier {
  final Ref _ref;

  RouterNotifier(this._ref) {
    _ref.listen<AuthState>(
      authProvider,
      (_, __) => notifyListeners(),
    );
  }
}

final routerNotifierProvider = Provider<RouterNotifier>((ref) {
  final notifier = RouterNotifier(ref);
  ref.onDispose(notifier.dispose);
  return notifier;
});

final routerProvider = Provider<GoRouter>((ref) {
  final notifier = ref.watch(routerNotifierProvider);

  return GoRouter(
    navigatorKey: rootNavigatorKey,
    refreshListenable: notifier,
    initialLocation: '/chat',
    redirect: (context, state) {
      final authState = ref.read(authProvider);
      final isLoggingIn = state.uri.path == '/login';

      if (authState.status == AuthStatus.initial || authState.status == AuthStatus.loading) {
        return null;
      }

      if (!authState.isAuthenticated) {
        return isLoggingIn ? null : '/login';
      }

      if (isLoggingIn) {
        return '/chat';
      }

      return null;
    },
    routes: [
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginPage(),
      ),
      GoRoute(
        path: '/profile',
        builder: (context, state) => const ProfilePage(),
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) {
          return Scaffold(
            body: Stack(
              children: [
                Positioned.fill(
                  child: AnimatedBranchFade(
                    currentIndex: navigationShell.currentIndex,
                    child: navigationShell,
                  ),
                ),
                Positioned(
                  left: 0,
                  right: 0,
                  bottom: 0,
                  child: FloatingGlassNavBar(
                    currentIndex: navigationShell.currentIndex,
                    onTabSelected: (index) {
                      if (index == navigationShell.currentIndex) {
                        // 重复点击当前已激活的 Tab
                        if (index == 0) {
                          ref.read(chatScrollToBottomTriggerProvider.notifier).state++;
                        }
                      } else {
                        navigationShell.goBranch(
                          index,
                          initialLocation: index == navigationShell.currentIndex,
                        );
                      }
                    },
                  ),
                ),
              ],
            ),
          );
        },
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/chat',
                builder: (context, state) => const ChatPage(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/history',
                builder: (context, state) => const HistoryPage(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/video',
                builder: (context, state) => const VideoPage(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/voice',
                builder: (context, state) => const VoicePage(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/explore',
                builder: (context, state) => const ExplorePage(),
              ),
            ],
          ),
        ],
      ),
    ],
  );
});
