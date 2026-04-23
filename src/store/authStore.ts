import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { AuthProvider, Profile } from '../types/shared';
import { zustandMmkvStorage } from '../storage/mmkv';

export type SessionMode = 'loading' | 'guest' | 'authenticated';

interface AuthUser {
  id: string;
  email: string | null;
  provider: AuthProvider;
}

interface AuthState {
  sessionMode: SessionMode;
  user: AuthUser | null;
  profile: Profile | null;
  hasCompletedEntry: boolean;
  setLoading: () => void;
  setGuest: () => void;
  markEntryComplete: () => void;
  setAuthenticated: (user: AuthUser, profile?: Profile | null) => void;
  setProfile: (profile: Profile | null) => void;
  signOutLocal: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      sessionMode: 'loading',
      user: null,
      profile: null,
      hasCompletedEntry: false,
      setLoading: () => set({ sessionMode: 'loading' }),
      setGuest: () => set({ sessionMode: 'guest', user: null, profile: null }),
      markEntryComplete: () => set({ hasCompletedEntry: true }),
      setAuthenticated: (user, profile = null) =>
        set({ sessionMode: 'authenticated', user, profile, hasCompletedEntry: true }),
      setProfile: (profile) => set({ profile }),
      signOutLocal: () => set({ sessionMode: 'guest', user: null, profile: null }),
    }),
    {
      name: 'overthought-auth-store',
      storage: createJSONStorage(() => zustandMmkvStorage),
      partialize: (state) => ({
        sessionMode: state.sessionMode === 'authenticated' ? 'loading' : state.sessionMode,
        user: null,
        profile: null,
        hasCompletedEntry: state.hasCompletedEntry,
      }),
    },
  ),
);
