import type {
  CustomerInfo,
  PurchasesEntitlementInfo,
  PurchasesPackage,
  PurchasesStoreProduct,
} from 'react-native-purchases';
import type { EntitlementStatus, PremiumPackage, PremiumState } from '../../types/shared';
import { trackEvent } from '../../lib/analytics/analyticsService';
import { supabase } from '../../lib/supabase/client';
import { useAuthStore } from '../../store/authStore';
import { isPremiumStateActive, usePremiumStore } from '../../store/premiumStore';
import { premiumFeatureFlags, type PremiumFeatureFlag } from './featureFlags';
import { revenueCatClient } from './revenueCatClient';

interface PremiumStateRow {
  user_id: string;
  entitlement_status: PremiumState['entitlementStatus'];
  source: PremiumState['source'];
  entitlement_id: string | null;
  product_id: string | null;
  expires_at: string | null;
  updated_at: string;
}

interface SyncPremiumStateSuccess {
  ok: true;
  premiumState: PremiumStateRow;
}

interface SyncPremiumStateFailure {
  ok: false;
  code: 'not_authenticated' | 'not_configured' | 'sync_failed';
  message: string;
}

type SyncPremiumStateResponse = SyncPremiumStateSuccess | SyncPremiumStateFailure;

export interface RestorePurchasesResult {
  ok: boolean;
  state: PremiumState;
  message: string;
  kind: 'restored' | 'already_active' | 'nothing_to_restore' | 'failed';
}

export interface PremiumOfferingResult {
  ok: boolean;
  packageInfo: PremiumPackage | null;
  message?: string;
}

export interface PremiumOfferingsResult {
  ok: boolean;
  packages: PremiumPackage[];
  message?: string;
}

export interface PremiumPurchaseResult {
  ok: boolean;
  cancelled?: boolean;
  alreadyPremium?: boolean;
  state: PremiumState;
  message: string;
}

const FREE_STATE_UPDATED_AT = new Date(0).toISOString();

function freeState(userId = 'guest'): PremiumState {
  return {
    userId,
    entitlementStatus: 'free',
    source: 'none',
    entitlementId: null,
    productId: null,
    expiresAt: null,
    updatedAt: FREE_STATE_UPDATED_AT,
  };
}

function mapPremiumStateRow(row: PremiumStateRow): PremiumState {
  return {
    userId: row.user_id,
    entitlementStatus: row.entitlement_status,
    source: row.source,
    entitlementId: row.entitlement_id,
    productId: row.product_id,
    expiresAt: row.expires_at,
    updatedAt: row.updated_at,
  };
}

function entitlementPriority(status: EntitlementStatus): number {
  switch (status) {
    case 'premium':
      return 4;
    case 'grace_period':
      return 3;
    case 'expired':
      return 2;
    case 'free':
    default:
      return 1;
  }
}

function isPremiumEntitlement(state: PremiumState): boolean {
  return state.entitlementStatus === 'premium' || state.entitlementStatus === 'grace_period';
}

function compareFreshness(left: PremiumState | null, right: PremiumState | null): number {
  const leftTime = left ? Date.parse(left.updatedAt) : Number.NEGATIVE_INFINITY;
  const rightTime = right ? Date.parse(right.updatedAt) : Number.NEGATIVE_INFINITY;
  return leftTime - rightTime;
}

function choosePreferredState(
  userId: string,
  backendState: PremiumState | null,
  revenueCatState: PremiumState | null,
): PremiumState {
  if (backendState && revenueCatState) {
    const backendPriority = entitlementPriority(backendState.entitlementStatus);
    const revenueCatPriority = entitlementPriority(revenueCatState.entitlementStatus);

    if (backendPriority > revenueCatPriority) {
      return backendState;
    }

    if (revenueCatPriority > backendPriority) {
      return revenueCatState;
    }

    return compareFreshness(backendState, revenueCatState) >= 0 ? backendState : revenueCatState;
  }

  return backendState ?? revenueCatState ?? freeState(userId);
}

