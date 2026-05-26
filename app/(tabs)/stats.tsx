import { StyleSheet, View } from 'react-native';
import { Archive, Sparkles } from 'lucide-react-native';
import type { CaseCategory } from '../../src/types/shared';
import { Screen } from '../../src/shared/ui/Screen';
import { AppText } from '../../src/shared/ui/Text';
import { Card } from '../../src/shared/ui/Card';
import { useCases } from '../../src/features/cases/services/useCases';
import { categoryIcons, categoryLabels } from '../../src/shared/utils/verdict';
import { colors, gradients, radii, shadows, spacing, typography } from '../../src/shared/theme/tokens';
import { LinearGradient } from 'expo-linear-gradient';

const categories: CaseCategory[] = ['romance', 'friendship', 'social', 'general'];

export default function StatsRoute() {
  const { cases } = useCases();
  const categoryStats = categories.map((category) => {
    const categoryCases = cases.filter((item) => item.category === category);
    const averageScore =
      categoryCases.length > 0
        ? Math.round(categoryCases.reduce((total, item) => total + item.delusionScore, 0) / categoryCases.length)
        : 0;

    return {
      category,
      count: categoryCases.length,
      averageScore,
    };
  });
  const average =
    cases.length > 0 ? Math.round(cases.reduce((total, item) => total + item.delusionScore, 0) / cases.length) : 0;
  const closed = cases.filter((item) => item.outcomeStatus !== 'unknown');
  const resolved = cases.filter((item) => item.outcomeStatus === 'right' || item.outcomeStatus === 'wrong');
  const right = cases.filter((item) => item.outcomeStatus === 'right').length;
  const overthought = cases.filter((item) => item.outcomeStatus === 'wrong').length;
  const unclear = cases.filter((item) => item.outcomeStatus === 'unclear').length;
  const accuracy = resolved.length > 0 ? Math.round((right / resolved.length) * 100) : 0;
  const mostCommon = categoryStats.reduce(
    (winner, category) => {
      return category.count > winner.count ? category : winner;
    },
    { category: 'general' as CaseCategory, count: 0, averageScore: 0 },
  );

  return (
    <Screen>
      <View style={styles.header}>
        <AppText variant="eyebrow" style={styles.headerLabel}>Stats</AppText>
        <AppText variant="display" style={styles.title}>
          The <AppText variant="display" color={colors.brand.pink} style={styles.script}>receipts</AppText>.
        </AppText>
      </View>

      <View style={styles.stack}>
        <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <View style={styles.heroTopRow}>
            <View style={styles.badge}>
              <Sparkles color={colors.text.onBrand} size={12} strokeWidth={2.5} />
              <AppText variant="eyebrow" color={colors.text.onBrand} style={styles.badgeText}>
                Main spiral
              </AppText>
            </View>
            <AppText variant="eyebrow" color={colors.text.onBrand} style={styles.monthLabel}>
              This month
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
          <AppText variant="eyebrow" color={colors.text.onBrand} style={styles.heroMeta}>
            Avg {mostCommon.averageScore}/100 · {mostCommon.count} cases
          </AppText>
        </LinearGradient>

        <View style={styles.statsRow}>
          <Card outlined style={styles.statCard}>
            <View style={styles.statLabelRow}>
              <View style={[styles.statDot, { backgroundColor: colors.accent.lime }]} />
              <AppText variant="eyebrow" style={styles.statLabel}>Total cases</AppText>
            </View>
            <View style={styles.statValueRow}>
              <AppText variant="display" style={styles.statValue}>{cases.length}</AppText>
              <AppText variant="body" color={colors.text.secondary} style={styles.statSmallCopy}>filed</AppText>
            </View>
          </Card>
          <Card outlined style={styles.statCard}>
            <View style={styles.statLabelRow}>
              <View style={[styles.statDot, { backgroundColor: colors.brand.pink }]} />
              <AppText variant="eyebrow" style={styles.statLabel}>Avg delusion</AppText>
            </View>
            <View style={styles.statValueRow}>
              <AppText variant="display" style={styles.statValue}>{average}</AppText>
              <AppText variant="title" color={colors.text.secondary} style={styles.statSuffix}>/100</AppText>
            </View>
            <AppText variant="meta" color={colors.text.secondary} style={styles.statHelper}>
              Across all cases
            </AppText>
          </Card>
        </View>

        <Card outlined style={styles.categoryCard}>
          <View style={styles.categoryHeader}>
            <AppText variant="eyebrow" style={styles.sectionEyebrow}>By category</AppText>
            <AppText variant="body" color={colors.text.secondary} style={styles.totalCopy}>
              {cases.length} total
            </AppText>
          </View>
          <AppText variant="subtitle" style={styles.categorySubtitle}>
            Where the spirals are happening
          </AppText>
          <View style={styles.categoryList}>
            {categoryStats.map(({ category, count }) => {
              const ratio = cases.length ? count / cases.length : 0;
              const isTopCategory = category === mostCommon.category && count > 0;

              return (
                <View key={category} style={styles.categoryRow}>
                  <AppText variant="body" style={styles.categoryLabel}>
                    {categoryIcons[category]} {categoryLabels[category]}
                  </AppText>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        isTopCategory && styles.topBarFill,
                        { width: `${Math.max(ratio * 100, count > 0 ? 14 : 0)}%` },
                      ]}
                    />
                  </View>
                  <AppText variant="body" color={colors.text.secondary} style={styles.categoryCount}>
                    {count}
                  </AppText>
                </View>
              );
            })}
          </View>
        </Card>

        <Card outlined style={styles.trackCard}>
          <AppText variant="eyebrow" style={styles.sectionEyebrow}>Track record</AppText>
          {closed.length === 0 ? (
            <View style={styles.trackEmptyRow}>
              <View style={styles.trackIconBadge}>
                <Archive color={colors.text.secondary} size={23} strokeWidth={2.4} />
              </View>
              <View style={styles.trackEmptyCopy}>
                <AppText variant="title" style={styles.trackEmptyTitle}>No closed cases yet</AppText>
                <AppText variant="subtitle" style={styles.trackCopy}>
                  Mark cases as <AppText variant="subtitle" style={styles.trackStrong}>right</AppText>,{' '}
                  <AppText variant="subtitle" style={styles.trackStrong}>overthought</AppText>, or{' '}
                  <AppText variant="subtitle" style={styles.trackStrong}>unclear</AppText> to build your record.
                </AppText>
              </View>
            </View>
          ) : (
            <View style={styles.trackResolved}>
              <View style={styles.trackRow}>
                <AppText variant="display" style={styles.trackNumber}>{accuracy}%</AppText>
                <AppText variant="subtitle" style={styles.trackCopy}>accuracy on resolved cases</AppText>
              </View>
              <View style={styles.outcomeRow}>
                <AppText variant="meta" style={styles.outcomeCopy}>{right} right</AppText>
                <AppText variant="meta" style={styles.outcomeCopy}>{overthought} overthought</AppText>
                <AppText variant="meta" style={styles.outcomeCopy}>{unclear} unclear</AppText>
              </View>
            </View>
          )}
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 2,
    marginBottom: spacing.xl,
  },
  headerLabel: {
    fontSize: 10,
    letterSpacing: 3.4,
    lineHeight: 13,
  },
  title: {
    fontSize: 35,
    lineHeight: 39,
  },
  script: {
    fontFamily: typography.family.editorial,
    fontSize: 42,
    lineHeight: 42,
  },
  stack: {
    gap: spacing.lg,
  },
  hero: {
    borderColor: colors.brand.ink,
    borderRadius: radii.xl,
    borderWidth: 2,
    minHeight: 156,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    ...shadows.hard,
  },
  heroTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  badge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderColor: 'rgba(255, 255, 255, 0.22)',
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 9,
    letterSpacing: 2.1,
  },
  monthLabel: {
    fontSize: 9,
    letterSpacing: 3,
  },
  heroTitle: {
    fontFamily: typography.family.displayBold,
    fontSize: 33,
    lineHeight: 36,
    flexShrink: 1,
  },
  heroTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  heroEmoji: {
    fontSize: 33,
    lineHeight: 37,
  },
  heroSubtitle: {
    fontFamily: typography.family.editorial,
    fontSize: 17,
    lineHeight: 22,
    marginTop: spacing.lg,
  },
  heroMeta: {
    fontSize: 9,
    letterSpacing: 2.9,
    marginTop: spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
    borderRadius: 22,
    justifyContent: 'center',
    minHeight: 88,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...shadows.hardSmall,
  },
  statLabelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statDot: {
    borderRadius: 5,
    height: 8,
    width: 8,
  },
  statLabel: {
    color: colors.text.secondary,
    fontSize: 9,
    letterSpacing: 2.2,
  },
  statValue: {
    fontSize: 29,
    lineHeight: 31,
  },
  statValueRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  statSmallCopy: {
    fontFamily: typography.family.displaySemiBold,
    fontSize: 13,
    lineHeight: 16,
  },
  statSuffix: {
    fontFamily: typography.family.displayMedium,
    fontSize: 13,
    lineHeight: 16,
  },
  statHelper: {
    fontSize: 11,
    lineHeight: 14,
    marginTop: 2,
  },
  categoryCard: {
    borderRadius: 24,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    ...shadows.hardSmall,
  },
  categoryHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionEyebrow: {
    fontSize: 10,
    letterSpacing: 3,
  },
  totalCopy: {
    fontFamily: typography.family.displayBold,
    fontSize: 13,
    lineHeight: 16,
  },
  categorySubtitle: {
    color: colors.text.secondary,
    fontSize: 13,
    lineHeight: 17,
    marginTop: spacing.xs,
  },
  categoryList: {
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  categoryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  categoryLabel: {
    fontFamily: typography.family.displaySemiBold,
    fontSize: 14,
    lineHeight: 18,
    width: 112,
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
  topBarFill: {
    backgroundColor: colors.brand.pink,
  },
  categoryCount: {
    fontFamily: typography.family.displayBold,
    fontSize: 14,
    lineHeight: 18,
    textAlign: 'right',
    width: 24,
  },
  trackCard: {
    borderRadius: 24,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    ...shadows.hardSmall,
  },
  trackEmptyRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.lg,
  },
  trackIconBadge: {
    alignItems: 'center',
    backgroundColor: colors.bg.creamTint,
    borderColor: colors.text.secondary,
    borderRadius: 35,
    borderStyle: 'dashed',
    borderWidth: 2,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  trackEmptyCopy: {
    flex: 1,
  },
  trackEmptyTitle: {
    fontSize: 19,
    lineHeight: 23,
    marginBottom: spacing.xs,
  },
  trackStrong: {
    color: colors.text.primary,
    fontFamily: typography.family.bodySemiBold,
  },
  trackRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  trackNumber: {
    fontSize: 31,
    lineHeight: 33,
  },
  trackCopy: {
    flex: 1,
    fontFamily: typography.family.body,
    fontSize: 15,
    lineHeight: 19,
  },
  trackResolved: {
    gap: spacing.md,
  },
  outcomeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  outcomeCopy: {
    color: colors.text.secondary,
    fontFamily: typography.family.displaySemiBold,
  },
});
