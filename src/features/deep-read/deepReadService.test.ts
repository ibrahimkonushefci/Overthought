import { supabase } from '../../lib/supabase/client';
import { useAiVerdictStore } from '../../store/aiVerdictStore';
import { useAuthStore } from '../../store/authStore';
import type { DeepReadResponse } from '../../types/shared';
import { deepReadService } from './deepReadService';

var mockSupabaseFrom = jest.fn();

jest.mock('../../lib/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockSupabaseFrom(...args),
    functions: {
      invoke: jest.fn(),
    },
  },
}));

const mockSupabase = supabase as unknown as {
  from: jest.Mock;
  functions: {
    invoke: jest.Mock;
  };
};

function successResponse(overrides: Partial<Extract<DeepReadResponse, { ok: true }>> = {}): DeepReadResponse {
  return {
    ok: true,
    deepRead: {
      whatsActuallyHappening: 'The situation is ambiguous.',
      whatYoureOverreading: 'You are treating a vibe like a plan.',
      whatEvidenceActuallyMatters: 'Direct follow-through matters most.',
      whatToDoNext: 'Wait for clearer evidence.',
      roastLine: 'The group chat needs receipts.',
    },
    cache: {
      id: 'deep-read-1',
      source: 'generated',
      targetType: 'case',
      targetFingerprint: 'fingerprint-1',
      modelProvider: 'stub',
      modelName: 'deep-read-stub',
      modelVersion: null,
      promptVersion: 1,
      responseSchemaVersion: 1,
      createdAt: '2026-04-29T10:00:00.000Z',
    },
    access: {
      accessTier: 'free',
      allowed: true,
      remaining: 1,
      limit: 2,
      quotaBucket: '2026-04-29',
    },
    ...overrides,
  };
}

