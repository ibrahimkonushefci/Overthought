import { Alert, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Apple, Mail, Search, Globe } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { authService } from '../../src/features/auth/authService';
import { Button } from '../../src/shared/ui/Button';
import { AppText } from '../../src/shared/ui/Text';
import { Screen } from '../../src/shared/ui/Screen';
import { colors, gradients, radii, spacing } from '../../src/shared/theme/tokens';

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
      <View style={styles.brandRow}>
        <View style={styles.logo}>
          <Search color={colors.brand.pink} size={22} strokeWidth={2.8} />
        </View>
        <AppText variant="title">Overthought</AppText>
      </View>

      <View style={styles.heroCopy}>
        <AppText variant="display">
          Are you <AppText variant="display" color={colors.brand.pink} style={styles.script}>overthinking</AppText> it, or are you right?
        </AppText>
        <AppText variant="subtitle">
          Drop the situation. Get a verdict, a score, and one honest next move.
        </AppText>
      </View>

      <LinearGradient colors={gradients.acid} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.floatingBadge}>
        <AppText variant="title" center style={styles.badgeFace}>
          :)
        </AppText>
      </LinearGradient>

      <View style={styles.actions}>
        <Button title="Continue as guest" onPress={continueGuest} />
        <View style={styles.providerRow}>
          <View style={styles.providerButton}>
            <Button title="Apple" variant="outline" icon={Apple} onPress={() => void showNativeSetup('apple')} />
          </View>
          <View style={styles.providerButton}>
            <Button title="Google" variant="outline" icon={Globe} onPress={() => void showNativeSetup('google')} />
          </View>
        </View>
        <Button title="Continue with email" variant="ghost" icon={Mail} onPress={() => router.push('/auth')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brandRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  logo: {
    alignItems: 'center',
    backgroundColor: colors.brand.ink,
    borderRadius: 16,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  heroCopy: {
    gap: spacing.lg,
    marginTop: 82,
  },
  script: {
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    fontWeight: '400',
  },
  floatingBadge: {
    alignItems: 'center',
    borderColor: colors.brand.ink,
    borderRadius: 22,
    borderWidth: 2,
    height: 58,
    justifyContent: 'center',
    position: 'absolute',
    right: 28,
    top: 148,
    transform: [{ rotate: '-7deg' }],
    width: 70,
  },
  badgeFace: {
    fontSize: 20,
  },
  actions: {
    gap: spacing.md,
    marginTop: 'auto',
  },
  providerRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  providerButton: {
    flex: 1,
  },
});
