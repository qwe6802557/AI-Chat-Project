import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../../core/theme/stitch_tokens.dart';
import '../../domain/chat_message_model.dart';

/// 联网搜索状态指示与来源卡片画廊
class ChatSearchSourceGallery extends StatefulWidget {
  final List<SearchSourceModel> sources;
  final String? searchStatus;

  const ChatSearchSourceGallery({
    super.key,
    required this.sources,
    this.searchStatus,
  });

  @override
  State<ChatSearchSourceGallery> createState() => _ChatSearchSourceGalleryState();
}

class _ChatSearchSourceGalleryState extends State<ChatSearchSourceGallery>
    with SingleTickerProviderStateMixin {
  late AnimationController _animController;
  final Set<int> _failedIconIds = {};

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  String _formatDomain(String url, String sitename) {
    if (sitename.isNotEmpty) return sitename;
    try {
      final uri = Uri.parse(url);
      return uri.host.replaceFirst(RegExp(r'^www\.'), '');
    } catch (_) {
      return '网页来源';
    }
  }

  Future<void> _openSourceUrl(String url) async {
    final uri = Uri.tryParse(url);
    if (uri != null) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  Widget _buildSearchingRadar() {
    return Container(
      margin: const EdgeInsets.only(bottom: 10.0),
      padding: const EdgeInsets.symmetric(horizontal: 12.0, vertical: 8.0),
      decoration: BoxDecoration(
        color: const Color(0xFFEFF6FF),
        borderRadius: BorderRadius.circular(StitchTokens.radiusMd),
        border: Border.all(color: const Color(0xFFBFDBFE)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          FadeTransition(
            opacity: Tween<double>(begin: 0.4, end: 1.0).animate(_animController),
            child: const Icon(
              Icons.travel_explore_rounded,
              size: 16.0,
              color: StitchTokens.primary,
            ),
          ),
          const SizedBox(width: 8.0),
          const Text(
            '正在深度联网检索中...',
            style: TextStyle(
              fontSize: 12.0,
              fontWeight: FontWeight.w500,
              color: StitchTokens.primary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSourceCard(SearchSourceModel source, int index) {
    final displayId = source.id > 0 ? source.id : (index + 1);
    final domain = _formatDomain(source.url, source.sitename);
    final hasFailedIcon = _failedIconIds.contains(source.id);

    return InkWell(
      borderRadius: BorderRadius.circular(StitchTokens.radiusMd),
      onTap: () => _openSourceUrl(source.url),
      child: Container(
        width: 156.0,
        padding: const EdgeInsets.all(8.0),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(StitchTokens.radiusMd),
          border: Border.all(color: const Color(0xFFE2E8F0)),
          boxShadow: const [
            BoxShadow(
              color: Color.fromRGBO(15, 23, 42, 0.04),
              blurRadius: 4.0,
              offset: Offset(0, 1),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(StitchTokens.radiusSm),
                  child: (source.icon != null && source.icon!.isNotEmpty && !hasFailedIcon)
                      ? Image.network(
                          source.icon!,
                          width: 14.0,
                          height: 14.0,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) {
                            WidgetsBinding.instance.addPostFrameCallback((_) {
                              if (mounted) setState(() => _failedIconIds.add(source.id));
                            });
                            return const Icon(
                              Icons.public_rounded,
                              size: 14.0,
                              color: StitchTokens.outline,
                            );
                          },
                        )
                      : const Icon(
                          Icons.public_rounded,
                          size: 14.0,
                          color: StitchTokens.outline,
                        ),
                ),
                const SizedBox(width: 4.0),
                Expanded(
                  child: Text(
                    domain,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 10.0,
                      color: StitchTokens.outline,
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 4.0, vertical: 1.0),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(StitchTokens.radiusSm),
                  ),
                  child: Text(
                    '[$displayId]',
                    style: const TextStyle(
                      fontSize: 9.0,
                      fontWeight: FontWeight.w600,
                      color: StitchTokens.onSurfaceVariant,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4.0),
            Text(
              source.title,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 11.0,
                fontWeight: FontWeight.w500,
                color: StitchTokens.onSurface,
                height: 1.3,
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isSearching = widget.searchStatus == 'searching';
    final hasSources = widget.sources.isNotEmpty;

    if (!isSearching && !hasSources) {
      return const SizedBox.shrink();
    }

    if (isSearching && !hasSources) {
      return _buildSearchingRadar();
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 12.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.language_rounded,
                size: 14.0,
                color: StitchTokens.primaryContainer,
              ),
              const SizedBox(width: 4.0),
              Text(
                '参考了 ${widget.sources.length} 个网页来源',
                style: const TextStyle(
                  fontSize: 11.0,
                  fontWeight: FontWeight.w600,
                  color: StitchTokens.primaryContainer,
                ),
              ),
              if (isSearching) ...[
                const SizedBox(width: 6.0),
                const SizedBox(
                  width: 10.0,
                  height: 10.0,
                  child: CircularProgressIndicator(
                    strokeWidth: 1.5,
                    color: StitchTokens.primary,
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 8.0),
          SizedBox(
            height: 68.0,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: widget.sources.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8.0),
              itemBuilder: (context, index) => _buildSourceCard(widget.sources[index], index),
            ),
          ),
        ],
      ),
    );
  }
}
