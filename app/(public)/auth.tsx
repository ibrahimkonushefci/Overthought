import { useEffect, useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Mail } from 'lucide-react-native';
import { authService } from '../../src/features/auth/authService';
import { useAuthStore } from '../../src/store/authStore';
import { Button } from '../../src/shared/ui/Button';
import { AppText } from '../../src/shared/ui/Text';
import { Screen } from '../../src/shared/ui/Screen';
import { colors, radii, spacing, typography } from '../../src/shared/theme/tokens';

export default function AuthRoute() {
  const router = useRouter();
  const sessionMode = useAuthStore((state) => state.sessionMode);
  const [email, setEmail] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    if (sessionMode === 'authenticated') {
      router.replace('/home');
    }
  }, [router, sessionMode]);

  const submit = async () => {
    setEmailLoading(true);
    const result = await authService.signInWithEmail(email.trim());
    setEmailLoading(false);
    Alert.alert(result.ok ? 'Email sent' : 'Email sign-in', result.message ?? 'Try again.');
  };

  const signInWithGoogle = async () => {
    setGoogleLoading(true);
    const result = await authService.signInWithGoogle();
    setGoogleLoading(false);

    if (!result.ok && !result.cancelled) {
      Alert.alert('Sign-in failed', result.message ?? 'Try again.');
    }
  };

  return (
    <Screen bottomInset={32}>
      <Button title="Back" variant="ghost" icon={ArrowLeft} onPress={() => router.back()} />
      <View style={styles.copy}>
        <AppText variant="eyebrow">Optional login</AppText>
        <AppText variant="display">
          Save your <AppText variant="display" color={colors.brand.pink} style={styles.script}>case file</AppText>.
        </AppText>
        <AppText variant="subtitle">Email sign-in uses Supabase magic links once credentials are configured.</AppText>
      </View>
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        onChangeText={setEmail}
        placeholder="you@example.com"
        placeholderTextColor={colors.ui.placeholder}
        style={styles.input}
        value={email}
      />
      <Button
        title="Send magic link"
        icon={Mail}
        loading={emailLoading}
        disabled={!email.includes('@') || emailLoading || googleLoading}
        onPress={() => void submit()}
      />
      <Button
        title="Continue with Google"
        variant="outline"
        loading={googleLoading}
        disabled={emailLoading || googleLoading}
        onPress={() => void signInWithGoogle()}
      />
      <Button
        title="Continue as guest"
        variant="ghost"
        onPress={() => {
          authService.continueAsGuest();
          router.replace('/home');
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  copy: {
    gap: spacing.md,
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  script: {
    fontFamily: typography.family.editorial,
  },
  input: {
    backgroundColor: colors.bg.surface,
    borderColor: colors.ui.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    color: colors.text.primary,
    fontFamily: typography.family.bodyMedium,
    fontSize: 15,
    marginBottom: spacing.lg,
    minHeight: 50,
    paddingHorizontal: spacing.lg,
  },
});
