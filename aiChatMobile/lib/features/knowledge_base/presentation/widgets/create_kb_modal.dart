import 'package:flutter/material.dart';
import '../../../../core/theme/stitch_tokens.dart';
import '../../domain/knowledge_base_model.dart';

/// 新建与编辑知识库底部抽屉
class CreateKbModal extends StatefulWidget {
  final KnowledgeBaseModel? initialKb;
  final Future<void> Function({
    required String name,
    required String description,
    required String avatar,
  }) onSubmit;

  const CreateKbModal({
    super.key,
    this.initialKb,
    required this.onSubmit,
  });

  static Future<void> show(
    BuildContext context, {
    KnowledgeBaseModel? initialKb,
    required Future<void> Function({
      required String name,
      required String description,
      required String avatar,
    }) onSubmit,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useRootNavigator: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => CreateKbModal(
        initialKb: initialKb,
        onSubmit: onSubmit,
      ),
    );
  }

  @override
  State<CreateKbModal> createState() => _CreateKbModalState();
}

class _CreateKbModalState extends State<CreateKbModal> {
  late final TextEditingController _nameController;
  late final TextEditingController _descController;
  late String _selectedAvatar;
  bool _submitting = false;
  String? _errorMessage;

  static const List<Map<String, dynamic>> _avatarOptions = [
    {'id': 'auto_stories', 'icon': Icons.auto_stories_rounded, 'name': '经典知识'},
    {'id': 'folder', 'icon': Icons.folder_rounded, 'name': '通用归档'},
    {'id': 'menu_book', 'icon': Icons.menu_book_rounded, 'name': '手册资料'},
    {'id': 'memory', 'icon': Icons.memory_rounded, 'name': '核心大脑'},
    {'id': 'code', 'icon': Icons.code_rounded, 'name': '技术规范'},
    {'id': 'science', 'icon': Icons.science_rounded, 'name': '研发学术'},
  ];

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(text: widget.initialKb?.name ?? '');
    _descController = TextEditingController(text: widget.initialKb?.description ?? '');
    _selectedAvatar = widget.initialKb?.avatar ?? 'auto_stories';
  }

  @override
  void dispose() {
    _nameController.dispose();
    _descController.dispose();
    super.dispose();
  }

  Future<void> _handleSubmit() async {
    final name = _nameController.text.trim();
    if (name.isEmpty) {
      setState(() => _errorMessage = '知识库名称不能为空');
      return;
    }

    setState(() {
      _submitting = true;
      _errorMessage = null;
    });

    try {
      await widget.onSubmit(
        name: name,
        description: _descController.text.trim(),
        avatar: _selectedAvatar,
      );
      if (mounted) Navigator.of(context).pop();
    } catch (e) {
      if (mounted) {
        setState(() {
          _submitting = false;
          _errorMessage = e.toString().replaceAll('Exception:', '').trim();
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isEditing = widget.initialKb != null;

    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(StitchTokens.radius2Xl),
        ),
      ),
      padding: EdgeInsets.fromLTRB(
        20.0,
        16.0,
        20.0,
        MediaQuery.of(context).viewInsets.bottom + MediaQuery.of(context).padding.bottom + 16.0,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 顶端拖拽手柄
            Center(
              child: Container(
                width: 36.0,
                height: 4.0,
                decoration: BoxDecoration(
                  color: StitchTokens.outlineVariant.withValues(alpha: 0.6),
                  borderRadius: BorderRadius.circular(StitchTokens.radiusFull),
                ),
              ),
            ),
            const SizedBox(height: 16.0),
            // 标题
            Row(
              children: [
                Text(
                  isEditing ? '编辑知识库' : '创建新知识库',
                  style: const TextStyle(
                    fontSize: 18.0,
                    fontWeight: FontWeight.w700,
                    color: StitchTokens.onSurface,
                  ),
                ),
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.close_rounded, size: 20.0, color: StitchTokens.outline),
                  onPressed: () => Navigator.of(context).pop(),
                  splashRadius: 20.0,
                ),
              ],
            ),
            const SizedBox(height: 16.0),
            // 知识库名称
            const Text(
              '知识库名称',
              style: TextStyle(
                fontSize: 13.0,
                fontWeight: FontWeight.w600,
                color: StitchTokens.onSurface,
              ),
            ),
            const SizedBox(height: 6.0),
            TextField(
              controller: _nameController,
              decoration: InputDecoration(
                hintText: '如：工程架构与产品规范',
                hintStyle: const TextStyle(fontSize: 13.0, color: StitchTokens.outline),
                filled: true,
                fillColor: StitchTokens.surfaceContainerLow,
                contentPadding: const EdgeInsets.symmetric(horizontal: 14.0, vertical: 12.0),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(StitchTokens.radiusMd),
                  borderSide: BorderSide.none,
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(StitchTokens.radiusMd),
                  borderSide: const BorderSide(color: StitchTokens.primary, width: 1.5),
                ),
              ),
            ),
            const SizedBox(height: 14.0),
            // 描述说明
            const Text(
              '描述说明 (选填)',
              style: TextStyle(
                fontSize: 13.0,
                fontWeight: FontWeight.w600,
                color: StitchTokens.onSurface,
              ),
            ),
            const SizedBox(height: 6.0),
            TextField(
              controller: _descController,
              maxLines: 3,
              decoration: InputDecoration(
                hintText: '简要说明此知识库的主要内容与适用的业务场景',
                hintStyle: const TextStyle(fontSize: 13.0, color: StitchTokens.outline),
                filled: true,
                fillColor: StitchTokens.surfaceContainerLow,
                contentPadding: const EdgeInsets.symmetric(horizontal: 14.0, vertical: 12.0),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(StitchTokens.radiusMd),
                  borderSide: BorderSide.none,
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(StitchTokens.radiusMd),
                  borderSide: const BorderSide(color: StitchTokens.primary, width: 1.5),
                ),
              ),
            ),
            const SizedBox(height: 16.0),
            // 封面图标选择
            const Text(
              '选择封面标识',
              style: TextStyle(
                fontSize: 13.0,
                fontWeight: FontWeight.w600,
                color: StitchTokens.onSurface,
              ),
            ),
            const SizedBox(height: 8.0),
            Wrap(
              spacing: 10.0,
              runSpacing: 10.0,
              children: _avatarOptions.map((opt) {
                final isSelected = _selectedAvatar == opt['id'];
                return Material(
                  color: Colors.transparent,
                  child: InkWell(
                    borderRadius: BorderRadius.circular(StitchTokens.radiusMd),
                    onTap: () => setState(() => _selectedAvatar = opt['id'] as String),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10.0, vertical: 8.0),
                      decoration: BoxDecoration(
                        color: isSelected
                            ? StitchTokens.primary.withValues(alpha: 0.1)
                            : StitchTokens.surfaceContainerLow,
                        borderRadius: BorderRadius.circular(StitchTokens.radiusMd),
                        border: Border.all(
                          color: isSelected ? StitchTokens.primary : Colors.transparent,
                          width: 1.5,
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            opt['icon'] as IconData,
                            size: 16.0,
                            color: isSelected ? StitchTokens.primary : StitchTokens.onSurfaceVariant,
                          ),
                          const SizedBox(width: 6.0),
                          Text(
                            opt['name'] as String,
                            style: TextStyle(
                              fontSize: 12.0,
                              fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                              color: isSelected ? StitchTokens.primary : StitchTokens.onSurfaceVariant,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
            if (_errorMessage != null) ...[
              const SizedBox(height: 12.0),
              Text(
                _errorMessage!,
                style: const TextStyle(fontSize: 12.0, color: StitchTokens.crimsonStop),
              ),
            ],
            const SizedBox(height: 20.0),
            // 提交按钮
            SizedBox(
              width: double.infinity,
              height: 44.0,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: StitchTokens.primary,
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(StitchTokens.radiusMd),
                  ),
                ),
                onPressed: _submitting ? null : _handleSubmit,
                child: _submitting
                    ? const SizedBox(
                        width: 20.0,
                        height: 20.0,
                        child: CircularProgressIndicator(
                          strokeWidth: 2.0,
                          valueColor: AlwaysStoppedAnimation(Colors.white),
                        ),
                      )
                    : Text(
                        isEditing ? '保存修改' : '确认创建',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 14.0,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
