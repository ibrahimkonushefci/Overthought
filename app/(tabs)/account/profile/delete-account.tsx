import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Trash2 } from 'lucide-react-native';
import { authService } from '../../../../src/features/auth/authService';
import { useAuthStore } from '../../../../src/store/authStore';
import { Screen } from '../../../../src/shared/ui/Screen';
import { AppText } from '../../../../src/shared/ui/Text';
import { Button } from '../../../../src/shared/ui/Button';
import { Card } from '../../../../src/shared/ui/Card';
import { colors, radii, spacing, typography } from '../../../../src/shared/theme/tokens';

export default function DeleteAccountRoute() {
  const router = useRouter();
  const sessionMode = useAuthStore((state) => state.sessionMode);
  const [loading, setLoading] = useState(false);
  const isGuest = sessionMode !== 'authenticated';

  const submit = () => {
    Alert.alert(isGuest ? 'Delete local data?' : 'Delete account?', 'This action cannot be undone from the app.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setLoading(true);
          void authService.deleteAccount().then((result) => {
            setLoading(false);
            if (!result.ok) {
              Alert.alert('Could not delete', result.message ?? 'Try again.');
              return;
            }
            router.replace('/welcome');
          });
        },
      },
    ]);
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
          {isGuest
            ? 'This clears guest cases, drafts, and local session markers from this device.'
            : 'This marks your profile for deletion and signs you out. A secured Supabase function should complete auth-user deletion before release.'}
        </AppText>
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
  action: {
    marginTop: spacing.xl,
  },
});
