import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Check, Crown, RotateCcw, Sparkles, X } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, View } from 'react-native';
import { trackEvent } from '../../src/lib/analytics/analyticsService';
import { env } from '../../src/lib/env';
import { premiumService } from '../../src/features/premium/premiumService';
import { isPremiumStateActive, usePremiumStore } from '../../src/store/premiumStore';
import { useAuthStore } from '../../src/store/authStore';
import type { PremiumPackage } from '../../src/types/shared';
import { Button } from '../../src/shared/ui/Button';
import { AppText } from '../../src/shared/ui/Text';
import { Screen } from '../../src/shared/ui/Screen';
import { colors, gradients, radii, shadows, spacing, typography } from '../../src/shared/theme/tokens';

const benefits = [
  'More AI Verdicts when free reads run out',
  'Sharper Deep Reads with more context',
  'Premium access stays attached when signed in',
  'Priority access to future premium features',
];

function isMonthlyPackage(aPackage: PremiumPackage): boolean {
  return aPackage.packageType === 'MONTHLY' || aPackage.periodLabel === 'month';
}

function isAnnualPackage(aPackage: PremiumPackage): boolean {
  return aPackage.packageType === 'ANNUAL' || aPackage.periodLabel === 'year';
}

function planTitle(aPackage: PremiumPackage): string {
  if (isAnnualPackage(aPackage)) {
    return 'Yearly';
  }

  if (isMonthlyPackage(aPackage)) {
    return 'Monthly';
  }

  return aPackage.title || 'Premium';
}

function planPrice(aPackage: PremiumPackage): string {
  if (!aPackage.periodLabel) {
    return aPackage.priceString;
  }

  return `${aPackage.priceString} / ${aPackage.periodLabel}`;
}

