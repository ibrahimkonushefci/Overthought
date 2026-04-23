let uuidCounter = 0;

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
