import 'package:flutter/material.dart';
import '../../../../core/theme/stitch_tokens.dart';
import '../../../../shared/widgets/cyber_button.dart';
import 'model_info_card.dart';

enum ModelTab {
  gemini,
  others,
}

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
    id: 'glm-4-flash',
    name: 'GLM-4-Flash',
    category: '通用全能',
    tag: '智谱免费',
    description: '智谱 AI 官方永久免费通用大模型，毫秒级快速响应与日常通用问答',
    latency: '30ms',
    contextWindow: '128k',
    cost: 10,
    icon: Icons.flash_on_rounded,
  ),
  ModelInfo(
    id: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-7B',
    name: 'DeepSeek-R1-Distill (7B)',
    category: '深度推理 (Reasoning)',
    tag: '开源推理',
    description: '硅基流动 DeepSeek-R1 蒸馏模型，具备强大深度思考与思维链推导能力',
    latency: '60ms',
    contextWindow: '128k',
    cost: 10,
    icon: Icons.psychology_alt_rounded,
  ),
  ModelInfo(
    id: 'Qwen/Qwen2.5-Coder-7B-Instruct',
    name: 'Qwen2.5-Coder (7B)',
    category: '代码极速',
    tag: '代码专家',
    description: '硅基流动通义千问代码特化模型，专注算法编写、架构设计与工程调试',
    latency: '50ms',
    contextWindow: '128k',
    cost: 10,
    icon: Icons.terminal_rounded,
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

  /// 格式化模型名称显示（精炼且去 AI 味）
  static String formatModelLabel(String modelId) {
    if (modelId.startsWith('gemini-3.8-flash')) {
      final effort = modelId.contains('low')
          ? 'Low'
          : (modelId.contains('high') ? 'High' : 'Med');
      return 'Gemini 3.8 Flash · $effort';
    } else if (modelId.startsWith('gemini-4-argon')) {
      final effort = modelId.contains('low')
          ? 'Low'
          : (modelId.contains('high') ? 'High' : 'Med');
      return 'Gemini 4 Argon · $effort';
    }
    return modelId;
  }

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
  late ModelTab _activeTab;
  late String _geminiBaseModel;
  late String _thinkingEffort;
  late String _selectedOtherModel;
  String _selectedCategory = '全部模型';

  @override
  void initState() {
    super.initState();
    final model = widget.currentModel;
    if (model.startsWith('gemini-')) {
      _activeTab = ModelTab.gemini;
      if (model.contains('gemini-4-argon')) {
        _geminiBaseModel = 'gemini-4-argon';
      } else {
        _geminiBaseModel = 'gemini-3.8-flash';
      }

      if (model.endsWith('-low')) {
        _thinkingEffort = 'low';
      } else if (model.endsWith('-high')) {
        _thinkingEffort = 'high';
      } else {
        _thinkingEffort = 'medium';
      }
      _selectedOtherModel = 'grok-chat-fast';
    } else {
      _activeTab = ModelTab.others;
      _geminiBaseModel = 'gemini-3.8-flash';
      _thinkingEffort = 'medium';
      _selectedOtherModel = model.isNotEmpty ? model : 'grok-chat-fast';
    }
  }

  String get _currentFinalModel {
    if (_activeTab == ModelTab.gemini) {
      return '$_geminiBaseModel-$_thinkingEffort';
    }
    return _selectedOtherModel;
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.88,
      ),
      decoration: const BoxDecoration(
        color: StitchTokens.surfaceContainerLowest,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28.0)),
        boxShadow: [
          BoxShadow(
            color: Color.fromRGBO(0, 0, 0, 0.16),
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
            // 顶部抓手条
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
              padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 6.0),
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
                              _activeTab == ModelTab.gemini ? 'Gemini 旗舰系列' : '已集成多供应商',
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
                      Text(
                        _activeTab == ModelTab.gemini
                            ? 'Google 原生前沿架构 · 毫秒级多档思考深度'
                            : '已兼容 Grok, 智谱 GLM, 硅基流动 DeepSeek 与 Qwen',
                        style: const TextStyle(
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
            // 顶层主分类切换分段器：Gemini 系列 vs 其它模型
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 8.0),
              child: Container(
                padding: const EdgeInsets.all(3.0),
                decoration: BoxDecoration(
                  color: StitchTokens.surfaceContainerLow,
                  borderRadius: BorderRadius.circular(StitchTokens.radiusLg),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: _buildMainTabButton(
                        tab: ModelTab.gemini,
                        label: 'Gemini 系列',
                        icon: Icons.auto_awesome_rounded,
                        badge: '推荐',
                      ),
                    ),
                    Expanded(
                      child: _buildMainTabButton(
                        tab: ModelTab.others,
                        label: '其它模型',
                        icon: Icons.widgets_outlined,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const Divider(height: 1.0, color: StitchTokens.surfaceContainerLow),
            // 主体内容区
            Flexible(
              child: _activeTab == ModelTab.gemini
                  ? _buildGeminiContent()
                  : _buildOthersContent(),
            ),
            // 底部确认切换按键
            Padding(
              padding: const EdgeInsets.fromLTRB(20.0, 10.0, 20.0, 20.0),
              child: Column(
                children: [
                  CyberButton(
                    onPressed: () {
                      widget.onModelSelected(_currentFinalModel);
                      Navigator.of(context).pop();
                    },
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.task_alt_rounded, size: 18.0, color: Colors.white),
                        const SizedBox(width: 8.0),
                        Text(
                          '确认切换至 ${ModelSwitcherBottomSheet.formatModelLabel(_currentFinalModel)}',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 14.5,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 6.0),
                  const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.info_outline_rounded, size: 12.0, color: StitchTokens.playbackEmerald),
                      SizedBox(width: 4.0),
                      Text(
                        '模型配置即时生效，不影响历史会话内容与上下文快照',
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

  Widget _buildMainTabButton({
    required ModelTab tab,
    required String label,
    required IconData icon,
    String? badge,
  }) {
    final isSelected = _activeTab == tab;
    return GestureDetector(
      onTap: () => setState(() => _activeTab = tab),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        curve: Curves.easeOutCubic,
        padding: const EdgeInsets.symmetric(vertical: 8.0),
        decoration: BoxDecoration(
          color: isSelected ? Colors.white : Colors.transparent,
          borderRadius: BorderRadius.circular(StitchTokens.radiusMd),
          boxShadow: isSelected
              ? const [
                  BoxShadow(
                    color: Color.fromRGBO(0, 0, 0, 0.08),
                    blurRadius: 8.0,
                    offset: Offset(0, 2),
                  ),
                ]
              : null,
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              icon,
              size: 16.0,
              color: isSelected ? StitchTokens.primary : StitchTokens.onSurfaceVariant,
            ),
            const SizedBox(width: 6.0),
            Text(
              label,
              style: TextStyle(
                fontSize: 13.5,
                fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                color: isSelected ? StitchTokens.onSurface : StitchTokens.onSurfaceVariant,
              ),
            ),
            if (badge != null) ...[
              const SizedBox(width: 5.0),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 5.0, vertical: 1.0),
                decoration: BoxDecoration(
                  color: isSelected ? StitchTokens.primary.withValues(alpha: 0.12) : Colors.transparent,
                  borderRadius: BorderRadius.circular(StitchTokens.radiusFull),
                ),
                child: Text(
                  badge,
                  style: TextStyle(
                    fontSize: 9.5,
                    fontWeight: FontWeight.w700,
                    color: isSelected ? StitchTokens.primary : StitchTokens.onSurfaceVariant,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildGeminiContent() {
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 14.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 提示条
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12.0, vertical: 8.0),
            decoration: BoxDecoration(
              color: StitchTokens.thinkingBg,
              borderRadius: BorderRadius.circular(StitchTokens.radiusMd),
              border: Border.all(color: StitchTokens.thinkingBorder),
            ),
            child: const Row(
              children: [
                Icon(Icons.bolt_rounded, size: 16.0, color: StitchTokens.thinkingText),
                SizedBox(width: 8.0),
                Expanded(
                  child: Text(
                    '已接入 Google 原生推理协议，全量开放多模态感知与动态思考强度微调',
                    style: TextStyle(fontSize: 11.5, color: StitchTokens.thinkingText, height: 1.3),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14.0),
          const Text(
            '选择模型型号',
            style: TextStyle(fontSize: 13.0, fontWeight: FontWeight.w700, color: StitchTokens.onSurface),
          ),
          const SizedBox(height: 8.0),
          // 两个 Gemini 模型卡片
          _buildGeminiModelCard(
            baseId: 'gemini-3.8-flash',
            title: 'Gemini 3.8 Flash',
            badge: '推荐日常',
            desc: '新一代高响应极速模型，毫秒级起流，多模态图文兼修，擅长日常问答、搜索与快速编码',
            cost: 10,
          ),
          const SizedBox(height: 10.0),
          _buildGeminiModelCard(
            baseId: 'gemini-4-argon',
            title: 'Gemini 4 Argon',
            badge: '前沿旗舰',
            desc: '最强前沿智力旗舰，擅长复杂工程架构、跨领域深度推导与长上下文严谨逻辑闭环',
            cost: 20,
          ),
          const SizedBox(height: 18.0),
          // 思考强度分段器
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                '思考强度 (Reasoning Effort)',
                style: TextStyle(fontSize: 13.0, fontWeight: FontWeight.w700, color: StitchTokens.onSurface),
              ),
              Text(
                '当前：${_getEffortDisplayName(_thinkingEffort)}',
                style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: StitchTokens.primary),
              ),
            ],
          ),
          const SizedBox(height: 8.0),
          Container(
            padding: const EdgeInsets.all(4.0),
            decoration: BoxDecoration(
              color: StitchTokens.surfaceContainerLow,
              borderRadius: BorderRadius.circular(StitchTokens.radiusLg),
            ),
            child: Row(
              children: [
                Expanded(child: _buildEffortOption('low', 'Low', '轻度推导 · 快速响应')),
                const SizedBox(width: 4.0),
                Expanded(child: _buildEffortOption('medium', 'Medium', '平衡思考 · 推荐日常')),
                const SizedBox(width: 4.0),
                Expanded(child: _buildEffortOption('high', 'High', '深度思维链 · 严谨推理')),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildGeminiModelCard({
    required String baseId,
    required String title,
    required String badge,
    required String desc,
    required int cost,
  }) {
    final isSelected = _geminiBaseModel == baseId;
    return GestureDetector(
      onTap: () => setState(() => _geminiBaseModel = baseId),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        padding: const EdgeInsets.all(14.0),
        decoration: BoxDecoration(
          color: isSelected ? StitchTokens.thinkingBg : StitchTokens.surfaceContainerLow,
          borderRadius: BorderRadius.circular(16.0),
          border: Border.all(
            color: isSelected ? StitchTokens.primary : Colors.transparent,
            width: 1.5,
          ),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 34.0,
              height: 34.0,
              decoration: BoxDecoration(
                color: isSelected ? StitchTokens.primary : StitchTokens.surfaceGlassDark,
                borderRadius: BorderRadius.circular(10.0),
              ),
              child: const Icon(
                Icons.auto_awesome_rounded,
                color: Colors.white,
                size: 18.0,
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
                        title,
                        style: TextStyle(
                          fontSize: 15.0,
                          fontWeight: isSelected ? FontWeight.w700 : FontWeight.w600,
                          color: StitchTokens.onSurface,
                        ),
                      ),
                      const SizedBox(width: 6.0),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6.0, vertical: 1.5),
                        decoration: BoxDecoration(
                          color: isSelected ? StitchTokens.primary : StitchTokens.surfaceVariant,
                          borderRadius: BorderRadius.circular(StitchTokens.radiusFull),
                        ),
                        child: Text(
                          badge,
                          style: TextStyle(
                            fontSize: 10.0,
                            fontWeight: FontWeight.w600,
                            color: isSelected ? Colors.white : StitchTokens.onSurfaceVariant,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4.0),
                  Text(
                    desc,
                    style: const TextStyle(fontSize: 12.0, color: StitchTokens.onSurfaceVariant, height: 1.35),
                  ),
                  const SizedBox(height: 6.0),
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6.0, vertical: 1.5),
                        decoration: BoxDecoration(
                          color: StitchTokens.creditBg,
                          borderRadius: BorderRadius.circular(4.0),
                          border: Border.all(color: StitchTokens.creditBorder),
                        ),
                        child: Text(
                          '$cost 算力/次',
                          style: const TextStyle(
                            fontSize: 10.5,
                            fontWeight: FontWeight.w600,
                            color: StitchTokens.creditAmber,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8.0),
                      const Text(
                        '128k 上下文',
                        style: TextStyle(fontSize: 10.5, color: StitchTokens.onSurfaceVariant),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            Container(
              width: 20.0,
              height: 20.0,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: isSelected ? StitchTokens.primary : StitchTokens.outlineVariant,
                  width: isSelected ? 5.5 : 1.5,
                ),
                color: Colors.white,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEffortOption(String effort, String label, String sub) {
    final isSelected = _thinkingEffort == effort;
    return GestureDetector(
      onTap: () => setState(() => _thinkingEffort = effort),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(vertical: 8.0, horizontal: 4.0),
        decoration: BoxDecoration(
          color: isSelected ? Colors.white : Colors.transparent,
          borderRadius: BorderRadius.circular(StitchTokens.radiusMd),
          border: Border.all(
            color: isSelected ? StitchTokens.primary.withValues(alpha: 0.3) : Colors.transparent,
            width: 1.0,
          ),
          boxShadow: isSelected
              ? const [
                  BoxShadow(
                    color: Color.fromRGBO(0, 0, 0, 0.06),
                    blurRadius: 4.0,
                    offset: Offset(0, 1),
                  ),
                ]
              : null,
        ),
        child: Column(
          children: [
            Text(
              label,
              style: TextStyle(
                fontSize: 12.5,
                fontWeight: isSelected ? FontWeight.w700 : FontWeight.w600,
                color: isSelected ? StitchTokens.primary : StitchTokens.onSurface,
              ),
            ),
            const SizedBox(height: 2.0),
            Text(
              sub.split(' · ').first,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 10.0,
                color: isSelected ? StitchTokens.primary : StitchTokens.onSurfaceVariant,
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _getEffortDisplayName(String effort) {
    switch (effort) {
      case 'low':
        return 'Low (轻度推导)';
      case 'high':
        return 'High (深度思维链)';
      case 'medium':
      default:
        return 'Medium (平衡推荐)';
    }
  }

  Widget _buildOthersContent() {
    final filteredModels = _selectedCategory == '全部模型'
        ? kAvailableChatModels
        : kAvailableChatModels.where((m) => m.category == _selectedCategory).toList();

    return Column(
      children: [
        // 类别过滤器
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
                  onSelected: (_) => setState(() => _selectedCategory = category),
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
        // 列表项
        Flexible(
          child: ListView.separated(
            padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 8.0),
            itemCount: filteredModels.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8.0),
            itemBuilder: (context, index) {
              final model = filteredModels[index];
              return ModelInfoCard(
                model: model,
                isSelected: _selectedOtherModel == model.id,
                onTap: () => setState(() => _selectedOtherModel = model.id),
              );
            },
          ),
        ),
      ],
    );
  }
}
