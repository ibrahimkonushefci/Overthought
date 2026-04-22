import { createMMKV } from 'react-native-mmkv';
import type { StateStorage } from 'zustand/middleware';

export const appStorage = createMMKV({
  id: 'overthought-v1',
});

export const zustandMmkvStorage: StateStorage = {
  getItem: (name) => appStorage.getString(name) ?? null,
  setItem: (name, value) => {
    appStorage.set(name, value);
  },
  removeItem: (name) => {
    appStorage.remove(name);
  },
};
