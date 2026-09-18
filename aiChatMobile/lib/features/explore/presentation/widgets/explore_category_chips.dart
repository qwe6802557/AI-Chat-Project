import 'package:flutter/material.dart';
import '../../../../core/theme/stitch_tokens.dart';

/// 创作分类横向滚动选择标签
class ExploreCategoryChips extends StatelessWidget {
  final List<String> categories;
  final String activeCategory;
  final ValueChanged<String> onSelected;

  const ExploreCategoryChips({
    super.key,
    required this.categories,
    required this.activeCategory,
    required this.onSelected,
  });

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: categories.map((category) {
          final isSelected = activeCategory == category;
          return Padding(
            padding: const EdgeInsets.only(right: 8.0),
            child: ChoiceChip(
              label: Text(category),
              selected: isSelected,
              onSelected: (_) => onSelected(category),
              selectedColor: StitchTokens.primary,
              backgroundColor: StitchTokens.surfaceContainerLowest,
              labelStyle: TextStyle(
                fontSize: 12.0,
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
                color: isSelected ? Colors.white : StitchTokens.onSurfaceVariant,
              ),
              showCheckmark: false,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(StitchTokens.radiusFull),
                side: BorderSide.none,
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}
