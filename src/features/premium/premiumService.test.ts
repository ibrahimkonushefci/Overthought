import type { CustomerInfo, PurchasesEntitlementInfo } from 'react-native-purchases';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase/client';
import { usePremiumStore } from '../../store/premiumStore';
import { premiumService } from './premiumService';
import { revenueCatClient } from './revenueCatClient';

jest.mock('../../lib/supabase/client', () => ({
  supabase: {
    from: jest.fn(),
    functions: {
      invoke: jest.fn(),
    },
  },
}));

jest.mock('./revenueCatClient', () => ({
  revenueCatClient: {
    handleAuthUserChanged: jest.fn(),
    getOfferings: jest.fn(),
    getCustomerInfo: jest.fn(),
    isAnonymous: jest.fn(),
    purchasePackage: jest.fn(),
    toPackageSummary: jest.fn(),
    restorePurchases: jest.fn(),
    isConfigured: jest.fn(),
  },
}));

const mockSupabase = supabase as unknown as {
  from: jest.Mock;
  functions: {
    invoke: jest.Mock;
  };
};

function premiumStateRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    user_id: 'user-1',
    entitlement_status: 'free',
    source: 'none',
    entitlement_id: null,
    product_id: null,
    expires_at: null,
    updated_at: '2026-04-23T09:00:00.000Z',
    ...overrides,
  };
}

function createPremiumStateQuery(row: ReturnType<typeof premiumStateRow> | null) {
  const builder = {
    select: jest.fn(),
    eq: jest.fn(),
    maybeSingle: jest.fn(),
  };

  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.maybeSingle.mockResolvedValue({ data: row, error: null });

  return builder;
}

function entitlement(overrides: Partial<PurchasesEntitlementInfo> = {}): PurchasesEntitlementInfo {
  return {
    identifier: 'pro',
    isActive: true,
    willRenew: true,
    periodType: 'NORMAL',
    latestPurchaseDate: '2026-04-20T00:00:00.000Z',
    latestPurchaseDateMillis: Date.parse('2026-04-20T00:00:00.000Z'),
    originalPurchaseDate: '2026-04-01T00:00:00.000Z',
    originalPurchaseDateMillis: Date.parse('2026-04-01T00:00:00.000Z'),
    expirationDate: '2026-05-01T00:00:00.000Z',
    expirationDateMillis: Date.parse('2026-05-01T00:00:00.000Z'),
    store: 'APP_STORE',
    productIdentifier: 'overthought.pro.monthly',
    productPlanIdentifier: null,
    isSandbox: true,
    unsubscribeDetectedAt: null,
    unsubscribeDetectedAtMillis: null,
    billingIssueDetectedAt: null,
    billingIssueDetectedAtMillis: null,
    ownershipType: 'PURCHASED',
    verification: 'NOT_REQUESTED' as never,
    ...overrides,
  };
}

function customerInfo(overrides: Partial<CustomerInfo> = {}): CustomerInfo {
  return {
    entitlements: {
      all: {},
      active: {},
      verification: 'NOT_REQUESTED' as never,
    },
    activeSubscriptions: [],
    allPurchasedProductIdentifiers: [],
    latestExpirationDate: null,
    firstSeen: '2026-04-01T00:00:00.000Z',
    originalAppUserId: 'user-1',
    requestDate: '2026-04-23T10:00:00.000Z',
    allExpirationDates: {},
    allPurchaseDates: {},
    originalApplicationVersion: null,
    originalPurchaseDate: null,
    managementURL: null,
    nonSubscriptionTransactions: [],
    subscriptionsByProductIdentifier: {},
    ...overrides,
  };
}

function monthlyPackage() {
  return {
    identifier: '$rc_monthly',
    packageType: 'MONTHLY' as never,
    product: {
      identifier: 'overthought_monthly',
      title: 'Overthought Monthly',
      priceString: '$4.99',
    },
    presentedOfferingContext: {
      offeringIdentifier: 'default',
    },
  };
}

