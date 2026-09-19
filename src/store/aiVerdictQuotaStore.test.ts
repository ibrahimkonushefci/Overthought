import { useAiVerdictQuotaStore } from './aiVerdictQuotaStore';

const access = {
  accessTier: 'free' as const,
  allowed: false,
  used: 2,
  remaining: 0,
  limit: 2,
  quotaScope: 'daily' as const,
  quotaBucket: '2026-09-19',
  resetAt: '2026-09-20T00:00:00.000Z',
};

describe('aiVerdictQuotaStore', () => {
  beforeEach(() => useAiVerdictQuotaStore.getState().clear());

  it('keeps authoritative access for the same identity', () => {
    useAiVerdictQuotaStore.getState().setAccess('user:one', access);
    expect(useAiVerdictQuotaStore.getState()).toMatchObject({ identityKey: 'user:one', status: 'ready', access });
  });

  it('drops access when identity changes', () => {
    useAiVerdictQuotaStore.getState().setAccess('user:one', access);
    useAiVerdictQuotaStore.getState().beginLoading('user:two');
    expect(useAiVerdictQuotaStore.getState()).toMatchObject({ identityKey: 'user:two', status: 'loading', access: null });
  });
});
