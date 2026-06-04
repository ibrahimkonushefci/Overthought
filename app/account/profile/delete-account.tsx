import { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Trash2 } from 'lucide-react-native';
import { authService } from '../../../src/features/auth/authService';
import {
  accountDeletionConfirmationMessage,
  accountDeletionDetailText,
  APPLE_SUBSCRIPTIONS_URL,
} from '../../../src/features/profile/accountDeletionCopy';
import { useAuthStore } from '../../../src/store/authStore';
import { isPremiumStateActive, usePremiumStore } from '../../../src/store/premiumStore';
import { Screen } from '../../../src/shared/ui/Screen';
import { AppText } from '../../../src/shared/ui/Text';
import { Button } from '../../../src/shared/ui/Button';
import { Card } from '../../../src/shared/ui/Card';
import { colors, radii, spacing, typography } from '../../../src/shared/theme/tokens';

export default function DeleteAccountRoute() {
  const router = useRouter();
  const sessionMode = useAuthStore((state) => state.sessionMode);
  const premiumState = usePremiumStore((state) => state.premiumState);
  const [loading, setLoading] = useState(false);
  const isGuest = sessionMode !== 'authenticated';
  const hasPremium = !isGuest && isPremiumStateActive(premiumState);

  const submit = () => {
    Alert.alert(isGuest ? 'Delete local data?' : 'Delete account?', accountDeletionConfirmationMessage(isGuest, hasPremium), [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setLoading(true);
          void (async () => {
            try {
              const result = await authService.deleteAccount();

              if (!result.ok) {
                Alert.alert('Could not delete', result.message ?? 'Try again.');
                return;
              }

              router.replace('/welcome');
            } catch (error) {
              Alert.alert('Could not delete', error instanceof Error ? error.message : 'Try again.');
            } finally {
              setLoading(false);
            }
          })();
        },
      },
    ]);
  };

  const openManageSubscriptions = async () => {
    try {
      await Linking.openURL(APPLE_SUBSCRIPTIONS_URL);
    } catch {
      Alert.alert('Subscriptions', 'Could not open App Store subscriptions right now.');
    }
  };

  return (
    <Screen>
      <View style={styles.topRow}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color={colors.text.primary} size={20} />
        </Pressable>
      </View>
      <AppText variant="display">
        Delete <AppText variant="display" color={colors.brand.pink} style={styles.script}>{isGuest ? 'data' : 'account'}</AppText>.
      </AppText>
      <Card>
        <AppText variant="title">{isGuest ? 'Local guest data' : 'Account deletion'}</AppText>
        <AppText variant="subtitle" style={styles.body}>
          {accountDeletionDetailText(isGuest, hasPremium)}
        </AppText>
        {hasPremium ? (
          <Pressable accessibilityRole="link" onPress={() => void openManageSubscriptions()} style={styles.subscriptionLink}>
            <AppText variant="body" color={colors.brand.pink} style={styles.subscriptionLinkText}>
              Manage Apple subscription
            </AppText>
          </Pressable>
        ) : null}
      </Card>
      <View style={styles.action}>
        <Button
          title={isGuest ? 'Delete all local data' : 'Delete my account'}
          variant="danger"
          icon={Trash2}
          loading={loading}
          onPress={submit}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: spacing.lg,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: colors.bg.surface,
    borderColor: colors.ui.border,
    borderRadius: 14,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  script: {
    fontFamily: typography.family.editorial,
  },
  body: {
    marginTop: spacing.md,
  },
  subscriptionLink: {
    alignSelf: 'flex-start',
    marginTop: spacing.lg,
  },
  subscriptionLinkText: {
    fontFamily: typography.family.displaySemiBold,
  },
  action: {
    marginTop: spacing.xl,
  },
});
