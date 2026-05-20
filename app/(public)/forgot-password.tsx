import { useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, MailCheck } from 'lucide-react-native';
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
      <Pressable accessibilityRole="button" onPress={() => router.replace('/auth')} style={styles.backButton}>
        <ArrowLeft color={colors.text.primary} size={22} strokeWidth={2.6} />
        <AppText variant="body" style={styles.backText}>
          Back
        </AppText>
      </Pressable>

      <View style={styles.copy}>
        <AppText variant="eyebrow">Forgot password</AppText>
        <AppText variant="display">
          Reset your <AppText variant="display" color={colors.brand.pink} style={styles.script}>case file</AppText> key.
        </AppText>
        <AppText variant="subtitle">
          Enter your account email and we will send a reset link.
        </AppText>
      </View>

      <View style={styles.form}>
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

      <Button
        title="Send reset link"
        icon={MailCheck}
        loading={loading}
        disabled={!email.includes('@') || loading}
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
  form: {
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
