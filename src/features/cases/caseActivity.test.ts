import type { GuestCaseLocal } from '../../types/shared';
import { compareCasesByActivity, getCaseActivity } from './caseActivity';

function guestCase(overrides: Partial<GuestCaseLocal> = {}): GuestCaseLocal {
  return {
    localId: 'case-1',
    localOwnerId: 'guest-1',
    title: null,
    category: 'general',
    inputText: 'A sufficiently detailed social situation for testing.',
    verdictLabel: 'mild_delusion',
    delusionScore: 50,
    explanationText: 'Explanation',
    nextMoveText: 'Next move',
    verdictVersion: 1,
    outcomeStatus: 'unknown',
    lastAnalyzedAt: '2026-09-19T17:00:00.000Z',
    createdAt: '2026-09-19T17:00:00.000Z',
    updatedAt: '2026-09-19T17:00:00.000Z',
    archivedAt: null,
    deletedAt: null,
    resultSource: 'smart',
    updates: [],
    syncStatus: 'local_only',
    ...overrides,
  };
}

describe('case activity', () => {
  it('labels an untouched case as created', () => {
    expect(getCaseActivity(guestCase())).toEqual({
      timestamp: '2026-09-19T17:00:00.000Z',
      kind: 'created',
    });
  });

  it('uses a guest follow-up as latest activity', () => {
    const record = guestCase({
      updates: [
        {
          localId: 'update-1',
          localCaseId: 'case-1',
          updateText: 'Something changed.',
          verdictLabel: null,
          delusionScore: null,
          explanationText: null,
          nextMoveText: null,
          verdictVersion: null,
          createdAt: '2026-09-19T17:20:00.000Z',
        },
      ],
    });

    expect(getCaseActivity(record)).toEqual({
      timestamp: '2026-09-19T17:20:00.000Z',
      kind: 'updated',
    });
  });

  it('sorts the oldest case first only when it has the newest activity', () => {
    const recentlyCreated = guestCase({ localId: 'new', createdAt: '2026-09-19T17:10:00.000Z', updatedAt: '2026-09-19T17:10:00.000Z' });
    const olderButUpdated = guestCase({ localId: 'old', latestActivityAt: '2026-09-19T17:20:00.000Z' });

    expect([recentlyCreated, olderButUpdated].sort(compareCasesByActivity).map((item) => item.localId)).toEqual(['old', 'new']);
  });
});
