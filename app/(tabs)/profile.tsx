import { Alert, Linking, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import type { ComponentType } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronRight, LogIn, Shield, Trash2, Crown, FileText, Sparkles, User } from 'lucide-react-native';
import type { LucideProps } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useState } from 'react';
import { authService } from '../../src/features/auth/authService';
import { premiumService } from '../../src/features/premium/premiumService';
import { profileRepository } from '../../src/features/profile/profileRepository';
import { isPremiumStateActive, usePremiumStore } from '../../src/store/premiumStore';
import { Screen } from '../../src/shared/ui/Screen';
import { AppText } from '../../src/shared/ui/Text';
import { Button } from '../../src/shared/ui/Button';
import { Card } from '../../src/shared/ui/Card';
import { useAuthStore } from '../../src/store/authStore';
import { useCases } from '../../src/features/cases/services/useCases';
import { caseRepository } from '../../src/features/cases/repositories/caseRepository';
import { env } from '../../src/lib/env';
import { colors, gradients, radii, shadows, spacing, typography } from '../../src/shared/theme/tokens';

export default function ProfileRoute() {
  const router = useRouter();
  const auth = useAuthStore();
  const premiumState = usePremiumStore((state) => state.premiumState);
  const premiumLoading = usePremiumStore((state) => state.loading);
  const { cases, refresh } = useCases();
  const [deletingCases, setDeletingCases] = useState(false);
  const [profileEditorVisible, setProfileEditorVisible] = useState(false);
  const [displayNameDraft, setDisplayNameDraft] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const isGuest = auth.sessionMode !== 'authenticated';
  const hasPremium = isPremiumStateActive(premiumState);
  const accountDisplayName = isGuest ? 'Guest' : auth.profile?.displayName ?? auth.user?.email?.split('@')[0] ?? 'Account';

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

  const openProfileEditor = () => {
    if (isGuest) {
      router.push('/auth');
      return;
    }

    setDisplayNameDraft(auth.profile?.displayName ?? '');
    setProfileEditorVisible(true);
  };

  const saveProfile = async () => {
    if (savingProfile) {
      return;
    }

    setSavingProfile(true);
    try {
      const profile = await profileRepository.updateCurrentProfile({ displayName: displayNameDraft });
      useAuthStore.getState().setProfile(profile);
      setProfileEditorVisible(false);
    } catch (error) {
      Alert.alert('Could not update profile', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setSavingProfile(false);
    }
  };

  const signOut = async () => {
    if (signingOut) {
      return;
    }

    setSigningOut(true);
    await authService.signOut();
    router.replace('/welcome');
    setSigningOut(false);
  };

  const deleteAllCases = () => {
    if (cases.length === 0) {
      Alert.alert('No cases to delete', 'Your case file is already empty.');
      return;
    }

    Alert.alert(
      'Delete all cases?',
      isGuest
        ? 'This removes all saved guest cases and updates from this device. Your guest session stays active.'
        : 'This removes all synced cases and updates from your case file. Your account stays active.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete all',
          style: 'destructive',
          onPress: () => {
            setDeletingCases(true);
            void caseRepository
              .archiveAllCases()
              .then(() => refresh())
              .catch((error) => {
                Alert.alert('Could not delete cases', error instanceof Error ? error.message : 'Try again.');
              })
              .finally(() => {
                setDeletingCases(false);
              });
          },
        },
      ],
    );
  };

  const openConfiguredUrl = async (label: string, url: string, envName: string) => {
    const trimmedUrl = url.trim();

    if (!trimmedUrl) {
      Alert.alert(label, `Add ${envName} to enable this link.`);
      return;
    }

    try {
      await Linking.openURL(trimmedUrl);
    } catch {
      Alert.alert(label, 'Could not open this link right now.');
    }
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
              {accountDisplayName}
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
              <Button title="Sign out" variant="outline" loading={signingOut} disabled={signingOut} onPress={() => void signOut()} />
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
          Sharper Deep Reads.
        </AppText>
        <AppText variant="subtitle" color={colors.text.onBrand} style={styles.premiumSubtitle}>
          {hasPremium
            ? 'Premium is active on this account.'
            : 'Get more Smart reads for the cases you cannot stop replaying. Fair-use limits apply.'}
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
        <SettingsRow
          icon={User}
          title="Display name"
          value={isGuest ? 'Sign in' : accountDisplayName}
          onPress={openProfileEditor}
        />
        <SettingsRow
          icon={Shield}
          title="Privacy Policy"
          onPress={() => void openConfiguredUrl('Privacy Policy', env.privacyPolicyUrl, 'EXPO_PUBLIC_PRIVACY_POLICY_URL')}
        />
        <SettingsRow
          icon={FileText}
          title="Terms and policies"
          onPress={() => void openConfiguredUrl('Terms and policies', env.termsUrl, 'EXPO_PUBLIC_TERMS_URL')}
        />
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

      <View style={styles.destructiveActions}>
        <Button
          title="Delete all cases"
          variant="ghost"
          icon={Trash2}
          loading={deletingCases}
          disabled={deletingCases}
          onPress={deleteAllCases}
        />
        <Button
          title={isGuest ? 'Delete all data' : 'Delete account'}
          variant="ghost"
          icon={Trash2}
          onPress={() => router.push('/account/profile/delete-account')}
        />
      </View>

      <AppText variant="meta" center style={styles.footer}>
        Overthought · v0.1 · Made with ❤️ and concerning questions
      </AppText>

      <Modal
        animationType="fade"
        transparent
        visible={profileEditorVisible}
        onRequestClose={() => setProfileEditorVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.profileModal}>
            <AppText variant="title" style={styles.profileModalTitle}>
              Display name
            </AppText>
            <TextInput
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={40}
              onChangeText={setDisplayNameDraft}
              placeholder="Account"
              placeholderTextColor={colors.text.secondary}
              returnKeyType="done"
              submitBehavior="submit"
              style={styles.profileInput}
              onSubmitEditing={() => void saveProfile()}
              value={displayNameDraft}
            />
            <AppText variant="meta" color={colors.text.secondary} style={styles.profileHelp}>
              Leave blank to use your email name.
            </AppText>
            <View style={styles.profileModalActions}>
              <Button title="Cancel" variant="outline" disabled={savingProfile} onPress={() => setProfileEditorVisible(false)} />
              <Button title="Save" variant="accent" loading={savingProfile} onPress={() => void saveProfile()} />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function SettingsRow({
  icon: Icon,
  title,
  value,
  onPress,
}: {
  icon: ComponentType<LucideProps>;
  title: string;
  value?: string;
  onPress?: () => void;
}) {
  const content = (
    <>
      <View style={styles.settingIcon}>
        <Icon color={colors.text.secondary} size={17} />
      </View>
      <AppText variant="body" style={styles.rowTitle}>
        {title}
      </AppText>
      {value ? <AppText variant="body" color={colors.text.secondary}>{value}</AppText> : null}
      <ChevronRight color={colors.text.secondary} size={20} />
    </>
  );

  if (onPress) {
    return (
      <Pressable accessibilityRole="button" onPress={onPress} style={styles.row}>
        {content}
      </Pressable>
    );
  }

  return (
    <View style={styles.row}>
      {content}
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
  destructiveActions: {
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  footer: {
    marginTop: spacing.xl,
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(31, 23, 34, 0.52)',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  profileModal: {
    backgroundColor: colors.bg.surface,
    borderColor: colors.brand.ink,
    borderRadius: radii.lg,
    borderWidth: 2,
    gap: spacing.md,
    padding: spacing.lg,
    width: '100%',
    ...shadows.hard,
  },
  profileModalTitle: {
    fontFamily: typography.family.displaySemiBold,
    fontSize: 22,
    lineHeight: 27,
  },
  profileInput: {
    backgroundColor: colors.bg.muted,
    borderColor: colors.ui.border,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.text.primary,
    fontFamily: typography.family.body,
    fontSize: 17,
    minHeight: 52,
    paddingHorizontal: spacing.md,
  },
  profileHelp: {
    marginTop: -spacing.xs,
  },
  profileModalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
