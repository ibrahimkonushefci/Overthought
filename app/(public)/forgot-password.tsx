import { useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Mail, MailCheck, Sparkles } from 'lucide-react-native';
import { authService } from '../../src/features/auth/authService';
import { Button } from '../../src/shared/ui/Button';
import { AppText } from '../../src/shared/ui/Text';
import { Screen } from '../../src/shared/ui/Screen';
import { colors, radii, spacing, typography } from '../../src/shared/theme/tokens';

export default function ForgotPasswordRoute() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail.includes('@')) {
      Alert.alert('Enter your email', 'Type the email address for your account.');
      return;
    }

    setLoading(true);
    const result = await authService.requestPasswordReset(trimmedEmail);
    setLoading(false);

    Alert.alert(result.ok ? 'Check your email' : 'Could not send reset link', result.message ?? 'Try again.');
  };

  return (
    <Screen bottomInset={32}>
      <View style={styles.topRow}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
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
        <AppText variant="eyebrow">Forgot password</AppText>
        <AppText variant="display" style={styles.title}>
          Reset your <AppText variant="display" color={colors.brand.pink} style={styles.script}>case file</AppText> key.
        </AppText>
        <AppText variant="subtitle" style={styles.subtitle}>
          Enter your account email and we will send a reset link.
        </AppText>
      </View>

      <View style={styles.authPanel}>
        <View style={styles.form}>
          <View style={styles.field}>
            <AppText variant="eyebrow" style={styles.fieldLabel}>
              Email
            </AppText>
            <View style={styles.inputShell}>
              <Mail color={colors.text.secondary} size={18} strokeWidth={2.4} />
              <TextInput
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                inputMode="email"
                keyboardType="email-address"
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={colors.ui.placeholder}
                style={styles.input}
                value={email}
              />
            </View>
          </View>
        </View>

        <Button
          title="Send reset link"
          icon={MailCheck}
          loading={loading}
          disabled={!email.includes('@') || loading}
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
