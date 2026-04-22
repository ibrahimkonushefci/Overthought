import { useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Mail } from 'lucide-react-native';
import { authService } from '../../src/features/auth/authService';
import { Button } from '../../src/shared/ui/Button';
import { AppText } from '../../src/shared/ui/Text';
import { Screen } from '../../src/shared/ui/Screen';
import { colors, radii, spacing } from '../../src/shared/theme/tokens';

export default function AuthRoute() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    const result = await authService.signInWithEmail(email.trim());
    setLoading(false);
    Alert.alert(result.ok ? 'Email sent' : 'Email sign-in', result.message ?? 'Try again.');
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
        loading={loading}
        disabled={!email.includes('@') || loading}
        onPress={() => void submit()}
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
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    fontWeight: '400',
  },
  input: {
    backgroundColor: colors.bg.surface,
    borderColor: colors.ui.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: spacing.lg,
    minHeight: 50,
    paddingHorizontal: spacing.lg,
  },
});
