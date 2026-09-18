import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../features/auth/presentation/login_page.dart';
import '../../features/auth/providers/auth_provider.dart';
import '../../features/chat/presentation/chat_page.dart';
import '../../features/history/presentation/history_page.dart';
import '../../features/voice/presentation/voice_page.dart';
import '../../features/explore/presentation/explore_page.dart';
import '../../features/profile/presentation/profile_page.dart';
import '../../shared/widgets/floating_glass_nav_bar.dart';

final GlobalKey<NavigatorState> _rootNavigatorKey = GlobalKey<NavigatorState>();
final GlobalKey<NavigatorState> _shellNavigatorKey = GlobalKey<NavigatorState>();

final routerProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authProvider);

  return GoRouter(
    navigatorKey: _rootNavigatorKey,
    initialLocation: '/chat',
    redirect: (context, state) {
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
      ShellRoute(
        navigatorKey: _shellNavigatorKey,
        builder: (context, state, child) {
          final location = state.uri.path;
          int currentIndex = 0;
          if (location.startsWith('/history')) {
            currentIndex = 1;
          } else if (location.startsWith('/voice')) {
            currentIndex = 2;
          } else if (location.startsWith('/explore')) {
            currentIndex = 3;
          }

          return Scaffold(
            body: Stack(
              children: [
                Positioned.fill(child: child),
                Positioned(
                  left: 0,
                  right: 0,
                  bottom: 0,
                  child: FloatingGlassNavBar(
                    currentIndex: currentIndex,
                    onTabSelected: (index) {
                      switch (index) {
                        case 0:
                          context.go('/chat');
                          break;
                        case 1:
                          context.go('/history');
                          break;
                        case 2:
                          context.go('/voice');
                          break;
                        case 3:
                          context.go('/explore');
                          break;
                      }
                    },
                  ),
                ),
              ],
            ),
          );
        },
        routes: [
          GoRoute(
            path: '/chat',
            builder: (context, state) => const ChatPage(),
          ),
          GoRoute(
            path: '/history',
            builder: (context, state) => const HistoryPage(),
          ),
          GoRoute(
            path: '/voice',
            builder: (context, state) => const VoicePage(),
          ),
          GoRoute(
            path: '/explore',
            builder: (context, state) => const ExplorePage(),
          ),
        ],
      ),
    ],
  );
});
