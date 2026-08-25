import { useEffect, useState } from 'react';
import type { StyleProp, TextStyle } from 'react-native';
import { Alert, Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { authService } from '../../src/features/auth/authService';
import { env } from '../../src/lib/env';
import { useAuthStore } from '../../src/store/authStore';
import { Button } from '../../src/shared/ui/Button';
import { AppText } from '../../src/shared/ui/Text';
import { Screen } from '../../src/shared/ui/Screen';
import { colors, gradients, shadows, spacing, typography } from '../../src/shared/theme/tokens';

export default function WelcomeRoute() {
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const sessionMode = useAuthStore((state) => state.sessionMode);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const titleFontSize = Math.max(40, Math.min(50, (width - spacing.xl * 2 - spacing.sm * 2) * 0.145));
  const titleLineHeight = Math.round(titleFontSize * 1.02);
  const responsiveTitleStyle = { fontSize: titleFontSize, lineHeight: titleLineHeight };

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

  const continueGuest = () => {
    authService.continueAsGuest();
    router.replace('/home');
  };

  const signInWithGoogle = async () => {
    const result = await authService.signInWithGoogle();

    if (result.ok) {
      router.replace('/home');
      return;
    }

    if (!result.cancelled) {
      Alert.alert(result.needsNativeSetup ? 'Native setup needed' : 'Sign-in failed', result.message ?? 'Try again.');
    }
  };

  const signInWithApple = async () => {
    setAppleLoading(true);
    const result = await authService.signInWithApple();
    setAppleLoading(false);

    if (result.ok) {
      router.replace('/home');
      return;
    }

    if (!result.cancelled) {
      Alert.alert(result.needsNativeSetup ? 'Native setup needed' : 'Sign-in failed', result.message ?? 'Try again.');
    }
  };

  return (
    <Screen bottomInset={32}>
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(242, 34, 142, 0.12)', 'rgba(139, 92, 246, 0.07)', 'rgba(246, 240, 226, 0)']}
        start={{ x: 0.16, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.glow}
      />
      <View style={styles.brandRow}>
        <View style={styles.brandLockup}>
          <View style={styles.logo}>
            <Image
              accessibilityIgnoresInvertColors
              accessibilityLabel="Overthought"
              resizeMode="contain"
              source={require('../../assets/brand/app-logo-transparent.png')}
              style={styles.logoImage}
            />
          </View>
          <AppText variant="title" style={styles.wordmark}>Overthought</AppText>
        </View>
        <LinearGradient colors={gradients.acid} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.floatingBadge}>
          <AppText variant="title" center style={styles.badgeFace}>
            🤡
          </AppText>
        </LinearGradient>
      </View>

      <View style={styles.heroCopy}>
        <View style={styles.titleBlock}>
          <AppText
            adjustsFontSizeToFit
            minimumFontScale={0.82}
            numberOfLines={1}
            variant="display"
            style={[styles.welcomeTitle, responsiveTitleStyle]}
          >
            Overthinking
          </AppText>
          <AppText
            adjustsFontSizeToFit
            minimumFontScale={0.82}
            numberOfLines={1}
            variant="display"
            style={[styles.welcomeTitle, responsiveTitleStyle]}
          >
            a <AppText variant="display" color={colors.brand.pink} style={[styles.script, styles.welcomeScript, responsiveTitleStyle]}>dating text</AppText>?
          </AppText>
        </View>
        <AppText variant="subtitle" style={styles.subtitle}>
          Describe what happened. Get a funny verdict, Delusion Score, evidence check, and one honest next move.
        </AppText>
      </View>

      <View style={styles.actions}>
        <Button title="Continue as guest →" onPress={continueGuest} />
        {appleAvailable ? (
          <View style={styles.providerRow}>
            <ProviderButton
              glyph=""
              title={appleLoading ? 'Signing in…' : 'Apple'}
              onPress={() => void signInWithApple()}
              disabled={appleLoading}
            />
          </View>
        ) : null}
        {env.enableGoogleAuth ? (
          <View style={styles.providerRow}>
            <ProviderButton glyph="G" title="Google" onPress={() => void signInWithGoogle()} glyphStyle={styles.googleGlyph} />
          </View>
        ) : null}
        <Button title="Continue with email" variant="ghost" onPress={() => router.push('/auth')} />
      </View>
    </Screen>
  );
}

function ProviderButton({
  glyph,
  title,
  onPress,
  disabled,
  glyphStyle,
}: {
  glyph: string;
  title: string;
  onPress: () => void;
  disabled?: boolean;
  glyphStyle?: StyleProp<TextStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.providerButton, pressed && !disabled && styles.providerPressed, disabled && styles.providerDisabled]}
    >
      <Text style={[styles.providerGlyph, glyphStyle]}>{glyph}</Text>
      <Text style={styles.providerLabel}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  glow: {
    borderRadius: 260,
    height: 340,
    position: 'absolute',
    right: -210,
    top: -108,
    width: 500,
  },
  brandRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    marginTop: spacing.xl,
  },
  brandLockup: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1,
    gap: spacing.md,
  },
  logo: {
    alignItems: 'center',
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  logoImage: {
    height: 46,
    width: 46,
  },
  wordmark: {
    fontFamily: typography.family.displaySemiBold,
    fontSize: 20,
    lineHeight: 24,
  },
  heroCopy: {
    gap: spacing.xl,
    marginTop: 64,
    paddingHorizontal: spacing.xs,
    width: '100%',
  },
  titleBlock: {
    width: '100%',
  },
  script: {
    fontFamily: typography.family.editorial,
  },
  welcomeTitle: {
    flexShrink: 0,
    letterSpacing: -0.8,
  },
  welcomeScript: {
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: typography.family.body,
    fontSize: 17,
    lineHeight: 25,
    maxWidth: 342,
  },
  floatingBadge: {
    alignItems: 'center',
    borderColor: colors.brand.ink,
    borderRadius: 20,
    borderWidth: 2,
    flexShrink: 0,
    height: 58,
    justifyContent: 'center',
    transform: [{ rotate: '-7deg' }],
    width: 68,
    ...shadows.hardSmall,
  },
  badgeFace: {
    fontSize: 29,
    lineHeight: 33,
  },
  actions: {
    gap: spacing.lg,
    marginTop: 'auto',
    paddingBottom: spacing.md,
  },
  providerRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  providerButton: {
    alignItems: 'center',
    backgroundColor: colors.bg.surface,
    borderColor: colors.brand.ink,
    borderRadius: 18,
    borderWidth: 2,
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'center',
    minHeight: 54,
    width: '100%',
  },
  providerPressed: {
    transform: [{ translateY: 1 }],
  },
  providerDisabled: {
    opacity: 0.6,
  },
  providerGlyph: {
    color: colors.text.primary,
    fontFamily: typography.family.bodySemiBold,
    fontSize: 19,
    lineHeight: 22,
  },
  googleGlyph: {
    color: '#EA4335',
    fontFamily: typography.family.displayBold,
  },
  providerLabel: {
    color: colors.text.primary,
    fontFamily: typography.family.displaySemiBold,
    fontSize: 15,
    lineHeight: 19,
  },
});
