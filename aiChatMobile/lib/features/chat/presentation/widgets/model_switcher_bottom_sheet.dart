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
  final bool isDefault;

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
    this.isDefault = false,
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
  final List<ModelInfo>? availableModels;

  const ModelSwitcherBottomSheet({
    super.key,
    required this.currentModel,
    required this.onModelSelected,
    this.availableModels,
  });

  /// 格式化模型名称显示（精炼且去 AI 味）
  static String formatModelLabel(String modelId) {
    return modelId;
  }

  /// 判定模型 ID 是否归属通用 Gemini 系列（预留后续接入任意新 Gemini 模型）
  static bool isGeminiModelId(String modelId) {
    return modelId.toLowerCase().startsWith('gemini-');
  }

  static Future<void> show(
    BuildContext context, {
    required String currentModel,
    required ValueChanged<String> onModelSelected,
    List<ModelInfo>? availableModels,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useRootNavigator: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ModelSwitcherBottomSheet(
        currentModel: currentModel,
        onModelSelected: onModelSelected,
        availableModels: availableModels,
      ),
    );
  }

  @override
  State<ModelSwitcherBottomSheet> createState() => _ModelSwitcherBottomSheetState();
}

class _ModelSwitcherBottomSheetState extends State<ModelSwitcherBottomSheet> {
  late ModelTab _activeTab;
  late String _selectedGeminiModel;
  late String _selectedOtherModel;
  String _selectedCategory = '全部模型';

  List<ModelInfo> get _effectiveModels => widget.availableModels ?? kAvailableChatModels;

  List<ModelInfo> get _geminiModels =>
      _effectiveModels.where((m) => ModelSwitcherBottomSheet.isGeminiModelId(m.id)).toList();

  List<ModelInfo> get _otherModels =>
      _effectiveModels.where((m) => !ModelSwitcherBottomSheet.isGeminiModelId(m.id)).toList();

  bool get _hasGeminiModels => _geminiModels.isNotEmpty;

  void _syncSelectionWithAvailableModels({bool initial = false}) {
    final model = widget.currentModel;
    final isCurrentGemini = ModelSwitcherBottomSheet.isGeminiModelId(model);

    if (initial) {
      _selectedGeminiModel = isCurrentGemini && _geminiModels.any((m) => m.id == model)
          ? model
          : (_geminiModels.isNotEmpty ? _geminiModels.first.id : '');
      _selectedOtherModel = model.isNotEmpty && !isCurrentGemini
          ? model
          : (_otherModels.isNotEmpty ? _otherModels.first.id : 'grok-chat-fast');
      _activeTab = (_hasGeminiModels && isCurrentGemini)
          ? ModelTab.gemini
          : ModelTab.others;
    }

    if (!_hasGeminiModels) {
      _activeTab = ModelTab.others;
      _selectedGeminiModel = '';
    } else if (!_geminiModels.any((m) => m.id == _selectedGeminiModel)) {
      _selectedGeminiModel = _geminiModels.first.id;
    }

    if (_otherModels.isNotEmpty && !_otherModels.any((m) => m.id == _selectedOtherModel)) {
      _selectedOtherModel = _otherModels.first.id;
    }
  }

  @override
  void initState() {
    super.initState();
    _syncSelectionWithAvailableModels(initial: true);
  }

  @override
  void didUpdateWidget(covariant ModelSwitcherBottomSheet oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.availableModels != oldWidget.availableModels ||
        widget.currentModel != oldWidget.currentModel) {
      _syncSelectionWithAvailableModels();
    }
  }

  String get _currentFinalModel {
    if (_hasGeminiModels && _activeTab == ModelTab.gemini) {
      if (_geminiModels.any((m) => m.id == _selectedGeminiModel)) {
        return _selectedGeminiModel;
      }
      return _geminiModels.first.id;
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
                              (_hasGeminiModels && _activeTab == ModelTab.gemini)
                                  ? 'Gemini 旗舰系列'
                                  : '现有可用模型',
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
                        (_hasGeminiModels && _activeTab == ModelTab.gemini)
                            ? 'Google 原生前沿架构 · 毫秒级多档思考深度'
                            : '已同步服务端当前启用模型',
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
            // 仅当存在已启用的 Gemini 模型时展示主分类切换分段器
            if (_hasGeminiModels)
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
              child: (_hasGeminiModels && _activeTab == ModelTab.gemini)
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

  /// 动态渲染后端已启用的 Gemini 系列模型列表（与具体版本号解耦）
  Widget _buildGeminiContent() {
    final models = _geminiModels;
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20.0, 12.0, 20.0, 6.0),
          child: Container(
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
                    '已同步服务端启用的 Google Gemini 系列多模态模型',
                    style: TextStyle(fontSize: 11.5, color: StitchTokens.thinkingText, height: 1.3),
                  ),
                ),
              ],
            ),
          ),
        ),
        Flexible(
          child: ListView.separated(
            padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 8.0),
            itemCount: models.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8.0),
            itemBuilder: (context, index) {
              final model = models[index];
              return ModelInfoCard(
                model: model,
                isSelected: _selectedGeminiModel == model.id,
                onTap: () => setState(() => _selectedGeminiModel = model.id),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildOthersContent() {
    final models = _otherModels;
    final dynamicCategories = <String>['全部模型'];
    for (final m in models) {
      if (!dynamicCategories.contains(m.category)) {
        dynamicCategories.add(m.category);
      }
    }
    final activeCategory = dynamicCategories.contains(_selectedCategory)
        ? _selectedCategory
        : '全部模型';
    final filteredModels = activeCategory == '全部模型'
        ? models
        : models.where((m) => m.category == activeCategory).toList();

    return Column(
      children: [
        // 类别过滤器
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 6.0),
          child: Row(
            children: dynamicCategories.map((category) {
              final isSelected = activeCategory == category;
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
          child: filteredModels.isEmpty
              ? const Center(
                  child: Padding(
                    padding: EdgeInsets.symmetric(vertical: 28.0),
                    child: Text(
                      '暂无可用模型',
                      style: TextStyle(fontSize: 13.0, color: StitchTokens.onSurfaceVariant),
                    ),
                  ),
                )
              : ListView.separated(
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
