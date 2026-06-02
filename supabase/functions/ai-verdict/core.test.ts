import {
  generateAiVerdictWithGemini,
  handleAiVerdictRequest,
  type AiVerdictAccessState,
  type AiVerdictDataAdapter,
  type AiVerdictGenerationTarget,
  type AiVerdictProviderResult,
  type AiVerdictStoredRow,
  type AiVerdictUsageReservationResult,
  type CaseRow,
  type InsertAuthenticatedAiVerdictInput,
  type InsertGuestAiVerdictInput,
} from './core';

function caseRow(overrides: Partial<CaseRow> = {}): CaseRow {
  return {
    id: 'case-1',
    user_id: 'user-1',
    category: 'romance',
    input_text: 'He said maybe sometime and never picked a day.',
    verdict_label: 'mild_delusion',
    delusion_score: 61,
    explanation_text: 'The local result says this is thin evidence.',
    next_move_text: 'Wait for a concrete plan.',
    latest_verdict_version: 1,
    archived_at: null,
    deleted_at: null,
    ...overrides,
  };
}

function aiVerdictRow(overrides: Partial<AiVerdictStoredRow> = {}): AiVerdictStoredRow {
  return {
    id: 'ai-verdict-1',
    target_fingerprint: 'fingerprint-case-1',
    verdict_label: 'dangerous_overthinking',
    delusion_score: 78,
    display_label: 'Fog Machine',
    explanation_text: 'AI says sometime is fog with punctuation.',
    evidence_check_text: 'The evidence is one vague "sometime," which is not a plan.',
    overreading_text: 'You are turning a maybe into a calendar invite.',
    what_matters_text: 'A real plan needs a day, a time, and fewer fumes.',
    next_move_text: 'Ask once for a real day, then stop refreshing the evidence.',
    verdict_version: 1,
    local_verdict_label: 'mild_delusion',
    local_delusion_score: 61,
    local_explanation_text: 'The local result says this is thin evidence.',
    local_next_move_text: 'Wait for a concrete plan.',
    local_verdict_version: 1,
    model_provider: 'test-provider',
    model_name: 'test-model',
    model_version: null,
    prompt_version: 1,
    response_schema_version: 1,
    created_at: '2026-05-16T10:00:00.000Z',
    ...overrides,
  };
}

function generatedAccess(overrides: Partial<AiVerdictAccessState> = {}): AiVerdictAccessState {
  return {
    accessTier: 'free',
    allowed: true,
    used: 1,
    remaining: 1,
    limit: 2,
    quotaScope: 'daily',
    quotaBucket: '2026-05-16',
    ...overrides,
  };
}

function reservationSuccess(access: AiVerdictAccessState = generatedAccess()): AiVerdictUsageReservationResult {
  return {
    ok: true,
    usageEventId: 'usage-1',
    access,
  };
}

function reservationFailure(
  code: Extract<AiVerdictUsageReservationResult, { ok: false }>['code'],
  access: AiVerdictAccessState,
): AiVerdictUsageReservationResult {
  return {
    ok: false,
    code,
    access,
  };
}

function successProvider(overrides: Partial<Extract<AiVerdictProviderResult, { ok: true }>> = {}) {
  return jest.fn<Promise<AiVerdictProviderResult>, [AiVerdictGenerationTarget]>(async () => ({
    ok: true,
      verdict: {
        verdictLabel: 'dangerous_overthinking',
        delusionScore: 78,
        displayLabel: 'Fog Machine',
        explanationText: 'AI says sometime is fog with punctuation.',
        evidenceCheckText: 'The evidence is one vague "sometime," which is not a plan.',
        overreadingText: 'You are turning a maybe into a calendar invite.',
        whatMattersText: 'A real plan needs a day, a time, and fewer fumes.',
        nextMoveText: 'Ask once for a real day, then stop refreshing the evidence.',
        verdictVersion: 1,
    },
    modelVersion: 'test-model-version',
    ...overrides,
  }));
}

