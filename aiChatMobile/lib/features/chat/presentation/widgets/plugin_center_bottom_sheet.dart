import 'package:flutter/material.dart';
import '../../../../core/theme/stitch_tokens.dart';
import '../../domain/tool_model.dart';

/// 插件工具中心底部弹出抽屉
class PluginCenterBottomSheet extends StatelessWidget {
  final List<String> enabledTools;
  final ValueChanged<String> onToggleTool;
  final ValueChanged<List<String>> onSetTools;

  const PluginCenterBottomSheet({
    super.key,
    required this.enabledTools,
    required this.onToggleTool,
    required this.onSetTools,
  });

  static Future<void> show(
    BuildContext context, {
    required List<String> enabledTools,
    required ValueChanged<String> onToggleTool,
    required ValueChanged<List<String>> onSetTools,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => PluginCenterBottomSheet(
        enabledTools: enabledTools,
        onToggleTool: onToggleTool,
        onSetTools: onSetTools,
      ),
    );
  }

  IconData _resolveToolIcon(String iconName) {
    switch (iconName) {
      case 'calculate':
        return Icons.calculate_rounded;
      case 'schedule':
        return Icons.schedule_rounded;
      case 'wb_sunny':
        return Icons.wb_sunny_rounded;
      case 'language':
        return Icons.language_rounded;
      case 'link':
        return Icons.link_rounded;
      case 'terminal':
        return Icons.terminal_rounded;
      default:
        return Icons.extension_rounded;
    }
  }

  String _resolveCategoryLabel(String category) {
    switch (category) {
      case 'data':
        return '计算数据';
      case 'network':
        return '网络检索';
      case 'system':
        return '系统环境';
      default:
        return '实用工具';
    }
  }

  @override
  Widget build(BuildContext context) {
    final tools = BuiltinTools.defaults;

    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(StitchTokens.radius2Xl)),
        boxShadow: [
          BoxShadow(
            color: Color.fromRGBO(0, 0, 0, 0.12),
            blurRadius: 20.0,
            offset: Offset(0, -4),
          ),
        ],
      ),
      padding: EdgeInsets.fromLTRB(
        20.0,
        12.0,
        20.0,
        MediaQuery.of(context).padding.bottom + 16.0,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // 顶部小横条手柄
          Center(
            child: Container(
              width: 36.0,
              height: 4.0,
              decoration: BoxDecoration(
                color: const Color(0xFFE2E8F0),
                borderRadius: BorderRadius.circular(StitchTokens.radiusFull),
              ),
            ),
          ),
          const SizedBox(height: 14.0),

          // 头部标题与关闭按钮
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: const [
                  Text(
                    '插件工具中心',
                    style: TextStyle(
                      fontSize: 16.0,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF0F172A),
                    ),
                  ),
                  SizedBox(height: 2.0),
                  Text(
                    '配置在对话中自动生效的轻量扩展工具',
                    style: TextStyle(
                      fontSize: 12.0,
                      color: Color(0xFF64748B),
                    ),
                  ),
                ],
              ),
              IconButton(
                icon: const Icon(Icons.close_rounded, size: 20.0, color: Color(0xFF94A3B8)),
                onPressed: () => Navigator.of(context).pop(),
                splashRadius: 20.0,
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
              ),
            ],
          ),
          const SizedBox(height: 12.0),

          // 快捷批量操作条
          Row(
            children: [
              InkWell(
                onTap: () {
                  final allIds = tools.map((t) => t.id).toList();
                  onSetTools(allIds);
                },
                borderRadius: BorderRadius.circular(StitchTokens.radiusSm),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 6.0, vertical: 4.0),
                  child: Text(
                    '全部启用',
                    style: TextStyle(
                      fontSize: 12.0,
                      fontWeight: FontWeight.w600,
                      color: StitchTokens.primary,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8.0),
              InkWell(
                onTap: () {
                  onSetTools(['web_search_v2']);
                },
                borderRadius: BorderRadius.circular(StitchTokens.radiusSm),
                child: const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 6.0, vertical: 4.0),
                  child: Text(
                    '重置为默认',
                    style: TextStyle(
                      fontSize: 12.0,
                      fontWeight: FontWeight.w500,
                      color: Color(0xFF64748B),
                    ),
                  ),
                ),
              ),
              const Spacer(),
              Text(
                '已启用 ${enabledTools.length}/${tools.length}',
                style: const TextStyle(
                  fontSize: 11.0,
                  fontWeight: FontWeight.w500,
                  color: Color(0xFF94A3B8),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8.0),
          const Divider(height: 1.0, color: Color(0xFFF1F5F9)),
          const SizedBox(height: 8.0),

          // 工具列表
          Flexible(
            child: ListView.separated(
              shrinkWrap: true,
              physics: const BouncingScrollPhysics(),
              itemCount: tools.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8.0),
              itemBuilder: (ctx, index) {
                final tool = tools[index];
                final isEnabled = enabledTools.contains(tool.id);

                return Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12.0, vertical: 10.0),
                  decoration: BoxDecoration(
                    color: isEnabled ? const Color(0xFFF8FAFC) : const Color(0xFFFAFAFA),
                    borderRadius: BorderRadius.circular(StitchTokens.radiusLg),
                    border: Border.all(
                      color: isEnabled ? const Color(0xFFBFDBFE) : const Color(0xFFE2E8F0),
                    ),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 38.0,
                        height: 38.0,
                        decoration: BoxDecoration(
                          color: isEnabled ? const Color(0xFFEFF6FF) : const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(StitchTokens.radiusMd),
                        ),
                        child: Icon(
                          _resolveToolIcon(tool.icon),
                          size: 20.0,
                          color: isEnabled ? StitchTokens.primaryContainer : const Color(0xFF64748B),
                        ),
                      ),
                      const SizedBox(width: 12.0),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Text(
                                  tool.title,
                                  style: TextStyle(
                                    fontSize: 13.0,
                                    fontWeight: FontWeight.w600,
                                    color: isEnabled ? const Color(0xFF0F172A) : const Color(0xFF475467),
                                  ),
                                ),
                                const SizedBox(width: 6.0),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 5.0, vertical: 1.0),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFF1F5F9),
                                    borderRadius: BorderRadius.circular(StitchTokens.radiusFull),
                                  ),
                                  child: Text(
                                    _resolveCategoryLabel(tool.category),
                                    style: const TextStyle(
                                      fontSize: 9.0,
                                      fontWeight: FontWeight.w500,
                                      color: Color(0xFF64748B),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 2.0),
                            Text(
                              tool.description,
                              style: const TextStyle(
                                fontSize: 11.0,
                                color: Color(0xFF64748B),
                                height: 1.3,
                              ),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8.0),
                      Switch.adaptive(
                        value: isEnabled,
                        onChanged: (_) => onToggleTool(tool.id),
                        activeTrackColor: StitchTokens.primary,
                        activeThumbColor: Colors.white,
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
