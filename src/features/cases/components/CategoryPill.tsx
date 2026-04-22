import { Pressable, StyleSheet, Text } from 'react-native';
import type { CaseCategory } from '../../../types/shared';
import { colors, radii, spacing } from '../../../shared/theme/tokens';
import { categoryIcons, categoryLabels } from '../../../shared/utils/verdict';

interface CategoryPillProps {
  category: CaseCategory | 'all';
  selected: boolean;
  onPress: () => void;
}

export function CategoryPill({ category, selected, onPress }: CategoryPillProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.pill, selected && styles.selected]}
    >
      <Text style={[styles.text, selected && styles.selectedText]}>
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
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  selected: {
    backgroundColor: colors.brand.ink,
    borderColor: colors.brand.ink,
  },
  text: {
    color: colors.text.secondary,
    fontSize: 12,
    fontWeight: '700',
  },
  selectedText: {
    color: colors.text.onBrand,
  },
});
