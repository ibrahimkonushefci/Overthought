import type { AnalysisOutput, GuestCaseLocal } from '../../../types/shared';
import { useAuthStore } from '../../../store/authStore';
import { useGuestStore } from '../../../store/guestStore';
import { supabase } from '../../../lib/supabase/client';
import { analysisService } from '../../analysis/analysisService';
import { caseUpdateRepository } from './caseUpdateRepository';
import type { CaseRow, CaseUpdateRow } from './caseMappers';

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

const mockAnalysisService = analysisService as unknown as {
  analyzeCase: jest.Mock;
};

function analysisOutput(overrides: Partial<AnalysisOutput> = {}): AnalysisOutput {
  return {
    verdictLabel: 'dangerous_overthinking',
    delusionScore: 79,
    explanationText: 'The new context raises the score.',
    nextMoveText: 'Ask directly instead of decoding hints.',
    verdictVersion: 1,
    triggeredSignals: ['new_context'],
    ...overrides,
  };
}

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

function updateRow(overrides: Partial<CaseUpdateRow> = {}): CaseUpdateRow {
  return {
    id: 'remote-update-1',
    case_id: 'remote-case-1',
    update_text: 'Now they asked to hang out.',
    verdict_label: 'dangerous_overthinking',
    delusion_score: 79,
    explanation_text: 'The new context raises the score.',
    next_move_text: 'Ask directly instead of decoding hints.',
    verdict_version: 1,
    created_at: '2026-04-23T10:00:00.000Z',
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

function getCaseBuilder(row: CaseRow | null) {
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

function listUpdatesBuilder(rows: CaseUpdateRow[]) {
  const builder = {
    select: jest.fn(),
    eq: jest.fn(),
    order: jest.fn(),
  };

  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.order.mockResolvedValue({ data: rows, error: null });

  return builder;
}

function insertUpdateBuilder(row: CaseUpdateRow) {
  const builder = {
    insert: jest.fn(),
    select: jest.fn(),
    single: jest.fn(),
  };

  builder.insert.mockReturnValue(builder);
  builder.select.mockReturnValue(builder);
  builder.single.mockResolvedValue({ data: row, error: null });

  return builder;
}

function parentUpdateBuilder(error: Error | null = null) {
  const builder = {
    update: jest.fn(),
    eq: jest.fn(),
    is: jest.fn(),
  };

  builder.update.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.is.mockResolvedValue({ error });

  return builder;
}

function rollbackBuilder(error: Error | null = null) {
  const builder = {
    delete: jest.fn(),
    eq: jest.fn(),
  };

  builder.delete.mockReturnValue(builder);
  builder.eq.mockReturnValueOnce(builder).mockResolvedValueOnce({ error });

  return builder;
}

describe('caseUpdateRepository authenticated sync behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useGuestStore.getState().clearAllLocalData();
    useAuthStore.getState().setAuthenticated({
      id: 'user-1',
      email: 'person@example.com',
      provider: 'email',
    });
    mockAnalysisService.analyzeCase.mockResolvedValue(analysisOutput());
  });

  afterEach(() => {
    useGuestStore.getState().clearAllLocalData();
    useAuthStore.getState().resetSession();
  });

  it('lists updates by the remote id when given a migrated local case id', async () => {
    useGuestStore.setState({
      migratedCaseMap: {
        'local-case-1': 'remote-case-1',
      },
    });
    const getCase = getCaseBuilder(caseRow({ id: 'remote-case-1' }));
    const listUpdates = listUpdatesBuilder([updateRow()]);
    mockSupabase.from.mockReturnValueOnce(getCase).mockReturnValueOnce(listUpdates);

    const updates = await caseUpdateRepository.listUpdates('local-case-1');

    expect(updates).toHaveLength(1);
    expect(getCase.eq).toHaveBeenCalledWith('id', 'remote-case-1');
    expect(listUpdates.eq).toHaveBeenCalledWith('case_id', 'remote-case-1');
  });

  it('adds an authenticated update only after the parent case refresh succeeds', async () => {
    const getCase = getCaseBuilder(caseRow());
    const listUpdates = listUpdatesBuilder([]);
    const insertUpdate = insertUpdateBuilder(updateRow());
    const updateParent = parentUpdateBuilder();
    mockSupabase.from
      .mockReturnValueOnce(getCase)
      .mockReturnValueOnce(listUpdates)
      .mockReturnValueOnce(insertUpdate)
      .mockReturnValueOnce(updateParent);

    const result = await caseUpdateRepository.addUpdate('remote-case-1', 'Now they asked to hang out.');

    expect('id' in result ? result.id : null).toBe('remote-update-1');
    expect(insertUpdate.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        case_id: 'remote-case-1',
        update_text: 'Now they asked to hang out.',
        verdict_label: 'dangerous_overthinking',
      }),
    );
    expect(updateParent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        verdict_label: 'dangerous_overthinking',
        delusion_score: 79,
        explanation_text: 'The new context raises the score.',
        next_move_text: 'Ask directly instead of decoding hints.',
        latest_verdict_version: 1,
      }),
    );
  });

  it('rolls back the inserted update and throws when the parent case update fails', async () => {
    const getCase = getCaseBuilder(caseRow());
    const listUpdates = listUpdatesBuilder([]);
    const insertUpdate = insertUpdateBuilder(updateRow());
    const updateParent = parentUpdateBuilder(new Error('parent update failed'));
    const rollback = rollbackBuilder();
    mockSupabase.from
      .mockReturnValueOnce(getCase)
      .mockReturnValueOnce(listUpdates)
      .mockReturnValueOnce(insertUpdate)
      .mockReturnValueOnce(updateParent)
      .mockReturnValueOnce(rollback);

    await expect(caseUpdateRepository.addUpdate('remote-case-1', 'Now they asked to hang out.')).rejects.toThrow(
      'parent update failed',
    );

    expect(rollback.delete).toHaveBeenCalled();
    expect(rollback.eq).toHaveBeenCalledWith('id', 'remote-update-1');
    expect(rollback.eq).toHaveBeenCalledWith('case_id', 'remote-case-1');
  });

  it('does not mutate a same-id guest case while adding an authenticated update', async () => {
    useGuestStore.getState().addCase(guestCase('remote-case-1'));
    const getCase = getCaseBuilder(caseRow());
    const listUpdates = listUpdatesBuilder([]);
    const insertUpdate = insertUpdateBuilder(updateRow());
    const updateParent = parentUpdateBuilder();
    mockSupabase.from
      .mockReturnValueOnce(getCase)
      .mockReturnValueOnce(listUpdates)
      .mockReturnValueOnce(insertUpdate)
      .mockReturnValueOnce(updateParent);

    await caseUpdateRepository.addUpdate('remote-case-1', 'Now they asked to hang out.');

    expect(useGuestStore.getState().cases[0].updates).toHaveLength(0);
  });
});
