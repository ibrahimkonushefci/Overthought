import type { StyleProp, TextStyle } from 'react-native';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { authService } from '../../src/features/auth/authService';
import { Button } from '../../src/shared/ui/Button';
import { AppText } from '../../src/shared/ui/Text';
import { Screen } from '../../src/shared/ui/Screen';
import { colors, gradients, shadows, spacing, typography } from '../../src/shared/theme/tokens';

export default function WelcomeRoute() {
  const router = useRouter();

  const continueGuest = () => {
    authService.continueAsGuest();
    router.replace('/home');
  };

  const showNativeSetup = async (provider: 'apple' | 'google') => {
    const result =
      provider === 'apple' ? await authService.signInWithApple() : await authService.signInWithGoogle();
    Alert.alert('Native setup needed', result.message ?? 'Provider setup is pending.');
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
        <View style={styles.logo}>
          <AppText center style={styles.logoGlyph}>🌀</AppText>
        </View>
        <AppText variant="title" style={styles.wordmark}>Overthought</AppText>
      </View>

      <View style={styles.heroCopy}>
        <AppText variant="display" style={styles.welcomeTitle}>
          Are you{'\n'}<AppText variant="display" color={colors.brand.pink} style={[styles.script, styles.welcomeScript]}>overthinking</AppText> it,{'\n'}or are you{'\n'}right?
        </AppText>
        <AppText variant="subtitle" style={styles.subtitle}>
          Drop the situation. Get a verdict, a score, and one honest next move.
        </AppText>
      </View>

      <LinearGradient colors={gradients.acid} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.floatingBadge}>
        <AppText variant="title" center style={styles.badgeFace}>
          🤡
        </AppText>
      </LinearGradient>

      <View style={styles.actions}>
        <Button title="Continue as guest →" onPress={continueGuest} />
        <View style={styles.providerRow}>
          <ProviderButton glyph="" title="Apple" onPress={() => void showNativeSetup('apple')} />
          <ProviderButton glyph="G" title="Google" onPress={() => void showNativeSetup('google')} glyphStyle={styles.googleGlyph} />
        </View>
        <Button title="Continue with email" variant="ghost" onPress={() => router.push('/auth')} />
      </View>
    </Screen>
  );
}

function ProviderButton({
  glyph,
  title,
  onPress,
  glyphStyle,
}: {
  glyph: string;
  title: string;
  onPress: () => void;
  glyphStyle?: StyleProp<TextStyle>;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.providerButton, pressed && styles.providerPressed]}>
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
    marginTop: spacing.xl,
  },
  logo: {
    alignItems: 'center',
    backgroundColor: colors.brand.ink,
    borderRadius: 14,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  logoGlyph: {
    fontSize: 21,
    lineHeight: 24,
  },
  wordmark: {
    fontFamily: typography.family.displaySemiBold,
    fontSize: 20,
    lineHeight: 24,
  },
  heroCopy: {
    gap: spacing.xl,
    marginTop: 76,
  },
  script: {
    fontFamily: typography.family.editorial,
  },
  welcomeTitle: {
    fontSize: 52,
    lineHeight: 50,
  },
  welcomeScript: {
    fontSize: 52,
    lineHeight: 50,
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
    borderRadius: 22,
    borderWidth: 2,
    height: 64,
    justifyContent: 'center',
    position: 'absolute',
    right: 30,
    top: 112,
    transform: [{ rotate: '-7deg' }],
    width: 76,
    ...shadows.hardSmall,
  },
  badgeFace: {
    fontSize: 31,
    lineHeight: 35,
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
    flex: 1,
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'center',
    minHeight: 54,
  },
  providerPressed: {
    transform: [{ translateY: 1 }],
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
