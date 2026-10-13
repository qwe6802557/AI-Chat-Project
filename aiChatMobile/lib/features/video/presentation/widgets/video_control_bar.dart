import 'dart:convert';
import 'package:flutter/material.dart';
import '../../../../core/constants/api_constants.dart';
import '../../../../core/theme/stitch_tokens.dart';

/// AI 视频底部悬浮创作控制面板
class VideoControlBar extends StatelessWidget {
  final TextEditingController promptController;
  final String aspectRatio;
  final String activeModelId;
  final String activeModeLabel;
  final String? referenceImageDataUrl;
  final String? referenceImageName;
  final bool isGenerating;
  final ValueChanged<String> onPromptChanged;
  final ValueChanged<String> onAspectRatioChanged;
  final VoidCallback onPickReferenceImage;
  final VoidCallback onClearReferenceImage;
  final VoidCallback onSubmit;

  const VideoControlBar({
    super.key,
    required this.promptController,
    required this.aspectRatio,
    required this.activeModelId,
    required this.activeModeLabel,
    this.referenceImageDataUrl,
    this.referenceImageName,
    required this.isGenerating,
    required this.onPromptChanged,
    required this.onAspectRatioChanged,
    required this.onPickReferenceImage,
    required this.onClearReferenceImage,
    required this.onSubmit,
  });

  static const List<Map<String, String>> _aspectOptions = [
    {'value': '16:9', 'label': '16:9 横屏'},
    {'value': '9:16', 'label': '9:16 竖屏'},
    {'value': '1:1', 'label': '1:1 方屏'},
  ];

  Widget _buildReferenceThumb() {
    if (referenceImageDataUrl == null || referenceImageDataUrl!.isEmpty) {
      return const SizedBox.shrink();
    }
    if (referenceImageDataUrl!.startsWith('data:image')) {
      final commaIndex = referenceImageDataUrl!.indexOf(',');
      if (commaIndex != -1) {
        try {
          final bytes = base64Decode(referenceImageDataUrl!.substring(commaIndex + 1));
          return ClipRRect(
            borderRadius: BorderRadius.circular(6.0),
            child: Image.memory(
              bytes,
              width: 24.0,
              height: 24.0,
              fit: BoxFit.cover,
            ),
          );
        } catch (_) {
          // 解码异常回退至图标展示
        }
      }
    }
    return const Icon(Icons.image_rounded, size: 16.0, color: StitchTokens.primary);
  }

