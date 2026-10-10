import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../../core/theme/stitch_tokens.dart';
import '../../domain/tool_model.dart';

/// 单个工具执行结果展示卡片（沉浸式折叠面板）
class ChatToolExecutionCard extends StatefulWidget {
  final ToolExecutionRecordModel toolRecord;

  const ChatToolExecutionCard({
    super.key,
    required this.toolRecord,
  });

  @override
  State<ChatToolExecutionCard> createState() => _ChatToolExecutionCardState();
}

class _ChatToolExecutionCardState extends State<ChatToolExecutionCard> {
  bool _isExpanded = false;

  IconData _resolveToolIcon(String name) {
    switch (name) {
      case 'calculator':
        return Icons.calculate_rounded;
      case 'clock_calendar':
        return Icons.schedule_rounded;
      case 'weather':
        return Icons.wb_sunny_rounded;
      case 'web_search_v2':
        return Icons.language_rounded;
      case 'url_fetcher':
        return Icons.link_rounded;
      case 'code_interpreter':
        return Icons.terminal_rounded;
      default:
        return Icons.extension_rounded;
    }
  }

  String _formatOutput(dynamic output, String? rawOutput) {
    if (rawOutput != null && rawOutput.isNotEmpty) {
      return rawOutput;
    }
    if (output == null) {
      return '无返回值';
    }
    if (output is String) {
      return output;
    }
    try {
      const encoder = JsonEncoder.withIndent('  ');
      return encoder.convert(output);
    } catch (_) {
      return output.toString();
    }
  }

  void _copyToClipboard(String content) {
    Clipboard.setData(ClipboardData(text: content));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('已复制执行结果到剪贴板'),
        duration: Duration(seconds: 1),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final record = widget.toolRecord;
    final isSuccess = record.result.isSuccess;
    final formattedOutput = _formatOutput(record.result.output, record.result.rawOutput);

    return Container(
      margin: const EdgeInsets.only(bottom: 8.0),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(StitchTokens.radiusMd),
        border: Border.all(
          color: isSuccess ? const Color(0xFFE2E8F0) : const Color(0xFFFECACA),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // 卡片头部（点击可展开/折叠）
          Material(
            color: Colors.transparent,
            child: InkWell(
              borderRadius: BorderRadius.circular(StitchTokens.radiusMd),
              onTap: () {
                setState(() {
                  _isExpanded = !_isExpanded;
                });
              },
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 10.0, vertical: 8.0),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(4.0),
                      decoration: BoxDecoration(
                        color: isSuccess ? const Color(0xFFEFF6FF) : const Color(0xFFFEF2F2),
                        borderRadius: BorderRadius.circular(StitchTokens.radiusSm),
                      ),
                      child: Icon(
                        _resolveToolIcon(record.name),
                        size: 14.0,
                        color: isSuccess ? StitchTokens.primaryContainer : StitchTokens.crimsonStop,
                      ),
                    ),
                    const SizedBox(width: 8.0),
                    Expanded(
                      child: Text(
                        record.title,
                        style: const TextStyle(
                          fontSize: 12.0,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF334155),
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 6.0),
                    // 状态胶囊
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6.0, vertical: 1.5),
                      decoration: BoxDecoration(
                        color: isSuccess ? const Color(0xFFECFDF5) : const Color(0xFFFEF2F2),
                        borderRadius: BorderRadius.circular(StitchTokens.radiusFull),
                        border: Border.all(
                          color: isSuccess ? const Color(0xFFA7F3D0) : const Color(0xFFFECDD3),
                        ),
                      ),
                      child: Text(
                        isSuccess ? '成功' : '失败',
                        style: TextStyle(
                          fontSize: 10.0,
                          fontWeight: FontWeight.w600,
                          color: isSuccess ? const Color(0xFF047857) : const Color(0xFFB91C1C),
                        ),
                      ),
                    ),
                    const SizedBox(width: 6.0),
                    // 耗时胶囊
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 5.0, vertical: 1.5),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(StitchTokens.radiusFull),
                      ),
                      child: Text(
                        '${record.result.durationMs}ms',
                        style: const TextStyle(
                          fontSize: 10.0,
                          fontWeight: FontWeight.w500,
                          color: Color(0xFF64748B),
                        ),
                      ),
                    ),
                    const SizedBox(width: 4.0),
                    AnimatedRotation(
                      turns: _isExpanded ? 0.5 : 0.0,
                      duration: const Duration(milliseconds: 200),
                      child: const Icon(
                        Icons.keyboard_arrow_down_rounded,
                        size: 16.0,
                        color: Color(0xFF94A3B8),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),

          // 展开内容区域
          if (_isExpanded) ...[
            const Divider(height: 1.0, color: Color(0xFFE2E8F0)),
            Padding(
              padding: const EdgeInsets.all(10.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // 入参展示（如有）
                  if (record.args.isNotEmpty) ...[
                    const Text(
                      '调用参数:',
                      style: TextStyle(
                        fontSize: 11.0,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF64748B),
                      ),
                    ),
                    const SizedBox(height: 4.0),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(8.0),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(StitchTokens.radiusSm),
                      ),
                      child: Text(
                        const JsonEncoder.withIndent('  ').convert(record.args),
                        style: const TextStyle(
                          fontFamily: 'monospace',
                          fontSize: 11.0,
                          color: Color(0xFF334155),
                        ),
                      ),
                    ),
                    const SizedBox(height: 8.0),
                  ],

                  // 执行结果标题与复制按钮
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        isSuccess ? '执行结果:' : '错误详情:',
                        style: TextStyle(
                          fontSize: 11.0,
                          fontWeight: FontWeight.w600,
                          color: isSuccess ? const Color(0xFF64748B) : const Color(0xFFDC2626),
                        ),
                      ),
                      InkWell(
                        onTap: () => _copyToClipboard(formattedOutput),
                        borderRadius: BorderRadius.circular(StitchTokens.radiusSm),
                        child: const Padding(
                          padding: EdgeInsets.symmetric(horizontal: 4.0, vertical: 2.0),
                          child: Row(
                            children: [
                              Icon(Icons.copy_rounded, size: 11.0, color: Color(0xFF64748B)),
                              SizedBox(width: 2.0),
                              Text(
                                '复制',
                                style: TextStyle(fontSize: 10.0, color: Color(0xFF64748B)),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4.0),

                  // 执行结果代码框
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(8.0),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1E293B),
                      borderRadius: BorderRadius.circular(StitchTokens.radiusSm),
                    ),
                    child: SelectableText(
                      formattedOutput,
                      style: const TextStyle(
                        fontFamily: 'monospace',
                        fontSize: 11.0,
                        height: 1.4,
                        color: Color(0xFFF8FAFC),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// 助手消息内部的工具调用聚合展示容器
class ChatToolExecutionGallery extends StatelessWidget {
  final List<ToolExecutionRecordModel> toolCalls;

  const ChatToolExecutionGallery({
    super.key,
    required this.toolCalls,
  });

  @override
  Widget build(BuildContext context) {
    if (toolCalls.isEmpty) return const SizedBox.shrink();

    return Container(
      margin: const EdgeInsets.only(bottom: 8.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: toolCalls
            .map((rec) => ChatToolExecutionCard(key: ValueKey(rec.id), toolRecord: rec))
            .toList(),
      ),
    );
  }
}
