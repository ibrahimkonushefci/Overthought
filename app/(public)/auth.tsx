import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { ArrowLeft, LogIn, UserPlus } from 'lucide-react-native';
import { authService } from '../../src/features/auth/authService';
import { env } from '../../src/lib/env';
import { useAuthStore } from '../../src/store/authStore';
import { Button } from '../../src/shared/ui/Button';
import { AppText } from '../../src/shared/ui/Text';
import { Screen } from '../../src/shared/ui/Screen';
import { colors, radii, spacing, typography } from '../../src/shared/theme/tokens';

export default function AuthRoute() {
  const router = useRouter();
  const pathname = usePathname();
  const sessionMode = useAuthStore((state) => state.sessionMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'sign_in' | 'sign_up'>('sign_in');
  const [emailLoading, setEmailLoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    if (sessionMode === 'authenticated' && pathname !== '/reset-password') {
      router.replace('/home');
    }
  }, [pathname, router, sessionMode]);

  useEffect(() => {
    let isMounted = true;

    void authService.isAppleSignInAvailable().then((isAvailable) => {
      if (isMounted) {
        setAppleAvailable(isAvailable);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const submit = async () => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail.includes('@') || password.length < 8) {
      Alert.alert('Check your details', 'Use a valid email and a password with at least 8 characters.');
      return;
    }

    setEmailLoading(true);
    const result =
      authMode === 'sign_in'
        ? await authService.signInWithEmailPassword(trimmedEmail, password)
        : await authService.signUpWithEmailPassword(trimmedEmail, password);
    setEmailLoading(false);

    if (!result.ok || result.message) {
      Alert.alert(authMode === 'sign_in' ? 'Email sign-in' : 'Create account', result.message ?? 'Try again.');
    }
  };

  const signInWithGoogle = async () => {
    setGoogleLoading(true);
    const result = await authService.signInWithGoogle();
    setGoogleLoading(false);

    if (!result.ok && !result.cancelled) {
      Alert.alert(result.needsNativeSetup ? 'Native setup needed' : 'Sign-in failed', result.message ?? 'Try again.');
    }
  };

  const signInWithApple = async () => {
    setAppleLoading(true);
    const result = await authService.signInWithApple();
    setAppleLoading(false);

    if (!result.ok && !result.cancelled) {
      Alert.alert(result.needsNativeSetup ? 'Native setup needed' : 'Sign-in failed', result.message ?? 'Try again.');
    }
  };

  return (
    <Screen bottomInset={32}>
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
        <ArrowLeft color={colors.text.primary} size={22} strokeWidth={2.6} />
        <AppText variant="body" style={styles.backText}>
          Back
        </AppText>
      </Pressable>
      <View style={styles.copy}>
        <AppText variant="eyebrow">Optional login</AppText>
        <AppText variant="display">
          Save your <AppText variant="display" color={colors.brand.pink} style={styles.script}>case file</AppText>.
        </AppText>
        <AppText variant="subtitle">Use email and password, or keep judging as a guest.</AppText>
      </View>
      <View style={styles.modeSwitch}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: authMode === 'sign_in' }}
          onPress={() => setAuthMode('sign_in')}
          style={[styles.modeButton, authMode === 'sign_in' && styles.modeButtonActive]}
        >
          <AppText variant="eyebrow" color={authMode === 'sign_in' ? colors.text.onBrand : colors.text.secondary} style={styles.modeText}>
            Sign in
          </AppText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: authMode === 'sign_up' }}
          onPress={() => setAuthMode('sign_up')}
          style={[styles.modeButton, authMode === 'sign_up' && styles.modeButtonActive]}
        >
          <AppText variant="eyebrow" color={authMode === 'sign_up' ? colors.text.onBrand : colors.text.secondary} style={styles.modeText}>
            Create account
          </AppText>
        </Pressable>
      </View>
      <View style={styles.form}>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          inputMode="email"
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor={colors.ui.placeholder}
          style={styles.input}
          value={email}
        />
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={authMode === 'sign_in' ? 'current-password' : 'new-password'}
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor={colors.ui.placeholder}
          secureTextEntry
          style={styles.input}
          textContentType={authMode === 'sign_in' ? 'password' : 'newPassword'}
          value={password}
        />
      </View>
      {authMode === 'sign_in' ? (
        <Pressable
          accessibilityRole="button"
          disabled={emailLoading || appleLoading || googleLoading}
          onPress={() => router.push('/forgot-password')}
          style={styles.forgotButton}
        >
          <AppText variant="body" color={colors.text.secondary} style={styles.forgotText}>
            Forgot password?
          </AppText>
        </Pressable>
      ) : null}
      <Button
        title={authMode === 'sign_in' ? 'Sign in with email' : 'Create account'}
        icon={authMode === 'sign_in' ? LogIn : UserPlus}
        loading={emailLoading}
        disabled={!email.includes('@') || password.length < 8 || emailLoading || appleLoading || googleLoading}
        onPress={() => void submit()}
      />
      {appleAvailable ? (
        <Button
          title="Continue with Apple"
          variant="outline"
          loading={appleLoading}
          disabled={emailLoading || appleLoading || googleLoading}
          onPress={() => void signInWithApple()}
        />
      ) : null}
      {env.enableGoogleAuth ? (
        <Button
          title="Continue with Google"
          variant="outline"
          loading={googleLoading}
          disabled={emailLoading || appleLoading || googleLoading}
          onPress={() => void signInWithGoogle()}
        />
      ) : null}
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
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  script: {
    fontFamily: typography.family.editorial,
  },
  form: {
    gap: spacing.md,
    marginBottom: spacing.sm,
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
  forgotButton: {
    alignSelf: 'flex-end',
    marginBottom: spacing.lg,
    minHeight: 30,
    paddingLeft: spacing.lg,
    paddingVertical: spacing.xs,
  },
  forgotText: {
    fontFamily: typography.family.displaySemiBold,
    fontSize: 14,
  },
  modeSwitch: {
    backgroundColor: colors.bg.surface,
    borderColor: colors.ui.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.lg,
    padding: spacing.xs,
  },
  modeButton: {
    alignItems: 'center',
    borderRadius: radii.md,
    flex: 1,
    minHeight: 42,
    justifyContent: 'center',
  },
  modeButtonActive: {
    backgroundColor: colors.brand.ink,
  },
  modeText: {
    fontFamily: typography.family.displayBold,
    fontSize: 10,
    letterSpacing: 1.4,
  },
});
