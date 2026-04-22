import { Pressable, StyleSheet, Text } from 'react-native';
import type { CaseCategory } from '../../../types/shared';
import { colors, radii, shadows, spacing, typography } from '../../../shared/theme/tokens';
import { categoryIcons, categoryLabels } from '../../../shared/utils/verdict';

interface CategoryPillProps {
  category: CaseCategory | 'all';
  selected: boolean;
  onPress: () => void;
  mode?: 'filter' | 'category';
}

export function CategoryPill({ category, selected, onPress, mode = 'filter' }: CategoryPillProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.pill,
        mode === 'category' && styles.categoryPill,
        selected && styles.selected,
        selected && mode === 'category' && styles.selectedCategory,
      ]}
    >
      <Text style={[styles.text, mode === 'category' && styles.categoryText, selected && styles.selectedText]}>
        {category === 'all' ? 'All' : `${categoryIcons[category]} ${categoryLabels[category]}`}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignItems: 'center',
    backgroundColor: colors.bg.surface,
    borderColor: colors.ui.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    minHeight: 28,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  categoryPill: {
    borderColor: colors.brand.ink,
    borderWidth: 2,
    minHeight: 40,
    paddingHorizontal: spacing.lg,
  },
  selected: {
    backgroundColor: colors.brand.ink,
    borderColor: colors.brand.ink,
  },
  selectedCategory: {
    ...shadows.hardSmall,
  },
  text: {
    color: colors.text.secondary,
    fontFamily: typography.family.displayMedium,
    fontSize: 11,
  },
  categoryText: {
    color: colors.text.primary,
    fontFamily: typography.family.displaySemiBold,
    fontSize: 14,
  },
  selectedText: {
    color: colors.text.onBrand,
  },
});
