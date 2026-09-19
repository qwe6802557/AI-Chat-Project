import 'package:flutter/material.dart';
import '../../../../core/theme/stitch_tokens.dart';
import '../../../../shared/widgets/cyber_button.dart';
import 'model_info_card.dart';

class ModelInfo {
  final String id;
  final String name;
  final String category;
  final String tag;
  final String description;
  final String latency;
  final String contextWindow;
  final int cost;
  final IconData icon;

  const ModelInfo({
    required this.id,
    required this.name,
    required this.category,
    required this.tag,
    required this.description,
    required this.latency,
    required this.contextWindow,
    required this.cost,
    required this.icon,
  });
}

const List<ModelInfo> kAvailableChatModels = [
  ModelInfo(
    id: 'grok-chat-fast',
    name: 'grok-chat-fast',
    category: '代码极速',
    tag: '默认极速',
    description: '本机 Grok2API 快速聊天模型，适合日常敏捷交互与快速问答',
    latency: '50ms',
    contextWindow: '128k',
    cost: 10,
    icon: Icons.bolt_rounded,
  ),
  ModelInfo(
    id: 'grok-4.3',
    name: 'grok-4.3',
    category: '通用全能',
    tag: '经典全能',
    description: '本机 Grok2API 4.3 聊天模型，兼顾响应速度与综合表达力',
    latency: '80ms',
    contextWindow: '128k',
    cost: 10,
    icon: Icons.psychology_rounded,
  ),
  ModelInfo(
    id: 'grok-4.5',
    name: 'grok-4.5',
    category: '通用全能',
    tag: '旗舰主力',
    description: '本机 Grok2API 4.5 聊天模型，具备高保真语义理解与多任务执行力',
    latency: '90ms',
    contextWindow: '128k',
    cost: 10,
    icon: Icons.smart_toy_rounded,
  ),
  ModelInfo(
    id: 'grok-4.6',
    name: 'grok-4.6',
    category: '深度推理 (Reasoning)',
    tag: '高阶推理',
    description: '本机 Grok2API 4.6 聊天模型，复杂逻辑推导与深度知识整合',
    latency: '100ms',
    contextWindow: '128k',
    cost: 10,
    icon: Icons.auto_awesome_rounded,
  ),
  ModelInfo(
    id: 'grok-build-0.1',
    name: 'grok-build-0.1',
    category: '代码极速',
    tag: '工程构建',
    description: '本机 Grok2API Build 模型，专注软件架构、脚手架与代码构建',
    latency: '85ms',
    contextWindow: '128k',
    cost: 10,
    icon: Icons.construction_rounded,
  ),
  ModelInfo(
    id: 'grok-composer-2.5-fast',
    name: 'grok-composer-2.5-fast',
    category: '代码极速',
    tag: '创作代码',
    description: '本机 Grok2API 代码与创作快速模型，支持高效编码与长篇创作',
    latency: '60ms',
    contextWindow: '128k',
    cost: 10,
    icon: Icons.code_rounded,
  ),
];

/// Stitch 模型切换半屏底部抽屉
class ModelSwitcherBottomSheet extends StatefulWidget {
  final String currentModel;
  final ValueChanged<String> onModelSelected;

  const ModelSwitcherBottomSheet({
    super.key,
    required this.currentModel,
    required this.onModelSelected,
  });

  static Future<void> show(
    BuildContext context, {
    required String currentModel,
    required ValueChanged<String> onModelSelected,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useRootNavigator: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ModelSwitcherBottomSheet(
        currentModel: currentModel,
        onModelSelected: onModelSelected,
      ),
    );
  }

  @override
  State<ModelSwitcherBottomSheet> createState() => _ModelSwitcherBottomSheetState();
}

class _ModelSwitcherBottomSheetState extends State<ModelSwitcherBottomSheet> {
  late String _selectedModel;
  String _selectedCategory = '全部模型';

  @override
  void initState() {
    super.initState();
    _selectedModel = widget.currentModel;
  }

