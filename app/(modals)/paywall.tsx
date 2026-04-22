import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { Crown, Sparkles } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import { trackEvent } from '../../src/lib/analytics/analyticsService';
import { Button } from '../../src/shared/ui/Button';
import { AppText } from '../../src/shared/ui/Text';
import { Screen } from '../../src/shared/ui/Screen';
import { colors, gradients, radii, shadows, spacing } from '../../src/shared/theme/tokens';

export default function PaywallPlaceholderRoute() {
  const router = useRouter();

  useEffect(() => {
    trackEvent('paywall_viewed');
  }, []);

  return (
    <Screen>
      <LinearGradient colors={gradients.clown} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.badge}>
          <Crown color={colors.text.onBrand} size={15} />
          <AppText variant="eyebrow" color={colors.text.onBrand}>
            Premium
          </AppText>
        </View>
        <AppText variant="display" color={colors.text.onBrand} style={styles.title}>
          Sharper verdicts.
        </AppText>
        <AppText variant="subtitle" color={colors.text.onBrand}>
          Deeper reads, share cards, tone modes, and unlimited history can plug in here when pricing is ready.
        </AppText>
        <Button title="Not yet" variant="accent" icon={Sparkles} onPress={() => router.back()} />
      </LinearGradient>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderColor: colors.brand.ink,
    borderRadius: radii.xl,
    borderWidth: 2,
    gap: spacing.sm,
    marginTop: spacing.lg,
    padding: spacing.lg,
    ...shadows.hard,
  },
  badge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(31, 23, 34, 0.24)',
    borderRadius: radii.pill,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  title: {
    fontSize: 32,
    lineHeight: 37,
  },
});