  @override
  Widget build(BuildContext context) {
    final hasRefImage = referenceImageDataUrl != null && referenceImageDataUrl!.isNotEmpty;
    final canSubmit = !isGenerating && promptController.text.trim().isNotEmpty;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16.0),
      padding: const EdgeInsets.all(14.0),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.95),
        borderRadius: BorderRadius.circular(StitchTokens.radius2Xl),
        border: Border.all(
          color: const Color(0xFFE2E8F0),
          width: 1.0,
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withValues(alpha: 0.08),
            blurRadius: 24.0,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          // 顶部模型引擎与单次算力消耗栏
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 3.5),
                decoration: BoxDecoration(
                  color: const Color(0xFFEEF2FF),
                  borderRadius: BorderRadius.circular(StitchTokens.radiusFull),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 6.0,
                      height: 6.0,
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        color: Color(0xFF10B981),
                      ),
                    ),
                    const SizedBox(width: 6.0),
                    Text(
                      '$activeModeLabel · ${activeModelId.replaceFirst('Wan-AI/', '')}',
                      style: const TextStyle(
                        fontSize: 11.0,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF4F46E5),
                      ),
                    ),
                  ],
                ),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 3.5),
                decoration: BoxDecoration(
                  color: StitchTokens.creditBg,
                  borderRadius: BorderRadius.circular(StitchTokens.radiusFull),
                  border: Border.all(color: StitchTokens.creditBorder),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.bolt_rounded,
                      size: 13.0,
                      color: Color(0xFFD97706),
                    ),
                    SizedBox(width: 2.0),
                    Text(
                      '${ApiConstants.videoGenerationCost} 积分 / 5s',
                      style: TextStyle(
                        fontSize: 11.0,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFFB45309),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),

          const SizedBox(height: 10.0),

          // 首帧参考图与画幅比例配置栏
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                if (!hasRefImage)
                  InkWell(
                    borderRadius: BorderRadius.circular(StitchTokens.radiusMd),
                    onTap: isGenerating ? null : onPickReferenceImage,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10.0, vertical: 6.0),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(StitchTokens.radiusMd),
                        border: Border.all(
                          color: const Color(0xFFCBD5E1),
                          style: BorderStyle.solid,
                        ),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.add_photo_alternate_outlined,
                            size: 15.0,
                            color: Color(0xFF475569),
                          ),
                          SizedBox(width: 4.0),
                          Text(
                            '首帧参考图',
                            style: TextStyle(
                              fontSize: 12.0,
                              fontWeight: FontWeight.w500,
                              color: Color(0xFF475569),
                            ),
                          ),
                        ],
                      ),
                    ),
                  )
                else
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 4.0),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEEF2FF),
                      borderRadius: BorderRadius.circular(StitchTokens.radiusMd),
                      border: Border.all(color: const Color(0xFFC7D2FE)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        _buildReferenceThumb(),
                        const SizedBox(width: 6.0),
                        ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 90.0),
                          child: Text(
                            referenceImageName ?? '已挂载首帧',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 11.5,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF4F46E5),
                            ),
                          ),
                        ),
                        const SizedBox(width: 4.0),
                        InkWell(
                          onTap: isGenerating ? null : onClearReferenceImage,
                          child: const Icon(
                            Icons.close_rounded,
                            size: 15.0,
                            color: Color(0xFF4F46E5),
                          ),
                        ),
                      ],
                    ),
                  ),

                const SizedBox(width: 8.0),

                // 画幅比例胶囊切换组
                Container(
                  padding: const EdgeInsets.all(2.5),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(10.0),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: _aspectOptions.map((item) {
                      final value = item['value']!;
                      final label = item['label']!;
                      final active = aspectRatio == value;
                      return GestureDetector(
                        onTap: isGenerating ? null : () => onAspectRatioChanged(value),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 160),
                          padding: const EdgeInsets.symmetric(horizontal: 9.0, vertical: 4.5),
                          decoration: BoxDecoration(
                            color: active ? Colors.white : Colors.transparent,
                            borderRadius: BorderRadius.circular(7.5),
                            boxShadow: active
                                ? [
                                    BoxShadow(
                                      color: Colors.black.withValues(alpha: 0.06),
                                      blurRadius: 4.0,
                                      offset: const Offset(0, 1),
                                    ),
                                  ]
                                : null,
                          ),
                          child: Text(
                            label,
                            style: TextStyle(
                              fontSize: 11.5,
                              fontWeight: active ? FontWeight.w600 : FontWeight.w500,
                              color: active ? const Color(0xFF0F172A) : const Color(0xFF64748B),
                            ),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 10.0),

          // 提示词输入框与发射按钮
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: Container(
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(StitchTokens.radiusLg),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: TextField(
                    controller: promptController,
                    enabled: !isGenerating,
                    minLines: 1,
                    maxLines: 3,
                    maxLength: 800,
                    onChanged: onPromptChanged,
                    style: const TextStyle(
                      fontSize: 13.5,
                      height: 1.45,
                      color: Color(0xFF0F172A),
                    ),
                    decoration: const InputDecoration(
                      hintText: '描述画面主体、运镜方式、光影风格...',
                      hintStyle: TextStyle(
                        fontSize: 13.0,
                        color: Color(0xFF94A3B8),
                      ),
                      counterText: '',
                      isDense: true,
                      contentPadding: EdgeInsets.symmetric(horizontal: 12.0, vertical: 10.0),
                      border: InputBorder.none,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10.0),
              SizedBox(
                height: 42.0,
                child: ElevatedButton.icon(
                  onPressed: canSubmit ? onSubmit : null,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0F172A),
                    disabledBackgroundColor: const Color(0xFFE2E8F0),
                    foregroundColor: Colors.white,
                    disabledForegroundColor: const Color(0xFF94A3B8),
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(horizontal: 14.0),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(StitchTokens.radiusLg),
                    ),
                  ),
                  icon: isGenerating
                      ? const SizedBox(
                          width: 14.0,
                          height: 14.0,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.0,
                            valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF64748B)),
                          ),
                        )
                      : const Icon(Icons.movie_creation_outlined, size: 16.0),
                  label: Text(
                    isGenerating ? '渲染中' : '生成视频',
                    style: const TextStyle(
                      fontSize: 13.0,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
