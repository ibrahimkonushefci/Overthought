import { useGuestStore } from '../../store/guestStore';
import { skipGuestMigrationPrompt } from './MigrationPrompt';
import type { GuestCaseLocal } from '../../types/shared';

jest.mock('./migrationService', () => ({
  migrationService: {
    migrateGuestCases: jest.fn(),
  },
}));

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

describe('MigrationPrompt skip behavior', () => {
  beforeEach(() => {
    useGuestStore.getState().clearAllLocalData();
  });

  afterEach(() => {
    useGuestStore.getState().clearAllLocalData();
  });

  it('marks the prompt skipped without deleting guest cases', () => {
    useGuestStore.getState().ensureGuestSession();
    useGuestStore.getState().addCase(buildGuestCase());

    skipGuestMigrationPrompt('user-1');

    expect(useGuestStore.getState().migrationPromptByUserId['user-1']).toBe('skipped');
    expect(useGuestStore.getState().cases).toHaveLength(1);
    expect(useGuestStore.getState().cases[0].localId).toBe('case-local-1');
    expect(useGuestStore.getState().localGuestId).not.toBeNull();
  });
});
