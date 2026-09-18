import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/constants/api_constants.dart';
import '../../core/theme/stitch_tokens.dart';

/// 工信部备案合规页脚组件
class SiteIcpFooter extends StatelessWidget {
  const SiteIcpFooter({super.key});

  Future<void> _launchIcpSite() async {
    final uri = Uri.parse(ApiConstants.icpOfficialUrl);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 16.0),
      child: Center(
        child: GestureDetector(
          onTap: _launchIcpSite,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                ApiConstants.icpLicenseNumber,
                style: const TextStyle(
                  fontSize: 12.0,
                  color: StitchTokens.onSurfaceVariant,
                  decoration: TextDecoration.none,
                ),
              ),
              const SizedBox(width: 4.0),
              const Icon(
                Icons.open_in_new_rounded,
                size: 12.0,
                color: StitchTokens.outline,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