function createAdapter(overrides: Partial<AiVerdictDataAdapter> = {}) {
  let lastAuthenticatedInsert: InsertAuthenticatedAiVerdictInput | null = null;
  let lastGuestInsert: InsertGuestAiVerdictInput | null = null;
  const adapter: AiVerdictDataAdapter & {
    lastAuthenticatedInsert: () => InsertAuthenticatedAiVerdictInput | null;
    lastGuestInsert: () => InsertGuestAiVerdictInput | null;
  } = {
    authenticate: jest.fn(async () => 'user-1'),
    getAuthenticatedAccessTier: jest.fn(async () => 'free'),
    getOwnedActiveCase: jest.fn(async () => caseRow()),
    getCachedVerdict: jest.fn(async () => null),
    getCachedGuestVerdict: jest.fn(async () => null),
    getUsageAccess: jest.fn(async (input) =>
      generatedAccess({
        accessTier: input.accessTier,
        quotaScope: input.quotaScope,
        quotaBucket: input.quotaScope === 'daily' ? input.quotaBucket : null,
        limit: input.limit,
      }),
    ),
    reserveUsage: jest.fn(async (input) =>
      reservationSuccess(generatedAccess({
        accessTier: input.accessTier,
        quotaScope: input.accessTier === 'guest' ? 'lifetime' : 'daily',
        quotaBucket: input.accessTier === 'guest' ? null : input.quotaBucket,
        limit: input.accessTier === 'guest' ? input.guestLifetimeLimit : input.primaryLimit,
      })),
    ),
    finalizeUsageSucceeded: jest.fn(async () => undefined),
    finalizeUsageFailed: jest.fn(async () => undefined),
    insertVerdict: jest.fn(async (input) => {
      lastAuthenticatedInsert = input;
      return aiVerdictRow({
        id: 'ai-verdict-generated',
	        target_fingerprint: input.target_fingerprint,
	        verdict_label: input.verdict_label,
	        delusion_score: input.delusion_score,
	        display_label: input.display_label,
	        explanation_text: input.explanation_text,
	        evidence_check_text: input.evidence_check_text,
	        overreading_text: input.overreading_text,
	        what_matters_text: input.what_matters_text,
	        next_move_text: input.next_move_text,
        verdict_version: input.verdict_version,
        local_verdict_label: input.local_verdict_label,
        local_delusion_score: input.local_delusion_score,
        local_explanation_text: input.local_explanation_text,
        local_next_move_text: input.local_next_move_text,
        local_verdict_version: input.local_verdict_version,
        model_provider: input.model_provider,
        model_name: input.model_name,
        model_version: input.model_version,
        prompt_version: input.prompt_version,
        response_schema_version: input.response_schema_version,
      });
    }),
    insertGuestVerdict: jest.fn(async (input) => {
      lastGuestInsert = input;
      return aiVerdictRow({
        id: 'guest-ai-verdict-generated',
	        target_fingerprint: input.target_fingerprint,
	        verdict_label: input.verdict_label,
	        delusion_score: input.delusion_score,
	        display_label: input.display_label,
	        explanation_text: input.explanation_text,
	        evidence_check_text: input.evidence_check_text,
	        overreading_text: input.overreading_text,
	        what_matters_text: input.what_matters_text,
	        next_move_text: input.next_move_text,
        verdict_version: input.verdict_version,
        local_verdict_label: input.local_verdict_label,
        local_delusion_score: input.local_delusion_score,
        local_explanation_text: input.local_explanation_text,
        local_next_move_text: input.local_next_move_text,
        local_verdict_version: input.local_verdict_version,
        model_provider: input.model_provider,
        model_name: input.model_name,
        model_version: input.model_version,
        prompt_version: input.prompt_version,
        response_schema_version: input.response_schema_version,
      });
    }),
    isUniqueViolation: jest.fn((error) => Boolean(error && typeof error === 'object' && 'unique' in error)),
    lastAuthenticatedInsert: () => lastAuthenticatedInsert,
    lastGuestInsert: () => lastGuestInsert,
    ...overrides,
  };

  return adapter;
}

function authenticatedPayload(caseId = 'case-1') {
  return {
    target: {
      targetType: 'case',
      caseId,
    },
  };
}

function guestPayload(overrides: Record<string, unknown> = {}) {
  return {
    guestKey: 'guest_install_key_123456789',
    target: {
      targetType: 'guest_case',
      guestCaseId: 'guest-case-1',
      category: 'romance',
      inputText: 'He said maybe sometime and never picked a day.',
      localVerdictLabel: 'mild_delusion',
      localDelusionScore: 61,
      localExplanationText: 'The local result says this is thin evidence.',
      localNextMoveText: 'Wait for a concrete plan.',
      localVerdictVersion: 1,
    },
    ...overrides,
  };
}

function hashFor(value: string) {
  if (value.startsWith('guest-key:')) {
    return 'hashed-guest-key';
  }

  if (value.startsWith('ip:')) {
    return 'hashed-ip';
  }

  if (value.includes('"targetType":"guest_case"')) {
    return 'fingerprint-guest-case-1';
  }

  return 'fingerprint-case-1';
}

