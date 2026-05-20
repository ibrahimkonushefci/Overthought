import type { AiVerdictResponse, GuestCaseLocal } from '../../types/shared';
import { useAiVerdictStore } from '../../store/aiVerdictStore';
import { useAuthStore } from '../../store/authStore';
import { useGuestStore } from '../../store/guestStore';
import { aiVerdictService } from './aiVerdictService';

var mockSupabaseFrom = jest.fn();

jest.mock('../../lib/env', () => ({
  env: {
    supabaseUrl: 'https://project.supabase.co',
    supabaseAnonKey: 'anon-key',
  },
  hasSupabaseEnv: () => true,
}));

jest.mock('../../lib/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(async () => ({
        data: {
          session: {
            access_token: 'user-token',
          },
        },
      })),
    },
    from: (...args: unknown[]) => mockSupabaseFrom(...args),
  },
}));

function successResponse(overrides: Partial<Extract<AiVerdictResponse, { ok: true }>> = {}): AiVerdictResponse {
  return {
    ok: true,
    verdict: {
      verdictLabel: 'dangerous_overthinking',
      delusionScore: 77,
      displayLabel: 'Breadcrumb Circus',
      explanationText: 'AI says this is a maybe wearing a fake mustache.',
      evidenceCheckText: 'The receipt is "maybe sometime," which is a fog machine with punctuation.',
      overreadingText: 'You are treating a non-plan like a calendar invite in witness protection.',
      whatMattersText: 'A real plan has a day, a time, and less interpretive dance.',
      nextMoveText: 'Ask once for a real plan, then stop refreshing.',
      verdictVersion: 1,
      source: 'ai',
    },
    localFallback: {
      verdictLabel: 'mild_delusion',
      delusionScore: 61,
      explanationText: 'Local fallback.',
      nextMoveText: 'Wait for evidence.',
      verdictVersion: 1,
    },
    cache: {
      id: 'ai-verdict-1',
      source: 'generated',
      targetFingerprint: 'fingerprint-1',
      modelProvider: 'gemini',
      modelName: 'gemini-2.5-flash',
      modelVersion: null,
      promptVersion: 1,
      responseSchemaVersion: 1,
      createdAt: '2026-05-16T10:00:00.000Z',
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
    ...overrides,
  };
}

function failureResponse(overrides: Partial<Extract<AiVerdictResponse, { ok: false }>> = {}): AiVerdictResponse {
  return {
    ok: false,
    code: 'quota_exceeded',
    message: 'Free AI verdicts are used up.',
    access: {
      accessTier: 'guest',
      allowed: false,
      used: 2,
      remaining: 0,
      limit: 2,
      quotaScope: 'lifetime',
      quotaBucket: null,
      reason: 'guest_lifetime_limit',
    },
    localFallback: {
      verdictLabel: 'mild_delusion',
      delusionScore: 61,
      explanationText: 'Local fallback.',
      nextMoveText: 'Wait for evidence.',
      verdictVersion: 1,
    },
    ...overrides,
  };
}

function guestCase(overrides: Partial<GuestCaseLocal> = {}): GuestCaseLocal {
  return {
    localId: 'local-case-1',
    localOwnerId: 'guest-local-1',
    title: 'Maybe sometime',
    category: 'romance',
    inputText: 'He said maybe sometime and never picked a day.',
    verdictLabel: 'mild_delusion',
    delusionScore: 61,
    explanationText: 'Local fallback.',
    nextMoveText: 'Wait for evidence.',
    verdictVersion: 1,
    triggeredSignals: [],
    outcomeStatus: 'unknown',
    lastAnalyzedAt: '2026-05-16T10:00:00.000Z',
    createdAt: '2026-05-16T10:00:00.000Z',
    updatedAt: '2026-05-16T10:00:00.000Z',
    archivedAt: null,
    deletedAt: null,
    updates: [],
    syncStatus: 'local_only',
    ...overrides,
  };
}

describe('aiVerdictService', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    useGuestStore.getState().clearAllLocalData();
    useAuthStore.getState().resetSession();
    useAiVerdictStore.getState().clearAllAiVerdicts();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    useGuestStore.getState().clearAllLocalData();
    useAuthStore.getState().resetSession();
    useAiVerdictStore.getState().clearAllAiVerdicts();
  });

  it('requests guest AI verdicts with a persisted guest key and no Authorization header', async () => {
    useAuthStore.getState().setGuest();
    const record = guestCase();
    useGuestStore.getState().addCase(record);
    global.fetch = jest.fn(async () => ({
      status: 200,
      json: async () => successResponse(),
    })) as unknown as typeof fetch;

    const result = await aiVerdictService.requestForCase(record);

    expect(result.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://project.supabase.co/functions/v1/ai-verdict',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          apikey: 'anon-key',
          'Content-Type': 'application/json',
        }),
      }),
    );
    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(init.headers.Authorization).toBeUndefined();
    const body = JSON.parse(init.body);
    expect(body.guestKey).toEqual(expect.stringMatching(/^guest_ai_/));
    expect(body.target).toMatchObject({
      targetType: 'guest_case',
      guestCaseId: 'local-case-1',
      localVerdictLabel: 'mild_delusion',
      localDelusionScore: 61,
    });
    expect(useGuestStore.getState().guestAiKey).toBe(body.guestKey);
    expect(useGuestStore.getState().cases[0].aiVerdict?.verdict.delusionScore).toBe(77);
    expect(useAiVerdictStore.getState().requestByCaseId['local-case-1']).toMatchObject({
      status: 'success',
      httpStatus: 200,
    });
  });

  it('requests authenticated AI verdicts with the session access token and stores a display cache', async () => {
    useAuthStore.getState().setAuthenticated({
      id: 'user-1',
      email: 'person@example.com',
      provider: 'email',
    });
    global.fetch = jest.fn(async () => ({
      status: 200,
      json: async () =>
        successResponse({
          access: {
            accessTier: 'free',
            allowed: true,
            used: 1,
            remaining: 1,
            limit: 2,
            quotaScope: 'daily',
            quotaBucket: '2026-05-16',
          },
        }),
    })) as unknown as typeof fetch;

    const result = await aiVerdictService.requestForCase({
      id: 'remote-case-1',
      userId: 'user-1',
      title: 'Remote case',
      category: 'romance',
      inputText: 'Remote input.',
      verdictLabel: 'mild_delusion',
      delusionScore: 61,
      explanationText: 'Local fallback.',
      nextMoveText: 'Wait for evidence.',
      verdictVersion: 1,
      outcomeStatus: 'unknown',
      lastAnalyzedAt: '2026-05-16T10:00:00.000Z',
      createdAt: '2026-05-16T10:00:00.000Z',
      updatedAt: '2026-05-16T10:00:00.000Z',
      archivedAt: null,
      deletedAt: null,
    });

    expect(result.ok).toBe(true);
    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer user-token');
    expect(JSON.parse(init.body)).toEqual({
      target: {
        targetType: 'case',
        caseId: 'remote-case-1',
      },
    });
    expect(useAiVerdictStore.getState().byCaseId['remote-case-1'].verdict.delusionScore).toBe(77);
    expect(useAiVerdictStore.getState().requestByCaseId['remote-case-1']).toMatchObject({
      status: 'success',
      httpStatus: 200,
    });
  });

  it('returns safe failures without attaching AI verdicts when the function fails', async () => {
    useAuthStore.getState().setGuest();
    const record = guestCase();
    useGuestStore.getState().addCase(record);
    global.fetch = jest.fn(async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;

    const result = await aiVerdictService.requestForCase(record);

    expect(result).toEqual({
      ok: false,
      code: 'unknown',
      message: 'AI verdict is unavailable right now.',
    });
    expect(useGuestStore.getState().cases[0].aiVerdict).toBeUndefined();
    expect(useAiVerdictStore.getState().requestByCaseId['local-case-1']).toMatchObject({
      status: 'unknown',
      code: 'unknown',
    });
  });

  it('stores timeout failures so the result screen can fall back to Basic Verdict', async () => {
    useAuthStore.getState().setGuest();
    const record = guestCase();
    useGuestStore.getState().addCase(record);
    global.fetch = jest.fn(async () => {
      throw new DOMException('The operation was aborted.', 'AbortError');
    }) as unknown as typeof fetch;

    const result = await aiVerdictService.requestForCase(record);

    expect(result).toEqual({
      ok: false,
      code: 'ai_timeout',
      message: 'AI verdict timed out. Showing basic verdict.',
    });
    expect(useGuestStore.getState().cases[0].aiVerdict).toBeUndefined();
    expect(useAiVerdictStore.getState().requestByCaseId['local-case-1']).toMatchObject({
      status: 'ai_timeout',
      code: 'ai_timeout',
    });
  });

  it('can replace an authenticated timeout state with a late stored AI verdict', async () => {
    useAuthStore.getState().setAuthenticated({
      id: 'user-1',
      email: 'person@example.com',
      provider: 'email',
    });
    const record = {
      id: 'remote-case-timeout',
      userId: 'user-1',
      title: 'Remote timeout case',
      category: 'romance' as const,
      inputText: 'Remote input.',
      verdictLabel: 'mild_delusion' as const,
      delusionScore: 61,
      explanationText: 'Local fallback.',
      nextMoveText: 'Wait for evidence.',
      verdictVersion: 1,
      outcomeStatus: 'unknown' as const,
      lastAnalyzedAt: '2026-05-16T10:00:00.000Z',
      createdAt: '2026-05-16T10:00:00.000Z',
      updatedAt: '2026-05-16T10:00:00.000Z',
      archivedAt: null,
      deletedAt: null,
    };
    global.fetch = jest.fn(async () => {
      throw new DOMException('The operation was aborted.', 'AbortError');
    }) as unknown as typeof fetch;

    await aiVerdictService.requestForCase(record);

    expect(useAiVerdictStore.getState().requestByCaseId['remote-case-timeout']).toMatchObject({
      status: 'ai_timeout',
      code: 'ai_timeout',
    });

    const maybeSingle = jest.fn(async () => ({
      data: {
        id: 'late-ai-1',
        target_fingerprint: 'fingerprint-late',
        verdict_label: 'dangerous_overthinking',
        delusion_score: 78,
        display_label: 'Late Spiral',
        explanation_text: 'Late stored AI read.',
        evidence_check_text: 'Late evidence check.',
        overreading_text: 'Late overreading note.',
        what_matters_text: 'Late what matters note.',
        next_move_text: 'Use the late stored answer.',
        verdict_version: 1,
        local_verdict_label: 'mild_delusion',
        local_delusion_score: 61,
        local_explanation_text: 'Local fallback.',
        local_next_move_text: 'Wait for evidence.',
        local_verdict_version: 1,
        model_provider: 'gemini',
        model_name: 'gemini-2.5-flash',
        model_version: null,
        prompt_version: 1,
        response_schema_version: 1,
        created_at: '2026-05-16T10:00:10.000Z',
      },
      error: null,
    }));
    const limit = jest.fn(() => ({ maybeSingle }));
    const order = jest.fn(() => ({ limit }));
    const eq = jest.fn(() => ({ order }));
    const select = jest.fn(() => ({ eq }));
    mockSupabaseFrom.mockReturnValue({ select });

    const stored = await aiVerdictService.loadStoredVerdictForCase(record);

    expect(stored?.verdict.delusionScore).toBe(78);
    expect(useAiVerdictStore.getState().byCaseId['remote-case-timeout'].verdict.explanationText).toBe('Late stored AI read.');
    expect(useAiVerdictStore.getState().requestByCaseId['remote-case-timeout']).toMatchObject({
      status: 'cache',
      message: 'Saved AI verdict from your account.',
    });
  });

  it('stores structured AI quota failures for the result screen', async () => {
    useAuthStore.getState().setGuest();
    const record = guestCase();
    useGuestStore.getState().addCase(record);
    global.fetch = jest.fn(async () => ({
      status: 429,
      json: async () => failureResponse(),
    })) as unknown as typeof fetch;

    const result = await aiVerdictService.requestForCase(record);

    expect(result).toMatchObject({
      ok: false,
      code: 'quota_exceeded',
    });
    expect(useGuestStore.getState().cases[0].aiVerdict).toBeUndefined();
    expect(useAiVerdictStore.getState().requestByCaseId['local-case-1']).toMatchObject({
      status: 'quota_exceeded',
      code: 'quota_exceeded',
      httpStatus: 429,
      access: expect.objectContaining({
        remaining: 0,
      }),
    });
  });

  it('loads stored authenticated AI verdicts without calling the Edge Function', async () => {
    useAuthStore.getState().setAuthenticated({
      id: 'user-1',
      email: 'person@example.com',
      provider: 'email',
    });
    global.fetch = jest.fn() as unknown as typeof fetch;
    const maybeSingle = jest.fn(async () => ({
      data: {
        id: 'stored-ai-1',
        target_fingerprint: 'fingerprint-stored',
        verdict_label: 'slight_reach',
        delusion_score: 34,
        display_label: 'Stored Spiral',
        explanation_text: 'Stored AI read.',
        evidence_check_text: 'Stored evidence check.',
        overreading_text: 'Stored overreading note.',
        what_matters_text: 'Stored what matters note.',
        next_move_text: 'Use the stored answer.',
        verdict_version: 1,
        local_verdict_label: 'mild_delusion',
        local_delusion_score: 61,
        local_explanation_text: 'Local fallback.',
        local_next_move_text: 'Wait for evidence.',
        local_verdict_version: 1,
        model_provider: 'gemini',
        model_name: 'gemini-2.5-flash',
        model_version: null,
        prompt_version: 1,
        response_schema_version: 1,
        created_at: '2026-05-16T10:00:00.000Z',
      },
      error: null,
    }));
    const limit = jest.fn(() => ({ maybeSingle }));
    const order = jest.fn(() => ({ limit }));
    const eq = jest.fn(() => ({ order }));
    const select = jest.fn(() => ({ eq }));
    mockSupabaseFrom.mockReturnValue({ select });

    const result = await aiVerdictService.loadStoredVerdictForCase({
      id: 'remote-case-1',
      userId: 'user-1',
      title: 'Remote case',
      category: 'romance',
      inputText: 'Remote input.',
      verdictLabel: 'mild_delusion',
      delusionScore: 61,
      explanationText: 'Local fallback.',
      nextMoveText: 'Wait for evidence.',
      verdictVersion: 1,
      outcomeStatus: 'unknown',
      lastAnalyzedAt: '2026-05-16T10:00:00.000Z',
      createdAt: '2026-05-16T10:00:00.000Z',
      updatedAt: '2026-05-16T10:00:00.000Z',
      archivedAt: null,
      deletedAt: null,
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockSupabaseFrom).toHaveBeenCalledWith('ai_case_verdicts');
    expect(eq).toHaveBeenCalledWith('case_id', 'remote-case-1');
    expect(result?.verdict.delusionScore).toBe(34);
    expect(result?.verdict.displayLabel).toBe('Stored Spiral');
    expect(result?.verdict.evidenceCheckText).toBe('Stored evidence check.');
    expect(useAiVerdictStore.getState().byCaseId['remote-case-1'].verdict.delusionScore).toBe(34);
    expect(useAiVerdictStore.getState().requestByCaseId['remote-case-1']).toMatchObject({
      status: 'cache',
      message: 'Saved AI verdict from your account.',
    });
  });
});
