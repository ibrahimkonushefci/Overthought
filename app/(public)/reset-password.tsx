import { useState } from 'react';
import { Alert, Keyboard, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, KeyRound, LockKeyhole, Sparkles } from 'lucide-react-native';
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
    Keyboard.dismiss();
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
      <View style={styles.topRow}>
        <Pressable accessibilityRole="button" onPress={() => router.replace('/auth')} style={styles.backButton}>
          <ArrowLeft color={colors.text.primary} size={20} strokeWidth={2.6} />
        </Pressable>
        <View style={styles.brandPill}>
          <Sparkles color={colors.brand.pink} size={14} strokeWidth={2.7} />
          <AppText variant="eyebrow" style={styles.brandPillText}>
            Overthought
          </AppText>
        </View>
      </View>

      <View style={styles.copy}>
        <AppText variant="eyebrow">Password reset</AppText>
        <AppText variant="display" style={styles.title}>
          Pick a new <AppText variant="display" color={colors.brand.pink} style={styles.script}>password</AppText>.
        </AppText>
        <AppText variant="subtitle" style={styles.subtitle}>
          Enter a fresh password for this account.
        </AppText>
      </View>

      <View style={styles.authPanel}>
        {sessionMode !== 'authenticated' ? (
          <View style={styles.notice}>
            <AppText variant="body" style={styles.noticeText}>
              Open the reset link from your email on this device to continue.
            </AppText>
          </View>
        ) : null}

        <View style={styles.form}>
          <View style={styles.field}>
            <AppText variant="eyebrow" style={styles.fieldLabel}>
              New password
            </AppText>
            <View style={styles.inputShell}>
              <LockKeyhole color={colors.text.secondary} size={18} strokeWidth={2.4} />
              <TextInput
                autoCapitalize="none"
                autoComplete="new-password"
                autoCorrect={false}
                onChangeText={setPassword}
                placeholder="At least 8 characters"
                placeholderTextColor={colors.ui.placeholder}
                secureTextEntry
                style={styles.input}
                returnKeyType="next"
                submitBehavior="submit"
                textContentType="newPassword"
                value={password}
              />
            </View>
          </View>
          <View style={styles.field}>
            <AppText variant="eyebrow" style={styles.fieldLabel}>
              Confirm password
            </AppText>
            <View style={styles.inputShell}>
              <LockKeyhole color={colors.text.secondary} size={18} strokeWidth={2.4} />
              <TextInput
                autoCapitalize="none"
                autoComplete="new-password"
                autoCorrect={false}
                onChangeText={setConfirmPassword}
                placeholder="Type it again"
                placeholderTextColor={colors.ui.placeholder}
                secureTextEntry
                style={styles.input}
                returnKeyType="done"
                submitBehavior="submit"
                textContentType="newPassword"
                onSubmitEditing={() => {
                  if (canSubmit) {
                    void submit();
                  }
                }}
                value={confirmPassword}
              />
            </View>
          </View>
        </View>

        <Button
          title="Update password"
          icon={KeyRound}
          loading={loading}
          disabled={!canSubmit}
          onPress={() => void submit()}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: colors.bg.surface,
    borderColor: colors.ui.border,
    borderRadius: 16,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  brandPill: {
    alignItems: 'center',
    backgroundColor: colors.bg.surface,
    borderColor: colors.ui.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  brandPillText: {
    color: colors.text.primary,
    fontFamily: typography.family.displayBold,
    fontSize: 10,
    letterSpacing: 1.5,
  },
  copy: {
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: 38,
    lineHeight: 41,
  },
  script: {
    fontFamily: typography.family.editorial,
  },
  subtitle: {
    fontFamily: typography.family.body,
    fontSize: 15,
    lineHeight: 22,
  },
  authPanel: {
    backgroundColor: colors.bg.surface,
    borderColor: colors.brand.ink,
    borderRadius: radii.xl,
    borderWidth: 2,
    gap: spacing.lg,
    padding: spacing.lg,
    shadowColor: colors.brand.ink,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
  },
  notice: {
    backgroundColor: '#F9F6EF',
    borderColor: colors.brand.pink,
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.lg,
  },
  noticeText: {
    color: colors.text.secondary,
    fontFamily: typography.family.bodyMedium,
    fontSize: 15,
    lineHeight: 21,
  },
  form: {
    gap: spacing.lg,
  },
  field: {
    gap: spacing.xs,
  },
  fieldLabel: {
    color: colors.text.secondary,
    fontFamily: typography.family.displayBold,
    fontSize: 9,
    letterSpacing: 1.5,
  },
  inputShell: {
    alignItems: 'center',
    backgroundColor: '#F9F6EF',
    borderColor: colors.ui.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 54,
    paddingHorizontal: spacing.lg,
  },
  input: {
    color: colors.text.primary,
    flex: 1,
    fontFamily: typography.family.bodyMedium,
    fontSize: 15,
    minWidth: 0,
    paddingVertical: 0,
  },
});
