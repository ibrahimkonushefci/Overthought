import { Alert, Pressable, StyleSheet, View } from 'react-native';
import type { ComponentType } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Bell, ChevronRight, LogIn, Shield, Trash2, Crown, FileText, Sparkles } from 'lucide-react-native';
import type { LucideProps } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback } from 'react';
import { authService } from '../../src/features/auth/authService';
import { premiumService } from '../../src/features/premium/premiumService';
import { isPremiumStateActive, usePremiumStore } from '../../src/store/premiumStore';
import { Screen } from '../../src/shared/ui/Screen';
import { AppText } from '../../src/shared/ui/Text';
import { Button } from '../../src/shared/ui/Button';
import { Card } from '../../src/shared/ui/Card';
import { useAuthStore } from '../../src/store/authStore';
import { useCases } from '../../src/features/cases/services/useCases';
import { colors, gradients, radii, shadows, spacing, typography } from '../../src/shared/theme/tokens';

export default function ProfileRoute() {
  const router = useRouter();
  const auth = useAuthStore();
  const premiumState = usePremiumStore((state) => state.premiumState);
  const premiumLoading = usePremiumStore((state) => state.loading);
  const { cases } = useCases();
  const isGuest = auth.sessionMode !== 'authenticated';
  const hasPremium = isPremiumStateActive(premiumState);

  useFocusEffect(
    useCallback(() => {
      if (auth.sessionMode === 'authenticated') {
        void premiumService.refreshPremiumState();
      }
    }, [auth.sessionMode]),
  );

  const restore = async () => {
    const result = await premiumService.restorePurchases();
    const title =
      result.kind === 'restored'
        ? 'Restore purchases'
        : result.kind === 'already_active'
          ? 'Premium active'
          : result.kind === 'nothing_to_restore'
            ? 'Nothing to restore'
            : 'Could not restore';

    Alert.alert(title, result.message);
  };

  return (
    <Screen>
      <View style={styles.header}>
        <AppText variant="eyebrow">You</AppText>
        <AppText variant="display">
          You, <AppText variant="display" color={colors.brand.pink} style={styles.script}>probably</AppText>.
        </AppText>
      </View>

      <Card>
        <View style={styles.accountRow}>
          <View style={styles.avatar}>
            <AppText variant="title" color={colors.accent.lime} style={styles.avatarText}>
              ☹
            </AppText>
          </View>
          <View style={styles.accountCopy}>
            <AppText variant="title" style={styles.accountTitle} numberOfLines={1}>
              {isGuest ? 'Guest' : auth.profile?.displayName ?? 'Account'}
            </AppText>
            <AppText variant="subtitle" style={styles.accountSubtitle} numberOfLines={1}>
              {cases.length} cases · {isGuest ? 'local only' : 'synced'}
            </AppText>
          </View>
          {isGuest ? (
            <View style={styles.signInButton}>
              <Pressable accessibilityRole="button" onPress={() => router.push('/auth')} style={styles.signInPill}>
                <LogIn color={colors.text.onBrand} size={17} strokeWidth={2.4} />
                <AppText variant="body" color={colors.text.onBrand} style={styles.signInText}>Sign in</AppText>
              </Pressable>
            </View>
          ) : (
            <View style={styles.signInButton}>
              <Button title="Sign out" variant="outline" onPress={() => void authService.signOut()} />
            </View>
          )}
        </View>
      </Card>

      <LinearGradient colors={gradients.clown} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.premium}>
        <View style={styles.badge}>
          <Crown color={colors.text.onBrand} size={15} />
          <AppText variant="eyebrow" color={colors.text.onBrand}>
            Premium
          </AppText>
        </View>
        <AppText variant="title" color={colors.text.onBrand} style={styles.premiumTitle}>
          Sharper verdicts.
        </AppText>
        <AppText variant="subtitle" color={colors.text.onBrand} style={styles.premiumSubtitle}>
          {hasPremium
            ? 'Premium is active on this account.'
            : 'Deeper reads, share cards, tone modes and unlimited history.'}
        </AppText>
        <View style={styles.premiumButton}>
          <Button
            title={hasPremium ? 'Premium active' : premiumLoading ? 'Checking Premium' : 'Try Premium'}
            variant="accent"
            icon={Sparkles}
            onPress={() => router.push('/paywall')}
          />
        </View>
      </LinearGradient>

      <View style={styles.settings}>
        <SettingsRow icon={Bell} title="Notifications" value="Off" />
        <SettingsRow icon={Shield} title="Privacy" />
        <SettingsRow icon={FileText} title="Terms and policies" />
        <Pressable accessibilityRole="button" onPress={() => void restore()} style={styles.row}>
          <View style={styles.settingIcon}>
            <Crown color={colors.text.secondary} size={17} />
          </View>
          <AppText variant="body" style={styles.rowTitle}>
            Restore purchases
          </AppText>
          {hasPremium ? <AppText variant="body" color={colors.text.secondary}>Active</AppText> : null}
          <ChevronRight color={colors.text.secondary} size={22} />
        </Pressable>
      </View>

      <Button
        title={isGuest ? 'Delete all data' : 'Delete account'}
        variant="ghost"
        icon={Trash2}
        onPress={() => router.push('/account/profile/delete-account')}
      />

      <AppText variant="meta" center style={styles.footer}>
        Overthought · v0.1 · Made with ❤️ and concerning questions
      </AppText>
    </Screen>
  );
}

