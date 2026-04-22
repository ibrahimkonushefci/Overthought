import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowRight, BarChart3 } from 'lucide-react-native';
import { AppText } from '../../src/shared/ui/Text';
import { Screen } from '../../src/shared/ui/Screen';
import { Card } from '../../src/shared/ui/Card';
import { EmptyState } from '../../src/shared/ui/EmptyState';
import { CaseCard } from '../../src/features/cases/components/CaseCard';
import { HeroActionCard } from '../../src/features/cases/components/HeroActionCard';
import { useCases } from '../../src/features/cases/services/useCases';
import { useAuthStore } from '../../src/store/authStore';
import { colors, spacing, typography } from '../../src/shared/theme/tokens';

export default function HomeRoute() {
  const router = useRouter();
  const { cases } = useCases();
  const sessionMode = useAuthStore((state) => state.sessionMode);
  const average =
    cases.length > 0 ? Math.round(cases.reduce((total, item) => total + item.delusionScore, 0) / cases.length) : null;
  const recent = cases.slice(0, 2);

  return (
    <Screen>
      <View style={styles.header}>
        <AppText variant="eyebrow">Overthought</AppText>
        <AppText variant="display">
          What's the <AppText variant="display" color={colors.brand.pink} style={styles.script}>situation</AppText>?
        </AppText>
        <Pressable accessibilityRole="button" onPress={() => router.push('/profile')} style={styles.faceButton}>
          <AppText variant="title" center style={styles.faceText}>☹</AppText>
        </Pressable>
      </View>

      <HeroActionCard onStart={() => router.push('/new-case')} />

      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <AppText variant="eyebrow">Cases</AppText>
          <AppText variant="display" style={styles.statValue}>{cases.length}</AppText>
        </Card>
        <Card style={styles.statCard}>
          <AppText variant="eyebrow">Avg score</AppText>
          {average === null ? (
            <AppText variant="display" style={styles.statValue}>-</AppText>
          ) : (
            <View style={styles.statValueRow}>
              <AppText variant="display" style={styles.statValue}>{average}</AppText>
              <AppText variant="title" color={colors.text.secondary} style={styles.statSuffix}>/100</AppText>
            </View>
          )}
        </Card>
      </View>

      <View style={styles.sectionHeader}>
        <AppText variant="title" style={styles.sectionTitle}>Recent cases</AppText>
        {cases.length > 0 ? (
          <Pressable accessibilityRole="button" onPress={() => router.push('/cases')} style={styles.seeAll}>
            <AppText variant="body" color={colors.text.secondary} style={styles.seeAllText}>See all</AppText>
            <ArrowRight color={colors.text.secondary} size={13} />
          </Pressable>
        ) : null}
      </View>

      {recent.length > 0 ? (
        <View style={styles.list}>
          {recent.map((item) => (
            <CaseCard key={'localId' in item ? item.localId : item.id} item={item} />
          ))}
        </View>
      ) : (
        <EmptyState title="No cases yet." body="Start your first one above." emoji="🫧" />
      )}

      {sessionMode === 'guest' ? (
        <AppText variant="meta" center style={styles.guestNote}>
          Guest mode · sign in later to sync across devices
        </AppText>
      ) : null}
      <View style={styles.footerIcon}>
        <BarChart3 color={colors.text.secondary} size={1} />
      </View>
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
  faceButton: {
    alignItems: 'center',
    backgroundColor: colors.bg.surface,
    borderColor: colors.brand.ink,
    borderRadius: 18,
    borderWidth: 2,
    height: 44,
    justifyContent: 'center',
    position: 'absolute',
    right: 0,
    top: 0,
    width: 52,
  },
  faceText: {
    color: colors.accent.orange,
    fontSize: 18,
    lineHeight: 22,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.lg,
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
  sectionTitle: {
    fontFamily: typography.family.displaySemiBold,
    fontSize: 17,
    lineHeight: 21,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  seeAll: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  seeAllText: {
    fontFamily: typography.family.body,
    fontSize: 14,
  },
  list: {
    gap: spacing.md,
  },
  guestNote: {
    marginTop: spacing.xl,
    fontFamily: typography.family.body,
    fontSize: 12,
  },
  footerIcon: {
    height: 1,
    width: 1,
  },
});
