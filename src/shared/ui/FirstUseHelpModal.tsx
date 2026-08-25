import { useEffect, useMemo, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { CheckCircle2, FileText, Sparkles } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useAuthStore } from '../../store/authStore';
import { useGuestStore } from '../../store/guestStore';
import { useUiPreferencesStore } from '../../store/uiPreferencesStore';
import { Button } from './Button';
import { AppText } from './Text';
import { colors, radii, shadows, spacing, typography } from '../theme/tokens';

interface HelpStep {
  icon: LucideIcon;
  title: string;
  body: string;
  tone: 'describe' | 'verdict' | 'move';
}

const helpSteps: HelpStep[] = [
  {
    icon: FileText,
    title: 'Describe it',
    body: 'Tell us what they texted or did. No screenshot upload needed.',
    tone: 'describe',
  },
  {
    icon: Sparkles,
    title: 'Get the verdict',
    body: 'Smart Verdict checks the evidence and gives you a Delusion Score.',
    tone: 'verdict',
  },
  {
    icon: CheckCircle2,
    title: 'Take one next move',
    body: 'Reply, ask directly, wait, or step back.',
    tone: 'move',
  },
];

function stepIconStyle(tone: HelpStep['tone']) {
  switch (tone) {
    case 'describe':
      return styles.describeIcon;
    case 'verdict':
      return styles.verdictIcon;
    case 'move':
    default:
      return styles.moveIcon;
  }
}

export function FirstUseHelpModal() {
  const pathname = usePathname();
  const router = useRouter();
  const sessionMode = useAuthStore((state) => state.sessionMode);
  const hasCompletedEntry = useAuthStore((state) => state.hasCompletedEntry);
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const guestCases = useGuestStore((state) => state.cases);
  const migratedCaseMap = useGuestStore((state) => state.migratedCaseMap);
  const migrationPromptDecision = useGuestStore((state) =>
    userId ? state.migrationPromptByUserId[userId] : undefined,
  );
  const hasSeenFirstUseHelp = useUiPreferencesStore((state) => state.hasSeenFirstUseHelp);
  const markFirstUseHelpSeen = useUiPreferencesStore((state) => state.markFirstUseHelpSeen);
  const [visible, setVisible] = useState(false);

  const hasPendingMigrationPrompt = useMemo(() => {
    if (sessionMode !== 'authenticated' || !userId || migrationPromptDecision) {
      return false;
    }

    return guestCases.some((item) => !item.deletedAt && !item.archivedAt && !migratedCaseMap[item.localId]);
  }, [guestCases, migratedCaseMap, migrationPromptDecision, sessionMode, userId]);

  const shouldOfferHelp =
    pathname === '/home' &&
    !hasSeenFirstUseHelp &&
    hasCompletedEntry &&
    (sessionMode === 'guest' || sessionMode === 'authenticated') &&
    !hasPendingMigrationPrompt;

  useEffect(() => {
    if (!shouldOfferHelp) {
      setVisible(false);
      return;
    }

    const timer = setTimeout(() => setVisible(true), 350);
    return () => clearTimeout(timer);
  }, [shouldOfferHelp]);

  const close = () => {
    markFirstUseHelpSeen();
    setVisible(false);
  };

  const startCase = () => {
    close();
    router.push('/new-case');
  };

  return (
    <Modal animationType="fade" onRequestClose={() => {}} transparent visible={visible}>
      <View style={styles.backdrop}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <View style={styles.badge}>
              <AppText variant="eyebrow" color={colors.text.onAccent} style={styles.badgeText}>
                How it works
              </AppText>
            </View>
          </View>

          <AppText variant="display" style={styles.title}>
            Dating drama, decoded.
          </AppText>
          <AppText variant="subtitle" style={styles.subtitle}>
            Three steps. No chatbot spiral.
          </AppText>

          <View style={styles.steps}>
            {helpSteps.map((step) => {
              const Icon = step.icon;

              return (
                <View key={step.title} style={styles.stepRow}>
                  <View style={[styles.stepIcon, stepIconStyle(step.tone)]}>
                    <Icon color={step.tone === 'describe' ? colors.text.onBrand : colors.text.primary} size={18} strokeWidth={2.8} />
                  </View>
                  <View style={styles.stepCopy}>
                    <AppText variant="body" style={styles.stepTitle}>
                      {step.title}
                    </AppText>
                    <AppText variant="meta" style={styles.stepBody}>
                      {step.body}
                    </AppText>
                  </View>
                </View>
              );
            })}
          </View>

          <View style={styles.reassurance}>
            <CheckCircle2 color={colors.brand.pink} size={17} strokeWidth={2.6} />
            <AppText variant="meta" style={styles.reassuranceText}>
              You can start messy. Overthought exists for exactly that.
            </AppText>
          </View>

          <Button title="Start my case" variant="accent" onPress={startCase} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(31, 23, 34, 0.54)',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modal: {
    backgroundColor: colors.bg.surface,
    borderColor: colors.brand.ink,
    borderRadius: radii.xl,
    borderWidth: 2,
    gap: spacing.md,
    maxHeight: '88%',
    padding: spacing.xl,
    width: '100%',
    ...shadows.hard,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  badge: {
    backgroundColor: colors.accent.lime,
    borderColor: colors.brand.ink,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  badgeText: {
    fontFamily: typography.family.displayBold,
    fontSize: 9,
    letterSpacing: 1.5,
    lineHeight: 12,
  },
  title: {
    fontSize: 30,
    lineHeight: 34,
  },
  subtitle: {
    marginTop: -spacing.xs,
  },
  steps: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  stepRow: {
    alignItems: 'center',
    backgroundColor: colors.bg.muted,
    borderColor: colors.ui.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  stepIcon: {
    alignItems: 'center',
    borderColor: colors.brand.ink,
    borderRadius: 15,
    borderWidth: 1.5,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  describeIcon: {
    backgroundColor: colors.brand.pink,
  },
  verdictIcon: {
    backgroundColor: colors.accent.lime,
  },
  moveIcon: {
    backgroundColor: '#F8C7D4',
  },
  stepCopy: {
    flex: 1,
    gap: 1,
    minWidth: 0,
  },
  stepTitle: {
    fontFamily: typography.family.displaySemiBold,
    fontSize: 14,
    lineHeight: 18,
  },
  stepBody: {
    fontFamily: typography.family.bodyMedium,
    fontSize: 12,
    lineHeight: 16,
  },
  reassurance: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  reassuranceText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
});
