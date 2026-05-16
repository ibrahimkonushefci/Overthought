import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { AiVerdictRequestState, CaseAiVerdictSnapshot } from '../types/shared';
import { zustandMmkvStorage } from '../storage/mmkv';

function persistableRequestStates(
  requestByCaseId: Record<string, AiVerdictRequestState>,
): Record<string, AiVerdictRequestState> {
  return Object.fromEntries(
    Object.entries(requestByCaseId).filter(([, requestState]) => requestState.status !== 'loading'),
  );
}

interface AiVerdictState {
  byCaseId: Record<string, CaseAiVerdictSnapshot>;
  requestByCaseId: Record<string, AiVerdictRequestState>;
  setAiVerdict: (caseId: string, aiVerdict: CaseAiVerdictSnapshot) => void;
  setRequestState: (caseId: string, requestState: AiVerdictRequestState) => void;
  clearAiVerdict: (caseId: string) => void;
  clearAllAiVerdicts: () => void;
}

export const useAiVerdictStore = create<AiVerdictState>()(
  persist(
    (set) => ({
      byCaseId: {},
      requestByCaseId: {},
      setAiVerdict: (caseId, aiVerdict) => {
        set((state) => ({
          byCaseId: {
            ...state.byCaseId,
            [caseId]: aiVerdict,
          },
        }));
      },
      setRequestState: (caseId, requestState) => {
        set((state) => ({
          requestByCaseId: {
            ...state.requestByCaseId,
            [caseId]: requestState,
          },
        }));
      },
      clearAiVerdict: (caseId) => {
        set((state) => {
          const nextVerdicts = { ...state.byCaseId };
          const nextRequests = { ...state.requestByCaseId };
          delete nextVerdicts[caseId];
          delete nextRequests[caseId];
          return { byCaseId: nextVerdicts, requestByCaseId: nextRequests };
        });
      },
      clearAllAiVerdicts: () => set({ byCaseId: {}, requestByCaseId: {} }),
    }),
    {
      name: 'overthought-ai-verdict-store',
      storage: createJSONStorage(() => zustandMmkvStorage),
      partialize: (state) => ({
        byCaseId: state.byCaseId,
        requestByCaseId: persistableRequestStates(state.requestByCaseId),
      }),
    },
  ),
);
