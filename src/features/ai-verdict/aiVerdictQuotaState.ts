import type { AiVerdictAccessState } from '../../types/shared';
import { useAuthStore } from '../../store/authStore';
import { useGuestStore } from '../../store/guestStore';
import { useAiVerdictQuotaStore } from '../../store/aiVerdictQuotaStore';

export function quotaIdentityKey(): string | null {
  const auth = useAuthStore.getState();

  if (auth.sessionMode === 'authenticated' && auth.user) {
    return `user:${auth.user.id}`;
  }

  if (auth.sessionMode === 'guest') {
    return `guest:${useGuestStore.getState().ensureGuestAiKey()}`;
  }

  return null;
}

export function publishAuthoritativeQuota(access: AiVerdictAccessState) {
  const identityKey = quotaIdentityKey();
  if (identityKey) {
    useAiVerdictQuotaStore.getState().setAccess(identityKey, access);
  }
}
