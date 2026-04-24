import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL, PURCHASES_ERROR_CODE } from 'react-native-purchases';
import type { CustomerInfo, PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import { env } from '../../lib/env';

let configured = false;
let configuredApiKey: string | null = null;
let authTransitionChain: Promise<void> = Promise.resolve();

function getRevenueCatApiKey(): string | null {
  if (Platform.OS === 'ios') {
    return env.revenueCatIosApiKey || null;
  }

  if (Platform.OS === 'android') {
    return env.revenueCatAndroidApiKey || null;
  }

  return null;
}

async function ensureConfigured(appUserID: string | null): Promise<boolean> {
  const apiKey = getRevenueCatApiKey();

  if (!apiKey) {
    return false;
  }

  if (!configured) {
    await Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.INFO);
    Purchases.configure({
      apiKey,
      appUserID: appUserID ?? undefined,
    });
    configured = true;
    configuredApiKey = apiKey;
    return true;
  }

  if (configuredApiKey !== apiKey) {
    return false;
  }

  const currentAppUserId = await Purchases.getAppUserID();
  const currentlyAnonymous = await Purchases.isAnonymous();

  if (appUserID) {
    if (currentAppUserId === appUserID && !currentlyAnonymous) {
      return true;
    }

    await Purchases.logIn(appUserID);
    return true;
  }

  if (currentlyAnonymous) {
    return true;
  }

  try {
    await Purchases.logOut();
  } catch (error) {
    if (!isAlreadyAnonymousError(error)) {
      throw error;
    }
  }

  return true;
}

function isAlreadyAnonymousError(error: unknown): boolean {
  const code =
    typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code) : '';
  const message = error instanceof Error ? error.message.toLowerCase() : '';

  return (
    code === PURCHASES_ERROR_CODE.INVALID_CREDENTIALS_ERROR ||
    message.includes('current user is anonymous') ||
    message.includes('user is anonymous')
  );
}

function periodLabelFromPackage(aPackage: PurchasesPackage): string | null {
  switch (aPackage.packageType) {
    case 'MONTHLY':
      return 'month';
    case 'ANNUAL':
      return 'year';
    case 'SIX_MONTH':
      return '6 months';
    case 'THREE_MONTH':
      return '3 months';
    case 'TWO_MONTH':
      return '2 months';
    case 'WEEKLY':
      return 'week';
    case 'LIFETIME':
      return 'lifetime';
    default:
      return null;
  }
}

export const revenueCatClient = {
  isConfigured(): boolean {
    return Boolean(getRevenueCatApiKey());
  },
  async handleAuthUserChanged(appUserID: string | null): Promise<void> {
    authTransitionChain = authTransitionChain.then(async () => {
      try {
        await ensureConfigured(appUserID);
      } catch (error) {
        if (appUserID === null && isAlreadyAnonymousError(error)) {
          return;
        }

        // Keep premium behavior non-blocking when RevenueCat setup is missing or unavailable.
      }
    });

    await authTransitionChain;
  },
  async getOfferings(appUserID: string): Promise<{
    current: PurchasesOffering | null;
    fallback: PurchasesOffering | null;
  } | null> {
    if (!(await ensureConfigured(appUserID))) {
      return null;
    }

    const offerings = await Purchases.getOfferings();
    const current = offerings.current ?? null;
    const fallback = offerings.all.default ?? null;

    return {
      current,
      fallback,
    };
  },
  async getCustomerInfo(appUserID: string): Promise<CustomerInfo | null> {
    if (!(await ensureConfigured(appUserID))) {
      return null;
    }

    return Purchases.getCustomerInfo();
  },
  async restorePurchases(appUserID: string): Promise<CustomerInfo> {
    if (!(await ensureConfigured(appUserID))) {
      throw new Error('RevenueCat is not configured for this build.');
    }

    return Purchases.restorePurchases();
  },
  async purchasePackage(appUserID: string, aPackage: PurchasesPackage) {
    if (!(await ensureConfigured(appUserID))) {
      throw new Error('RevenueCat is not configured for this build.');
    }

    return Purchases.purchasePackage(aPackage);
  },
  async isAnonymous(): Promise<boolean> {
    if (!(await ensureConfigured(null))) {
      return true;
    }

    return Purchases.isAnonymous();
  },
  toPackageSummary(aPackage: PurchasesPackage) {
    return {
      identifier: aPackage.identifier,
      offeringIdentifier: aPackage.presentedOfferingContext.offeringIdentifier ?? null,
      packageType: aPackage.packageType,
      productIdentifier: aPackage.product.identifier,
      title: aPackage.product.title,
      priceString: aPackage.product.priceString,
      periodLabel: periodLabelFromPackage(aPackage),
    };
  },
};
