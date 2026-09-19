import type { AiVerdictResponse } from '../../../types/shared';
import { useAuthStore } from '../../../store/authStore';
import { useGuestStore } from '../../../store/guestStore';

const mockCreateSmartCase = jest.fn();

jest.mock('../../ai-verdict/aiVerdictService', () => ({
  aiVerdictService: {
    createSmartCase: mockCreateSmartCase,
  },
}));

jest.mock('../../../lib/supabase/client', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

import { caseRepository } from './caseRepository';

function successResponse(): Extract<AiVerdictResponse, { ok: true }> {
  return {
    ok: true,
    requestId: 'smart_case_1234567890abcdef',
    caseId: null,
    verdict: {
      verdictLabel: 'mild_delusion',
      delusionScore: 58,
      displayLabel: 'A Maybe, Not A Plan',
      explanationText: 'The interest is possible, but the plan is missing.',
      evidenceCheckText: 'There is a warm statement and no date or time.',
      overreadingText: 'You are treating intention like completed logistics.',
      whatMattersText: 'Whether they choose a specific day and time.',
      nextMoveText: 'Suggest one time, then let their answer be the answer.',
      verdictVersion: 1,
      source: 'ai',
    },
    localFallback: {
      verdictLabel: 'mild_delusion',
      delusionScore: 50,
      explanationText: 'There is enough here to notice and not enough to bet on.',
      nextMoveText: 'Wait for concrete follow-through.',
      verdictVersion: 1,
    },
    localCalibration: {
      verdictLabel: 'mild_delusion',
      delusionScore: 50,
      explanationText: 'There is enough here to notice and not enough to bet on.',
      nextMoveText: 'Wait for concrete follow-through.',
      verdictVersion: 1,
    },
    cache: {
      id: 'guest-smart-verdict-1',
      source: 'generated',
      targetFingerprint: 'fingerprint-1',
      modelProvider: 'gemini',
      modelName: 'gemini-2.5-flash',
      modelVersion: null,
      promptVersion: 6,
      responseSchemaVersion: 2,
      createdAt: '2026-09-17T10:00:00.000Z',
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
  };
}

describe('Smart-only case creation repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useGuestStore.getState().clearAllLocalData();
    useAuthStore.getState().setGuest();
  });

  afterEach(() => {
    useGuestStore.getState().clearAllLocalData();
    useAuthStore.getState().resetSession();
  });

  it('adds a guest case only after a successful Smart response', async () => {
    mockCreateSmartCase.mockResolvedValue(successResponse());

    const result = await caseRepository.createSmartCase({
      requestId: 'smart_case_1234567890abcdef',
      category: 'friendship',
      inputText: 'My friend said they wanted to meet this weekend but never chose a day or time.',
    });

    expect(result.ok).toBe(true);
    expect(useGuestStore.getState().cases).toHaveLength(1);
    expect(useGuestStore.getState().cases[0]).toMatchObject({
      resultSource: 'smart',
      delusionScore: 58,
      smartVerdict: { displayLabel: 'A Maybe, Not A Plan' },
      legacyBasicSnapshot: { delusionScore: 50 },
    });
  });

  it('creates no guest case when Smart generation fails', async () => {
    mockCreateSmartCase.mockResolvedValue({
      ok: false,
      code: 'ai_failed',
      message: 'Smart Verdict is unavailable right now.',
    });

    const result = await caseRepository.createSmartCase({
      requestId: 'smart_case_1234567890abcdef',
      category: 'friendship',
      inputText: 'My friend said they wanted to meet this weekend but never chose a day or time.',
    });

    expect(result).toMatchObject({ ok: false, response: { code: 'ai_failed' } });
    expect(useGuestStore.getState().cases).toHaveLength(0);
  });

  it('preserves a retry request ID until the draft is edited or cleared', () => {
    useGuestStore.getState().setCaseDraft('A draft long enough to become a real case later.');
    const firstRequestId = useGuestStore.getState().ensureCaseRequestId();

    expect(useGuestStore.getState().ensureCaseRequestId()).toBe(firstRequestId);
    useGuestStore.getState().setPreferredCategory('friendship');
    expect(useGuestStore.getState().drafts.caseRequestId).toBeNull();

    const secondRequestId = useGuestStore.getState().ensureCaseRequestId();
    useGuestStore.getState().setCaseDraft('An edited draft with different evidence and details.');
    expect(secondRequestId).not.toBe(firstRequestId);
    expect(useGuestStore.getState().drafts.caseRequestId).toBeNull();

    useGuestStore.getState().clearCaseDraft();
    expect(useGuestStore.getState().drafts).toMatchObject({
      caseText: '',
      caseRequestId: null,
      preferredCategory: 'romance',
    });
  });
});