function SettingsRow({
  icon: Icon,
  title,
  value,
}: {
  icon: ComponentType<LucideProps>;
  title: string;
  value?: string;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.settingIcon}>
        <Icon color={colors.text.secondary} size={17} />
      </View>
      <AppText variant="body" style={styles.rowTitle}>
        {title}
      </AppText>
      {value ? <AppText variant="body" color={colors.text.secondary}>{value}</AppText> : null}
      <ChevronRight color={colors.text.secondary} size={20} />
    </View>
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
  accountRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.brand.ink,
    borderRadius: 14,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  avatarText: {
    color: colors.accent.orange,
    fontSize: 18,
    lineHeight: 22,
  },
  accountCopy: {
    flex: 1,
    minWidth: 0,
  },
  accountTitle: {
    fontFamily: typography.family.displaySemiBold,
    fontSize: 18,
    lineHeight: 22,
  },
  accountSubtitle: {
    fontFamily: typography.family.body,
    fontSize: 14,
    lineHeight: 19,
  },
  signInButton: {
    width: 100,
  },
  signInPill: {
    alignItems: 'center',
    backgroundColor: colors.brand.ink,
    borderRadius: radii.pill,
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: spacing.md,
  },
  signInText: {
    fontFamily: typography.family.displaySemiBold,
    fontSize: 13,
  },
  premium: {
    borderColor: colors.brand.ink,
    borderRadius: radii.xl,
    borderWidth: 2,
    marginTop: spacing.xl,
    gap: spacing.sm,
    minHeight: 218,
    padding: 24,
    ...shadows.hard,
  },
  badge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(31, 23, 34, 0.24)',
    borderRadius: radii.pill,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  premiumTitle: {
    fontFamily: typography.family.displayBold,
    fontSize: 26,
    lineHeight: 31,
    marginTop: 0,
  },
  premiumSubtitle: {
    fontFamily: typography.family.body,
    fontSize: 14,
    lineHeight: 20,
  },
  premiumButton: {
    marginTop: spacing.xs,
  },
  settings: {
    backgroundColor: colors.bg.surface,
    borderColor: colors.ui.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginTop: spacing.xl,
    overflow: 'hidden',
  },
  row: {
    alignItems: 'center',
    borderBottomColor: colors.ui.divider,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 64,
    paddingHorizontal: spacing.lg,
  },
  settingIcon: {
    alignItems: 'center',
    backgroundColor: colors.bg.muted,
    borderRadius: 10,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  rowTitle: {
    flex: 1,
    fontFamily: typography.family.bodyMedium,
    fontSize: 15,
    lineHeight: 20,
  },
  footer: {
    marginTop: spacing.xl,
  },
});
