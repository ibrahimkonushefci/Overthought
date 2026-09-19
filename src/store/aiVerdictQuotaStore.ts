import { create } from 'zustand';
import type { AiVerdictAccessState } from '../types/shared';

export type AiVerdictQuotaLoadState = 'idle' | 'loading' | 'ready' | 'unknown';

interface AiVerdictQuotaState {
  identityKey: string | null;
  status: AiVerdictQuotaLoadState;
  access: AiVerdictAccessState | null;
  fetchedAt: string | null;
  beginLoading: (identityKey: string) => void;
  setAccess: (identityKey: string, access: AiVerdictAccessState) => void;
  setUnknown: (identityKey: string) => void;
  clear: () => void;
}

export const useAiVerdictQuotaStore = create<AiVerdictQuotaState>()((set) => ({
  identityKey: null,
  status: 'idle',
  access: null,
  fetchedAt: null,
  beginLoading: (identityKey) =>
    set((state) =>
      state.identityKey === identityKey
        ? { status: 'loading' }
        : { identityKey, status: 'loading', access: null, fetchedAt: null },
    ),
  setAccess: (identityKey, access) =>
    set({
      identityKey,
      status: 'ready',
      access,
      fetchedAt: new Date().toISOString(),
    }),
  setUnknown: (identityKey) =>
    set((state) => ({
      identityKey,
      status: 'unknown',
      access: state.identityKey === identityKey ? state.access : null,
      fetchedAt: state.identityKey === identityKey ? state.fetchedAt : null,
    })),
  clear: () => set({ identityKey: null, status: 'idle', access: null, fetchedAt: null }),
}));
