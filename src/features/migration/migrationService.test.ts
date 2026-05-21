import type { GuestCaseLocal } from '../../types/shared';
import { useAiVerdictStore } from '../../store/aiVerdictStore';
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
    useAiVerdictStore.getState().clearAllAiVerdicts();
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
    useAiVerdictStore.getState().clearAllAiVerdicts();
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

  it('preserves a migrated guest AI verdict snapshot under the remote case id', async () => {
    const guestCase = buildGuestCase();
    useGuestStore.getState().addCase({
      ...guestCase,
      aiVerdict: {
        verdict: {
          verdictLabel: 'dangerous_overthinking',
          delusionScore: 84,
          displayLabel: 'Breadcrumb Circus',
          explanationText: 'AI read.',
          evidenceCheckText: 'AI evidence.',
          overreadingText: 'AI overreading.',
          whatMattersText: 'AI matters.',
          nextMoveText: 'AI move.',
          verdictVersion: 1,
          source: 'ai',
        },
        localFallback: {
          verdictLabel: guestCase.verdictLabel,
          delusionScore: guestCase.delusionScore,
          explanationText: guestCase.explanationText,
          nextMoveText: guestCase.nextMoveText,
          verdictVersion: guestCase.verdictVersion,
        },
        cache: {
          id: 'guest-ai-1',
          source: 'generated',
          targetFingerprint: 'fingerprint-1',
          modelProvider: 'gemini',
          modelName: 'gemini-2.5-flash',
          modelVersion: null,
          promptVersion: 3,
          responseSchemaVersion: 2,
          createdAt: '2026-04-22T10:00:02.000Z',
        },
        access: {
          accessTier: 'guest',
          allowed: true,
          used: 1,
          remaining: 1,
          limit: 2,
          quotaScope: 'lifetime',
          quotaBucket: null,
        },
        updatedAt: '2026-04-22T10:00:03.000Z',
      },
    });

    const builder = caseLookupBuilder('remote-case-1');
    mockSupabase.from.mockReturnValue(builder);

    const result = await migrationService.migrateGuestCases();

    expect(result).toEqual({ migrated: 1, skipped: 0, failed: 0 });
    expect(useAiVerdictStore.getState().byCaseId['remote-case-1'].verdict.explanationText).toBe('AI read.');
    expect(useAiVerdictStore.getState().requestByCaseId['remote-case-1']).toMatchObject({
      status: 'cache',
      message: 'Moved from your guest case.',
    });
  });
});
