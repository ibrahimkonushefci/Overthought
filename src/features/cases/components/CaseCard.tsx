import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { CaseEntity } from '../types';
import { getCaseId } from '../types';
import { AppText } from '../../../shared/ui/Text';
import { colors, radii, spacing, typography } from '../../../shared/theme/tokens';
import { categoryIcons, categoryLabels, scoreToneBackground, scoreColor, verdictIcons, verdictLabels } from '../../../shared/utils/verdict';
import { relativeTime } from '../../../shared/utils/date';

interface CaseCardProps {
  item: CaseEntity;
}

export function CaseCard({ item }: CaseCardProps) {
  const router = useRouter();
  const id = getCaseId(item);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/case/${id}`)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={[styles.scoreBox, { backgroundColor: scoreToneBackground(item.delusionScore) }]}>
        <AppText variant="title" color={scoreColor(item.delusionScore)} center style={styles.scoreNumber}>
          {item.delusionScore}
        </AppText>
        <AppText variant="eyebrow" color={scoreColor(item.delusionScore)} center style={styles.scoreLabel}>
          Score
        </AppText>
      </View>
      <View style={styles.body}>
        <AppText variant="meta">
          {categoryIcons[item.category]} {categoryLabels[item.category]} · {relativeTime(item.updatedAt)}
        </AppText>
        <AppText variant="body" style={styles.title} numberOfLines={2}>
          {item.title ?? item.inputText}
        </AppText>
        <AppText variant="body" style={styles.verdict} numberOfLines={1}>
          {verdictIcons[item.verdictLabel]} {verdictLabels[item.verdictLabel]}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    backgroundColor: colors.bg.surface,
    borderColor: colors.ui.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 74,
    padding: spacing.md,
  },
  pressed: {
    opacity: 0.75,
  },
  scoreBox: {
    alignItems: 'center',
    borderRadius: 14,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  scoreNumber: {
    fontFamily: typography.family.displayBold,
    fontSize: 21,
    lineHeight: 23,
  },
  scoreLabel: {
    fontFamily: typography.family.displaySemiBold,
    fontSize: 8,
    letterSpacing: 0.8,
    lineHeight: 10,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 14,
    lineHeight: 18,
    fontFamily: typography.family.bodyMedium,
  },
  verdict: {
    fontFamily: typography.family.displaySemiBold,
    fontSize: 12,
    lineHeight: 16,
  },
});