function sortedEntitlements(entitlements: Record<string, PurchasesEntitlementInfo>): PurchasesEntitlementInfo[] {
  return Object.entries(entitlements)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, value]) => value);
}

function mapRevenueCatState(userId: string, customerInfo: CustomerInfo): PremiumState {
  const activeEntitlement = sortedEntitlements(customerInfo.entitlements.active)[0] ?? null;

  if (activeEntitlement) {
    return {
      userId,
      entitlementStatus: activeEntitlement.billingIssueDetectedAt ? 'grace_period' : 'premium',
      source: 'revenuecat',
      entitlementId: activeEntitlement.identifier,
      productId: activeEntitlement.productIdentifier,
      expiresAt: activeEntitlement.expirationDate,
      updatedAt: customerInfo.requestDate,
    };
  }

  const knownEntitlement = sortedEntitlements(customerInfo.entitlements.all)[0] ?? null;

  return {
    userId,
    entitlementStatus:
      knownEntitlement || customerInfo.allPurchasedProductIdentifiers.length > 0 || customerInfo.latestExpirationDate
        ? 'expired'
        : 'free',
    source: 'revenuecat',
    entitlementId: knownEntitlement?.identifier ?? null,
    productId: knownEntitlement?.productIdentifier ?? customerInfo.allPurchasedProductIdentifiers[0] ?? null,
    expiresAt: knownEntitlement?.expirationDate ?? customerInfo.latestExpirationDate,
    updatedAt: customerInfo.requestDate,
  };
}

function hasActivePremiumEntitlement(customerInfo: CustomerInfo): boolean {
  return Object.keys(customerInfo.entitlements.active).length > 0;
}

function packagePriority(aPackage: PurchasesPackage): number {
  switch (aPackage.packageType) {
    case 'MONTHLY':
      return 1;
    case 'ANNUAL':
      return 2;
    default:
      return 3;
  }
}

function sortPaywallPackages(packages: PurchasesPackage[]): PurchasesPackage[] {
  return [...packages].sort((left, right) => {
    const priorityDifference = packagePriority(left) - packagePriority(right);

    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    return left.identifier.localeCompare(right.identifier);
  });
}

