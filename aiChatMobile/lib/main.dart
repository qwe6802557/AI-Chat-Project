import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/router/app_router.dart';
import 'core/theme/stitch_theme.dart';

import 'features/upgrade/services/update_coordinator.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();

  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
      systemNavigationBarColor: Colors.transparent,
      systemNavigationBarIconBrightness: Brightness.dark,
    ),
  );

  runApp(
    const ProviderScope(
      child: AiChatMobileApp(),
    ),
  );
}

/// AI-Chat 移动端主应用组件
class AiChatMobileApp extends ConsumerStatefulWidget {
  const AiChatMobileApp({super.key});

  @override
  ConsumerState<AiChatMobileApp> createState() => _AiChatMobileAppState();
}

class _AiChatMobileAppState extends ConsumerState<AiChatMobileApp> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Future.delayed(const Duration(milliseconds: 1500), () {
        if (!mounted) return;
        ref.read(updateCoordinatorProvider).checkForUpdates();
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(routerProvider);

    return MaterialApp.router(
      title: 'ERJ Chat',
      debugShowCheckedModeBanner: false,
      theme: StitchTheme.lightTheme,
      routerConfig: router,
    );
  }
}
