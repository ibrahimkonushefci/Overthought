import { StyleSheet, View } from 'react-native';
import { BarChart3 } from 'lucide-react-native';
import type { CaseCategory } from '../../src/types/shared';
import { Screen } from '../../src/shared/ui/Screen';
import { AppText } from '../../src/shared/ui/Text';
import { EmptyState } from '../../src/shared/ui/EmptyState';
import { Card } from '../../src/shared/ui/Card';
import { useCases } from '../../src/features/cases/services/useCases';
import { categoryIcons, categoryLabels } from '../../src/shared/utils/verdict';
import { colors, gradients, radii, shadows, spacing, typography } from '../../src/shared/theme/tokens';
import { LinearGradient } from 'expo-linear-gradient';

const categories: CaseCategory[] = ['romance', 'friendship', 'social', 'general'];

export default function StatsRoute() {
  const { cases } = useCases();
  const average =
    cases.length > 0 ? Math.round(cases.reduce((total, item) => total + item.delusionScore, 0) / cases.length) : 0;
  const resolved = cases.filter((item) => item.outcomeStatus === 'right' || item.outcomeStatus === 'wrong');
  const right = cases.filter((item) => item.outcomeStatus === 'right').length;
  const accuracy = resolved.length > 0 ? Math.round((right / resolved.length) * 100) : 0;
  const mostCommon = categories.reduce(
    (winner, category) => {
      const count = cases.filter((item) => item.category === category).length;
      return count > winner.count ? { category, count } : winner;
    },
    { category: 'general' as CaseCategory, count: 0 },
  );

  return (
    <Screen>
      <View style={styles.header}>
        <AppText variant="eyebrow">Stats</AppText>
        <AppText variant="display">
          The <AppText variant="display" color={colors.brand.pink} style={styles.script}>receipts</AppText>.
        </AppText>
      </View>

      {cases.length === 0 ? (
        <EmptyState title="Nothing to chart yet." body="Stats unlock after your first case." emoji="📊" icon={BarChart3} />
      ) : (
        <View style={styles.stack}>
          <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
            <View style={styles.badge}>
              <AppText variant="eyebrow" color={colors.text.onBrand}>
                Most overthinking
              </AppText>
            </View>
            <View style={styles.heroTitleRow}>
              <AppText style={styles.heroEmoji}>{categoryIcons[mostCommon.category]}</AppText>
              <AppText variant="display" color={colors.text.onBrand} style={styles.heroTitle}>
                {categoryLabels[mostCommon.category]}
              </AppText>
            </View>
            <AppText variant="subtitle" color={colors.text.onBrand} style={styles.heroSubtitle}>
              "Reading rooms that aren't there."
            </AppText>
            <AppText variant="eyebrow" color={colors.text.onBrand}>
              Avg {average}/100 · {mostCommon.count} cases
            </AppText>
          </LinearGradient>

          <View style={styles.statsRow}>
            <Card style={styles.statCard}>
              <AppText variant="eyebrow">Total cases</AppText>
              <AppText variant="display" style={styles.statValue}>{cases.length}</AppText>
            </Card>
            <Card style={styles.statCard}>
              <AppText variant="eyebrow">Avg score</AppText>
              <View style={styles.statValueRow}>
                <AppText variant="display" style={styles.statValue}>{average}</AppText>
                <AppText variant="title" color={colors.text.secondary} style={styles.statSuffix}>/100</AppText>
              </View>
            </Card>
          </View>

          <View style={styles.categoryList}>
            <AppText variant="eyebrow">By category</AppText>
            {categories.map((category) => {
              const count = cases.filter((item) => item.category === category).length;
              const ratio = cases.length ? count / cases.length : 0;

              return (
                <View key={category} style={styles.categoryRow}>
                  <AppText variant="body" style={styles.categoryLabel}>
                    {categoryIcons[category]} {categoryLabels[category]}
                  </AppText>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: `${Math.max(ratio * 100, count > 0 ? 8 : 0)}%` }]} />
                  </View>
                  <AppText variant="body" color={colors.text.secondary} style={styles.categoryCount}>
                    {count}
                  </AppText>
                </View>
              );
            })}
          </View>

          <Card style={styles.trackCard}>
            <AppText variant="eyebrow">Track record</AppText>
            <View style={styles.trackRow}>
              <AppText variant="display" style={styles.trackNumber}>{accuracy}%</AppText>
              <AppText variant="subtitle" style={styles.trackCopy}>accuracy on resolved cases</AppText>
            </View>
          </Card>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  script: {
    fontFamily: typography.family.editorial,
  },
  stack: {
    gap: spacing.lg,
  },
  hero: {
    borderColor: colors.brand.ink,
    borderRadius: radii.xl,
    borderWidth: 2,
    gap: spacing.sm,
    minHeight: 206,
    padding: 24,
    ...shadows.hard,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  heroTitle: {
    fontFamily: typography.family.displayBold,
    fontSize: 40,
    lineHeight: 44,
  },
  heroTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  heroEmoji: {
    fontSize: 46,
    lineHeight: 50,
  },
  heroSubtitle: {
    fontFamily: typography.family.editorial,
    fontSize: 18,
    lineHeight: 24,
    marginTop: spacing.xs,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  statCard: {
    flex: 1,
    minHeight: 70,
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 30,
    lineHeight: 34,
  },
  statValueRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
  },
  statSuffix: {
    fontFamily: typography.family.displayMedium,
    fontSize: 15,
    lineHeight: 19,
  },
  categoryList: {
    gap: spacing.md,
  },
  categoryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  categoryLabel: {
    fontFamily: typography.family.displaySemiBold,
    fontSize: 15,
    lineHeight: 20,
    width: 122,
  },
  barTrack: {
    backgroundColor: colors.bg.muted,
    borderRadius: radii.pill,
    flex: 1,
    height: 8,
    overflow: 'hidden',
  },
  barFill: {
    backgroundColor: colors.brand.ink,
    borderRadius: radii.pill,
    height: 8,
  },
  categoryCount: {
    fontFamily: typography.family.bodyMedium,
    fontSize: 14,
    lineHeight: 18,
    textAlign: 'right',
    width: 24,
  },
  trackCard: {
    padding: spacing.xl,
  },
  trackRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  trackNumber: {
    fontSize: 36,
    lineHeight: 38,
  },
  trackCopy: {
    flex: 1,
    fontFamily: typography.family.body,
    fontSize: 15,
    lineHeight: 20,
  },
});