function dedupePackages(packages: PurchasesPackage[]): PurchasesPackage[] {
  const seen = new Set<string>();

  return packages.filter((aPackage) => {
    const key = `${aPackage.identifier}:${aPackage.product.identifier}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function offeringPackages(offering: Awaited<ReturnType<typeof revenueCatClient.getOfferings>>): PurchasesPackage[] {
  const selectedOffering = offering?.current ?? offering?.fallback ?? null;

  if (!selectedOffering) {
    return [];
  }

  return sortPaywallPackages(dedupePackages(selectedOffering.availablePackages ?? []));
}

function findPackageByIdentifier(packages: PurchasesPackage[], packageIdentifier: string | null): PurchasesPackage | null {
  if (!packageIdentifier) {
    return packages[0] ?? null;
  }

  return packages.find((aPackage) => aPackage.identifier === packageIdentifier) ?? null;
}

interface StoreProductLookupResult {
  productsByIdentifier: Map<string, PurchasesStoreProduct>;
  usedSubscriptionProductCategory: boolean;
}

async function storeProductsByIdentifier(
  userId: string,
  packages: PurchasesPackage[],
): Promise<StoreProductLookupResult> {
  const productIdentifiers = [...new Set(packages.map((aPackage) => aPackage.product.identifier))];

  if (productIdentifiers.length === 0) {
    return {
      productsByIdentifier: new Map<string, PurchasesStoreProduct>(),
      usedSubscriptionProductCategory: false,
    };
  }

  try {
    const products = await revenueCatClient.getProducts(userId, productIdentifiers);
    return {
      productsByIdentifier: new Map(products.map((product) => [product.identifier, product])),
      usedSubscriptionProductCategory: true,
    };
  } catch {
    return {
      productsByIdentifier: new Map<string, PurchasesStoreProduct>(),
      usedSubscriptionProductCategory: true,
    };
  }
}

function logPaywallPackageDiagnostics(aPackage: PremiumPackage) {
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  console.info('[paywall-package]', {
    packageIdentifier: aPackage.identifier,
    productIdentifier: aPackage.productIdentifier,
    packageType: aPackage.packageType,
    priceString: aPackage.priceString,
    currencyCode: aPackage.currencyCode,
    price: aPackage.price,
    subscriptionPeriod: aPackage.subscriptionPeriod,
    packageProductPriceString: aPackage.packageProductPriceString,
    storeProductPriceString: aPackage.storeProductPriceString,
    storeProductFound: aPackage.storeProductFound,
    storeProductLookupUsedSubscriptionCategory: aPackage.storeProductLookupUsedSubscriptionCategory,
    finalDisplayPrice: aPackage.finalDisplayPrice,
  });
}

function setPremiumState(premiumState: PremiumState) {
  usePremiumStore.getState().setPremiumState(premiumState);
}

function getCachedPremiumState(userId: string | null): PremiumState | null {
  const premiumState = usePremiumStore.getState().premiumState;

  if (!premiumState) {
    return null;
  }

  if (userId === null) {
    return premiumState.userId === 'guest' ? premiumState : null;
  }

  return premiumState.userId === userId ? premiumState : null;
}

async function syncPremiumStateInBackground(userId: string, revenueCatState: PremiumState | null): Promise<void> {
  let syncedBackendState: PremiumState | null = null;

  try {
    syncedBackendState = await syncBackendPremiumState();
  } catch {
    return;
  }

  if (!syncedBackendState) {
    return;
  }

  setPremiumState(choosePreferredState(userId, syncedBackendState, revenueCatState));
}

async function getBackendPremiumState(userId: string): Promise<PremiumState | null> {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('premium_states')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapPremiumStateRow(data as PremiumStateRow);
}

async function syncBackendPremiumState(): Promise<PremiumState | null> {
  if (!supabase) {
    return null;
  }

  const response = await supabase.functions.invoke<SyncPremiumStateResponse>('sync-premium-state', {
    body: {},
  });

  if (!response) {
    return null;
  }

  const { data, error } = response;

  if (error || !data || !data.ok) {
    return null;
  }

  return mapPremiumStateRow(data.premiumState);
}

export const premiumService = {
  async handleAuthStateChange(appUserID: string | null): Promise<void> {
    await revenueCatClient.handleAuthUserChanged(appUserID);

    if (!appUserID) {
      setPremiumState(freeState());
      usePremiumStore.getState().setLoading(false);
      return;
    }

    await this.refreshPremiumState({ syncBackend: true });
  },
  async refreshPremiumState({ syncBackend = true }: { syncBackend?: boolean } = {}): Promise<PremiumState> {
    const auth = useAuthStore.getState();

    if (auth.sessionMode !== 'authenticated' || !auth.user) {
      const guestState = freeState();
      setPremiumState(guestState);
      usePremiumStore.getState().setLoading(false);
      return guestState;
    }

    const userId = auth.user.id;
    const cachedState = getCachedPremiumState(userId);
    usePremiumStore.getState().setLoading(true);

    try {
      const revenueCatCustomerInfo = await revenueCatClient.getCustomerInfo(userId).catch(() => null);
      const revenueCatState = revenueCatCustomerInfo ? mapRevenueCatState(userId, revenueCatCustomerInfo) : cachedState;

      if (revenueCatState) {
        setPremiumState(revenueCatState);
      }

      const backendState = syncBackend ? await getBackendPremiumState(userId) : null;
      const resolvedState = choosePreferredState(userId, backendState, revenueCatState);
      setPremiumState(resolvedState);

      if (syncBackend) {
        void syncPremiumStateInBackground(userId, revenueCatState ?? resolvedState);
      }

      return resolvedState;
    } finally {
      usePremiumStore.getState().setLoading(false);
    }
  },
  async getPremiumState(): Promise<PremiumState> {
    const auth = useAuthStore.getState();

    if (auth.sessionMode !== 'authenticated' || !auth.user) {
      const guestState = freeState();
      setPremiumState(guestState);
      return guestState;
    }

    const userId = auth.user.id;
    const cachedState = getCachedPremiumState(userId);

    if (cachedState) {
      return cachedState;
    }

    return this.refreshPremiumState();
  },
  async isPremium(): Promise<boolean> {
    const state = await this.getPremiumState();
    return isPremiumEntitlement(state);
  },
  canUseFeature(flag: PremiumFeatureFlag, state: PremiumState | null = null): boolean {
    if (flag === 'premiumEnabled') {
      return premiumFeatureFlags.premiumEnabled;
    }

    if (!premiumFeatureFlags.premiumEnabled) {
      return true;
    }

    if (!premiumFeatureFlags[flag]) {
      return false;
    }

    return state ? isPremiumEntitlement(state) : false;
  },
  async hasFeatureAccess(flag: PremiumFeatureFlag): Promise<boolean> {
    const state = await this.getPremiumState();
    return this.canUseFeature(flag, state);
  },
  async getPaywallPackage(): Promise<PremiumOfferingResult> {
    const result = await this.getPaywallPackages();

    return {
      ok: result.ok,
      packageInfo: result.packages[0] ?? null,
      message: result.message,
    };
  },
  async getPaywallPackages(): Promise<PremiumOfferingsResult> {
    const auth = useAuthStore.getState();

    if (auth.sessionMode !== 'authenticated' || !auth.user) {
      return {
        ok: false,
        packages: [],
        message: 'Sign in to access Premium.',
      };
    }

    const currentState = getCachedPremiumState(auth.user.id) ?? (await this.refreshPremiumState({ syncBackend: false }));

    if (isPremiumStateActive(currentState)) {
      return {
        ok: true,
        packages: [],
        message: 'Premium is already active on this account.',
      };
    }

    if (!revenueCatClient.isConfigured()) {
      return {
        ok: false,
        packages: [],
        message: 'RevenueCat is not configured for this build.',
      };
    }

    try {
      const offerings = await revenueCatClient.getOfferings(auth.user.id);
      const packages = offeringPackages(offerings);

      if (packages.length === 0) {
        return {
          ok: false,
          packages: [],
          message: 'No purchasable package is available right now. Make sure your default offering is configured.',
        };
      }

      const { productsByIdentifier, usedSubscriptionProductCategory } = await storeProductsByIdentifier(
        auth.user.id,
        packages,
      );
      const packageSummaries = packages.map((aPackage) => {
        const summary = revenueCatClient.toPackageSummary(
          aPackage,
          productsByIdentifier.get(aPackage.product.identifier) ?? null,
          { storeProductLookupUsedSubscriptionCategory: usedSubscriptionProductCategory },
        );
        logPaywallPackageDiagnostics(summary);
        return summary;
      });

      return {
        ok: true,
        packages: packageSummaries,
      };
    } catch (error) {
      return {
        ok: false,
        packages: [],
        message: error instanceof Error ? error.message : 'Unable to load Premium options right now.',
      };
    }
  },
  async purchasePaywallPackage(packageIdentifier: string | null = null): Promise<PremiumPurchaseResult> {
    const auth = useAuthStore.getState();

    if (auth.sessionMode !== 'authenticated' || !auth.user) {
      return {
        ok: false,
        state: freeState(),
        message: 'Sign in to purchase Premium.',
      };
    }

    if (!revenueCatClient.isConfigured()) {
      return {
        ok: false,
        state: freeState(auth.user.id),
        message: 'RevenueCat is not configured for this build.',
      };
    }

    try {
      const currentState = getCachedPremiumState(auth.user.id) ?? (await this.refreshPremiumState({ syncBackend: false }));

      if (isPremiumStateActive(currentState)) {
        return {
          ok: false,
          alreadyPremium: true,
          state: currentState,
          message: 'Premium is already active on this account.',
        };
      }

      const offerings = await revenueCatClient.getOfferings(auth.user.id);
      const packages = offeringPackages(offerings);
      const aPackage = findPackageByIdentifier(packages, packageIdentifier);

      if (!aPackage) {
        return {
          ok: false,
          state: await this.getPremiumState(),
          message: packageIdentifier
            ? 'That Premium option is not available right now. Try another plan or restore purchases.'
            : 'No purchasable package is available right now. Make sure your default offering is configured.',
        };
      }

      trackEvent('premium_purchase_started', {
        offeringIdentifier: aPackage.presentedOfferingContext.offeringIdentifier ?? null,
        packageIdentifier: aPackage.identifier,
        productIdentifier: aPackage.product.identifier,
      });

      const { customerInfo } = await revenueCatClient.purchasePackage(auth.user.id, aPackage);
      const revenueCatState = mapRevenueCatState(auth.user.id, customerInfo);
      setPremiumState(revenueCatState);
      void syncPremiumStateInBackground(auth.user.id, revenueCatState);

      trackEvent('premium_purchase_completed', {
        entitlementActive: hasActivePremiumEntitlement(customerInfo),
        productIdentifier: aPackage.product.identifier,
      });

      return {
        ok: true,
        state: revenueCatState,
        message: isPremiumStateActive(revenueCatState)
          ? 'Premium unlocked.'
          : 'Purchase completed, but the premium entitlement is not active yet.',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to complete the purchase right now.';
      const cancelled =
        typeof error === 'object' &&
        error !== null &&
        'userCancelled' in error &&
        Boolean((error as { userCancelled?: unknown }).userCancelled);

      return {
        ok: false,
        cancelled,
        state: await this.getPremiumState(),
        message: cancelled ? 'Purchase cancelled.' : message,
      };
    }
  },
  async restorePurchases(): Promise<RestorePurchasesResult> {
    trackEvent('restore_purchases_tapped');

    const auth = useAuthStore.getState();

    if (auth.sessionMode !== 'authenticated' || !auth.user) {
      return {
        ok: false,
        state: freeState(),
        message: 'Sign in to restore purchases.',
        kind: 'failed',
      };
    }

    if (!revenueCatClient.isConfigured()) {
      const fallbackState = (await getBackendPremiumState(auth.user.id)) ?? freeState(auth.user.id);
      return {
        ok: false,
        state: fallbackState,
        message: 'RevenueCat is not configured for this build.',
        kind: 'failed',
      };
    }

    try {
      const priorState = getCachedPremiumState(auth.user.id) ?? (await this.refreshPremiumState({ syncBackend: false }));
      const customerInfo = await revenueCatClient.restorePurchases(auth.user.id);
      const revenueCatState = mapRevenueCatState(auth.user.id, customerInfo);
      setPremiumState(revenueCatState);
      void syncPremiumStateInBackground(auth.user.id, revenueCatState);

      if (isPremiumStateActive(revenueCatState) && isPremiumStateActive(priorState)) {
        return {
          ok: true,
          state: revenueCatState,
          message: 'Premium is already active on this account.',
          kind: 'already_active',
        };
      }

      if (isPremiumStateActive(revenueCatState)) {
        return {
          ok: true,
          state: revenueCatState,
          message: 'Purchases restored.',
          kind: 'restored',
        };
      }

      return {
        ok: true,
        state: revenueCatState,
        message: 'No purchases were found to restore.',
        kind: 'nothing_to_restore',
      };
    } catch (error) {
      const fallbackState = await this.getPremiumState();
      return {
        ok: false,
        state: fallbackState,
        message: error instanceof Error ? error.message : 'Unable to restore purchases right now.',
        kind: 'failed',
      };
    }
  },
};
