import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Keyboard, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { ArrowLeft, LockKeyhole, LogIn, Mail, Sparkles, UserPlus } from 'lucide-react-native';
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
  const [signupSuccessEmail, setSignupSuccessEmail] = useState<string | null>(null);
  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const emailRequestInFlightRef = useRef(false);

  const routeHome = useCallback(() => {
    router.replace('/home');
  }, [router]);

  useEffect(() => {
    if (sessionMode === 'authenticated' && pathname !== '/reset-password') {
      routeHome();
    }
  }, [pathname, routeHome, sessionMode]);

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
    if (emailRequestInFlightRef.current || emailLoading || appleLoading || googleLoading) {
      return;
    }

    const trimmedEmail = email.trim();

    if (!trimmedEmail.includes('@') || password.length < 8) {
      Alert.alert('Check your details', 'Use a valid email and a password with at least 8 characters.');
      return;
    }

    emailRequestInFlightRef.current = true;
    setEmailLoading(true);
    Keyboard.dismiss();
    const result =
      authMode === 'sign_in'
        ? await authService.signInWithEmailPassword(trimmedEmail, password)
        : await authService.signUpWithEmailPassword(trimmedEmail, password);
    emailRequestInFlightRef.current = false;
    setEmailLoading(false);

    if (result.ok && authMode === 'sign_up' && result.message) {
      setEmail('');
      setPassword('');
      setAuthMode('sign_in');
      setSignupSuccessEmail(trimmedEmail);
      return;
    }

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

      <View style={styles.authPanel}>
        <View style={styles.panelHeader}>
          <View style={styles.panelHeaderCopy}>
            <AppText variant="eyebrow" style={styles.panelKicker}>
              {authMode === 'sign_in' ? 'Welcome back' : 'New account'}
            </AppText>
            <AppText variant="title" style={styles.panelTitle} numberOfLines={2}>
              {authMode === 'sign_in' ? 'Sign in' : 'Create your case file'}
            </AppText>
            <AppText variant="meta" style={styles.panelSubtitle} numberOfLines={1}>
              Save cases and keep Premium attached.
            </AppText>
          </View>
          <View style={styles.panelIcon}>
            {authMode === 'sign_in' ? (
              <LogIn color={colors.brand.pink} size={18} strokeWidth={2.7} />
            ) : (
              <UserPlus color={colors.brand.pink} size={18} strokeWidth={2.7} />
            )}
          </View>
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
            onPress={() => {
              setAuthMode('sign_up');
              setSignupSuccessEmail(null);
            }}
            style={[styles.modeButton, authMode === 'sign_up' && styles.modeButtonActive]}
          >
            <AppText variant="eyebrow" color={authMode === 'sign_up' ? colors.text.onBrand : colors.text.secondary} style={styles.modeText}>
              Create account
            </AppText>
          </Pressable>
        </View>

        {signupSuccessEmail ? (
          <View style={styles.successNotice}>
            <Mail color={colors.brand.pink} size={18} strokeWidth={2.5} />
            <View style={styles.successCopy}>
              <AppText variant="body" style={styles.successTitle}>
                Account created
              </AppText>
              <AppText variant="meta" style={styles.successBody}>
                Check {signupSuccessEmail} to confirm your account, then sign in here. If it is not there, check Spam/Junk.
              </AppText>
            </View>
          </View>
        ) : null}

        <View style={styles.form}>
          <View style={styles.field}>
            <AppText variant="eyebrow" style={styles.fieldLabel}>
              Email
            </AppText>
            <Pressable accessible={false} onPress={() => emailInputRef.current?.focus()} style={styles.inputShell}>
              <Mail color={colors.text.secondary} size={18} strokeWidth={2.4} />
              <TextInput
                ref={emailInputRef}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                inputMode="email"
                keyboardType="email-address"
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={colors.ui.placeholder}
                returnKeyType="next"
                style={styles.input}
                submitBehavior="submit"
                onSubmitEditing={() => passwordInputRef.current?.focus()}
                value={email}
              />
            </Pressable>
          </View>
          <View style={styles.field}>
            <AppText variant="eyebrow" style={styles.fieldLabel}>
              Password
            </AppText>
            <Pressable accessible={false} onPress={() => passwordInputRef.current?.focus()} style={styles.inputShell}>
              <LockKeyhole color={colors.text.secondary} size={18} strokeWidth={2.4} />
              <TextInput
                ref={passwordInputRef}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete={authMode === 'sign_in' ? 'current-password' : 'new-password'}
                onChangeText={setPassword}
                placeholder="At least 8 characters"
                placeholderTextColor={colors.ui.placeholder}
                secureTextEntry
                style={styles.input}
                returnKeyType="done"
                submitBehavior="submit"
                textContentType={authMode === 'sign_in' ? 'password' : 'newPassword'}
                onSubmitEditing={() => {
                  if (email.includes('@') && password.length >= 8 && !emailLoading && !appleLoading && !googleLoading) {
                    void submit();
                  }
                }}
                value={password}
              />
            </Pressable>
          </View>
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
        ) : (
          <AppText variant="meta" style={styles.confirmationNote}>
            You may need to confirm your email before signing in.
          </AppText>
        )}

        <View style={styles.actionStack}>
          <Button
            title={authMode === 'sign_in' ? 'Sign in with email' : 'Create account'}
            icon={authMode === 'sign_in' ? LogIn : UserPlus}
            loading={emailLoading}
            disabled={!email.includes('@') || password.length < 8 || emailLoading || appleLoading || googleLoading}
            onPress={() => void submit()}
          />
        </View>

        {appleAvailable || env.enableGoogleAuth ? (
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <AppText variant="eyebrow" style={styles.dividerText}>
              Or
            </AppText>
            <View style={styles.dividerLine} />
          </View>
        ) : null}

        <View style={styles.providerStack}>
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
        </View>
      </View>

      <View style={styles.guestWrap}>
        <Button
          title="Continue as guest"
          variant="ghost"
          onPress={() => {
            authService.continueAsGuest();
            routeHome();
          }}
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
  panelHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  panelHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  panelKicker: {
    color: colors.text.secondary,
    fontFamily: typography.family.displayBold,
    fontSize: 9,
    letterSpacing: 1.5,
  },
  panelTitle: {
    color: colors.text.primary,
    fontFamily: typography.family.displayBold,
    fontSize: 22,
    lineHeight: 27,
    marginTop: 2,
  },
  panelSubtitle: {
    marginTop: 4,
  },
  panelIcon: {
    alignItems: 'center',
    backgroundColor: '#FDE8F6',
    borderColor: colors.ui.border,
    borderRadius: 14,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  successNotice: {
    alignItems: 'center',
    backgroundColor: '#FDE8F6',
    borderColor: colors.ui.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  successCopy: {
    flex: 1,
    minWidth: 0,
  },
  successTitle: {
    fontFamily: typography.family.displaySemiBold,
    fontSize: 14,
    lineHeight: 18,
  },
  successBody: {
    lineHeight: 16,
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
    alignSelf: 'stretch',
    color: colors.text.primary,
    flex: 1,
    fontFamily: typography.family.bodyMedium,
    fontSize: 15,
    minHeight: 54,
    minWidth: 0,
    paddingVertical: 0,
  },
  forgotButton: {
    alignSelf: 'flex-end',
    minHeight: 30,
    paddingLeft: spacing.lg,
  },
  forgotText: {
    fontFamily: typography.family.displaySemiBold,
    fontSize: 14,
  },
  confirmationNote: {
    marginTop: -spacing.sm,
  },
  actionStack: {
    gap: spacing.md,
  },
  providerStack: {
    gap: spacing.md,
  },
  dividerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  dividerLine: {
    backgroundColor: colors.ui.divider,
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontFamily: typography.family.displayBold,
    fontSize: 9,
    letterSpacing: 1.6,
  },
  guestWrap: {
    marginTop: spacing.xl,
  },
  modeSwitch: {
    backgroundColor: colors.bg.muted,
    borderColor: colors.ui.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
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