describe('deepReadService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabaseFrom.mockReset();
    useAuthStore.getState().resetSession();
    useAiVerdictStore.getState().clearAllAiVerdicts();
  });

  afterEach(() => {
    useAuthStore.getState().resetSession();
    useAiVerdictStore.getState().clearAllAiVerdicts();
  });

  it('returns not_authenticated without invoking Supabase for guests', async () => {
    useAuthStore.getState().setGuest();

    const result = await deepReadService.requestCaseDeepRead('case-1');

    expect(result).toEqual({
      ok: false,
      code: 'not_authenticated',
      message: 'Sign in to use Deep Read.',
    });
    expect(mockSupabase.functions.invoke).not.toHaveBeenCalled();
  });

  it('invokes the authenticated case-only Edge Function request shape', async () => {
    useAuthStore.getState().setAuthenticated({
      id: 'user-1',
      email: 'person@example.com',
      provider: 'email',
    });
    mockSupabase.functions.invoke.mockResolvedValue({
      data: successResponse(),
      error: null,
    });

    const result = await deepReadService.requestCaseDeepRead(' case-1 ');

    expect(result.ok).toBe(true);
    expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('deep-read', {
      body: {
        target: {
          targetType: 'case',
          caseId: 'case-1',
        },
      },
    });
  });

  it('loads a cached Deep Read for an authenticated case without invoking the Edge Function', async () => {
    useAuthStore.getState().setAuthenticated({
      id: 'user-1',
      email: 'person@example.com',
      provider: 'email',
    });
    const maybeSingle = jest.fn(async () => ({
      data: {
        id: 'deep-read-1',
        target_type: 'case',
        target_fingerprint: 'fingerprint-1',
        model_provider: 'gemini',
        model_name: 'gemini-2.5-flash',
        model_version: null,
        prompt_version: 2,
        response_schema_version: 1,
        response_json: {
          whatsActuallyHappening: 'The situation is ambiguous.',
          whatYoureOverreading: 'You are treating a vibe like a plan.',
          whatEvidenceActuallyMatters: 'Direct follow-through matters most.',
          whatToDoNext: 'Wait for clearer evidence.',
          roastLine: 'The group chat needs receipts.',
        },
        category: 'romance',
        local_verdict_label: 'mild_delusion',
        local_delusion_score: 61,
        local_verdict_version: 1,
        created_at: '2026-04-29T10:00:00.000Z',
      },
      error: null,
    }));
    const query: {
      eq: jest.Mock;
      order: jest.Mock;
      limit: jest.Mock;
    } = {
      eq: jest.fn(),
      order: jest.fn(),
      limit: jest.fn(() => ({ maybeSingle })),
    };
    query.eq.mockReturnValue(query);
    query.order.mockReturnValue(query);
    const select = jest.fn(() => query);
    mockSupabaseFrom.mockReturnValue({ select });

    const result = await deepReadService.loadStoredCaseDeepRead({
      id: 'case-1',
      userId: 'user-1',
      title: 'Maybe sometime',
      category: 'romance',
      inputText: 'He said maybe sometime.',
      verdictLabel: 'mild_delusion',
      delusionScore: 61,
      explanationText: 'Local fallback.',
      nextMoveText: 'Wait for evidence.',
      verdictVersion: 1,
      outcomeStatus: 'unknown',
      lastAnalyzedAt: '2026-04-29T10:00:00.000Z',
      createdAt: '2026-04-29T10:00:00.000Z',
      updatedAt: '2026-04-29T10:00:00.000Z',
      archivedAt: null,
      deletedAt: null,
    });

    expect(result?.ok).toBe(true);
    expect(result?.cache.source).toBe('cache');
    expect(result?.deepRead.roastLine).toBe('The group chat needs receipts.');
    expect(mockSupabaseFrom).toHaveBeenCalledWith('ai_deep_reads');
    expect(query.eq).toHaveBeenCalledWith('case_id', 'case-1');
    expect(query.eq).toHaveBeenCalledWith('local_verdict_label', 'mild_delusion');
    expect(query.eq).toHaveBeenCalledWith('local_delusion_score', 61);
    expect(query.eq).toHaveBeenCalledWith('local_verdict_version', 1);
    expect(mockSupabase.functions.invoke).not.toHaveBeenCalled();
  });

  it('blocks Deep Read locally when AI verdict quota is exhausted for the account', async () => {
    useAuthStore.getState().setAuthenticated({
      id: 'user-1',
      email: 'person@example.com',
      provider: 'email',
    });
    useAiVerdictStore.getState().setRequestState('other-case', {
      status: 'quota_exceeded',
      code: 'quota_exceeded',
      message: 'Free AI verdicts are used up.',
      access: {
        accessTier: 'free',
        allowed: false,
        used: 2,
        remaining: 0,
        limit: 2,
        quotaScope: 'daily',
        quotaBucket: new Date().toISOString().slice(0, 10),
        reason: 'daily_limit',
      },
      updatedAt: new Date().toISOString(),
    });

    await expect(deepReadService.requestCaseDeepRead('case-1')).resolves.toEqual({
      ok: false,
      code: 'quota_exceeded',
      message: 'AI verdict quota is used up for now. Deep Read stays locked for this case.',
    });
    expect(mockSupabase.functions.invoke).not.toHaveBeenCalled();
  });

  it('passes through valid quota failures from the Edge Function', async () => {
    useAuthStore.getState().setAuthenticated({
      id: 'user-1',
      email: 'person@example.com',
      provider: 'email',
    });
    const quotaFailure: DeepReadResponse = {
      ok: false,
      code: 'quota_exceeded',
      message: 'Daily Deep Reads are used up.',
      access: {
        accessTier: 'free',
        allowed: false,
        remaining: 0,
        limit: 2,
        quotaBucket: '2026-04-29',
        reason: 'daily_limit',
      },
    };
    mockSupabase.functions.invoke.mockResolvedValue({
      data: quotaFailure,
      error: null,
    });

    await expect(deepReadService.requestCaseDeepRead('case-1')).resolves.toEqual(quotaFailure);
  });

  it('passes through structured quota failures from non-2xx Edge Function responses', async () => {
    useAuthStore.getState().setAuthenticated({
      id: 'user-1',
      email: 'person@example.com',
      provider: 'email',
    });
    const quotaFailure: DeepReadResponse = {
      ok: false,
      code: 'quota_exceeded',
      message: 'Daily Deep Reads are used up.',
      access: {
        accessTier: 'free',
        allowed: false,
        remaining: 0,
        limit: 2,
        quotaBucket: '2026-04-29',
        reason: 'daily_limit',
      },
    };
    mockSupabase.functions.invoke.mockResolvedValue({
      data: null,
      error: {
        message: 'Edge Function returned a non-2xx status code',
        context: {
          clone: () => ({
            json: jest.fn(async () => quotaFailure),
          }),
        },
      },
    });

    await expect(deepReadService.requestCaseDeepRead('case-1')).resolves.toEqual(quotaFailure);
  });

  it('passes through valid fair-use failures from the Edge Function', async () => {
    useAuthStore.getState().setAuthenticated({
      id: 'user-1',
      email: 'person@example.com',
      provider: 'email',
    });
    const fairUseFailure: DeepReadResponse = {
      ok: false,
      code: 'fair_use_exceeded',
      message: 'Deep Read is temporarily limited for fair use.',
      access: {
        accessTier: 'premium',
        allowed: false,
        remaining: 0,
        limit: 100,
        quotaBucket: '2026-04-29',
        reason: 'fair_use',
      },
    };
    mockSupabase.functions.invoke.mockResolvedValue({
      data: fairUseFailure,
      error: null,
    });

    await expect(deepReadService.requestCaseDeepRead('case-1')).resolves.toEqual(fairUseFailure);
  });

  it('maps malformed responses to invalid_ai_response', async () => {
    useAuthStore.getState().setAuthenticated({
      id: 'user-1',
      email: 'person@example.com',
      provider: 'email',
    });
    mockSupabase.functions.invoke.mockResolvedValue({
      data: { ok: true, deepRead: null },
      error: null,
    });

    await expect(deepReadService.requestCaseDeepRead('case-1')).resolves.toEqual({
      ok: false,
      code: 'invalid_ai_response',
      message: 'Deep Read returned an invalid response.',
    });
  });

  it('maps invoke errors to a safe failure response', async () => {
    useAuthStore.getState().setAuthenticated({
      id: 'user-1',
      email: 'person@example.com',
      provider: 'email',
    });
    mockSupabase.functions.invoke.mockResolvedValue({
      data: null,
      error: { message: 'Function unavailable' },
    });

    await expect(deepReadService.requestCaseDeepRead('case-1')).resolves.toEqual({
      ok: false,
      code: 'unknown',
      message: 'Deep Read is unavailable right now.',
    });
  });

  it('maps thrown client errors to a safe failure response', async () => {
    useAuthStore.getState().setAuthenticated({
      id: 'user-1',
      email: 'person@example.com',
      provider: 'email',
    });
    mockSupabase.functions.invoke.mockRejectedValue(new Error('Network down'));

    await expect(deepReadService.requestCaseDeepRead('case-1')).resolves.toEqual({
      ok: false,
      code: 'unknown',
      message: 'Deep Read is unavailable right now.',
    });
  });

  it('returns deep_read_not_configured when Supabase is unavailable', async () => {
    jest.resetModules();
    jest.doMock('../../lib/supabase/client', () => ({
      supabase: null,
    }));

    const { deepReadService: isolatedDeepReadService } = await import('./deepReadService');

    await expect(isolatedDeepReadService.requestCaseDeepRead('case-1')).resolves.toEqual({
      ok: false,
      code: 'deep_read_not_configured',
      message: 'Deep Read is not configured for this build.',
    });
  });
});