function handlerDeps(adapter: AiVerdictDataAdapter, generateVerdict = successProvider()) {
  return {
    data: adapter,
    generateVerdict,
    hash: jest.fn(async (value: string) => hashFor(value)),
    now: () => new Date('2026-05-16T10:00:00.000Z'),
    modelProvider: 'test-provider',
    modelName: 'test-model',
    promptVersion: 1,
    responseSchemaVersion: 1,
    signedInFreeDailyLimit: 2,
    premiumDailyLimit: 50,
    guestLifetimeLimit: 2,
    guestDailyLimit: 2,
    guestIpDailyLimit: 10,
    globalDailyLimit: 100,
  };
}

describe('ai-verdict core authenticated path', () => {
  it('rejects invalid auth tokens when an authorization header is present', async () => {
    const adapter = createAdapter({
      authenticate: jest.fn(async () => null),
    });

    const result = await handleAiVerdictRequest('token', authenticatedPayload(), handlerDeps(adapter));

    expect(result.status).toBe(401);
    expect(result.body).toEqual({
      ok: false,
      code: 'not_authenticated',
      message: 'Invalid auth token.',
    });
    expect(adapter.getOwnedActiveCase).not.toHaveBeenCalled();
  });

  it('rejects missing or unowned authenticated cases', async () => {
    const adapter = createAdapter({
      getOwnedActiveCase: jest.fn(async () => null),
    });

    const result = await handleAiVerdictRequest('token', authenticatedPayload('case-2'), handlerDeps(adapter));

    expect(result.status).toBe(404);
    expect(result.body).toEqual({
      ok: false,
      code: 'case_not_found',
      message: 'Case not found.',
    });
    expect(adapter.getOwnedActiveCase).toHaveBeenCalledWith('user-1', 'case-2');
  });

  it('returns authenticated cache hits before reserving daily quota', async () => {
    const cached = aiVerdictRow();
    const adapter = createAdapter({
      getCachedVerdict: jest.fn(async () => cached),
    });
    const generateVerdict = successProvider();

    const result = await handleAiVerdictRequest('token', authenticatedPayload(), handlerDeps(adapter, generateVerdict));

    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    if (result.body.ok) {
      expect(result.body.cache.source).toBe('cache');
      expect(result.body.access.quotaScope).toBe('daily');
      expect(result.body.access.quotaBucket).toBe('2026-05-16');
    }
    expect(adapter.reserveUsage).not.toHaveBeenCalled();
    expect(generateVerdict).not.toHaveBeenCalled();
  });

  it('uses signed-in free 2/day quota with active reservations enforced by reservation result', async () => {
    const adapter = createAdapter({
      reserveUsage: jest.fn(async () =>
        reservationFailure('quota_exceeded', generatedAccess({
          allowed: false,
          used: 2,
          remaining: 0,
          reason: 'daily_limit',
        })),
      ),
    });
    const generateVerdict = successProvider();

    const result = await handleAiVerdictRequest('token', authenticatedPayload(), handlerDeps(adapter, generateVerdict));

    expect(result.status).toBe(429);
    expect(result.body).toEqual({
      ok: false,
      code: 'quota_exceeded',
      message: 'Free AI verdicts are used up.',
      localFallback: {
        verdictLabel: 'mild_delusion',
        delusionScore: 61,
        explanationText: 'The local result says this is thin evidence.',
        nextMoveText: 'Wait for a concrete plan.',
        verdictVersion: 1,
      },
      access: {
        accessTier: 'free',
        allowed: false,
        used: 2,
        remaining: 0,
        limit: 2,
        quotaScope: 'daily',
        quotaBucket: '2026-05-16',
        reason: 'daily_limit',
      },
    });
    expect(adapter.reserveUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        accessTier: 'free',
        quotaBucket: '2026-05-16',
        primaryLimit: 2,
      }),
    );
    expect(generateVerdict).not.toHaveBeenCalled();
  });

  it('uses premium daily quota for premium authenticated users', async () => {
    const adapter = createAdapter({
      getAuthenticatedAccessTier: jest.fn(async () => 'premium'),
    });

    const result = await handleAiVerdictRequest('token', authenticatedPayload(), handlerDeps(adapter));

    expect(result.status).toBe(200);
    expect(adapter.reserveUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        accessTier: 'premium',
        quotaBucket: '2026-05-16',
        primaryLimit: 50,
      }),
    );
    expect(result.body.ok).toBe(true);
    if (result.body.ok) {
      expect(result.body.access).toMatchObject({
        accessTier: 'premium',
        limit: 50,
        quotaScope: 'daily',
        quotaBucket: '2026-05-16',
      });
    }
  });

  it('uses premium daily quota for grace-period authenticated users', async () => {
    const adapter = createAdapter({
      getAuthenticatedAccessTier: jest.fn(async () => 'premium'),
    });

    const result = await handleAiVerdictRequest('token', authenticatedPayload(), handlerDeps(adapter));

    expect(result.status).toBe(200);
    expect(adapter.getAuthenticatedAccessTier).toHaveBeenCalledWith('user-1');
    expect(adapter.reserveUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        accessTier: 'premium',
        primaryLimit: 50,
      }),
    );
  });

  it('returns premium access state on authenticated cache hits', async () => {
    const cached = aiVerdictRow();
    const adapter = createAdapter({
      getAuthenticatedAccessTier: jest.fn(async () => 'premium'),
      getCachedVerdict: jest.fn(async () => cached),
    });
    const generateVerdict = successProvider();

    const result = await handleAiVerdictRequest('token', authenticatedPayload(), handlerDeps(adapter, generateVerdict));

    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    if (result.body.ok) {
      expect(result.body.cache.source).toBe('cache');
      expect(result.body.access).toMatchObject({
        accessTier: 'premium',
        limit: 50,
      });
    }
    expect(adapter.getUsageAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        accessTier: 'premium',
        limit: 50,
      }),
    );
    expect(adapter.reserveUsage).not.toHaveBeenCalled();
    expect(generateVerdict).not.toHaveBeenCalled();
  });

  it('returns fair-use exhaustion when premium authenticated users reach the premium cap', async () => {
    const adapter = createAdapter({
      getAuthenticatedAccessTier: jest.fn(async () => 'premium'),
      reserveUsage: jest.fn(async () =>
        reservationFailure('fair_use_exceeded', generatedAccess({
          accessTier: 'premium',
          allowed: false,
          used: 50,
          remaining: 0,
          limit: 50,
          reason: 'fair_use',
        })),
      ),
    });
    const generateVerdict = successProvider();

    const result = await handleAiVerdictRequest('token', authenticatedPayload(), handlerDeps(adapter, generateVerdict));

    expect(result.status).toBe(429);
    expect(result.body).toEqual({
      ok: false,
      code: 'fair_use_exceeded',
      message: 'AI verdicts are temporarily limited for fair use.',
      localFallback: {
        verdictLabel: 'mild_delusion',
        delusionScore: 61,
        explanationText: 'The local result says this is thin evidence.',
        nextMoveText: 'Wait for a concrete plan.',
        verdictVersion: 1,
      },
      access: {
        accessTier: 'premium',
        allowed: false,
        used: 50,
        remaining: 0,
        limit: 50,
        quotaScope: 'daily',
        quotaBucket: '2026-05-16',
        reason: 'fair_use',
      },
    });
    expect(adapter.reserveUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        accessTier: 'premium',
        primaryLimit: 50,
      }),
    );
    expect(generateVerdict).not.toHaveBeenCalled();
  });

  it('stores authenticated AI verdicts separately while preserving the local fallback snapshot', async () => {
    const adapter = createAdapter();

    const result = await handleAiVerdictRequest('token', authenticatedPayload(), handlerDeps(adapter));

    expect(result.status).toBe(200);
    expect(adapter.finalizeUsageSucceeded).toHaveBeenCalledWith({
      usageEventId: 'usage-1',
      aiCaseVerdictId: 'ai-verdict-generated',
    });
    expect(adapter.lastAuthenticatedInsert()).toMatchObject({
      user_id: 'user-1',
      case_id: 'case-1',
      local_verdict_label: 'mild_delusion',
      local_delusion_score: 61,
      local_explanation_text: 'The local result says this is thin evidence.',
      local_next_move_text: 'Wait for a concrete plan.',
      local_verdict_version: 1,
	      verdict_label: 'dangerous_overthinking',
	      delusion_score: 78,
	      display_label: 'Fog Machine',
	      evidence_check_text: 'The evidence is one vague "sometime," which is not a plan.',
	      overreading_text: 'You are turning a maybe into a calendar invite.',
	      what_matters_text: 'A real plan needs a day, a time, and fewer fumes.',
	    });
    expect(result.body.ok).toBe(true);
    if (result.body.ok) {
      expect(result.body.localFallback.nextMoveText).toBe('Wait for a concrete plan.');
      expect(result.body.verdict.source).toBe('ai');
      expect(result.body.cache.source).toBe('generated');
    }
  });
});

