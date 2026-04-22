import type { PremiumState } from '../../types/shared';
import { trackEvent } from '../../lib/analytics/analyticsService';
import { env } from '../../lib/env';
import { supabase } from '../../lib/supabase/client';
import { useAuthStore } from '../../store/authStore';
import { premiumFeatureFlags, type PremiumFeatureFlag } from './featureFlags';

const freeState: PremiumState = {
  userId: 'guest',
  entitlementStatus: 'free',
  source: 'none',
  entitlementId: null,
  productId: null,
  expiresAt: null,
  updatedAt: new Date(0).toISOString(),
};

export const premiumService = {
  async getPremiumState(): Promise<PremiumState> {
    const auth = useAuthStore.getState();

    if (auth.sessionMode !== 'authenticated' || !auth.user || !supabase) {
      return freeState;
    }

    const { data, error } = await supabase
      .from('premium_states')
      .select('*')
      .eq('user_id', auth.user.id)
      .maybeSingle();

    if (error || !data) {
      return { ...freeState, userId: auth.user.id };
    }

    return {
      userId: data.user_id,
      entitlementStatus: data.entitlement_status,
      source: data.source,
      entitlementId: data.entitlement_id,
      productId: data.product_id,
      expiresAt: data.expires_at,
      updatedAt: data.updated_at,
    };
  },
  async isPremium(): Promise<boolean> {
    const state = await this.getPremiumState();
    return state.entitlementStatus === 'premium' || state.entitlementStatus === 'grace_period';
  },
  canUseFeature(flag: PremiumFeatureFlag): boolean {
    if (flag === 'premiumEnabled') {
      return premiumFeatureFlags.premiumEnabled;
    }

    return !premiumFeatureFlags.premiumEnabled || premiumFeatureFlags[flag];
  },
  async restorePurchases(): Promise<void> {
    trackEvent('restore_purchases_tapped');
    // TODO: wire RevenueCat Purchases.restorePurchases after native SDK and API key setup.
    if (!env.revenueCatIosApiKey && __DEV__) {
      console.log('[revenuecat] Missing EXPO_PUBLIC_REVENUECAT_IOS_API_KEY.');
    }
  },
};
