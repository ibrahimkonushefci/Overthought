import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { zustandMmkvStorage } from '../storage/mmkv';

interface UiPreferencesState {
  hasSeenFirstUseHelp: boolean;
  markFirstUseHelpSeen: () => void;
  resetFirstUseHelp: () => void;
}

export const useUiPreferencesStore = create<UiPreferencesState>()(
  persist(
    (set) => ({
      hasSeenFirstUseHelp: false,
      markFirstUseHelpSeen: () => set({ hasSeenFirstUseHelp: true }),
      resetFirstUseHelp: () => set({ hasSeenFirstUseHelp: false }),
    }),
    {
      name: 'overthought-ui-preferences-store',
      storage: createJSONStorage(() => zustandMmkvStorage),
      partialize: (state) => ({
        hasSeenFirstUseHelp: state.hasSeenFirstUseHelp,
      }),
    },
  ),
);
