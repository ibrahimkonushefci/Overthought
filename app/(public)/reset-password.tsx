import { useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, KeyRound } from 'lucide-react-native';
import { authService } from '../../src/features/auth/authService';
import { useAuthStore } from '../../src/store/authStore';
import { Button } from '../../src/shared/ui/Button';
import { AppText } from '../../src/shared/ui/Text';
import { Screen } from '../../src/shared/ui/Screen';
import { colors, radii, spacing, typography } from '../../src/shared/theme/tokens';

export default function ResetPasswordRoute() {
  const router = useRouter();
  const sessionMode = useAuthStore((state) => state.sessionMode);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const canSubmit =
    sessionMode === 'authenticated' &&
    password.length >= 8 &&
    confirmPassword.length >= 8 &&
    password === confirmPassword &&
    !loading;

  const submit = async () => {
    if (password.length < 8) {
      Alert.alert('Check your password', 'Use at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Passwords do not match', 'Enter the same password twice.');
      return;
    }

    setLoading(true);
    const result = await authService.updatePassword(password);
    setLoading(false);

    if (!result.ok) {
      Alert.alert('Could not update password', result.message ?? 'Try again.');
      return;
    }

    Alert.alert('Password updated', 'Use your new password next time you sign in.', [
      {
        text: 'OK',
        onPress: () => router.replace('/home'),
      },
    ]);
  };

  return (
    <Screen bottomInset={32}>
      <Pressable accessibilityRole="button" onPress={() => router.replace('/auth')} style={styles.backButton}>
        <ArrowLeft color={colors.text.primary} size={22} strokeWidth={2.6} />
        <AppText variant="body" style={styles.backText}>
          Back
        </AppText>
      </Pressable>

      <View style={styles.copy}>
        <AppText variant="eyebrow">Password reset</AppText>
        <AppText variant="display">
          Pick a new <AppText variant="display" color={colors.brand.pink} style={styles.script}>password</AppText>.
        </AppText>
        <AppText variant="subtitle">
          Enter a fresh password for this account.
        </AppText>
      </View>

      {sessionMode !== 'authenticated' ? (
        <View style={styles.notice}>
          <AppText variant="body" style={styles.noticeText}>
            Open the reset link from your email on this device to continue.
          </AppText>
        </View>
      ) : null}

      <View style={styles.form}>
        <TextInput
          autoCapitalize="none"
          autoComplete="new-password"
          autoCorrect={false}
          onChangeText={setPassword}
          placeholder="New password"
          placeholderTextColor={colors.ui.placeholder}
          secureTextEntry
          style={styles.input}
          textContentType="newPassword"
          value={password}
        />
        <TextInput
          autoCapitalize="none"
          autoComplete="new-password"
          autoCorrect={false}
          onChangeText={setConfirmPassword}
          placeholder="Confirm password"
          placeholderTextColor={colors.ui.placeholder}
          secureTextEntry
          style={styles.input}
          textContentType="newPassword"
          value={confirmPassword}
        />
      </View>

      <Button
        title="Update password"
        icon={KeyRound}
        loading={loading}
        disabled={!canSubmit}
        onPress={() => void submit()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 40,
    paddingRight: spacing.md,
  },
  backText: {
    fontFamily: typography.family.displaySemiBold,
    fontSize: 16,
  },
  copy: {
    gap: spacing.md,
    marginBottom: spacing.xl,
    marginTop: spacing.xl,
  },
  script: {
    fontFamily: typography.family.editorial,
  },
  notice: {
    backgroundColor: colors.bg.surface,
    borderColor: colors.ui.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing.lg,
    padding: spacing.lg,
  },
  noticeText: {
    color: colors.text.secondary,
    fontFamily: typography.family.bodyMedium,
    fontSize: 15,
    lineHeight: 21,
  },
  form: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  input: {
    backgroundColor: colors.bg.surface,
    borderColor: colors.ui.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    color: colors.text.primary,
    fontFamily: typography.family.bodyMedium,
    fontSize: 15,
    minHeight: 54,
    paddingHorizontal: spacing.lg,
  },
});