export default function PaywallRoute() {
  const router = useRouter();
  const auth = useAuthStore();
  const premiumState = usePremiumStore((state) => state.premiumState);
  const hasPremium = isPremiumStateActive(premiumState);
  const isGuest = auth.sessionMode !== 'authenticated';
  const [packages, setPackages] = useState<PremiumPackage[]>([]);
  const [selectedPackageIdentifier, setSelectedPackageIdentifier] = useState<string | null>(null);
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedPackage = useMemo(
    () => packages.find((aPackage) => aPackage.identifier === selectedPackageIdentifier) ?? packages[0] ?? null,
    [packages, selectedPackageIdentifier],
  );
  const hasMonthlyAndAnnual = packages.some(isMonthlyPackage) && packages.some(isAnnualPackage);

  const loadPackages = useCallback(async () => {
    setLoadingPackages(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const state = await premiumService.refreshPremiumState({ syncBackend: false });

      if (isPremiumStateActive(state)) {
        setPackages([]);
        setSelectedPackageIdentifier(null);
        setStatusMessage('Premium is already active on this account.');
        return;
      }

      const result = await premiumService.getPaywallPackages();

      if (!result.ok) {
        setPackages([]);
        setSelectedPackageIdentifier(null);
        setErrorMessage(result.message ?? 'Premium options are unavailable right now.');
        return;
      }

      setPackages(result.packages);
      const preferredPackage = result.packages.find(isAnnualPackage) ?? result.packages[0] ?? null;
      setSelectedPackageIdentifier(preferredPackage?.identifier ?? null);
    } finally {
      setLoadingPackages(false);
    }
  }, []);

  useEffect(() => {
    trackEvent('paywall_viewed');
    void loadPackages();
  }, [loadPackages]);

  const openConfiguredUrl = async (label: string, url: string) => {
    const trimmedUrl = url.trim();

    if (!trimmedUrl) {
      Alert.alert(label, 'This link is not configured yet.');
      return;
    }

    try {
      await Linking.openURL(trimmedUrl);
    } catch {
      Alert.alert(label, 'Could not open this link right now.');
    }
  };

  const purchase = async () => {
    if (hasPremium) {
      Alert.alert('Premium', 'Premium is already active on this account.', [{ text: 'OK', onPress: () => router.back() }]);
      return;
    }

    if (isGuest) {
      router.push('/auth');
      return;
    }

    if (!selectedPackage) {
      setErrorMessage('No Premium option is available right now.');
      return;
    }

    setPurchaseLoading(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const result = await premiumService.purchasePaywallPackage(selectedPackage.identifier);

      if (result.ok) {
        Alert.alert('Premium', result.message, [{ text: 'OK', onPress: () => router.back() }]);
        return;
      }

      if (result.alreadyPremium) {
        Alert.alert('Premium', result.message, [{ text: 'OK', onPress: () => router.back() }]);
        return;
      }

      if (!result.cancelled) {
        setErrorMessage(result.message);
      }
    } finally {
      setPurchaseLoading(false);
    }
  };

  const restore = async () => {
    setRestoreLoading(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const result = await premiumService.restorePurchases();

      if (result.ok) {
        setStatusMessage(result.message);
      } else {
        setErrorMessage(result.message);
      }
    } finally {
      setRestoreLoading(false);
    }
  };

  return (
    <Screen bottomInset={spacing.xxxl}>
      <View style={styles.closeRow}>
        <Pressable accessibilityLabel="Close Premium" accessibilityRole="button" onPress={() => router.back()} style={styles.closeButton}>
          <X color={colors.text.primary} size={21} strokeWidth={2.8} />
        </Pressable>
      </View>

      <LinearGradient colors={gradients.clown} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.badge}>
          <Crown color={colors.text.onBrand} size={15} />
          <AppText variant="eyebrow" color={colors.text.onBrand}>
            Premium
          </AppText>
        </View>
        <AppText variant="display" color={colors.text.onBrand} style={styles.title}>
          More AI Verdicts.
        </AppText>
        <AppText variant="subtitle" color={colors.text.onBrand} style={styles.subtitle}>
          For the cases you cannot stop replaying.
        </AppText>
      </LinearGradient>

      <View style={styles.body}>
        <View style={styles.benefitList}>
          {benefits.map((benefit) => (
            <PremiumBenefit key={benefit} text={benefit} />
          ))}
        </View>

        {loadingPackages ? (
          <View style={styles.loadingPanel}>
            <ActivityIndicator color={colors.brand.pink} />
            <AppText variant="body" style={styles.loadingText}>
              Loading Premium options...
            </AppText>
          </View>
        ) : null}

        {!loadingPackages && packages.length > 0 ? (
          <View style={styles.planList}>
            {packages.map((aPackage) => (
              <PlanCard
                key={`${aPackage.identifier}:${aPackage.productIdentifier}`}
                aPackage={aPackage}
                recommended={hasMonthlyAndAnnual && isAnnualPackage(aPackage)}
                selected={selectedPackage?.identifier === aPackage.identifier}
                onPress={() => setSelectedPackageIdentifier(aPackage.identifier)}
              />
            ))}
          </View>
        ) : null}

        {!loadingPackages && isGuest ? (
          <View style={styles.notice}>
            <AppText variant="body" style={styles.noticeText}>
              Sign in to access Premium.
            </AppText>
          </View>
        ) : null}

        {!loadingPackages && errorMessage ? (
          <View style={styles.errorNotice}>
            <AppText variant="meta" style={styles.errorText}>
              {errorMessage}
            </AppText>
          </View>
        ) : null}

        {!loadingPackages && statusMessage ? (
          <View style={styles.notice}>
            <AppText variant="meta" style={styles.noticeText}>
              {statusMessage}
            </AppText>
          </View>
        ) : null}

        <Button
          title={isGuest ? 'Sign in to access Premium' : hasPremium ? 'Premium active' : 'Continue'}
          variant="accent"
          icon={Sparkles}
          loading={purchaseLoading}
          disabled={!isGuest && !hasPremium && !selectedPackage}
          onPress={() => void purchase()}
        />

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: restoreLoading }}
          disabled={restoreLoading}
          onPress={() => void restore()}
          style={styles.restoreButton}
        >
          {restoreLoading ? <ActivityIndicator color={colors.text.secondary} /> : <RotateCcw color={colors.text.secondary} size={16} />}
          <AppText variant="body" color={colors.text.secondary} style={styles.restoreText}>
            {restoreLoading ? 'Restoring...' : 'Restore Purchases'}
          </AppText>
        </Pressable>

        <View style={styles.legalLinks}>
          {env.privacyPolicyUrl ? (
            <Pressable accessibilityRole="link" onPress={() => void openConfiguredUrl('Privacy Policy', env.privacyPolicyUrl)}>
              <AppText variant="meta" style={styles.legalLinkText}>
                Privacy Policy
              </AppText>
            </Pressable>
          ) : null}
          {env.termsUrl ? (
            <Pressable accessibilityRole="link" onPress={() => void openConfiguredUrl('Terms of Use', env.termsUrl)}>
              <AppText variant="meta" style={styles.legalLinkText}>
                Terms of Use
              </AppText>
            </Pressable>
          ) : null}
        </View>

        <AppText variant="meta" center style={styles.disclaimer}>
          Payment will be charged to your Apple ID at confirmation of purchase. Subscriptions renew automatically unless
          canceled at least 24 hours before the end of the current period. You can manage or cancel subscriptions in your
          App Store account settings.
        </AppText>
      </View>
    </Screen>
  );
}

