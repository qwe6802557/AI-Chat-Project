import 'package:flutter/material.dart';
import '../../../core/theme/stitch_tokens.dart';
import '../../../shared/widgets/cyber_button.dart';
import '../../../shared/widgets/glass_card.dart';
import '../domain/app_version_model.dart';
import '../services/upgrade_service.dart';

/// Stitch 风格应用内无缝升级对话框
class UpgradeDialog extends StatefulWidget {
  final AppVersionInfo versionInfo;
  final VoidCallback? onDismiss;

  const UpgradeDialog({
    super.key,
    required this.versionInfo,
    this.onDismiss,
  });

  static Future<void> show(BuildContext context, AppVersionInfo versionInfo) {
    return showDialog<void>(
      context: context,
      barrierDismissible: !versionInfo.forceUpdate,
      barrierColor: Colors.black54,
      builder: (context) => UpgradeDialog(versionInfo: versionInfo),
    );
  }

  @override
  State<UpgradeDialog> createState() => _UpgradeDialogState();
}

class _UpgradeDialogState extends State<UpgradeDialog> with WidgetsBindingObserver {
  final UpgradeService _upgradeService = UpgradeService();
  bool _isDownloading = false;
  String? _downloadedPath;
  double _progress = 0.0;
  String _statusText = '';
  bool _hasInstallPermission = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _checkPermission();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _checkPermission();
    }
  }

  Future<void> _checkPermission() async {
    final hasPermission = await _upgradeService.checkInstallPermission();
    if (mounted) {
      setState(() {
        _hasInstallPermission = hasPermission;
      });
    }
  }

  Future<void> _openPermissionSettings() async {
    final opened = await _upgradeService.openInstallPermissionSettings();
    if (!opened && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('无法打开系统设置，请手动前往设置开启安装应用权限')),
      );
    }
  }

  Future<void> _startInAppDownload() async {
    setState(() {
      _isDownloading = true;
      _progress = 0.0;
      _statusText = '准备下载安装包...';
    });

    final path = await _upgradeService.downloadApk(
      widget.versionInfo.downloadUrl,
      onProgress: (received, total) {
        if (total > 0 && mounted) {
          setState(() {
            _progress = received / total;
            final percent = (_progress * 100).toInt();
            final recMb = (received / 1048576).toStringAsFixed(1);
            final totMb = (total / 1048576).toStringAsFixed(1);
            _statusText = '正在下载 $percent% ($recMb MB / $totMb MB)';
          });
        }
      },
    );

    if (!mounted) return;

    if (path != null) {
      setState(() {
        _isDownloading = false;
        _downloadedPath = path;
        _statusText = '安装包下载完成，正在唤起应用安装...';
      });

      final hasPerm = await _upgradeService.checkInstallPermission();
      if (mounted) setState(() => _hasInstallPermission = hasPerm);

      if (hasPerm) {
        final installed = await _upgradeService.installApk(path);
        if (!installed && mounted) {
          setState(() {
            _statusText = '安装包已下载就绪，点击下方按钮开始安装';
          });
        }
      } else if (mounted) {
        setState(() {
          _statusText = '安装包已下载就绪，请先开启安装权限';
        });
      }
    } else {
      setState(() {
        _isDownloading = false;
        _statusText = '应用内下载受限，建议使用备选浏览器下载';
      });
    }
  }

  Future<void> _handleInstall() async {
    if (_downloadedPath == null) return;

    if (!_hasInstallPermission) {
      setState(() {
        _statusText = '请先开启安装未知应用权限后开始安装';
      });
      await _openPermissionSettings();
      return;
    }

    setState(() {
      _statusText = '正在唤起系统安装器...';
    });
    final success = await _upgradeService.installApk(_downloadedPath!);
    if (!success && mounted) {
      setState(() {
        _statusText = '唤起系统安装器失败，请检查安装权限';
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('调起系统安装器失败，请检查是否允许安装应用')),
      );
    }
  }

  Future<void> _launchBrowser() async {
    await _upgradeService.launchBrowserDownload(widget.versionInfo.downloadUrl);
    if (mounted && !widget.versionInfo.forceUpdate) {
      Navigator.of(context).pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    final info = widget.versionInfo;

    return Center(
      child: Material(
        color: Colors.transparent,
        child: Container(
          constraints: const BoxConstraints(maxWidth: 380.0),
          margin: const EdgeInsets.symmetric(horizontal: 24.0),
          child: GlassCard(
            padding: const EdgeInsets.all(24.0),
            border: Border.all(
              color: StitchTokens.primary.withValues(alpha: 0.3),
              width: 1.5,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10.0),
                      decoration: BoxDecoration(
                        color: StitchTokens.primaryContainer.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(12.0),
                      ),
                      child: const Icon(
                        Icons.system_update_rounded,
                        color: StitchTokens.primary,
                        size: 26.0,
                      ),
                    ),
                    const SizedBox(width: 14.0),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Flexible(
                                child: Text(
                                  '版本更新 v${info.latestVersion}',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    fontSize: 16.5,
                                    fontWeight: FontWeight.w700,
                                    color: StitchTokens.onSurface,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8.0),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 6.0,
                                  vertical: 2.0,
                                ),
                                decoration: BoxDecoration(
                                  color: StitchTokens.primaryContainer.withValues(alpha: 0.12),
                                  borderRadius: BorderRadius.circular(4.0),
                                ),
                                child: Text(
                                  info.packageSize,
                                  style: const TextStyle(
                                    fontSize: 11.0,
                                    fontWeight: FontWeight.w600,
                                    color: StitchTokens.primary,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 2.0),
                          Text(
                            '当前版本: v${info.currentVersion}',
                            style: const TextStyle(
                              fontSize: 12.0,
                              color: StitchTokens.onSurfaceVariant,
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (!info.forceUpdate && !_isDownloading)
                      IconButton(
                        icon: const Icon(Icons.close_rounded, size: 20.0),
                        color: StitchTokens.onSurfaceVariant,
                        onPressed: () {
                          widget.onDismiss?.call();
                          Navigator.of(context).pop();
                        },
                      ),
                  ],
                ),
                const SizedBox(height: 18.0),
                const Text(
                  '更新内容与优化日志',
                  style: TextStyle(
                    fontSize: 13.0,
                    fontWeight: FontWeight.w600,
                    color: StitchTokens.primary,
                  ),
                ),
                const SizedBox(height: 8.0),
                Container(
                  padding: const EdgeInsets.all(12.0),
                  decoration: BoxDecoration(
                    color: StitchTokens.surfaceContainerLow,
                    borderRadius: BorderRadius.circular(10.0),
                    border: Border.all(
                      color: StitchTokens.outlineVariant.withValues(alpha: 0.5),
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: info.releaseNotes.map((note) {
                      return Padding(
                        padding: const EdgeInsets.symmetric(vertical: 3.0),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              '• ',
                              style: TextStyle(
                                color: StitchTokens.primary,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            Expanded(
                              child: Text(
                                note,
                                style: const TextStyle(
                                  fontSize: 13.0,
                                  height: 1.4,
                                  color: StitchTokens.onSurface,
                                ),
                              ),
                            ),
                          ],
                        ),
                      );
                    }).toList(),
                  ),
                ),
                const SizedBox(height: 20.0),
                if (_isDownloading) ...[
                  LinearProgressIndicator(
                    value: _progress > 0.0 ? _progress : null,
                    backgroundColor: StitchTokens.surfaceContainer,
                    valueColor: const AlwaysStoppedAnimation<Color>(
                      StitchTokens.primary,
                    ),
                    borderRadius: BorderRadius.circular(4.0),
                  ),
                  const SizedBox(height: 8.0),
                  Text(
                    _statusText,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 12.0,
                      color: StitchTokens.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: 14.0),
                ],
                CyberButton(
                  variant: CyberButtonVariant.primary,
                  onPressed: _isDownloading
                      ? null
                      : (_downloadedPath != null ? _handleInstall : _startInAppDownload),
                  child: Text(
                    _isDownloading
                        ? '正在应用内下载更新包...'
                        : (_downloadedPath != null ? '安装包已就绪 · 点击立即安装' : '立即升级 (应用内直接下载)'),
                    style: const TextStyle(
                      fontSize: 14.0,
                      fontWeight: FontWeight.w600,
                      color: Colors.white,
                    ),
                  ),
                ),
                if (!_isDownloading) ...[
                  const SizedBox(height: 10.0),
                  GestureDetector(
                    onTap: _openPermissionSettings,
                    behavior: HitTestBehavior.opaque,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 2.0),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            _hasInstallPermission
                                ? Icons.shield_outlined
                                : Icons.warning_amber_rounded,
                            size: 14.0,
                            color: _hasInstallPermission
                                ? StitchTokens.primary
                                : const Color(0xFFE11D48),
                          ),
                          const SizedBox(width: 4.0),
                          Text(
                            _hasInstallPermission
                                ? '未开启安装权限？点击去开启安装权限'
                                : '提示：未开启安装权限，点击去开启安装权限',
                            style: TextStyle(
                              fontSize: 12.0,
                              fontWeight: FontWeight.w500,
                              color: _hasInstallPermission
                                  ? StitchTokens.primary
                                  : const Color(0xFFE11D48),
                              decoration: TextDecoration.underline,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 10.0),
                OutlinedButton.icon(
                  onPressed: _launchBrowser,
                  icon: const Icon(Icons.open_in_browser_rounded, size: 16.0),
                  label: const Text(
                    '备选方式 · 浏览器极速直链下载',
                    style: TextStyle(fontSize: 13.0),
                  ),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: StitchTokens.primary,
                    side: BorderSide(
                      color: StitchTokens.primary.withValues(alpha: 0.4),
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10.0),
                    ),
                    padding: const EdgeInsets.symmetric(vertical: 11.0),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
