import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Crown, Sparkles } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Alert, StyleSheet, View } from 'react-native';
import { trackEvent } from '../../src/lib/analytics/analyticsService';
import { premiumService } from '../../src/features/premium/premiumService';
import { isPremiumStateActive, usePremiumStore } from '../../src/store/premiumStore';
import { Button } from '../../src/shared/ui/Button';
import { AppText } from '../../src/shared/ui/Text';
import { Screen } from '../../src/shared/ui/Screen';
import { colors, gradients, radii, shadows, spacing } from '../../src/shared/theme/tokens';

export default function PaywallPlaceholderRoute() {
  const router = useRouter();
  const premiumState = usePremiumStore((state) => state.premiumState);
  const hasPremium = isPremiumStateActive(premiumState);
  const [subtitle, setSubtitle] = useState(
    'Deeper reads, share cards, tone modes, and unlimited history can plug in here when pricing is ready.',
  );
  const [ctaTitle, setCtaTitle] = useState('Not yet');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    trackEvent('paywall_viewed');
    let cancelled = false;

    void premiumService.refreshPremiumState({ syncBackend: false }).then(() => premiumService.getPaywallPackage()).then((result) => {
      if (cancelled) {
        return;
      }

      if (hasPremium) {
        setSubtitle('Premium is already active on this account.');
        setCtaTitle('Premium active');
        return;
      }

      if (result.ok && result.packageInfo) {
        const packageLabel = result.packageInfo.periodLabel
          ? `${result.packageInfo.priceString}/${result.packageInfo.periodLabel}`
          : result.packageInfo.priceString;

        setSubtitle(`Deeper reads, share cards, tone modes, and unlimited history. ${packageLabel}.`);
        setCtaTitle(`Start ${result.packageInfo.priceString}`);
        return;
      }

      if (result.message) {
        setSubtitle(result.message);
      }
      setCtaTitle('Try Premium');
    });

    return () => {
      cancelled = true;
    };
  }, [hasPremium]);

  const purchase = async () => {
    if (hasPremium) {
      Alert.alert('Premium', 'Premium is already active on this account.', [{ text: 'OK', onPress: () => router.back() }]);
      return;
    }

    setLoading(true);
    try {
      const result = await premiumService.purchasePaywallPackage();

      if (result.ok) {
        Alert.alert('Premium', result.message, [{ text: 'OK', onPress: () => router.back() }]);
        return;
      }

      if (result.alreadyPremium) {
        Alert.alert('Premium', result.message, [{ text: 'OK', onPress: () => router.back() }]);
        return;
      }

      if (!result.cancelled) {
        Alert.alert('Premium', result.message);
      }
    } finally {
      setLoading(false);
    }
  };

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
          {subtitle}
        </AppText>
        <Button title={ctaTitle} variant="accent" icon={Sparkles} loading={loading} onPress={() => void purchase()} />
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
