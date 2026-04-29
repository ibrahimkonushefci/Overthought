import type { GuestCaseLocal } from '../../../types/shared';
import { useAuthStore } from '../../../store/authStore';
import { useGuestStore } from '../../../store/guestStore';
import { supabase } from '../../../lib/supabase/client';
import { caseRepository } from './caseRepository';
import type { CaseRow } from './caseMappers';

jest.mock('../../../lib/supabase/client', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

jest.mock('../../analysis/analysisService', () => ({
  analysisService: {
    analyzeCase: jest.fn(),
  },
}));

const mockSupabase = supabase as unknown as {
  from: jest.Mock;
};

function caseRow(overrides: Partial<CaseRow> = {}): CaseRow {
  return {
    id: 'remote-case-1',
    user_id: 'user-1',
    title: 'Story reply',
    category: 'romance',
    input_text: 'They liked my story.',
    verdict_label: 'mild_delusion',
    delusion_score: 62,
    explanation_text: 'The facts are thin.',
    next_move_text: 'Wait for one more signal.',
    outcome_status: 'unknown',
    latest_verdict_version: 1,
    last_analyzed_at: '2026-04-22T10:00:00.000Z',
    created_at: '2026-04-22T10:00:00.000Z',
    updated_at: '2026-04-22T10:00:00.000Z',
    archived_at: null,
    deleted_at: null,
    ...overrides,
  };
}

function guestCase(localId = 'local-case-1'): GuestCaseLocal {
  return {
    localId,
    localOwnerId: 'guest-local-1',
    title: 'Local story',
    category: 'romance',
    inputText: 'Local input.',
    verdictLabel: 'slight_reach',
    delusionScore: 41,
    explanationText: 'Local explanation.',
    nextMoveText: 'Local move.',
    verdictVersion: 1,
    triggeredSignals: [],
    outcomeStatus: 'unknown',
    lastAnalyzedAt: '2026-04-21T10:00:00.000Z',
    createdAt: '2026-04-21T10:00:00.000Z',
    updatedAt: '2026-04-21T10:00:00.000Z',
    archivedAt: null,
    deletedAt: null,
    updates: [],
    syncStatus: 'local_only',
  };
}

function listBuilder(rows: CaseRow[]) {
  const builder = {
    select: jest.fn(),
    eq: jest.fn(),
    is: jest.fn(),
    order: jest.fn(),
  };

  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.is.mockReturnValue(builder);
  builder.order.mockResolvedValue({ data: rows, error: null });

  return builder;
}

function getBuilder(row: CaseRow | null) {
  const builder = {
    select: jest.fn(),
    eq: jest.fn(),
    is: jest.fn(),
    maybeSingle: jest.fn(),
  };

  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.is.mockReturnValue(builder);
  builder.maybeSingle.mockResolvedValue({ data: row, error: null });

  return builder;
}

function updateBuilder() {
  const builder = {
    update: jest.fn(),
    eq: jest.fn(),
    is: jest.fn(),
  };

  builder.update.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.is.mockResolvedValue({ error: null });

  return builder;
}

function bulkArchiveBuilder() {
  const builder = {
    update: jest.fn(),
    eq: jest.fn(),
    is: jest.fn(),
  };

  builder.update.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.is.mockReturnValueOnce(builder).mockResolvedValueOnce({ error: null });

  return builder;
}

describe('caseRepository authenticated sync behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useGuestStore.getState().clearAllLocalData();
    useAuthStore.getState().setAuthenticated({
      id: 'user-1',
      email: 'person@example.com',
      provider: 'email',
    });
  });

  afterEach(() => {
    useGuestStore.getState().clearAllLocalData();
    useAuthStore.getState().resetSession();
  });

  it('uses remote cases as the source of truth when authenticated', async () => {
    useGuestStore.getState().addCase(guestCase('remote-case-1'));
    const builder = listBuilder([caseRow({ id: 'remote-case-1', title: 'Remote story' })]);
    mockSupabase.from.mockReturnValue(builder);

    const cases = await caseRepository.listCases();

    expect(cases).toHaveLength(1);
    expect(cases[0].title).toBe('Remote story');
    expect(mockSupabase.from).toHaveBeenCalledWith('cases');
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(builder.is).toHaveBeenCalledWith('archived_at', null);
    expect(builder.is).toHaveBeenCalledWith('deleted_at', null);
  });

  it('resolves a migrated local case id to the remote case id in authenticated mode', async () => {
    useGuestStore.setState({
      migratedCaseMap: {
        'local-case-1': 'remote-case-1',
      },
    });
    const builder = getBuilder(caseRow({ id: 'remote-case-1' }));
    mockSupabase.from.mockReturnValue(builder);

    const record = await caseRepository.getCase('local-case-1');

    expect(record && 'id' in record ? record.id : null).toBe('remote-case-1');
    expect(builder.eq).toHaveBeenCalledWith('id', 'remote-case-1');
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-1');
  });

  it('does not mutate a local guest case with the same id while authenticated', async () => {
    useGuestStore.getState().addCase(guestCase('remote-case-1'));
    const builder = updateBuilder();
    mockSupabase.from.mockReturnValue(builder);

    await caseRepository.updateOutcome('remote-case-1', 'right');

    expect(useGuestStore.getState().cases[0].outcomeStatus).toBe('unknown');
    expect(builder.update).toHaveBeenCalledWith({ outcome_status: 'right' });
    expect(builder.eq).toHaveBeenCalledWith('id', 'remote-case-1');
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-1');
  });

  it('archives remote cases without touching guest cases in authenticated mode', async () => {
    useGuestStore.getState().addCase(guestCase('remote-case-1'));
    const builder = updateBuilder();
    mockSupabase.from.mockReturnValue(builder);

    await caseRepository.archiveCase('remote-case-1');

    expect(useGuestStore.getState().cases[0].archivedAt).toBeNull();
    expect(builder.update).toHaveBeenCalledWith({ archived_at: expect.any(String) });
    expect(builder.eq).toHaveBeenCalledWith('id', 'remote-case-1');
  });

  it('clears local guest cases without resetting the guest session', async () => {
    useAuthStore.getState().setGuest();
    const localGuestId = useGuestStore.getState().ensureGuestSession();
    useGuestStore.getState().addCase(guestCase('local-case-1'));
    useGuestStore.getState().addCase(guestCase('local-case-2'));
    useGuestStore.getState().setUpdateDraft('local-case-1', 'draft update');

    await caseRepository.archiveAllCases();

    expect(useGuestStore.getState().localGuestId).toBe(localGuestId);
    expect(useGuestStore.getState().cases).toHaveLength(0);
    expect(useGuestStore.getState().drafts.updateTextByCaseId).toEqual({});
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('bulk archives authenticated cases using the existing soft-delete model', async () => {
    const builder = bulkArchiveBuilder();
    mockSupabase.from.mockReturnValue(builder);

    await caseRepository.archiveAllCases();

    expect(mockSupabase.from).toHaveBeenCalledWith('cases');
    expect(builder.update).toHaveBeenCalledWith({ archived_at: expect.any(String) });
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(builder.is).toHaveBeenCalledWith('archived_at', null);
    expect(builder.is).toHaveBeenCalledWith('deleted_at', null);
  });
});