  @override
  Widget build(BuildContext context) {
    final filteredModels = _selectedCategory == '全部模型'
        ? kAvailableChatModels
        : kAvailableChatModels.where((m) => m.category == _selectedCategory).toList();

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.85,
      ),
      decoration: const BoxDecoration(
        color: StitchTokens.surfaceContainerLowest,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28.0)),
        boxShadow: [
          BoxShadow(
            color: Color.fromRGBO(0, 0, 0, 0.18),
            blurRadius: 32.0,
            offset: Offset(0, -8),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // 顶部小横条
            Padding(
              padding: const EdgeInsets.only(top: 12.0, bottom: 8.0),
              child: Container(
                width: 44.0,
                height: 5.0,
                decoration: BoxDecoration(
                color: StitchTokens.surfaceVariant,
                borderRadius: BorderRadius.circular(StitchTokens.radiusFull),
              ),
            ),
          ),
          // 标题栏
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 8.0),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Text(
                          '切换 AI 模型',
                          style: TextStyle(
                            fontSize: 18.0,
                            fontWeight: FontWeight.w700,
                            color: StitchTokens.onSurface,
                          ),
                        ),
                        const SizedBox(width: 8.0),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 2.0),
                          decoration: BoxDecoration(
                            color: StitchTokens.primaryContainer,
                            borderRadius: BorderRadius.circular(StitchTokens.radiusFull),
                          ),
                          child: Text(
                            '${kAvailableChatModels.length} 个可用',
                            style: const TextStyle(
                              fontSize: 11.0,
                              fontWeight: FontWeight.w600,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 2.0),
                    const Text(
                      '根据任务类型选择具备不同推理与专业能力的模型',
                      style: TextStyle(
                        fontSize: 12.0,
                        color: StitchTokens.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
                IconButton(
                  icon: const Icon(Icons.close_rounded, size: 22.0),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
          ),
          // 分类标签条
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 6.0),
            child: Row(
              children: [
                '全部模型',
                '深度推理 (Reasoning)',
                '通用全能',
                '代码极速',
              ].map((category) {
                final isSelected = _selectedCategory == category;
                return Padding(
                  padding: const EdgeInsets.only(right: 8.0),
                  child: ChoiceChip(
                    label: Text(category),
                    selected: isSelected,
                    onSelected: (_) {
                      setState(() => _selectedCategory = category);
                    },
                    selectedColor: StitchTokens.primary,
                    backgroundColor: StitchTokens.surfaceContainerLow,
                    labelStyle: TextStyle(
                      fontSize: 12.0,
                      fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
                      color: isSelected ? Colors.white : StitchTokens.onSurfaceVariant,
                    ),
                    showCheckmark: false,
                    padding: const EdgeInsets.symmetric(horizontal: 4.0),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(StitchTokens.radiusFull),
                      side: BorderSide.none,
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
          const Divider(height: 1.0, color: StitchTokens.surfaceContainerLow),
          // 模型列表
          Flexible(
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 12.0),
              itemCount: filteredModels.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10.0),
              itemBuilder: (context, index) {
                final model = filteredModels[index];
                return ModelInfoCard(
                  model: model,
                  isSelected: _selectedModel == model.id,
                  onTap: () => setState(() => _selectedModel = model.id),
                );
              },
            ),
          ),
          // 底部确定按钮
          Padding(
            padding: const EdgeInsets.fromLTRB(20.0, 8.0, 20.0, 24.0),
            child: Column(
              children: [
                CyberButton(
                  onPressed: () {
                    widget.onModelSelected(_selectedModel);
                    Navigator.of(context).pop();
                  },
                  child: const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.task_alt_rounded, size: 18.0, color: Colors.white),
                      SizedBox(width: 6.0),
                      Text(
                        '确认切换并应用',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 15.0,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 8.0),
                const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.info_outline_rounded, size: 13.0, color: StitchTokens.playbackEmerald),
                    SizedBox(width: 4.0),
                    Text(
                      '模型配置即时生效，不影响已生成的历史对话内容',
                      style: TextStyle(fontSize: 11.0, color: StitchTokens.onSurfaceVariant),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}
}
