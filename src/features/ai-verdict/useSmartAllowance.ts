import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { useGuestStore } from '../../store/guestStore';
import { usePremiumStore } from '../../store/premiumStore';
import { useAiVerdictQuotaStore } from '../../store/aiVerdictQuotaStore';
import { aiVerdictService } from './aiVerdictService';
import { quotaIdentityKey } from './aiVerdictQuotaState';

const MAX_TIMER_MS = 2_147_000_000;

export function useSmartAllowance() {
  const sessionMode = useAuthStore((state) => state.sessionMode);
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const guestAiKey = useGuestStore((state) => state.guestAiKey);
  const premiumUpdatedAt = usePremiumStore((state) => state.premiumState?.updatedAt ?? null);
  const identityKey =
    sessionMode === 'authenticated' && userId
      ? `user:${userId}`
      : sessionMode === 'guest'
        ? `guest:${guestAiKey ?? 'pending'}`
        : null;
  const status = useAiVerdictQuotaStore((state) => state.status);
  const access = useAiVerdictQuotaStore((state) => state.access);
  const storeIdentityKey = useAiVerdictQuotaStore((state) => state.identityKey);
  const refreshInFlight = useRef<Promise<void> | null>(null);

  const refresh = useCallback(async () => {
    const currentIdentityKey = quotaIdentityKey();

    if (!currentIdentityKey) {
      useAiVerdictQuotaStore.getState().clear();
      return;
    }

    if (refreshInFlight.current) {
      return refreshInFlight.current;
    }

    useAiVerdictQuotaStore.getState().beginLoading(currentIdentityKey);
    refreshInFlight.current = aiVerdictService
      .getQuotaStatus()
      .then((response) => {
        const latestIdentityKey = quotaIdentityKey();
        if (latestIdentityKey !== currentIdentityKey) {
          return;
        }

        if (response.ok) {
          useAiVerdictQuotaStore.getState().setAccess(currentIdentityKey, response.access);
        } else {
          useAiVerdictQuotaStore.getState().setUnknown(currentIdentityKey);
        }
      })
      .finally(() => {
        refreshInFlight.current = null;
      });

    return refreshInFlight.current;
  }, []);

  useEffect(() => {
    if (identityKey !== storeIdentityKey) {
      useAiVerdictQuotaStore.getState().clear();
    }
    void refresh();
  }, [identityKey, premiumUpdatedAt, refresh, storeIdentityKey]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void refresh();
      }
    });
    return () => subscription.remove();
  }, [refresh]);

  useEffect(() => {
    if (!access?.resetAt) {
      return;
    }

    const resetAt = Date.parse(access.resetAt);
    if (!Number.isFinite(resetAt)) {
      return;
    }

    const delay = Math.min(Math.max(resetAt - Date.now() + 1_000, 1_000), MAX_TIMER_MS);
    const timer = setTimeout(() => void refresh(), delay);
    return () => clearTimeout(timer);
  }, [access?.resetAt, refresh]);

  return {
    access: identityKey === storeIdentityKey && status !== 'unknown' ? access : null,
    status: identityKey === storeIdentityKey ? status : 'idle',
    refresh,
  };
}