describe('ai-verdict core guest path', () => {
  it('rejects guest requests without a valid guest key', async () => {
    const adapter = createAdapter();

    const result = await handleAiVerdictRequest(null, guestPayload({ guestKey: 'short' }), handlerDeps(adapter));

    expect(result.status).toBe(400);
    expect(result.body).toEqual({
      ok: false,
      code: 'guest_key_required',
      message: 'Guest AI verdicts need a valid guest key.',
    });
    expect(adapter.reserveUsage).not.toHaveBeenCalled();
  });

  it('returns guest cache hits before reserving quota', async () => {
    const cached = aiVerdictRow({ id: 'guest-cache-1', target_fingerprint: 'fingerprint-guest-case-1' });
    const adapter = createAdapter({
      getCachedGuestVerdict: jest.fn(async () => cached),
    });
    const generateVerdict = successProvider();

    const result = await handleAiVerdictRequest(null, guestPayload(), handlerDeps(adapter, generateVerdict), {
      ipAddress: '203.0.113.10',
    });

    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    if (result.body.ok) {
      expect(result.body.cache.source).toBe('cache');
      expect(result.body.access.accessTier).toBe('guest');
      expect(result.body.access.quotaScope).toBe('lifetime');
    }
    expect(adapter.getCachedGuestVerdict).toHaveBeenCalledWith(
      expect.objectContaining({
        guestKeyHash: 'hashed-guest-key',
        targetFingerprint: 'fingerprint-guest-case-1',
      }),
    );
    expect(adapter.reserveUsage).not.toHaveBeenCalled();
    expect(generateVerdict).not.toHaveBeenCalled();
  });

  it('enforces guest lifetime cap from atomic reservation result', async () => {
    const adapter = createAdapter({
      reserveUsage: jest.fn(async () =>
        reservationFailure('quota_exceeded', generatedAccess({
          accessTier: 'guest',
          allowed: false,
          used: 2,
          remaining: 0,
          limit: 2,
          quotaScope: 'lifetime',
          quotaBucket: null,
          reason: 'guest_lifetime_limit',
        })),
      ),
    });

    const result = await handleAiVerdictRequest(null, guestPayload(), handlerDeps(adapter));

    expect(result.status).toBe(429);
    expect(result.body.ok).toBe(false);
    if (!result.body.ok) {
      expect(result.body.code).toBe('quota_exceeded');
      expect(result.body.access?.reason).toBe('guest_lifetime_limit');
      expect(result.body.localFallback?.verdictLabel).toBe('mild_delusion');
    }
  });

  it('enforces guest daily cap from atomic reservation result', async () => {
    const adapter = createAdapter({
      reserveUsage: jest.fn(async () =>
        reservationFailure('quota_exceeded', generatedAccess({
          accessTier: 'guest',
          allowed: false,
          used: 2,
          remaining: 0,
          limit: 2,
          quotaScope: 'daily',
          quotaBucket: '2026-05-16',
          reason: 'daily_limit',
        })),
      ),
    });

    const result = await handleAiVerdictRequest(null, guestPayload(), handlerDeps(adapter));

    expect(result.status).toBe(429);
    expect(result.body.ok).toBe(false);
    if (!result.body.ok) {
      expect(result.body.code).toBe('quota_exceeded');
      expect(result.body.access?.reason).toBe('daily_limit');
    }
  });

  it('enforces guest IP cap from atomic reservation result', async () => {
    const adapter = createAdapter({
      reserveUsage: jest.fn(async () =>
        reservationFailure('ip_daily_cap_exceeded', generatedAccess({
          accessTier: 'guest',
          allowed: false,
          used: 10,
          remaining: 0,
          limit: 10,
          quotaScope: 'daily',
          quotaBucket: '2026-05-16',
          reason: 'ip_daily_cap',
        })),
      ),
    });

    const result = await handleAiVerdictRequest(null, guestPayload(), handlerDeps(adapter), {
      ipAddress: '203.0.113.10',
    });

    expect(result.status).toBe(429);
    expect(result.body.ok).toBe(false);
    if (!result.body.ok) {
      expect(result.body.code).toBe('ip_daily_cap_exceeded');
      expect(result.body.access?.reason).toBe('ip_daily_cap');
    }
    expect(adapter.reserveUsage).toHaveBeenCalledWith(expect.objectContaining({ ipHash: 'hashed-ip' }));
  });

  it('enforces global daily cap from atomic reservation result', async () => {
    const adapter = createAdapter({
      reserveUsage: jest.fn(async () =>
        reservationFailure('global_daily_cap_exceeded', generatedAccess({
          accessTier: 'guest',
          allowed: false,
          used: 100,
          remaining: 0,
          limit: 100,
          quotaScope: 'daily',
          quotaBucket: '2026-05-16',
          reason: 'global_daily_cap',
        })),
      ),
    });

    const result = await handleAiVerdictRequest(null, guestPayload(), handlerDeps(adapter));

    expect(result.status).toBe(429);
    expect(result.body.ok).toBe(false);
    if (!result.body.ok) {
      expect(result.body.code).toBe('global_daily_cap_exceeded');
      expect(result.body.access?.reason).toBe('global_daily_cap');
    }
  });

  it('stores guest AI verdicts separately without raw case text', async () => {
    const adapter = createAdapter();

    const result = await handleAiVerdictRequest(null, guestPayload(), handlerDeps(adapter), {
      ipAddress: '203.0.113.10',
    });

    expect(result.status).toBe(200);
    expect(adapter.reserveUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        guestKeyHash: 'hashed-guest-key',
        ipHash: 'hashed-ip',
        accessTier: 'guest',
        targetFingerprint: 'fingerprint-guest-case-1',
      }),
    );
    expect(adapter.finalizeUsageSucceeded).toHaveBeenCalledWith({
      usageEventId: 'usage-1',
      aiGuestCaseVerdictId: 'guest-ai-verdict-generated',
    });
    expect(adapter.lastGuestInsert()).toMatchObject({
      guest_key_hash: 'hashed-guest-key',
      target_fingerprint: 'fingerprint-guest-case-1',
      local_verdict_label: 'mild_delusion',
      local_delusion_score: 61,
      local_explanation_text: 'The local result says this is thin evidence.',
	      local_next_move_text: 'Wait for a concrete plan.',
	      verdict_label: 'dangerous_overthinking',
	      display_label: 'Fog Machine',
	    });
    expect(adapter.lastGuestInsert()).not.toHaveProperty('input_text');
  });
});

