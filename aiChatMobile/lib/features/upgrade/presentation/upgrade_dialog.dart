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

class _UpgradeDialogState extends State<UpgradeDialog> {
  final UpgradeService _upgradeService = UpgradeService();
  bool _isDownloading = false;
  double _progress = 0.0;
  String _statusText = '';

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
        _statusText = '下载完成，已准备就绪';
      });
      await _upgradeService.launchBrowserDownload(widget.versionInfo.downloadUrl);
    } else {
      setState(() {
        _isDownloading = false;
        _statusText = '应用内下载受限，建议使用浏览器极速下载';
      });
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
                              Text(
                                '版本更新 v${info.latestVersion}',
                                style: const TextStyle(
                                  fontSize: 17.0,
                                  fontWeight: FontWeight.w700,
                                  color: StitchTokens.onSurface,
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
                  onPressed: _isDownloading ? null : _startInAppDownload,
                  child: Text(
                    _isDownloading ? '正在下载更新包...' : '立即升级 (应用内下载)',
                    style: const TextStyle(
                      fontSize: 14.0,
                      fontWeight: FontWeight.w600,
                      color: Colors.white,
                    ),
                  ),
                ),
                const SizedBox(height: 10.0),
                OutlinedButton.icon(
                  onPressed: _launchBrowser,
                  icon: const Icon(Icons.open_in_browser_rounded, size: 16.0),
                  label: const Text(
                    '免设置 · 浏览器极速直链下载',
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
