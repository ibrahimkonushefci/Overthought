import { create } from 'zustand';
import type { PremiumState } from '../types/shared';

interface PremiumStoreState {
  premiumState: PremiumState | null;
  loading: boolean;
  setPremiumState: (premiumState: PremiumState | null) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

export const usePremiumStore = create<PremiumStoreState>()((set) => ({
  premiumState: null,
  loading: false,
  setPremiumState: (premiumState) => set({ premiumState }),
  setLoading: (loading) => set({ loading }),
  reset: () => set({ premiumState: null, loading: false }),
}));

export function isPremiumStateActive(premiumState: PremiumState | null): boolean {
  return premiumState?.entitlementStatus === 'premium' || premiumState?.entitlementStatus === 'grace_period';
}