describe('ai-verdict provider failures', () => {
  it('finalizes malformed AI output as failed without consuming quota', async () => {
    const adapter = createAdapter();
    const generateVerdict = jest.fn<Promise<AiVerdictProviderResult>, [AiVerdictGenerationTarget]>(async () => ({
      ok: false,
      code: 'invalid_ai_response',
    }));

    const result = await handleAiVerdictRequest('token', authenticatedPayload(), handlerDeps(adapter, generateVerdict));

    expect(result.status).toBe(502);
    expect(result.body).toEqual({
      ok: false,
      code: 'invalid_ai_response',
      message: 'AI verdict returned an invalid response.',
      access: generatedAccess(),
      localFallback: {
        verdictLabel: 'mild_delusion',
        delusionScore: 61,
        explanationText: 'The local result says this is thin evidence.',
        nextMoveText: 'Wait for a concrete plan.',
        verdictVersion: 1,
      },
    });
    expect(adapter.finalizeUsageFailed).toHaveBeenCalledWith('usage-1', 'invalid_ai_response');
    expect(adapter.insertVerdict).not.toHaveBeenCalled();
  });

  it('handles provider failures and leaves the local fallback available', async () => {
    const adapter = createAdapter();
    const generateVerdict = jest.fn<Promise<AiVerdictProviderResult>, [AiVerdictGenerationTarget]>(async () => ({
      ok: false,
      code: 'ai_failed',
    }));

    const result = await handleAiVerdictRequest('token', authenticatedPayload(), handlerDeps(adapter, generateVerdict));

    expect(result.status).toBe(502);
    expect(result.body.ok).toBe(false);
    if (!result.body.ok) {
      expect(result.body.code).toBe('ai_failed');
      expect(result.body.localFallback?.verdictLabel).toBe('mild_delusion');
    }
    expect(adapter.finalizeUsageFailed).toHaveBeenCalledWith('usage-1', 'ai_failed');
  });

  it('handles provider timeouts distinctly', async () => {
    const adapter = createAdapter();
    const generateVerdict = jest.fn<Promise<AiVerdictProviderResult>, [AiVerdictGenerationTarget]>(async () => ({
      ok: false,
      code: 'ai_timeout',
    }));

    const result = await handleAiVerdictRequest('token', authenticatedPayload(), handlerDeps(adapter, generateVerdict));

    expect(result.status).toBe(504);
    expect(result.body.ok).toBe(false);
    if (!result.body.ok) {
      expect(result.body.code).toBe('ai_timeout');
      expect(result.body.localFallback?.nextMoveText).toBe('Wait for a concrete plan.');
    }
    expect(adapter.finalizeUsageFailed).toHaveBeenCalledWith('usage-1', 'ai_timeout');
  });

  it('fails safely when authenticated cache write fails', async () => {
    const adapter = createAdapter({
      insertVerdict: jest.fn(async () => {
        throw new Error('write failed');
      }),
    });

    const result = await handleAiVerdictRequest('token', authenticatedPayload(), handlerDeps(adapter));

    expect(result.status).toBe(500);
    expect(result.body.ok).toBe(false);
    if (!result.body.ok) {
      expect(result.body.code).toBe('cache_write_failed');
      expect(result.body.localFallback?.delusionScore).toBe(61);
    }
    expect(adapter.finalizeUsageFailed).toHaveBeenCalledWith('usage-1', 'cache_write_failed');
  });
});

