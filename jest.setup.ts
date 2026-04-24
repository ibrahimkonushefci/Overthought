let uuidCounter = 0;

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

jest.mock('react-native', () => ({
  Alert: {
    alert: jest.fn(),
  },
  Linking: {
    addEventListener: jest.fn(),
    getInitialURL: jest.fn(async () => null),
  },
  Platform: {
    OS: 'ios',
    select: (options: Record<string, unknown>) => options.ios ?? options.default ?? options.android,
  },
}));

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: {
    SHA256: 'SHA-256',
  },
  digestStringAsync: jest.fn(async (_algorithm: string, value: string) => `hashed-${value}`),
  randomUUID: jest.fn(() => {
    uuidCounter += 1;
    return `test-uuid-${uuidCounter}`;
  }),
}));

jest.mock('react-native-mmkv', () => ({
  createMMKV: () => {
    const store = new Map<string, string>();

    return {
      getString: (key: string) => store.get(key),
      set: (key: string, value: string) => {
        store.set(key, value);
      },
      remove: (key: string) => {
        store.delete(key);
      },
    };
  },
}));

jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: jest.fn(async () => ({ type: 'dismiss' })),
}));

jest.mock('react-native-purchases', () => {
  const defaultCustomerInfo = {
    entitlements: {
      all: {},
      active: {},
      verification: 'NOT_REQUESTED',
    },
    activeSubscriptions: [],
    allPurchasedProductIdentifiers: [],
    latestExpirationDate: null,
    firstSeen: '2026-01-01T00:00:00.000Z',
    originalAppUserId: 'guest',
    requestDate: '2026-01-01T00:00:00.000Z',
    allExpirationDates: {},
    allPurchaseDates: {},
    originalApplicationVersion: null,
    originalPurchaseDate: null,
    managementURL: null,
    nonSubscriptionTransactions: [],
    subscriptionsByProductIdentifier: {},
  };

  return {
    __esModule: true,
    default: {
      configure: jest.fn(),
      setLogLevel: jest.fn(async () => undefined),
      getOfferings: jest.fn(async () => ({
        current: null,
        all: {},
      })),
      getAppUserID: jest.fn(async () => '$RCAnonymousID:test'),
      getCustomerInfo: jest.fn(async () => defaultCustomerInfo),
      isAnonymous: jest.fn(async () => true),
      restorePurchases: jest.fn(async () => defaultCustomerInfo),
      purchasePackage: jest.fn(async () => ({ customerInfo: defaultCustomerInfo, productIdentifier: 'overthought_monthly' })),
      logIn: jest.fn(async () => ({ customerInfo: defaultCustomerInfo, created: false })),
      logOut: jest.fn(async () => defaultCustomerInfo),
    },
    PURCHASES_ERROR_CODE: {
      INVALID_CREDENTIALS_ERROR: 'INVALID_CREDENTIALS_ERROR',
    },
    LOG_LEVEL: {
      DEBUG: 'DEBUG',
      INFO: 'INFO',
    },
  };
});
