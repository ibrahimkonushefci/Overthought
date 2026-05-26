import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight, FileText, Lock, Plus, Sparkles } from 'lucide-react-native';
import { AppText } from '../../src/shared/ui/Text';
import { Screen } from '../../src/shared/ui/Screen';
import { Card } from '../../src/shared/ui/Card';
import { EmptyState } from '../../src/shared/ui/EmptyState';
import { CaseCard } from '../../src/features/cases/components/CaseCard';
import { useCases } from '../../src/features/cases/services/useCases';
import { getCaseId } from '../../src/features/cases/types';
import { useAuthStore } from '../../src/store/authStore';
import { colors, gradients, radii, shadows, spacing, typography } from '../../src/shared/theme/tokens';

export default function HomeRoute() {
  const router = useRouter();
  const { cases } = useCases();
  const sessionMode = useAuthStore((state) => state.sessionMode);
  const average =
    cases.length > 0 ? Math.round(cases.reduce((total, item) => total + item.delusionScore, 0) / cases.length) : null;
  const recent = cases.slice(0, 5);

  return (
    <Screen>
      <View style={styles.header}>
        <AppText variant="eyebrow" style={styles.brandLabel}>Overthought</AppText>
        <View style={styles.headlineBlock}>
          <AppText variant="display" style={styles.headline}>What's the</AppText>
          <AppText variant="display" style={styles.headlineSecondLine}>
            <AppText variant="display" color={colors.brand.pink} style={styles.script}>situation</AppText>?
          </AppText>
        </View>
        <Pressable accessibilityRole="button" onPress={() => router.push('/profile')} style={styles.faceButton}>
          <AppText variant="title" center style={styles.faceText}>🫠</AppText>
        </Pressable>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/new-case')}
        style={({ pressed }) => [styles.heroPressable, pressed && styles.pressed]}
      >
        <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroBadge}>
              <Sparkles color={colors.text.onBrand} size={12} strokeWidth={2.5} />
              <AppText variant="eyebrow" color={colors.text.onBrand} style={styles.heroBadgeText}>
                New case
              </AppText>
            </View>
            <AppText variant="eyebrow" color={colors.text.onBrand} style={styles.dropIt}>
              Drop it
            </AppText>
          </View>
          <View style={styles.heroBody}>
            <View style={styles.heroCopy}>
              <AppText variant="title" color={colors.text.onBrand} style={styles.heroTitle}>
                Tell me what they did.
              </AppText>
              <AppText variant="subtitle" color={colors.text.onBrand} style={styles.heroSubtitle}>
                I'll tell you if it's giving clown.
              </AppText>
            </View>
            <View style={styles.heroPlus}>
              <Plus color={colors.brand.ink} size={22} strokeWidth={3} />
            </View>
          </View>
        </LinearGradient>
      </Pressable>

      <View style={styles.statsRow}>
        <Card outlined style={styles.statCard}>
          <View style={styles.statLabelRow}>
            <View style={[styles.statDot, { backgroundColor: colors.accent.lime }]} />
            <AppText variant="eyebrow" style={styles.statLabel}>Cases</AppText>
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
          {average === null ? (
            <AppText variant="display" style={styles.statValue}>-</AppText>
          ) : (
            <View style={styles.statValueRow}>
              <AppText variant="display" style={styles.statValue}>{average}</AppText>
              <AppText variant="title" color={colors.text.secondary} style={styles.statSuffix}>/100</AppText>
            </View>
          )}
          <AppText variant="meta" color={colors.text.secondary} style={styles.statHelper}>
            Your average case score
          </AppText>
        </Card>
      </View>

      <View style={styles.sectionHeader}>
        <View style={styles.sectionCopy}>
          <View style={styles.sectionTitleRow}>
            <FileText color={colors.brand.ink} size={18} strokeWidth={2.5} />
            <AppText variant="title" style={styles.sectionTitle}>Recent cases</AppText>
          </View>
          <AppText variant="subtitle" style={styles.sectionSubtitle}>The receipts so far</AppText>
        </View>
        {cases.length > 0 ? (
          <Pressable accessibilityRole="button" onPress={() => router.push('/cases')} style={styles.seeAll}>
            <AppText variant="body" color={colors.brand.pink} style={styles.seeAllText}>See all</AppText>
            <ArrowRight color={colors.brand.pink} size={17} strokeWidth={3} />
          </Pressable>
        ) : null}
      </View>

      {recent.length > 0 ? (
        <View style={styles.list}>
          {recent.map((item) => (
            <CaseCard key={getCaseId(item)} item={item} />
          ))}
        </View>
      ) : (
        <EmptyState title="No cases yet." body="Start your first one above." emoji="🫧" />
      )}

      {sessionMode === 'guest' ? (
        <View style={styles.guestNote}>
          <Lock color={colors.text.secondary} size={17} strokeWidth={2.2} />
          <AppText variant="meta" color={colors.text.secondary} style={styles.guestText}>
            Guest mode — sign in later to sync your cases.
          </AppText>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 2,
    marginBottom: spacing.lg,
    paddingRight: 62,
  },
  brandLabel: {
    color: colors.text.secondary,
    fontSize: 10,
    letterSpacing: 3.4,
    lineHeight: 14,
  },
  headline: {
    fontSize: 28,
    lineHeight: 30,
  },
  headlineBlock: {
    gap: 0,
  },
  headlineSecondLine: {
    fontSize: 28,
    lineHeight: 42,
  },
  script: {
    fontFamily: typography.family.editorial,
    fontSize: 36,
    lineHeight: 42,
  },
  faceButton: {
    alignItems: 'center',
    backgroundColor: colors.bg.surface,
    borderColor: colors.brand.ink,
    borderRadius: 27,
    borderWidth: 2,
    height: 54,
    justifyContent: 'center',
    position: 'absolute',
    right: 0,
    top: 0,
    width: 54,
    ...shadows.hardSmall,
  },
  faceText: {
    color: colors.accent.orange,
    fontSize: 24,
    lineHeight: 28,
  },
  heroPressable: {
    borderRadius: radii.xl,
  },
  heroCard: {
    borderColor: colors.brand.ink,
    borderRadius: 25,
    borderWidth: 2,
    minHeight: 126,
    paddingHorizontal: spacing.lg,
    paddingVertical: 9,
    ...shadows.hardSmall,
  },
  heroTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  heroBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderColor: 'rgba(255, 255, 255, 0.22)',
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  heroBadgeText: {
    fontSize: 10,
    letterSpacing: 2,
  },
  dropIt: {
    fontSize: 10,
    letterSpacing: 3,
  },
  heroBody: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  heroCopy: {
    flex: 1,
    gap: spacing.sm,
  },
  heroTitle: {
    fontFamily: typography.family.displayBold,
    fontSize: 21,
    lineHeight: 23,
    maxWidth: 190,
  },
  heroSubtitle: {
    fontFamily: typography.family.bodySemiBold,
    fontSize: 12,
    lineHeight: 16,
    opacity: 0.92,
  },
  heroPlus: {
    alignItems: 'center',
    backgroundColor: colors.bg.surface,
    borderColor: colors.brand.ink,
    borderRadius: 23,
    borderWidth: 2,
    height: 46,
    justifyContent: 'center',
    width: 46,
    ...shadows.hardSmall,
  },
  pressed: {
    opacity: 0.75,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  statCard: {
    flex: 1,
    borderRadius: 24,
    justifyContent: 'center',
    minHeight: 84,
    padding: spacing.md,
    ...shadows.hardSmall,
  },
  statLabelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: 1,
  },
  statDot: {
    borderRadius: 5,
    height: 8,
    width: 8,
  },
  statLabel: {
    color: colors.text.secondary,
    fontSize: 9,
    letterSpacing: 2,
  },
  statValue: {
    fontSize: 28,
    lineHeight: 30,
  },
  statValueRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  statSmallCopy: {
    fontFamily: typography.family.displaySemiBold,
    fontSize: 12,
    lineHeight: 15,
  },
  statSuffix: {
    fontFamily: typography.family.displayMedium,
    fontSize: 13,
    lineHeight: 16,
  },
  statHelper: {
    fontSize: 10,
    lineHeight: 13,
    marginTop: 1,
  },
  sectionCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  sectionTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  sectionTitle: {
    fontFamily: typography.family.displaySemiBold,
    fontSize: 20,
    lineHeight: 23,
  },
  sectionSubtitle: {
    color: colors.text.secondary,
    fontSize: 14,
    lineHeight: 17,
  },
  sectionHeader: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },
  seeAll: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    paddingBottom: 1,
  },
  seeAllText: {
    fontFamily: typography.family.displaySemiBold,
    fontSize: 15,
    lineHeight: 18,
  },
  list: {
    gap: spacing.md,
  },
  guestNote: {
    alignItems: 'center',
    borderColor: colors.ui.border,
    borderRadius: radii.xl,
    borderStyle: 'dashed',
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'center',
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  guestText: {
    flexShrink: 1,
    fontFamily: typography.family.bodyMedium,
    fontSize: 13,
    lineHeight: 17,
  },
});
