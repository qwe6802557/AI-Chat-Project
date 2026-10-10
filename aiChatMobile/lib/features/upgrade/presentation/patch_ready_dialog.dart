import 'package:flutter/material.dart';
import '../../../core/theme/stitch_tokens.dart';
import '../../../shared/widgets/cyber_button.dart';
import '../../../shared/widgets/glass_card.dart';

/// Shorebird 代码热补丁就绪温和提示对话框
class PatchReadyDialog extends StatelessWidget {
  final int? patchNumber;
  final VoidCallback onRestart;
  final VoidCallback? onDismiss;

  const PatchReadyDialog({
    super.key,
    this.patchNumber,
    required this.onRestart,
    this.onDismiss,
  });

  /// 弹出补丁就绪提示框
  static Future<void> show(
    BuildContext context, {
    int? patchNumber,
    required VoidCallback onRestart,
    VoidCallback? onDismiss,
  }) {
    return showDialog<void>(
      context: context,
      barrierDismissible: true,
      barrierColor: Colors.black54,
      builder: (context) => PatchReadyDialog(
        patchNumber: patchNumber,
        onRestart: onRestart,
        onDismiss: onDismiss,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Material(
        color: Colors.transparent,
        child: Container(
          constraints: const BoxConstraints(maxWidth: 360.0),
          margin: const EdgeInsets.symmetric(horizontal: 24.0),
          child: GlassCard(
            padding: const EdgeInsets.all(22.0),
            border: Border.all(
              color: StitchTokens.primary.withValues(alpha: 0.35),
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
                        Icons.bolt_rounded,
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
                              const Text(
                                '新功能已就绪',
                                style: TextStyle(
                                  fontSize: 17.0,
                                  fontWeight: FontWeight.w700,
                                  color: StitchTokens.onSurface,
                                ),
                              ),
                              if (patchNumber != null) ...[
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
                                    'Patch #$patchNumber',
                                    style: const TextStyle(
                                      fontSize: 11.0,
                                      fontWeight: FontWeight.w600,
                                      color: StitchTokens.primary,
                                    ),
                                  ),
                                ),
                              ],
                            ],
                          ),
                          const SizedBox(height: 2.0),
                          const Text(
                            '无感增量补丁已在后台自动部署',
                            style: TextStyle(
                              fontSize: 12.0,
                              color: StitchTokens.onSurfaceVariant,
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close_rounded, size: 20.0),
                      color: StitchTokens.onSurfaceVariant,
                      onPressed: () {
                        onDismiss?.call();
                        Navigator.of(context).pop();
                      },
                    ),
                  ],
                ),
                const SizedBox(height: 16.0),
                Container(
                  padding: const EdgeInsets.all(12.0),
                  decoration: BoxDecoration(
                    color: StitchTokens.surfaceContainerLow,
                    borderRadius: BorderRadius.circular(10.0),
                    border: Border.all(
                      color: StitchTokens.outlineVariant.withValues(alpha: 0.5),
                    ),
                  ),
                  child: const Row(
                    children: [
                      Icon(
                        Icons.check_circle_outline_rounded,
                        color: StitchTokens.primary,
                        size: 18.0,
                      ),
                      SizedBox(width: 10.0),
                      Expanded(
                        child: Text(
                          '最新优化已更新完毕，无需重新安装 APK。重启应用即可立即生效。',
                          style: TextStyle(
                            fontSize: 12.5,
                            height: 1.4,
                            color: StitchTokens.onSurface,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20.0),
                CyberButton(
                  variant: CyberButtonVariant.primary,
                  onPressed: () {
                    Navigator.of(context).pop();
                    onRestart();
                  },
                  child: const Text(
                    '立即重启生效',
                    style: TextStyle(
                      fontSize: 14.0,
                      fontWeight: FontWeight.w600,
                      color: Colors.white,
                    ),
                  ),
                ),
                const SizedBox(height: 10.0),
                TextButton(
                  onPressed: () {
                    onDismiss?.call();
                    Navigator.of(context).pop();
                  },
                  child: const Text(
                    '稍后 / 下次启动自动生效',
                    style: TextStyle(
                      fontSize: 13.0,
                      color: StitchTokens.onSurfaceVariant,
                    ),
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
