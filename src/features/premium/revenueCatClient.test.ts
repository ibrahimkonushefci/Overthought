import Purchases, { PRODUCT_CATEGORY } from 'react-native-purchases';
import { env } from '../../lib/env';
import { revenueCatClient } from './revenueCatClient';

function packageWithPrice(priceString: string | undefined) {
  return {
    identifier: '$rc_monthly',
    packageType: 'MONTHLY',
    product: {
      identifier: 'overthought_monthly',
      title: 'Overthought Monthly',
      priceString,
      subscriptionPeriod: 'P1M',
    },
    presentedOfferingContext: {
      offeringIdentifier: 'default',
    },
  };
}

function storeProductWithPrice(priceString: string | undefined) {
  return {
    identifier: 'overthought_monthly',
    title: 'Overthought Premium',
    priceString,
    price: 5.99,
    currencyCode: 'EUR',
    subscriptionPeriod: 'P1M',
  };
}

describe('revenueCatClient.handleAuthUserChanged', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not call logOut when RevenueCat already reports an anonymous user', async () => {
    jest.mocked(Purchases.getAppUserID).mockResolvedValue('$RCAnonymousID:test');
    jest.mocked(Purchases.isAnonymous).mockResolvedValue(true);

    await revenueCatClient.handleAuthUserChanged(null);

    expect(Purchases.logOut).not.toHaveBeenCalled();
  });

  it('does not throw when duplicate anonymous cleanup is triggered', async () => {
    jest.mocked(Purchases.getAppUserID).mockResolvedValue('$RCAnonymousID:test');
    jest.mocked(Purchases.isAnonymous).mockResolvedValue(true);

    await expect(revenueCatClient.handleAuthUserChanged(null)).resolves.toBeUndefined();
    await expect(revenueCatClient.handleAuthUserChanged(null)).resolves.toBeUndefined();
  });
});

describe('revenueCatClient.getProducts', () => {
  it('requests store products with the explicit subscription product category', async () => {
    const mutableEnv = env as unknown as {
      enablePremium: boolean;
      revenueCatIosApiKey: string;
    };
    const originalEnablePremium = mutableEnv.enablePremium;
    const originalIosApiKey = mutableEnv.revenueCatIosApiKey;

    mutableEnv.enablePremium = true;
    mutableEnv.revenueCatIosApiKey = 'test-ios-key';
    jest.mocked(Purchases.getProducts).mockResolvedValue([]);

    try {
      await revenueCatClient.getProducts('user-1', ['overthought_monthly']);
    } finally {
      mutableEnv.enablePremium = originalEnablePremium;
      mutableEnv.revenueCatIosApiKey = originalIosApiKey;
    }

    expect(Purchases.getProducts).toHaveBeenCalledWith(
      ['overthought_monthly'],
      PRODUCT_CATEGORY.SUBSCRIPTION,
    );
  });
});

describe('revenueCatClient.toPackageSummary', () => {
  it('uses direct store product priceString as the final display price', () => {
    const summary = revenueCatClient.toPackageSummary(
      packageWithPrice('$4.99') as never,
      storeProductWithPrice('5,99 €') as never,
      { storeProductLookupUsedSubscriptionCategory: true },
    );

    expect(summary.priceString).toBe('5,99 €');
    expect(summary.finalDisplayPrice).toBe('5,99 €');
    expect(summary.packageProductPriceString).toBe('$4.99');
    expect(summary.storeProductPriceString).toBe('5,99 €');
    expect(summary.storeProductFound).toBe(true);
    expect(summary.storeProductLookupUsedSubscriptionCategory).toBe(true);
    expect(summary.periodLabel).toBe('month');
  });

  it('falls back to package product priceString when store product is unavailable', () => {
    const summary = revenueCatClient.toPackageSummary(packageWithPrice('$4.99') as never);

    expect(summary.priceString).toBe('$4.99');
    expect(summary.finalDisplayPrice).toBe('$4.99');
    expect(summary.packageProductPriceString).toBe('$4.99');
    expect(summary.storeProductPriceString).toBeNull();
    expect(summary.storeProductFound).toBe(false);
  });

  it('returns Price unavailable when no product priceString exists', () => {
    const summary = revenueCatClient.toPackageSummary(packageWithPrice(undefined) as never);

    expect(summary.priceString).toBe('Price unavailable');
    expect(summary.finalDisplayPrice).toBe('Price unavailable');
    expect(summary.packageProductPriceString).toBeNull();
    expect(summary.storeProductPriceString).toBeNull();
    expect(summary.storeProductFound).toBe(false);
  });
});
