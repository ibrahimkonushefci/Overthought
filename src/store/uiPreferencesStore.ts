import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { zustandMmkvStorage } from '../storage/mmkv';

interface UiPreferencesState {
  hasSeenFirstUseHelp: boolean;
  completedSmartVerdicts: number;
  hasAttemptedReviewPrompt: boolean;
  markFirstUseHelpSeen: () => void;
  recordCompletedSmartVerdict: () => void;
  markReviewPromptAttempted: () => void;
  resetFirstUseHelp: () => void;
}

export const useUiPreferencesStore = create<UiPreferencesState>()(
  persist(
    (set) => ({
      hasSeenFirstUseHelp: false,
      completedSmartVerdicts: 0,
      hasAttemptedReviewPrompt: false,
      markFirstUseHelpSeen: () => set({ hasSeenFirstUseHelp: true }),
      recordCompletedSmartVerdict: () =>
        set((state) => ({ completedSmartVerdicts: state.completedSmartVerdicts + 1 })),
      markReviewPromptAttempted: () => set({ hasAttemptedReviewPrompt: true }),
      resetFirstUseHelp: () => set({ hasSeenFirstUseHelp: false }),
    }),
    {
      name: 'overthought-ui-preferences-store',
      storage: createJSONStorage(() => zustandMmkvStorage),
      partialize: (state) => ({
        hasSeenFirstUseHelp: state.hasSeenFirstUseHelp,
        completedSmartVerdicts: state.completedSmartVerdicts,
        hasAttemptedReviewPrompt: state.hasAttemptedReviewPrompt,
      }),
    },
  ),
);
