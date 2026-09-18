import 'package:flutter/material.dart';
import '../../../../core/theme/stitch_tokens.dart';
import '../../../../shared/widgets/cyber_button.dart';
import '../../../../shared/widgets/glass_card.dart';

/// Grok Imagine 2.0 生图操作控制台
class ExploreGenerationConsole extends StatelessWidget {
  final TextEditingController promptController;
  final String selectedRatio;
  final bool isGenerating;
  final ValueChanged<String> onRatioChanged;
  final VoidCallback onGenerate;

  const ExploreGenerationConsole({
    super.key,
    required this.promptController,
    required this.selectedRatio,
    required this.isGenerating,
    required this.onRatioChanged,
    required this.onGenerate,
  });

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Grok Imagine 2.0',
                style: TextStyle(
                  fontSize: 15.0,
                  fontWeight: FontWeight.w600,
                  color: StitchTokens.onSurface,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 4.0),
                decoration: BoxDecoration(
                  color: StitchTokens.creditBg,
                  borderRadius: BorderRadius.circular(StitchTokens.radiusFull),
                  border: Border.all(color: StitchTokens.creditBorder),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.toll_rounded, size: 12.0, color: StitchTokens.creditAmber),
                    SizedBox(width: 4.0),
                    Text(
                      '100 积分/次',
                      style: TextStyle(
                        fontSize: 11.0,
                        fontWeight: FontWeight.w600,
                        color: StitchTokens.creditAmber,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12.0),
          TextField(
            controller: promptController,
            maxLines: 3,
            decoration: InputDecoration(
              hintText: '输入灵感创意提示词，例如：赛博朋克深海微光水母，电影级虚化...',
              hintStyle: const TextStyle(fontSize: 13.0, color: StitchTokens.outline),
              fillColor: StitchTokens.surfaceContainerLow,
              filled: true,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12.0),
                borderSide: BorderSide.none,
              ),
            ),
          ),
          const SizedBox(height: 12.0),
          Row(
            children: [
              const Text(
                '比例：',
                style: TextStyle(fontSize: 12.0, color: StitchTokens.onSurfaceVariant),
              ),
              const SizedBox(width: 4.0),
              ...['1:1', '16:9', '9:16', '4:3'].map((ratio) {
                final isSelected = selectedRatio == ratio;
                return Padding(
                  padding: const EdgeInsets.only(right: 6.0),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(6.0),
                    onTap: () => onRatioChanged(ratio),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 3.0),
                      decoration: BoxDecoration(
                        color: isSelected ? StitchTokens.primary : StitchTokens.surfaceContainerLow,
                        borderRadius: BorderRadius.circular(6.0),
                      ),
                      child: Text(
                        ratio,
                        style: TextStyle(
                          fontSize: 11.0,
                          fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                          color: isSelected ? Colors.white : StitchTokens.onSurfaceVariant,
                        ),
                      ),
                    ),
                  ),
                );
              }),
            ],
          ),
          const SizedBox(height: 16.0),
          CyberButton(
            onPressed: isGenerating ? null : onGenerate,
            child: isGenerating
                ? const SizedBox(
                    width: 20.0,
                    height: 20.0,
                    child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.0),
                  )
                : const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.auto_awesome_rounded, size: 18.0, color: Colors.white),
                      SizedBox(width: 8.0),
                      Text(
                        '立即生成画作',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 15.0,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
          ),
        ],
      ),
    );
  }
}