function PremiumBenefit({ text }: { text: string }) {
  return (
    <View style={styles.benefitRow}>
      <View style={styles.benefitIcon}>
        <Check color={colors.brand.ink} size={13} strokeWidth={3} />
      </View>
      <AppText variant="body" style={styles.benefitText}>
        {text}
      </AppText>
    </View>
  );
}

function PlanCard({
  aPackage,
  recommended,
  selected,
  onPress,
}: {
  aPackage: PremiumPackage;
  recommended: boolean;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.planCard, selected && styles.planCardSelected]}
    >
      <View style={styles.planCopy}>
        <View style={styles.planTitleRow}>
          <AppText variant="title" style={styles.planTitle}>
            {planTitle(aPackage)}
          </AppText>
          {recommended ? (
            <View style={styles.bestValueBadge}>
              <AppText variant="eyebrow" color={colors.text.onAccent} style={styles.bestValueText}>
                Best value
              </AppText>
            </View>
          ) : null}
        </View>
        <AppText variant="subtitle" style={styles.planPrice}>
          {planPrice(aPackage)}
        </AppText>
        <AppText variant="meta" style={styles.planMeta} numberOfLines={1}>
          {aPackage.title}
        </AppText>
      </View>
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected ? <Check color={colors.brand.ink} size={15} strokeWidth={3.2} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  closeRow: {
    alignItems: 'flex-end',
    marginBottom: spacing.sm,
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: colors.bg.surface,
    borderColor: colors.brand.ink,
    borderRadius: 18,
    borderWidth: 2,
    height: 36,
    justifyContent: 'center',
    width: 36,
    ...shadows.hardSmall,
  },
  hero: {
    borderColor: colors.brand.ink,
    borderRadius: radii.xl,
    borderWidth: 2,
    gap: spacing.sm,
    padding: spacing.xl,
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
    fontSize: 34,
    lineHeight: 38,
  },
  subtitle: {
    opacity: 0.92,
  },
  body: {
    gap: spacing.lg,
    paddingTop: spacing.xl,
  },
  benefitList: {
    gap: spacing.sm,
  },
  benefitRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  benefitIcon: {
    alignItems: 'center',
    backgroundColor: colors.accent.lime,
    borderColor: colors.brand.ink,
    borderRadius: 11,
    borderWidth: 1.5,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  benefitText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
  },
  loadingPanel: {
    alignItems: 'center',
    backgroundColor: colors.bg.surface,
    borderColor: colors.brand.ink,
    borderRadius: radii.lg,
    borderWidth: 2,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.lg,
  },
  loadingText: {
    fontFamily: typography.family.bodyMedium,
  },
  planList: {
    gap: spacing.md,
  },
  planCard: {
    alignItems: 'center',
    backgroundColor: colors.bg.surface,
    borderColor: colors.brand.ink,
    borderRadius: radii.lg,
    borderWidth: 2,
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    minHeight: 104,
    padding: spacing.lg,
  },
  planCardSelected: {
    backgroundColor: '#FFF6FB',
    borderColor: colors.brand.pink,
    ...shadows.hardSmall,
  },
  planCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  planTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  planTitle: {
    lineHeight: 24,
  },
  bestValueBadge: {
    backgroundColor: colors.accent.lime,
    borderColor: colors.brand.ink,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  bestValueText: {
    fontSize: 10,
    letterSpacing: 0.8,
  },
  planPrice: {
    color: colors.text.primary,
    fontFamily: typography.family.displaySemiBold,
  },
  planMeta: {
    color: colors.text.secondary,
  },
  radio: {
    alignItems: 'center',
    borderColor: colors.brand.ink,
    borderRadius: 15,
    borderWidth: 2,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  radioSelected: {
    backgroundColor: colors.accent.lime,
  },
  notice: {
    backgroundColor: colors.bg.muted,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  noticeText: {
    color: colors.text.primary,
    fontFamily: typography.family.bodySemiBold,
  },
  errorNotice: {
    backgroundColor: '#FDE2E2',
    borderColor: colors.ui.destructive,
    borderRadius: radii.md,
    borderWidth: 1.5,
    padding: spacing.md,
  },
  errorText: {
    color: colors.ui.destructive,
    fontFamily: typography.family.bodySemiBold,
  },
  restoreButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: 36,
  },
  restoreText: {
    fontFamily: typography.family.bodySemiBold,
  },
  legalLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
    justifyContent: 'center',
  },
  legalLinkText: {
    color: colors.text.secondary,
    fontFamily: typography.family.bodySemiBold,
    textDecorationLine: 'underline',
  },
  disclaimer: {
    color: colors.text.secondary,
    opacity: 0.82,
  },
});
