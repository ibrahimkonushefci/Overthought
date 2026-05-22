import { useAiVerdictStore } from '../../store/aiVerdictStore';
import { findAiVerdictDeepReadAccountLock, isAiVerdictDeepReadAccountLocked } from './aiVerdictAccess';

describe('aiVerdictAccess', () => {
  beforeEach(() => {
    useAiVerdictStore.getState().clearAllAiVerdicts();
  });

  afterEach(() => {
    useAiVerdictStore.getState().clearAllAiVerdicts();
  });

  it('does not treat exhausted guest lifetime quota as an authenticated account lock', () => {
    const guestQuotaState = {
      status: 'quota_exceeded' as const,
      code: 'quota_exceeded' as const,
      message: 'Guest AI verdicts are used up.',
      access: {
        accessTier: 'guest' as const,
        allowed: false,
        used: 2,
        remaining: 0,
        limit: 2,
        quotaScope: 'lifetime' as const,
        quotaBucket: null,
        reason: 'guest_lifetime_limit' as const,
      },
      updatedAt: new Date().toISOString(),
    };

    useAiVerdictStore.getState().setRequestState('migrated-case', guestQuotaState);

    expect(isAiVerdictDeepReadAccountLocked(guestQuotaState)).toBe(false);
    expect(findAiVerdictDeepReadAccountLock()).toBeUndefined();
  });

  it('still treats current signed-in free daily exhaustion as an account lock', () => {
    const freeQuotaState = {
      status: 'quota_exceeded' as const,
      code: 'quota_exceeded' as const,
      message: 'Free AI verdicts are used up.',
      access: {
        accessTier: 'free' as const,
        allowed: false,
        used: 2,
        remaining: 0,
        limit: 2,
        quotaScope: 'daily' as const,
        quotaBucket: new Date().toISOString().slice(0, 10),
        reason: 'daily_limit' as const,
      },
      updatedAt: new Date().toISOString(),
    };

    useAiVerdictStore.getState().setRequestState('free-case', freeQuotaState);

    expect(isAiVerdictDeepReadAccountLocked(freeQuotaState)).toBe(true);
    expect(findAiVerdictDeepReadAccountLock()).toEqual(freeQuotaState);
  });
});
