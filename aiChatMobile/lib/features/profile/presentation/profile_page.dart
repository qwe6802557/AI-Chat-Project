import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/stitch_tokens.dart';
import '../../../shared/widgets/glass_card.dart';
import '../../../shared/widgets/site_icp_footer.dart';
import '../../../shared/widgets/cyber_button.dart';
import '../../auth/providers/auth_provider.dart';
import '../../chat/providers/chat_provider.dart';
import '../../upgrade/presentation/upgrade_dialog.dart';
import '../../upgrade/services/upgrade_service.dart';
import '../../../core/constants/api_constants.dart';

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
              const SizedBox(height: 16.0),
              GlassCard(
                padding: const EdgeInsets.all(20.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      '智能协同与全渠道台',
                      style: TextStyle(
                        fontSize: 15.0,
                        fontWeight: FontWeight.w600,
                        color: StitchTokens.onSurface,
                      ),
                    ),
                    const SizedBox(height: 10.0),
                    _buildFeatureEntry(
                      context,
                      icon: Icons.account_tree_outlined,
                      iconColor: StitchTokens.primary,
                      iconBg: const Color(0xFFEFF6FF),
                      title: '智能编排工作流',
                      subtitle: '查看 DAG 节点拓扑并应用于当前对话',
                      onTap: () => context.push('/workflows'),
                    ),
                    const Divider(height: 16.0, color: Color(0xFFF1F5F9)),
                    _buildFeatureEntry(
                      context,
                      icon: Icons.timeline_rounded,
                      iconColor: const Color(0xFF4F46E5),
                      iconBg: const Color(0xFFEEF2FF),
                      title: '全链路 Trace 观测',
                      subtitle: '检索执行链路 KPI、Span 瀑布流与脱敏载荷',
                      onTap: () => context.push('/traces'),
                    ),
                    const Divider(height: 16.0, color: Color(0xFFF1F5F9)),
                    _buildFeatureEntry(
                      context,
                      icon: Icons.hub_outlined,
                      iconColor: const Color(0xFF0D9488),
                      iconBg: const Color(0xFFF0FDFA),
                      title: 'IM 智能助理通道',
                      subtitle: '企微/飞书/钉钉/QQ/微信长连接巡检、绑定与审计',
                      onTap: () => context.push('/channels'),
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
                      '应用版本与更新',
                      style: TextStyle(
                        fontSize: 15.0,
                        fontWeight: FontWeight.w600,
                        color: StitchTokens.onSurface,
                      ),
                    ),
                    const SizedBox(height: 12.0),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'ERJ Chat 移动客户端',
                              style: TextStyle(
                                fontSize: 14.0,
                                fontWeight: FontWeight.w600,
                                color: StitchTokens.onSurface,
                              ),
                            ),
                            const SizedBox(height: 2.0),
                            Text(
                              'v${ApiConstants.appVersion} (Build ${ApiConstants.appBuildNumber}) 生产正式版',
                              style: const TextStyle(
                                fontSize: 12.0,
                                color: StitchTokens.onSurfaceVariant,
                              ),
                            ),
                          ],
                        ),
                        OutlinedButton.icon(
                          onPressed: () => _handleCheckUpdate(context),
                          icon: const Icon(Icons.sync_rounded, size: 16.0),
                          label: const Text('检查更新'),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: StitchTokens.primary,
                            side: BorderSide(
                              color: StitchTokens.primary.withValues(alpha: 0.4),
                            ),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(8.0),
                            ),
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12.0,
                              vertical: 8.0,
                            ),
                          ),
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

  Widget _buildFeatureEntry(
    BuildContext context, {
    required IconData icon,
    required Color iconColor,
    required Color iconBg,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return InkWell(
      borderRadius: BorderRadius.circular(10.0),
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 4.0),
        child: Row(
          children: [
            Container(
              width: 36.0,
              height: 36.0,
              decoration: BoxDecoration(
                color: iconBg,
                borderRadius: BorderRadius.circular(10.0),
              ),
              child: Icon(icon, size: 19.0, color: iconColor),
            ),
            const SizedBox(width: 12.0),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 14.0,
                      fontWeight: FontWeight.w600,
                      color: StitchTokens.onSurface,
                    ),
                  ),
                  const SizedBox(height: 2.0),
                  Text(
                    subtitle,
                    style: const TextStyle(
                      fontSize: 11.5,
                      color: StitchTokens.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(
              Icons.chevron_right_rounded,
              size: 18.0,
              color: Color(0xFF94A3B8),
            ),
          ],
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

  Future<void> _handleCheckUpdate(BuildContext context) async {
    final scaffoldMessenger = ScaffoldMessenger.of(context);
    scaffoldMessenger.showSnackBar(
      const SnackBar(
        content: Text('正在连接服务器检查更新...'),
        duration: Duration(seconds: 1),
      ),
    );

    final info = await UpgradeService().checkUpdate(currentVersion: ApiConstants.appVersion);
    if (!context.mounted) return;

    if (info != null && info.hasUpdate) {
      await UpgradeDialog.show(context, info);
    } else if (info != null) {
      scaffoldMessenger.showSnackBar(
        SnackBar(
          content: Text('当前已是最新版本 (v${info.currentVersion})'),
          backgroundColor: StitchTokens.primary,
        ),
      );
    } else {
      scaffoldMessenger.showSnackBar(
        const SnackBar(
          content: Text('检查更新失败，请检查网络连接'),
          backgroundColor: StitchTokens.crimsonStop,
        ),
      );
    }
  }
}
