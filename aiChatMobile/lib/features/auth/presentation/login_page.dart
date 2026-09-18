import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/stitch_tokens.dart';
import '../../../shared/widgets/glass_card.dart';
import '../../../shared/widgets/cyber_button.dart';
import '../../../shared/widgets/site_icp_footer.dart';
import '../data/auth_repository.dart';
import '../providers/auth_provider.dart';

/// Stitch 科技毛玻璃登录页面
class LoginPage extends ConsumerStatefulWidget {
  const LoginPage({super.key});

  @override
  ConsumerState<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends ConsumerState<LoginPage> {
  final _usernameController = TextEditingController();
  final _passwordController = TextEditingController();
  final _captchaController = TextEditingController();

  String? _captchaId;
  ImageProvider? _captchaImageProvider;
  bool _isLoadingCaptcha = false;

  @override
  void initState() {
    super.initState();
    _refreshCaptcha();
  }

  @override
  void dispose() {
    _usernameController.dispose();
    _passwordController.dispose();
    _captchaController.dispose();
    super.dispose();
  }

  Future<void> _refreshCaptcha() async {
    setState(() => _isLoadingCaptcha = true);
    try {
      final repo = ref.read(authRepositoryProvider);
      final res = await repo.getCaptcha();
      final base64Raw = res.captchaImage.contains(',')
          ? res.captchaImage.split(',')[1]
          : res.captchaImage;
      final bytes = base64Decode(base64Raw);

      if (mounted) {
        setState(() {
          _captchaId = res.captchaId;
          _captchaImageProvider = MemoryImage(bytes);
          _isLoadingCaptcha = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() => _isLoadingCaptcha = false);
      }
    }
  }

  Future<void> _handleLogin() async {
    final username = _usernameController.text.trim();
    final password = _passwordController.text;
    final captcha = _captchaController.text.trim();

    if (username.isEmpty || password.isEmpty || captcha.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('请填写完整的账号、密码和验证码')),
      );
      return;
    }

    if (_captchaId == null) {
      _refreshCaptcha();
      return;
    }

    try {
      await ref.read(authProvider.notifier).login(
            username: username,
            password: password,
            captcha: captcha,
            captchaId: _captchaId!,
          );
    } catch (e) {
      _refreshCaptcha();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString().replaceAll('Exception: ', '')),
            backgroundColor: StitchTokens.crimsonStop,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);
    final isLoading = authState.status == AuthStatus.loading;

    return Scaffold(
      backgroundColor: StitchTokens.background,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 32.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 32.0),
              Center(
                child: Container(
                  width: 64.0,
                  height: 64.0,
                  decoration: BoxDecoration(
                    color: StitchTokens.surfaceGlassDark,
                    borderRadius: BorderRadius.circular(StitchTokens.radiusXl),
                    boxShadow: [
                      BoxShadow(
                        color: StitchTokens.primaryGlow.withValues(alpha: 0.25),
                        blurRadius: 20.0,
                      ),
                    ],
                  ),
                  child: const Icon(
                    Icons.auto_awesome_rounded,
                    color: StitchTokens.primaryGlow,
                    size: 32.0,
                  ),
                ),
              ),
              const SizedBox(height: 20.0),
              const Center(
                child: Text(
                  'AI Spark',
                  style: TextStyle(
                    fontSize: 28.0,
                    fontWeight: FontWeight.w700,
                    letterSpacing: -0.5,
                    color: StitchTokens.onSurface,
                  ),
                ),
              ),
              const SizedBox(height: 6.0),
              const Center(
                child: Text(
                  'Deep Tech Glass Intelligence',
                  style: TextStyle(
                    fontSize: 13.0,
                    color: StitchTokens.onSurfaceVariant,
                  ),
                ),
              ),
              const SizedBox(height: 32.0),
              GlassCard(
                padding: const EdgeInsets.all(24.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    TextField(
                      controller: _usernameController,
                      decoration: const InputDecoration(
                        labelText: '账号 / 邮箱',
                        prefixIcon: Icon(Icons.person_outline_rounded),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.all(Radius.circular(12.0)),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16.0),
                    TextField(
                      controller: _passwordController,
                      obscureText: true,
                      decoration: const InputDecoration(
                        labelText: '密码',
                        prefixIcon: Icon(Icons.lock_outline_rounded),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.all(Radius.circular(12.0)),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16.0),
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _captchaController,
                            decoration: const InputDecoration(
                              labelText: '图形验证码',
                              prefixIcon: Icon(Icons.verified_user_outlined),
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.all(Radius.circular(12.0)),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12.0),
                        GestureDetector(
                          onTap: _isLoadingCaptcha ? null : _refreshCaptcha,
                          child: Container(
                            width: 110.0,
                            height: 52.0,
                            decoration: BoxDecoration(
                              color: StitchTokens.surfaceContainerLow,
                              borderRadius: BorderRadius.circular(12.0),
                              border: Border.all(color: StitchTokens.outlineVariant),
                            ),
                            child: _isLoadingCaptcha
                                ? const Center(
                                    child: SizedBox(
                                      width: 20.0,
                                      height: 20.0,
                                      child: CircularProgressIndicator(strokeWidth: 2.0),
                                    ),
                                  )
                                : (_captchaImageProvider != null
                                    ? ClipRRect(
                                        borderRadius: BorderRadius.circular(12.0),
                                        child: Image(
                                          image: _captchaImageProvider!,
                                          fit: BoxFit.fill,
                                        ),
                                      )
                                    : const Center(
                                        child: Text(
                                          '点击刷新',
                                          style: TextStyle(fontSize: 12.0, color: StitchTokens.outline),
                                        ),
                                      )),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 24.0),
                    CyberButton(
                      onPressed: isLoading ? null : _handleLogin,
                      child: isLoading
                          ? const SizedBox(
                              width: 20.0,
                              height: 20.0,
                              child: CircularProgressIndicator(
                                color: Colors.white,
                                strokeWidth: 2.0,
                              ),
                            )
                          : const Text(
                              '立即登录',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 16.0,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                    ),
                  ],
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
}