describe('Gemini AI verdict provider', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.spyOn(console, 'info').mockImplementation(() => undefined);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('maps malformed provider JSON to invalid_ai_response', async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: '{"verdictLabel":"not_real"}' }],
            },
          },
        ],
      }),
    })) as unknown as typeof fetch;

    const resultPromise = generateAiVerdictWithGemini({ targetType: 'case', row: caseRow() }, 'api-key');
    await jest.runOnlyPendingTimersAsync();
    const result = await resultPromise;

    expect(result).toEqual({
      ok: false,
      code: 'invalid_ai_response',
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(console.info).toHaveBeenCalledWith(
      '[ai-verdict] provider',
      expect.objectContaining({
        event: 'invalid_response',
        reason: 'schema_validation_failed',
        textLength: expect.any(Number),
      }),
    );
  });

  it('retries missing Gemini text once with strict JSON prompt and succeeds', async () => {
    jest.useFakeTimers();
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [] } }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          modelVersion: 'gemini-test-version',
          candidates: [
            {
              finishReason: 'STOP',
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      verdictLabel: 'mild_delusion',
                      delusionScore: 55,
                      displayLabel: 'Thin Plot',
                      explanationText: 'This is thin, but not imaginary.',
                      evidenceCheckText: 'The receipt is a vague maybe, not a plan.',
                      overreadingText: 'You are giving a foggy sentence a full production budget.',
                      whatMattersText: 'A real plan gives you a day and time.',
                      nextMoveText: 'Wait for a real plan before reacting.',
                      verdictVersion: 1,
                    }),
                  },
                ],
              },
            },
          ],
        }),
      }) as unknown as typeof fetch;

    const resultPromise = generateAiVerdictWithGemini({ targetType: 'case', row: caseRow() }, 'api-key');
    await jest.runOnlyPendingTimersAsync();
    const result = await resultPromise;

    expect(result).toEqual({
      ok: true,
      verdict: {
        verdictLabel: 'mild_delusion',
        delusionScore: 55,
        displayLabel: 'Thin Plot',
        explanationText: 'This is thin, but not imaginary.',
        evidenceCheckText: 'The receipt is a vague maybe, not a plan.',
        overreadingText: 'You are giving a foggy sentence a full production budget.',
        whatMattersText: 'A real plan gives you a day and time.',
        nextMoveText: 'Wait for a real plan before reacting.',
        verdictVersion: 1,
      },
      modelVersion: 'gemini-test-version',
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);
    const secondBody = JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body);
    expect(secondBody.contents[0].parts[0].text).toContain('STRICT RETRY MODE');
    expect(secondBody.contents[0].parts[0].text).toContain('If the user was clearly included');
    expect(secondBody.contents[0].parts[0].text).toContain('Bad-input calibration');
    expect(secondBody.contents[0].parts[0].text).toContain('Valid non-English or mixed-language social situations are allowed');
    expect(secondBody.contents[0].parts[0].text).toContain('Response language');
    expect(secondBody.contents[0].parts[0].text).toContain('If the case text is Albanian, answer in Albanian');
    expect(secondBody.contents[0].parts[0].text).toContain('Language matching is a hard requirement');
    expect(secondBody.contents[0].parts[0].text).toContain('do not copy its language when the user');
    expect(secondBody.contents[0].parts[0].text).toContain('never start with "What matters is"');
    expect(secondBody.generationConfig.temperature).toBe(0.8);
    expect(secondBody.generationConfig.maxOutputTokens).toBe(2048);
    expect(secondBody.generationConfig.responseSchema).toBeDefined();
    expect(secondBody.generationConfig.responseJsonSchema).toBeUndefined();
  });

  it('normalizes safe numeric strings and missing verdictVersion from Gemini JSON', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        modelVersion: 'gemini-test-version',
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    verdictLabel: 'slight_reach',
                    delusionScore: '34',
                    displayLabel: 'Tiny Reach',
                    explanationText: 'There is a signal, just not a full case.',
                    evidenceCheckText: 'The signal exists, but it is still not a real ask.',
                    overreadingText: 'You are trying to make a maybe clock in as proof.',
                    whatMattersText: 'The next real evidence is whether they make a plan.',
                    nextMoveText: 'Ask once, then let the answer be the answer.',
                  }),
                },
              ],
            },
          },
        ],
      }),
    })) as unknown as typeof fetch;

    const result = await generateAiVerdictWithGemini({ targetType: 'case', row: caseRow() }, 'api-key');

    expect(result).toEqual({
      ok: true,
      verdict: {
        verdictLabel: 'slight_reach',
        delusionScore: 34,
        displayLabel: 'Tiny Reach',
        explanationText: 'There is a signal, just not a full case.',
        evidenceCheckText: 'The signal exists, but it is still not a real ask.',
        overreadingText: 'You are trying to make a maybe clock in as proof.',
        whatMattersText: 'The next real evidence is whether they make a plan.',
        nextMoveText: 'Ask once, then let the answer be the answer.',
        verdictVersion: 1,
      },
      modelVersion: 'gemini-test-version',
    });
  });

  it('strips markdown markers and banned What Matters opener from Gemini text fields', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        modelVersion: 'gemini-test-version',
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    verdictLabel: 'slight_reach',
                    delusionScore: 34,
                    displayLabel: '`Tiny` *Reach*',
                    explanationText: 'This is *friendly*, not a proposal in a trench coat.',
                    evidenceCheckText: 'The receipt is `banter`, not a signed confession.',
                    overreadingText: 'You are turning _laughing_ into a rom-com trailer.',
                    whatMattersText: 'What matters is the actual ask, not sparkle-font eye contact.',
                    nextMoveText: 'Ask once for a low-stakes plan, then stop doing screenplay math.',
                    verdictVersion: 1,
                  }),
                },
              ],
            },
          },
        ],
      }),
    })) as unknown as typeof fetch;

    const result = await generateAiVerdictWithGemini({ targetType: 'case', row: caseRow() }, 'api-key');

    expect(result).toEqual({
      ok: true,
      verdict: {
        verdictLabel: 'slight_reach',
        delusionScore: 34,
        displayLabel: 'Tiny Reach',
        explanationText: 'This is friendly, not a proposal in a trench coat.',
        evidenceCheckText: 'The receipt is banter, not a signed confession.',
        overreadingText: 'You are turning laughing into a rom-com trailer.',
        whatMattersText: 'the actual ask, not sparkle-font eye contact.',
        nextMoveText: 'Ask once for a low-stakes plan, then stop doing screenplay math.',
        verdictVersion: 1,
      },
      modelVersion: 'gemini-test-version',
    });
  });

  it('rejects Gemini scores and verdict labels that do not match calibration', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        modelVersion: 'gemini-test-version',
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    verdictLabel: 'full_clown_territory',
                    delusionScore: 55,
                    displayLabel: 'Clown Emergency',
                    explanationText: 'This is thin, but not a full clown case.',
                    evidenceCheckText: 'The receipt is weak but not fantasy-only.',
                    overreadingText: 'You are adding more plot than the evidence can hold.',
                    whatMattersText: 'The next evidence is whether they make a real plan.',
                    nextMoveText: 'Wait for a real plan before reacting.',
                    verdictVersion: 1,
                  }),
                },
              ],
            },
          },
        ],
      }),
    })) as unknown as typeof fetch;

    const result = await generateAiVerdictWithGemini({ targetType: 'case', row: caseRow() }, 'api-key');

    expect(result).toEqual({
      ok: false,
      code: 'invalid_ai_response',
    });
  });

  it('maps provider busy responses to ai_failed', async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 503,
      text: async () => '{"error":{"status":"UNAVAILABLE","message":"temporarily overloaded"}}',
    })) as unknown as typeof fetch;

    const resultPromise = generateAiVerdictWithGemini({ targetType: 'case', row: caseRow() }, 'api-key');
    await jest.runOnlyPendingTimersAsync();
    const result = await resultPromise;

    expect(result).toEqual({
      ok: false,
      code: 'ai_failed',
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
