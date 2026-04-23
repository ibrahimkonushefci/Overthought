import type { GuestCaseLocal } from '../../types/shared';
import { useAuthStore } from '../../store/authStore';
import { useGuestStore } from '../../store/guestStore';

const mockSupabase = {
  from: jest.fn(),
};

jest.mock('../../lib/supabase/client', () => ({
  supabase: mockSupabase,
}));

import { migrationService } from './migrationService';

function buildGuestCase(localId = 'case-local-1'): GuestCaseLocal {
  return {
    localId,
    localOwnerId: 'guest-local-1',
    title: 'Story reply',
    category: 'romance',
    inputText: 'She liked my story but replied after 9 hours.',
    verdictLabel: 'mild_delusion',
    delusionScore: 68,
    explanationText: 'The facts are thin.',
    nextMoveText: 'Wait for one more signal.',
    verdictVersion: 1,
    triggeredSignals: ['delayed_reply'],
    outcomeStatus: 'unknown',
    lastAnalyzedAt: '2026-04-22T10:00:00.000Z',
    createdAt: '2026-04-22T10:00:00.000Z',
    updatedAt: '2026-04-22T10:00:00.000Z',
    archivedAt: null,
    deletedAt: null,
    updates: [],
    syncStatus: 'local_only',
  };
}

function caseLookupBuilder(remoteCaseId: string | null) {
  const builder: {
    select: jest.Mock;
    eq: jest.Mock;
    maybeSingle: jest.Mock;
    insert: jest.Mock;
    single: jest.Mock;
  } = {
    select: jest.fn(),
    eq: jest.fn(),
    maybeSingle: jest.fn(),
    insert: jest.fn(),
    single: jest.fn(),
  };

  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.maybeSingle.mockResolvedValue({
      data: remoteCaseId ? { id: remoteCaseId } : null,
      error: null,
  });
  builder.insert.mockReturnValue(builder);
  builder.single.mockResolvedValue({ data: { id: 'inserted-case-1' }, error: null });

  return builder;
}

describe('migrationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useGuestStore.getState().clearAllLocalData();
    useGuestStore.setState({ localGuestId: 'guest-local-1' });
    useAuthStore.getState().setAuthenticated({
      id: 'user-1',
      email: 'person@example.com',
      provider: 'email',
    });
  });

  afterEach(() => {
    useGuestStore.getState().clearAllLocalData();
    useAuthStore.getState().setGuest();
  });

  it('skips a local case that already has a migrated remote id', async () => {
    const guestCase = buildGuestCase();
    useGuestStore.getState().addCase(guestCase);
    useGuestStore.getState().markCaseMigrated(guestCase.localId, 'remote-case-1');

    const result = await migrationService.migrateGuestCases();

    expect(result).toEqual({ migrated: 0, skipped: 1, failed: 0 });
    expect(mockSupabase.from).not.toHaveBeenCalled();
    expect(useGuestStore.getState().cases).toHaveLength(0);
  });

  it('uses an existing remote case by guest_local_id instead of inserting a duplicate', async () => {
    const guestCase = buildGuestCase();
    useGuestStore.getState().addCase(guestCase);

    const builder = caseLookupBuilder('remote-case-1');
    mockSupabase.from.mockReturnValue(builder);

    const result = await migrationService.migrateGuestCases();

    expect(result).toEqual({ migrated: 1, skipped: 0, failed: 0 });
    expect(mockSupabase.from).toHaveBeenCalledWith('cases');
    expect(builder.insert).not.toHaveBeenCalled();
    expect(useGuestStore.getState().cases).toHaveLength(0);
  });
});
