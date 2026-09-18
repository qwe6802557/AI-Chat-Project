import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/stitch_tokens.dart';
import '../../../shared/widgets/glass_card.dart';
import '../../../shared/widgets/site_icp_footer.dart';
import '../../../shared/widgets/cyber_button.dart';
import '../../auth/providers/auth_provider.dart';
import '../../chat/providers/chat_provider.dart';

/// Stitch 个人中心与账户设置页
class ProfilePage extends ConsumerWidget {
  const ProfilePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authProvider);
    final chatState = ref.watch(chatProvider);
    final user = authState.user;

    return Scaffold(
      backgroundColor: StitchTokens.background,
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20.0),
          onPressed: () => context.pop(),
        ),
        title: const Text(
          '个人中心与账户',
          style: TextStyle(fontSize: 18.0, fontWeight: FontWeight.w600),
        ),
        centerTitle: true,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              GlassCard(
                padding: const EdgeInsets.all(20.0),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 32.0,
                      backgroundColor: StitchTokens.primaryContainer,
                      child: Text(
                        user != null && user.username.isNotEmpty
                            ? user.username[0].toUpperCase()
                            : 'U',
                        style: const TextStyle(
                          fontSize: 24.0,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                        ),
                      ),
                    ),
                    const SizedBox(width: 16.0),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            user?.username ?? '未登录',
                            style: const TextStyle(
                              fontSize: 18.0,
                              fontWeight: FontWeight.w700,
                              color: StitchTokens.onSurface,
                            ),
                          ),
                          const SizedBox(height: 4.0),
                          Text(
                            user?.email ?? '普通账户 (Role: ${user?.role ?? "User"})',
                            style: const TextStyle(
                              fontSize: 13.0,
                              color: StitchTokens.onSurfaceVariant,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16.0),
              GlassCard(
                padding: const EdgeInsets.all(20.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      '算力资产与积分',
                      style: TextStyle(
                        fontSize: 15.0,
                        fontWeight: FontWeight.w600,
                        color: StitchTokens.onSurface,
                      ),
                    ),
                    const SizedBox(height: 16.0),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceAround,
                      children: [
                        _buildStatItem(
                          '可用积分',
                          '${chatState.creditsRemaining}',
                          StitchTokens.primary,
                        ),
                        _buildStatItem(
                          '已消耗',
                          '${user?.credits.consumed ?? 0}',
                          StitchTokens.onSurfaceVariant,
                        ),
                        _buildStatItem(
                          '对话单价',
                          '10/次',
                          StitchTokens.creditAmber,
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24.0),
              CyberButton(
                variant: CyberButtonVariant.stop,
                onPressed: () async {
                  await ref.read(authProvider.notifier).logout();
                  if (context.mounted) {
                    context.go('/login');
                  }
                },
                child: const Text(
                  '退出当前账号',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 15.0,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              const SizedBox(height: 24.0),
              const SiteIcpFooter(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatItem(String label, String value, Color valueColor) {
    return Column(
      children: [
        Text(
          value,
          style: TextStyle(
            fontSize: 20.0,
            fontWeight: FontWeight.w700,
            color: valueColor,
          ),
        ),
        const SizedBox(height: 4.0),
        Text(
          label,
          style: const TextStyle(
            fontSize: 12.0,
            color: StitchTokens.onSurfaceVariant,
          ),
        ),
      ],
    );
  }
}