describe('premiumService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.getState().resetSession();
    usePremiumStore.getState().reset();
    mockSupabase.from.mockReset();
    mockSupabase.functions.invoke.mockReset();
    jest.mocked(revenueCatClient.getOfferings).mockResolvedValue(null);
    jest.mocked(revenueCatClient.getCustomerInfo).mockResolvedValue(null);
    jest.mocked(revenueCatClient.isAnonymous).mockResolvedValue(true);
    jest.mocked(revenueCatClient.purchasePackage).mockResolvedValue({ customerInfo: customerInfo() } as never);
    jest.mocked(revenueCatClient.toPackageSummary).mockReturnValue({
      identifier: '$rc_monthly',
      offeringIdentifier: 'default',
      packageType: 'MONTHLY' as never,
      productIdentifier: 'overthought_monthly',
      title: 'Overthought Monthly',
      priceString: '$4.99',
      periodLabel: 'month',
    });
    jest.mocked(revenueCatClient.restorePurchases).mockResolvedValue(customerInfo());
    jest.mocked(revenueCatClient.isConfigured).mockReturnValue(true);
  });

  it('returns a free state for guests', async () => {
    const state = await premiumService.getPremiumState();

    expect(state).toEqual({
      userId: 'guest',
      entitlementStatus: 'free',
      source: 'none',
      entitlementId: null,
      productId: null,
      expiresAt: null,
      updatedAt: new Date(0).toISOString(),
    });
  });

  it('falls back to backend premium state when RevenueCat local state is unavailable', async () => {
    useAuthStore.getState().setAuthenticated({
      id: 'user-1',
      email: 'person@example.com',
      provider: 'email',
    });

    mockSupabase.from.mockReturnValue(
      createPremiumStateQuery(
        premiumStateRow({
          entitlement_status: 'premium',
          source: 'revenuecat',
          entitlement_id: 'pro',
          product_id: 'overthought.pro.monthly',
        }),
      ),
    );
    mockSupabase.functions.invoke.mockResolvedValue({
      data: { ok: false, code: 'not_configured', message: 'RevenueCat server sync is not configured.' },
      error: null,
    });

    const state = await premiumService.getPremiumState();

    expect(state.entitlementStatus).toBe('premium');
    expect(state.entitlementId).toBe('pro');
  });

  it('maps active RevenueCat entitlement data into the normalized premium state', async () => {
    useAuthStore.getState().setAuthenticated({
      id: 'user-1',
      email: 'person@example.com',
      provider: 'email',
    });

    mockSupabase.from.mockReturnValue(createPremiumStateQuery(null));
    mockSupabase.functions.invoke.mockResolvedValue({
      data: { ok: false, code: 'sync_failed', message: 'sync failed' },
      error: null,
    });
    jest.mocked(revenueCatClient.getCustomerInfo).mockResolvedValue(
      customerInfo({
        entitlements: {
          all: { pro: entitlement() },
          active: { pro: entitlement() },
          verification: 'NOT_REQUESTED' as never,
        },
        activeSubscriptions: ['overthought.pro.monthly'],
        allPurchasedProductIdentifiers: ['overthought.pro.monthly'],
      }),
    );

    const state = await premiumService.getPremiumState();

    expect(state).toMatchObject({
      userId: 'user-1',
      entitlementStatus: 'premium',
      source: 'revenuecat',
      entitlementId: 'pro',
      productId: 'overthought.pro.monthly',
      expiresAt: '2026-05-01T00:00:00.000Z',
    });
  });

  it('treats grace-period entitlements as premium access', async () => {
    useAuthStore.getState().setAuthenticated({
      id: 'user-1',
      email: 'person@example.com',
      provider: 'email',
    });

    mockSupabase.from.mockReturnValue(createPremiumStateQuery(null));
    mockSupabase.functions.invoke.mockResolvedValue({
      data: { ok: false, code: 'sync_failed', message: 'sync failed' },
      error: null,
    });
    jest.mocked(revenueCatClient.getCustomerInfo).mockResolvedValue(
      customerInfo({
        entitlements: {
          all: {
            pro: entitlement({
              billingIssueDetectedAt: '2026-04-22T00:00:00.000Z',
              billingIssueDetectedAtMillis: Date.parse('2026-04-22T00:00:00.000Z'),
            }),
          },
          active: {
            pro: entitlement({
              billingIssueDetectedAt: '2026-04-22T00:00:00.000Z',
              billingIssueDetectedAtMillis: Date.parse('2026-04-22T00:00:00.000Z'),
            }),
          },
          verification: 'NOT_REQUESTED' as never,
        },
      }),
    );

    await expect(premiumService.isPremium()).resolves.toBe(true);
    const state = await premiumService.getPremiumState();

    expect(state.entitlementStatus).toBe('grace_period');
  });

  it('restorePurchases returns a refreshed premium state when restore succeeds', async () => {
    useAuthStore.getState().setAuthenticated({
      id: 'user-1',
      email: 'person@example.com',
      provider: 'email',
    });

    mockSupabase.from.mockReturnValue(createPremiumStateQuery(null));
    mockSupabase.functions.invoke.mockResolvedValue({
      data: { ok: false, code: 'sync_failed', message: 'sync failed' },
      error: null,
    });
    jest.mocked(revenueCatClient.restorePurchases).mockResolvedValue(
      customerInfo({
        entitlements: {
          all: { pro: entitlement() },
          active: { pro: entitlement() },
          verification: 'NOT_REQUESTED' as never,
        },
      }),
    );

    const result = await premiumService.restorePurchases();

    expect(result.ok).toBe(true);
    expect(result.state.entitlementStatus).toBe('premium');
    expect(result.message).toBe('Purchases restored.');
    expect(result.kind).toBe('restored');
    expect(usePremiumStore.getState().premiumState?.entitlementStatus).toBe('premium');
  });

  it('resolves the paywall package from the current offering first', async () => {
    useAuthStore.getState().setAuthenticated({
      id: 'user-1',
      email: 'person@example.com',
      provider: 'email',
    });

    jest.mocked(revenueCatClient.getOfferings).mockResolvedValue({
      current: {
        monthly: monthlyPackage(),
        availablePackages: [monthlyPackage()],
      } as never,
      fallback: null,
    });

    const result = await premiumService.getPaywallPackage();

    expect(result.ok).toBe(true);
    expect(result.packageInfo?.productIdentifier).toBe('overthought_monthly');
    expect(revenueCatClient.toPackageSummary).toHaveBeenCalled();
  });

  it('falls back to the default offering when no current offering is returned', async () => {
    useAuthStore.getState().setAuthenticated({
      id: 'user-1',
      email: 'person@example.com',
      provider: 'email',
    });

    jest.mocked(revenueCatClient.getOfferings).mockResolvedValue({
      current: null,
      fallback: {
        monthly: monthlyPackage(),
        availablePackages: [monthlyPackage()],
      } as never,
    });

    const result = await premiumService.getPaywallPackage();

    expect(result.ok).toBe(true);
    expect(result.packageInfo?.offeringIdentifier).toBe('default');
  });

  it('purchases the paywall package and refreshes premium state', async () => {
    useAuthStore.getState().setAuthenticated({
      id: 'user-1',
      email: 'person@example.com',
      provider: 'email',
    });

    mockSupabase.from.mockReturnValue(createPremiumStateQuery(null));
    mockSupabase.functions.invoke.mockResolvedValue({
      data: { ok: false, code: 'sync_failed', message: 'sync failed' },
      error: null,
    });
    jest.mocked(revenueCatClient.getOfferings).mockResolvedValue({
      current: {
        monthly: monthlyPackage(),
        availablePackages: [monthlyPackage()],
      } as never,
      fallback: null,
    });
    jest.mocked(revenueCatClient.purchasePackage).mockResolvedValue({
      customerInfo: customerInfo({
        entitlements: {
          all: { premium: entitlement({ identifier: 'premium' }) },
          active: { premium: entitlement({ identifier: 'premium' }) },
          verification: 'NOT_REQUESTED' as never,
        },
      }),
    } as never);

    const result = await premiumService.purchasePaywallPackage();

    expect(result.ok).toBe(true);
    expect(result.state.entitlementStatus).toBe('premium');
    expect(revenueCatClient.purchasePackage).toHaveBeenCalled();
    expect(usePremiumStore.getState().premiumState?.entitlementStatus).toBe('premium');
  });

  it('blocks repeat purchase attempts when premium is already active locally', async () => {
    useAuthStore.getState().setAuthenticated({
      id: 'user-1',
      email: 'person@example.com',
      provider: 'email',
    });

    usePremiumStore.getState().setPremiumState({
      userId: 'user-1',
      entitlementStatus: 'premium',
      source: 'revenuecat',
      entitlementId: 'premium',
      productId: 'overthought_monthly',
      expiresAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-04-24T10:00:00.000Z',
    });

    const result = await premiumService.purchasePaywallPackage();

    expect(result.ok).toBe(false);
    expect(result.alreadyPremium).toBe(true);
    expect(result.message).toBe('Premium is already active on this account.');
    expect(revenueCatClient.purchasePackage).not.toHaveBeenCalled();
  });

  it('reports already active on restore when local premium is already active', async () => {
    useAuthStore.getState().setAuthenticated({
      id: 'user-1',
      email: 'person@example.com',
      provider: 'email',
    });

    usePremiumStore.getState().setPremiumState({
      userId: 'user-1',
      entitlementStatus: 'premium',
      source: 'revenuecat',
      entitlementId: 'premium',
      productId: 'overthought_monthly',
      expiresAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-04-24T10:00:00.000Z',
    });
    jest.mocked(revenueCatClient.restorePurchases).mockResolvedValue(
      customerInfo({
        entitlements: {
          all: { premium: entitlement({ identifier: 'premium' }) },
          active: { premium: entitlement({ identifier: 'premium' }) },
          verification: 'NOT_REQUESTED' as never,
        },
      }),
    );

    const result = await premiumService.restorePurchases();

    expect(result.ok).toBe(true);
    expect(result.kind).toBe('already_active');
    expect(result.message).toBe('Premium is already active on this account.');
  });

  it('restorePurchases fails safely when RevenueCat is unavailable', async () => {
    useAuthStore.getState().setAuthenticated({
      id: 'user-1',
      email: 'person@example.com',
      provider: 'email',
    });

    mockSupabase.from.mockReturnValue(createPremiumStateQuery(null));
    mockSupabase.functions.invoke.mockResolvedValue({
      data: { ok: false, code: 'sync_failed', message: 'sync failed' },
      error: null,
    });
    jest.mocked(revenueCatClient.restorePurchases).mockRejectedValue(new Error('SDK unavailable'));

    const result = await premiumService.restorePurchases();

    expect(result.ok).toBe(false);
    expect(result.state.entitlementStatus).toBe('free');
    expect(result.message).toBe('SDK unavailable');
    expect(result.kind).toBe('failed');
  });
});
