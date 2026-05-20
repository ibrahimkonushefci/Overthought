type CaseCategory = 'romance' | 'friendship' | 'social' | 'general';
type VerdictLabel =
  | 'barely_delusional'
  | 'slight_reach'
  | 'mild_delusion'
  | 'dangerous_overthinking'
  | 'full_clown_territory';
type AiVerdictAccessTier = 'guest' | 'free' | 'premium';
type AiVerdictQuotaScope = 'daily' | 'lifetime';
type AiVerdictAccessReason =
  | 'guest_lifetime_limit'
  | 'daily_limit'
  | 'fair_use'
  | 'global_daily_cap'
  | 'ip_daily_cap';
type AiVerdictFailureCode =
  | 'not_authenticated'
  | 'case_not_found'
  | 'guest_key_required'
  | 'global_daily_cap_exceeded'
  | 'ip_daily_cap_exceeded'
  | 'quota_exceeded'
  | 'fair_use_exceeded'
  | 'ai_timeout'
  | 'ai_failed'
  | 'invalid_ai_response'
  | 'cache_write_failed'
  | 'unknown';

export type AiVerdictRequest =
  | {
      target?: {
        targetType?: 'case';
        caseId?: string;
      };
    }
  | {
      guestKey?: string;
      target?: {
        targetType?: 'guest_case';
        guestCaseId?: string;
        category?: CaseCategory;
        inputText?: string;
        localVerdictLabel?: VerdictLabel;
        localDelusionScore?: number;
        localExplanationText?: string;
        localNextMoveText?: string;
        localVerdictVersion?: number;
      };
    };

export interface CaseRow {
  id: string;
  user_id: string;
  category: CaseCategory;
  input_text: string;
  verdict_label: VerdictLabel;
  delusion_score: number;
  explanation_text: string;
  next_move_text: string;
  latest_verdict_version: number;
  archived_at: string | null;
  deleted_at: string | null;
}

export interface GuestCaseSnapshot {
  guestCaseId: string;
  category: CaseCategory;
  inputText: string;
  localVerdictLabel: VerdictLabel;
  localDelusionScore: number;
  localExplanationText: string;
  localNextMoveText: string;
  localVerdictVersion: number;
}

export type AiVerdictGenerationTarget =
  | { targetType: 'case'; row: CaseRow }
  | { targetType: 'guest_case'; snapshot: GuestCaseSnapshot };

export interface AiVerdictOutput {
  verdictLabel: VerdictLabel;
  delusionScore: number;
  explanationText: string;
  nextMoveText: string;
  verdictVersion: number;
}

export interface AiVerdictStoredRow {
  id: string;
  target_fingerprint: string;
  verdict_label: VerdictLabel;
  delusion_score: number;
  explanation_text: string;
  next_move_text: string;
  verdict_version: number;
  local_verdict_label: VerdictLabel;
  local_delusion_score: number;
  local_explanation_text: string;
  local_next_move_text: string;
  local_verdict_version: number;
  model_provider: string;
  model_name: string;
  model_version: string | null;
  prompt_version: number;
  response_schema_version: number;
  created_at: string;
}

export interface InsertAuthenticatedAiVerdictInput {
  user_id: string;
  case_id: string;
  target_fingerprint: string;
  category: CaseCategory;
  local_verdict_label: VerdictLabel;
  local_delusion_score: number;
  local_explanation_text: string;
  local_next_move_text: string;
  local_verdict_version: number;
  verdict_label: VerdictLabel;
  delusion_score: number;
  explanation_text: string;
  next_move_text: string;
  verdict_version: number;
  model_provider: string;
  model_name: string;
  model_version: string | null;
  prompt_version: number;
  response_schema_version: number;
}

export interface InsertGuestAiVerdictInput extends Omit<InsertAuthenticatedAiVerdictInput, 'user_id' | 'case_id'> {
  guest_key_hash: string;
}

export interface AiVerdictProviderSuccess {
  ok: true;
  verdict: AiVerdictOutput;
  modelVersion: string | null;
}

export interface AiVerdictProviderFailure {
  ok: false;
  code: Extract<AiVerdictFailureCode, 'ai_timeout' | 'ai_failed' | 'invalid_ai_response'>;
}

export type AiVerdictProviderResult = AiVerdictProviderSuccess | AiVerdictProviderFailure;

export interface AiVerdictAccessState {
  accessTier: AiVerdictAccessTier;
  allowed: boolean;
  used: number;
  remaining: number;
  limit: number;
  quotaScope: AiVerdictQuotaScope;
  quotaBucket: string | null;
  reason?: AiVerdictAccessReason;
}

export interface AiVerdictCacheLookupInput {
  userId: string;
  caseId: string;
  targetFingerprint: string;
  modelProvider: string;
  modelName: string;
  promptVersion: number;
  responseSchemaVersion: number;
}

export interface GuestAiVerdictCacheLookupInput {
  guestKeyHash: string;
  targetFingerprint: string;
  modelProvider: string;
  modelName: string;
  promptVersion: number;
  responseSchemaVersion: number;
}

export interface AiVerdictUsageReservationInput {
  userId?: string;
  guestKeyHash?: string;
  ipHash?: string | null;
  accessTier: AiVerdictAccessTier;
  targetFingerprint: string;
  quotaBucket: string;
  primaryLimit: number;
  guestLifetimeLimit: number;
  guestDailyLimit: number;
  ipDailyLimit: number;
  globalDailyLimit: number;
  nowIso: string;
}

export type AiVerdictUsageReservationResult =
  | {
      ok: true;
      usageEventId: string;
      access: AiVerdictAccessState;
    }
  | {
      ok: false;
      code: Extract<
        AiVerdictFailureCode,
        'quota_exceeded' | 'fair_use_exceeded' | 'global_daily_cap_exceeded' | 'ip_daily_cap_exceeded'
      >;
      access: AiVerdictAccessState;
    };

export interface AiVerdictDataAdapter {
  authenticate: (token: string) => Promise<string | null>;
  getAuthenticatedAccessTier: (userId: string) => Promise<Extract<AiVerdictAccessTier, 'free' | 'premium'>>;
  getOwnedActiveCase: (userId: string, caseId: string) => Promise<CaseRow | null>;
  getCachedVerdict: (input: AiVerdictCacheLookupInput) => Promise<AiVerdictStoredRow | null>;
  getCachedGuestVerdict: (input: GuestAiVerdictCacheLookupInput) => Promise<AiVerdictStoredRow | null>;
  getUsageAccess: (input: {
    userId?: string;
    guestKeyHash?: string;
    accessTier: AiVerdictAccessTier;
    quotaBucket: string;
    quotaScope: AiVerdictQuotaScope;
    limit: number;
  }) => Promise<AiVerdictAccessState>;
  reserveUsage: (input: AiVerdictUsageReservationInput) => Promise<AiVerdictUsageReservationResult>;
  finalizeUsageSucceeded: (input: {
    usageEventId: string;
    aiCaseVerdictId?: string;
    aiGuestCaseVerdictId?: string;
  }) => Promise<void>;
  finalizeUsageFailed: (usageEventId: string, failureCode: AiVerdictFailureCode) => Promise<void>;
  insertVerdict: (input: InsertAuthenticatedAiVerdictInput) => Promise<AiVerdictStoredRow>;
  insertGuestVerdict: (input: InsertGuestAiVerdictInput) => Promise<AiVerdictStoredRow>;
  isUniqueViolation: (error: unknown) => boolean;
}

export interface AiVerdictHandlerDeps {
  data: AiVerdictDataAdapter;
  generateVerdict: (target: AiVerdictGenerationTarget) => Promise<AiVerdictProviderResult>;
  now?: () => Date;
  hash?: (value: string) => Promise<string>;
  modelProvider?: string;
  modelName?: string;
  promptVersion?: number;
  responseSchemaVersion?: number;
  signedInFreeDailyLimit?: number;
  premiumDailyLimit?: number;
  guestLifetimeLimit?: number;
  guestDailyLimit?: number;
  guestIpDailyLimit?: number;
  globalDailyLimit?: number;
}

export interface AiVerdictHttpResult {
  status: number;
  body: AiVerdictResponse;
}

type AiVerdictResponse =
  | {
      ok: true;
      verdict: AiVerdictOutput & { source: 'ai' };
      localFallback: AiVerdictOutput;
      cache: {
        id: string;
        source: 'cache' | 'generated';
        targetFingerprint: string;
        modelProvider: string;
        modelName: string;
        modelVersion: string | null;
        promptVersion: number;
        responseSchemaVersion: number;
        createdAt: string;
      };
      access: AiVerdictAccessState;
    }
  | {
      ok: false;
      code: AiVerdictFailureCode;
      message: string;
      access?: AiVerdictAccessState;
      localFallback?: AiVerdictOutput;
    };

const MODEL_PROVIDER = 'gemini';
const MODEL_NAME = 'gemini-2.5-flash';
const PROMPT_VERSION = 1;
const RESPONSE_SCHEMA_VERSION = 1;
const SIGNED_IN_FREE_DAILY_LIMIT = 2;
const GUEST_LIFETIME_LIMIT = 2;
const GUEST_DAILY_LIMIT = 2;
const GUEST_IP_DAILY_LIMIT = 10;
const GLOBAL_DAILY_LIMIT = 100;
const GEMINI_TIMEOUT_MS = 12_000;
const GEMINI_MAX_ATTEMPTS = 2;
const GEMINI_RETRY_DELAY_MS = 750;
const GUEST_KEY_MIN_LENGTH = 16;
const GUEST_KEY_MAX_LENGTH = 256;
const VERDICT_LABELS = new Set<VerdictLabel>([
  'barely_delusional',
  'slight_reach',
  'mild_delusion',
  'dangerous_overthinking',
  'full_clown_territory',
]);
const CATEGORIES = new Set<CaseCategory>(['romance', 'friendship', 'social', 'general']);
const AI_VERDICT_FIELD_LIMITS = {
  explanationText: 260,
  nextMoveText: 170,
} as const;

function failure(
  status: number,
  code: AiVerdictFailureCode,
  message: string,
  localFallback?: AiVerdictOutput,
  access?: AiVerdictAccessState,
): AiVerdictHttpResult {
  return {
    status,
    body: {
      ok: false,
      code,
      message,
      ...(access ? { access } : {}),
      ...(localFallback ? { localFallback } : {}),
    },
  };
}

function todayUtcBucket(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function normalizeInputText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function canonicalJson(value: Record<string, unknown>): string {
  return JSON.stringify(
    Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = value[key];
        return result;
      }, {}),
  );
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);

  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function fingerprintCase(row: CaseRow, hash = sha256Hex): Promise<string> {
  return hash(
    canonicalJson({
      category: row.category,
      inputText: normalizeInputText(row.input_text),
      localDelusionScore: row.delusion_score,
      localVerdictLabel: row.verdict_label,
      localVerdictVersion: row.latest_verdict_version,
      targetType: 'case',
    }),
  );
}

export async function fingerprintGuestCase(snapshot: GuestCaseSnapshot, hash = sha256Hex): Promise<string> {
  return hash(
    canonicalJson({
      category: snapshot.category,
      inputText: normalizeInputText(snapshot.inputText),
      localDelusionScore: snapshot.localDelusionScore,
      localVerdictLabel: snapshot.localVerdictLabel,
      localVerdictVersion: snapshot.localVerdictVersion,
      targetType: 'guest_case',
    }),
  );
}

function localFallbackFromCase(row: CaseRow): AiVerdictOutput {
  return {
    verdictLabel: row.verdict_label,
    delusionScore: row.delusion_score,
    explanationText: row.explanation_text,
    nextMoveText: row.next_move_text,
    verdictVersion: row.latest_verdict_version,
  };
}

function localFallbackFromGuest(snapshot: GuestCaseSnapshot): AiVerdictOutput {
  return {
    verdictLabel: snapshot.localVerdictLabel,
    delusionScore: snapshot.localDelusionScore,
    explanationText: snapshot.localExplanationText,
    nextMoveText: snapshot.localNextMoveText,
    verdictVersion: snapshot.localVerdictVersion,
  };
}

function responseFromRow(
  row: AiVerdictStoredRow,
  source: 'cache' | 'generated',
  localFallback: AiVerdictOutput,
  access: AiVerdictAccessState,
): AiVerdictHttpResult {
  return {
    status: 200,
    body: {
      ok: true,
      verdict: {
        verdictLabel: row.verdict_label,
        delusionScore: row.delusion_score,
        explanationText: row.explanation_text,
        nextMoveText: row.next_move_text,
        verdictVersion: row.verdict_version,
        source: 'ai',
      },
      localFallback,
      cache: {
        id: row.id,
        source,
        targetFingerprint: row.target_fingerprint,
        modelProvider: row.model_provider,
        modelName: row.model_name,
        modelVersion: row.model_version,
        promptVersion: row.prompt_version,
        responseSchemaVersion: row.response_schema_version,
        createdAt: row.created_at,
      },
      access,
    },
  };
}

function statusForFailure(code: AiVerdictFailureCode): number {
  switch (code) {
    case 'not_authenticated':
      return 401;
    case 'case_not_found':
      return 404;
    case 'guest_key_required':
      return 400;
    case 'quota_exceeded':
    case 'fair_use_exceeded':
    case 'global_daily_cap_exceeded':
    case 'ip_daily_cap_exceeded':
      return 429;
    case 'ai_timeout':
      return 504;
    case 'invalid_ai_response':
    case 'ai_failed':
      return 502;
    case 'cache_write_failed':
    case 'unknown':
    default:
      return 500;
  }
}

function messageForFailure(code: AiVerdictFailureCode): string {
  switch (code) {
    case 'not_authenticated':
      return 'Sign in to use AI verdicts.';
    case 'case_not_found':
      return 'Case not found.';
    case 'guest_key_required':
      return 'Guest AI verdicts need a valid guest key.';
    case 'quota_exceeded':
      return 'Free AI verdicts are used up.';
    case 'fair_use_exceeded':
      return 'AI verdicts are temporarily limited for fair use.';
    case 'global_daily_cap_exceeded':
      return 'AI verdicts are temporarily limited today.';
    case 'ip_daily_cap_exceeded':
      return 'AI verdicts are temporarily limited on this network.';
    case 'ai_timeout':
      return 'AI verdict timed out. Try again.';
    case 'invalid_ai_response':
      return 'AI verdict returned an invalid response.';
    case 'cache_write_failed':
      return 'Unable to cache AI verdict right now.';
    case 'ai_failed':
    case 'unknown':
    default:
      return 'AI verdict is unavailable right now.';
  }
}

function isValidGuestKey(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length >= GUEST_KEY_MIN_LENGTH &&
    value.trim().length <= GUEST_KEY_MAX_LENGTH &&
    /^[A-Za-z0-9:_-]+$/.test(value.trim())
  );
}

function isValidGuestSnapshot(value: unknown): value is GuestCaseSnapshot {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const snapshot = value as Record<string, unknown>;

  return (
    snapshot.targetType === 'guest_case' &&
    typeof snapshot.guestCaseId === 'string' &&
    snapshot.guestCaseId.trim().length > 0 &&
    typeof snapshot.category === 'string' &&
    CATEGORIES.has(snapshot.category as CaseCategory) &&
    typeof snapshot.inputText === 'string' &&
    snapshot.inputText.trim().length > 0 &&
    typeof snapshot.localVerdictLabel === 'string' &&
    VERDICT_LABELS.has(snapshot.localVerdictLabel as VerdictLabel) &&
    Number.isInteger(snapshot.localDelusionScore) &&
    Number(snapshot.localDelusionScore) >= 0 &&
    Number(snapshot.localDelusionScore) <= 100 &&
    typeof snapshot.localExplanationText === 'string' &&
    snapshot.localExplanationText.trim().length > 0 &&
    typeof snapshot.localNextMoveText === 'string' &&
    snapshot.localNextMoveText.trim().length > 0 &&
    Number.isInteger(snapshot.localVerdictVersion) &&
    Number(snapshot.localVerdictVersion) >= 1
  );
}

function reservationFailureCode(reason?: AiVerdictAccessReason): Extract<
  AiVerdictFailureCode,
  'quota_exceeded' | 'fair_use_exceeded' | 'global_daily_cap_exceeded' | 'ip_daily_cap_exceeded'
> {
  if (reason === 'global_daily_cap') {
    return 'global_daily_cap_exceeded';
  }

  if (reason === 'ip_daily_cap') {
    return 'ip_daily_cap_exceeded';
  }

  if (reason === 'fair_use') {
    return 'fair_use_exceeded';
  }

  return 'quota_exceeded';
}

async function handleAuthenticatedRequest(
  token: string,
  payload: AiVerdictRequest,
  deps: Required<Pick<AiVerdictHandlerDeps, 'data' | 'generateVerdict'>> &
    Omit<AiVerdictHandlerDeps, 'data' | 'generateVerdict'>,
  runtime: {
    now: Date;
    nowIso: string;
    quotaBucket: string;
    modelProvider: string;
    modelName: string;
    promptVersion: number;
    responseSchemaVersion: number;
    signedInFreeDailyLimit: number;
    premiumDailyLimit: number;
    guestLifetimeLimit: number;
    guestDailyLimit: number;
    guestIpDailyLimit: number;
    globalDailyLimit: number;
    hash: (value: string) => Promise<string>;
  },
): Promise<AiVerdictHttpResult> {
  const request = payload as Extract<AiVerdictRequest, { target?: { targetType?: 'case' } }>;
  const caseId = request?.target?.targetType === 'case' ? request.target.caseId?.trim() : '';

  if (!caseId) {
    return failure(400, 'case_not_found', messageForFailure('case_not_found'));
  }

  const userId = await deps.data.authenticate(token);

  if (!userId) {
    return failure(401, 'not_authenticated', 'Invalid auth token.');
  }

  let usageEventId: string | null = null;

  try {
    const caseRow = await deps.data.getOwnedActiveCase(userId, caseId);

    if (!caseRow) {
      return failure(404, 'case_not_found', messageForFailure('case_not_found'));
    }

    const localFallback = localFallbackFromCase(caseRow);
    const targetFingerprint = await fingerprintCase(caseRow, runtime.hash);
    const accessTier = await deps.data.getAuthenticatedAccessTier(userId);
    const primaryLimit = accessTier === 'premium' ? runtime.premiumDailyLimit : runtime.signedInFreeDailyLimit;
    const lookupInput: AiVerdictCacheLookupInput = {
      userId,
      caseId: caseRow.id,
      targetFingerprint,
      modelProvider: runtime.modelProvider,
      modelName: runtime.modelName,
      promptVersion: runtime.promptVersion,
      responseSchemaVersion: runtime.responseSchemaVersion,
    };

    const cached = await deps.data.getCachedVerdict(lookupInput);

    if (cached) {
      const access = await deps.data.getUsageAccess({
        userId,
        accessTier,
        quotaBucket: runtime.quotaBucket,
        quotaScope: 'daily',
        limit: primaryLimit,
      });
      return responseFromRow(cached, 'cache', localFallback, access);
    }

    const reservation = await deps.data.reserveUsage({
      userId,
      accessTier,
      targetFingerprint,
      quotaBucket: runtime.quotaBucket,
      primaryLimit,
      guestLifetimeLimit: runtime.guestLifetimeLimit,
      guestDailyLimit: runtime.guestDailyLimit,
      ipDailyLimit: runtime.guestIpDailyLimit,
      globalDailyLimit: runtime.globalDailyLimit,
      nowIso: runtime.nowIso,
    });

    if (!reservation.ok) {
      return failure(
        statusForFailure(reservation.code),
        reservation.code,
        messageForFailure(reservation.code),
        localFallback,
        reservation.access,
      );
    }

    usageEventId = reservation.usageEventId;
    const providerResult = await deps.generateVerdict({ targetType: 'case', row: caseRow });

    if (!providerResult.ok) {
      await deps.data.finalizeUsageFailed(usageEventId, providerResult.code);
      return failure(
        statusForFailure(providerResult.code),
        providerResult.code,
        messageForFailure(providerResult.code),
        localFallback,
        reservation.access,
      );
    }

    let inserted: AiVerdictStoredRow;

    try {
      inserted = await deps.data.insertVerdict({
        user_id: userId,
        case_id: caseRow.id,
        target_fingerprint: targetFingerprint,
        category: caseRow.category,
        local_verdict_label: caseRow.verdict_label,
        local_delusion_score: caseRow.delusion_score,
        local_explanation_text: caseRow.explanation_text,
        local_next_move_text: caseRow.next_move_text,
        local_verdict_version: caseRow.latest_verdict_version,
        verdict_label: providerResult.verdict.verdictLabel,
        delusion_score: providerResult.verdict.delusionScore,
        explanation_text: providerResult.verdict.explanationText,
        next_move_text: providerResult.verdict.nextMoveText,
        verdict_version: providerResult.verdict.verdictVersion,
        model_provider: runtime.modelProvider,
        model_name: runtime.modelName,
        model_version: providerResult.modelVersion,
        prompt_version: runtime.promptVersion,
        response_schema_version: runtime.responseSchemaVersion,
      });
    } catch (error) {
      if (deps.data.isUniqueViolation(error)) {
        const racedCache = await deps.data.getCachedVerdict(lookupInput);

        if (racedCache) {
          await deps.data.finalizeUsageSucceeded({ usageEventId, aiCaseVerdictId: racedCache.id });
          return responseFromRow(racedCache, 'cache', localFallback, reservation.access);
        }
      }

      await deps.data.finalizeUsageFailed(usageEventId, 'cache_write_failed');
      return failure(500, 'cache_write_failed', messageForFailure('cache_write_failed'), localFallback);
    }

    await deps.data.finalizeUsageSucceeded({ usageEventId, aiCaseVerdictId: inserted.id });
    return responseFromRow(inserted, 'generated', localFallback, reservation.access);
  } catch {
    if (usageEventId) {
      await deps.data.finalizeUsageFailed(usageEventId, 'unknown').catch(() => undefined);
    }

    return failure(500, 'unknown', messageForFailure('unknown'));
  }
}

async function handleGuestRequest(
  payload: AiVerdictRequest,
  ipHash: string | null,
  deps: Required<Pick<AiVerdictHandlerDeps, 'data' | 'generateVerdict'>> &
    Omit<AiVerdictHandlerDeps, 'data' | 'generateVerdict'>,
  runtime: {
    now: Date;
    nowIso: string;
    quotaBucket: string;
    modelProvider: string;
    modelName: string;
    promptVersion: number;
    responseSchemaVersion: number;
    signedInFreeDailyLimit: number;
    premiumDailyLimit: number;
    guestLifetimeLimit: number;
    guestDailyLimit: number;
    guestIpDailyLimit: number;
    globalDailyLimit: number;
    hash: (value: string) => Promise<string>;
  },
): Promise<AiVerdictHttpResult> {
  const request = payload as Extract<AiVerdictRequest, { guestKey?: string }>;

  if (!isValidGuestKey(request.guestKey)) {
    return failure(400, 'guest_key_required', messageForFailure('guest_key_required'));
  }

  if (!isValidGuestSnapshot(request.target)) {
    return failure(400, 'case_not_found', messageForFailure('case_not_found'));
  }

  const snapshot: GuestCaseSnapshot = {
    guestCaseId: request.target.guestCaseId.trim(),
    category: request.target.category,
    inputText: request.target.inputText,
    localVerdictLabel: request.target.localVerdictLabel,
    localDelusionScore: request.target.localDelusionScore,
    localExplanationText: request.target.localExplanationText,
    localNextMoveText: request.target.localNextMoveText,
    localVerdictVersion: request.target.localVerdictVersion,
  };
  const guestKeyHash = await runtime.hash(`guest-key:${request.guestKey.trim()}`);
  const targetFingerprint = await fingerprintGuestCase(snapshot, runtime.hash);
  const localFallback = localFallbackFromGuest(snapshot);
  const lookupInput: GuestAiVerdictCacheLookupInput = {
    guestKeyHash,
    targetFingerprint,
    modelProvider: runtime.modelProvider,
    modelName: runtime.modelName,
    promptVersion: runtime.promptVersion,
    responseSchemaVersion: runtime.responseSchemaVersion,
  };
  let usageEventId: string | null = null;

  try {
    const cached = await deps.data.getCachedGuestVerdict(lookupInput);

    if (cached) {
      const access = await deps.data.getUsageAccess({
        guestKeyHash,
        accessTier: 'guest',
        quotaBucket: runtime.quotaBucket,
        quotaScope: 'lifetime',
        limit: runtime.guestLifetimeLimit,
      });
      return responseFromRow(cached, 'cache', localFallback, access);
    }

    const reservation = await deps.data.reserveUsage({
      guestKeyHash,
      ipHash,
      accessTier: 'guest',
      targetFingerprint,
      quotaBucket: runtime.quotaBucket,
      primaryLimit: runtime.guestLifetimeLimit,
      guestLifetimeLimit: runtime.guestLifetimeLimit,
      guestDailyLimit: runtime.guestDailyLimit,
      ipDailyLimit: runtime.guestIpDailyLimit,
      globalDailyLimit: runtime.globalDailyLimit,
      nowIso: runtime.nowIso,
    });

    if (!reservation.ok) {
      return failure(
        statusForFailure(reservation.code),
        reservation.code,
        messageForFailure(reservation.code),
        localFallback,
        reservation.access,
      );
    }

    usageEventId = reservation.usageEventId;
    const providerResult = await deps.generateVerdict({ targetType: 'guest_case', snapshot });

    if (!providerResult.ok) {
      await deps.data.finalizeUsageFailed(usageEventId, providerResult.code);
      return failure(
        statusForFailure(providerResult.code),
        providerResult.code,
        messageForFailure(providerResult.code),
        localFallback,
        reservation.access,
      );
    }

    let inserted: AiVerdictStoredRow;

    try {
      inserted = await deps.data.insertGuestVerdict({
        guest_key_hash: guestKeyHash,
        target_fingerprint: targetFingerprint,
        category: snapshot.category,
        local_verdict_label: snapshot.localVerdictLabel,
        local_delusion_score: snapshot.localDelusionScore,
        local_explanation_text: snapshot.localExplanationText,
        local_next_move_text: snapshot.localNextMoveText,
        local_verdict_version: snapshot.localVerdictVersion,
        verdict_label: providerResult.verdict.verdictLabel,
        delusion_score: providerResult.verdict.delusionScore,
        explanation_text: providerResult.verdict.explanationText,
        next_move_text: providerResult.verdict.nextMoveText,
        verdict_version: providerResult.verdict.verdictVersion,
        model_provider: runtime.modelProvider,
        model_name: runtime.modelName,
        model_version: providerResult.modelVersion,
        prompt_version: runtime.promptVersion,
        response_schema_version: runtime.responseSchemaVersion,
      });
    } catch (error) {
      if (deps.data.isUniqueViolation(error)) {
        const racedCache = await deps.data.getCachedGuestVerdict(lookupInput);

        if (racedCache) {
          await deps.data.finalizeUsageSucceeded({ usageEventId, aiGuestCaseVerdictId: racedCache.id });
          return responseFromRow(racedCache, 'cache', localFallback, reservation.access);
        }
      }

      await deps.data.finalizeUsageFailed(usageEventId, 'cache_write_failed');
      return failure(500, 'cache_write_failed', messageForFailure('cache_write_failed'), localFallback);
    }

    await deps.data.finalizeUsageSucceeded({ usageEventId, aiGuestCaseVerdictId: inserted.id });
    return responseFromRow(inserted, 'generated', localFallback, reservation.access);
  } catch {
    if (usageEventId) {
      await deps.data.finalizeUsageFailed(usageEventId, 'unknown').catch(() => undefined);
    }

    return failure(500, 'unknown', messageForFailure('unknown'));
  }
}

export async function handleAiVerdictRequest(
  token: string | null,
  payload: unknown,
  deps: AiVerdictHandlerDeps,
  requestMeta: { ipAddress?: string | null } = {},
): Promise<AiVerdictHttpResult> {
  const now = (deps.now ?? (() => new Date()))();
  const hash = deps.hash ?? sha256Hex;
  const runtime = {
    now,
    nowIso: now.toISOString(),
    quotaBucket: todayUtcBucket(now),
    modelProvider: deps.modelProvider ?? MODEL_PROVIDER,
    modelName: deps.modelName ?? MODEL_NAME,
    promptVersion: deps.promptVersion ?? PROMPT_VERSION,
    responseSchemaVersion: deps.responseSchemaVersion ?? RESPONSE_SCHEMA_VERSION,
    signedInFreeDailyLimit: deps.signedInFreeDailyLimit ?? SIGNED_IN_FREE_DAILY_LIMIT,
    premiumDailyLimit: deps.premiumDailyLimit ?? 50,
    guestLifetimeLimit: deps.guestLifetimeLimit ?? GUEST_LIFETIME_LIMIT,
    guestDailyLimit: deps.guestDailyLimit ?? GUEST_DAILY_LIMIT,
    guestIpDailyLimit: deps.guestIpDailyLimit ?? GUEST_IP_DAILY_LIMIT,
    globalDailyLimit: deps.globalDailyLimit ?? GLOBAL_DAILY_LIMIT,
    hash,
  };
  const ipHash = requestMeta.ipAddress ? await hash(`ip:${requestMeta.ipAddress}`) : null;

  if (!payload || typeof payload !== 'object') {
    return failure(400, 'case_not_found', messageForFailure('case_not_found'));
  }

  if (token) {
    return handleAuthenticatedRequest(token, payload as AiVerdictRequest, deps, runtime);
  }

  return handleGuestRequest(payload as AiVerdictRequest, ipHash, deps, runtime);
}

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    finishReason?: string;
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  modelVersion?: string;
}

type GeminiInvalidResponseReason =
  | 'response_json_parse_failed'
  | 'missing_text'
  | 'invalid_json'
  | 'schema_validation_failed';

interface GeminiErrorResponse {
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
}

function logGeminiProviderDiagnostic(
  event: string,
  details: {
    attempt: number;
    maxAttempts: number;
    modelName: string;
    status?: number;
    retrying?: boolean;
    reason?: GeminiInvalidResponseReason;
    finishReason?: string | null;
    candidateCount?: number;
    partCount?: number;
    textLength?: number | null;
    errorCode?: number | null;
    errorStatus?: string | null;
  },
) {
  console.info('[ai-verdict] provider', { event, ...details });
}

function geminiUrl(apiKey: string, modelName = MODEL_NAME): string {
  const url = new URL(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`);
  url.searchParams.set('key', apiKey);
  return url.toString();
}

function wait(milliseconds: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function sanitizeProviderMessage(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const sanitized = value.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  return sanitized ? sanitized.slice(0, 180) : null;
}

async function readGeminiError(response: Response) {
  const body = await response.text();
  const bodyLength = body.length;

  try {
    const parsed = JSON.parse(body) as GeminiErrorResponse;
    return {
      bodyLength,
      errorCode: parsed.error?.code ?? null,
      errorStatus: parsed.error?.status ?? null,
      errorMessage: sanitizeProviderMessage(parsed.error?.message),
    };
  } catch {
    return {
      bodyLength,
      errorCode: null,
      errorStatus: null,
      errorMessage: null,
    };
  }
}

function isTemporaryProviderStatus(status: number, providerErrorStatus: string | null, providerErrorMessage: string | null) {
  if (status === 502 || status === 503 || status === 504) {
    return true;
  }

  if (status !== 429) {
    return false;
  }

  const retryText = `${providerErrorStatus ?? ''} ${providerErrorMessage ?? ''}`.toLowerCase();
  return (
    retryText.includes('temporar') ||
    retryText.includes('retry') ||
    retryText.includes('unavailable') ||
    retryText.includes('overload') ||
    retryText.includes('high demand') ||
    retryText.includes('rate limit')
  );
}

function aiVerdictJsonSchema() {
  const stringField = (description: string) => ({
    type: 'string',
    description,
  });

  return {
    type: 'object',
    properties: {
      verdictLabel: {
        type: 'string',
        enum: [
          'barely_delusional',
          'slight_reach',
          'mild_delusion',
          'dangerous_overthinking',
          'full_clown_territory',
        ],
      },
      delusionScore: {
        type: 'integer',
        minimum: 0,
        maximum: 100,
      },
      explanationText: stringField('A short, concrete, funny-first verdict explanation for the user.'),
      nextMoveText: stringField('One practical next move, written as a direct instruction.'),
      verdictVersion: {
        type: 'integer',
        minimum: 1,
      },
    },
    required: ['verdictLabel', 'delusionScore', 'explanationText', 'nextMoveText', 'verdictVersion'],
    propertyOrdering: ['verdictLabel', 'delusionScore', 'explanationText', 'nextMoveText', 'verdictVersion'],
  };
}

function buildAiVerdictPrompt(target: AiVerdictGenerationTarget, strictJsonOnly = false): string {
  const strictJsonReminder = strictJsonOnly
    ? `
STRICT RETRY MODE:
- Your previous output was not parseable or did not match the schema.
- Return JSON only. Start with "{" and end with "}".`
    : '';
  const caseContext =
    target.targetType === 'case'
      ? {
          category: target.row.category,
          inputText: target.row.input_text,
          localVerdictLabel: target.row.verdict_label,
          localDelusionScore: target.row.delusion_score,
          localExplanationText: target.row.explanation_text,
          localNextMoveText: target.row.next_move_text,
          localVerdictVersion: target.row.latest_verdict_version,
        }
      : {
          category: target.snapshot.category,
          inputText: target.snapshot.inputText,
          localVerdictLabel: target.snapshot.localVerdictLabel,
          localDelusionScore: target.snapshot.localDelusionScore,
          localExplanationText: target.snapshot.localExplanationText,
          localNextMoveText: target.snapshot.localNextMoveText,
          localVerdictVersion: target.snapshot.localVerdictVersion,
        };

  return `You are Overthought's canonical AI verdict generator.

Return exactly one valid JSON object and nothing else.
Use exactly these keys: verdictLabel, delusionScore, explanationText, nextMoveText, verdictVersion.
Do not include markdown, code fences, commentary, or extra keys.${strictJsonReminder}

Verdict labels:
- barely_delusional: 0-20
- slight_reach: 21-40
- mild_delusion: 41-65
- dangerous_overthinking: 66-85
- full_clown_territory: 86-100

Tone:
- funny-first and useful
- concrete, direct, group-chat sharp
- roast the overthinking, not the user's identity or worth
- no slurs, threats, sexual insults, self-harm language, diagnosis language, therapy language, or corporate advice
- no generic AI hedging
- use details from the case

Length:
- explanationText: 1-2 short sentences, max ${AI_VERDICT_FIELD_LIMITS.explanationText} characters
- nextMoveText: one direct next move, max ${AI_VERDICT_FIELD_LIMITS.nextMoveText} characters

Local backup result, for context only. You may disagree, but keep the same output contract:
${JSON.stringify(
  {
    category: caseContext.category,
    localVerdictLabel: caseContext.localVerdictLabel,
    localDelusionScore: caseContext.localDelusionScore,
    localExplanationText: caseContext.localExplanationText,
    localNextMoveText: caseContext.localNextMoveText,
    localVerdictVersion: caseContext.localVerdictVersion,
  },
  null,
  2,
)}

Untrusted case text:
${JSON.stringify(caseContext.inputText)}

Final reminder: return exactly one JSON object matching the schema.`;
}

function extractGeminiText(value: GeminiGenerateContentResponse): string | null {
  return value.candidates?.[0]?.content?.parts?.find((part) => typeof part.text === 'string')?.text ?? null;
}

function parseUnknownJson(value: string): { ok: true; parsed: unknown } | { ok: false } {
  try {
    return { ok: true, parsed: JSON.parse(value) as unknown };
  } catch {
    return { ok: false };
  }
}

function extractJsonObjectText(value: string): string | null {
  const trimmed = value.trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');

  if (start === -1 || end <= start) {
    return null;
  }

  return trimmed.slice(start, end + 1);
}

function sanitizeAiVerdictOutput(value: AiVerdictOutput): AiVerdictOutput {
  return {
    verdictLabel: value.verdictLabel,
    delusionScore: value.delusionScore,
    explanationText: value.explanationText.trim().slice(0, AI_VERDICT_FIELD_LIMITS.explanationText),
    nextMoveText: value.nextMoveText.trim().slice(0, AI_VERDICT_FIELD_LIMITS.nextMoveText),
    verdictVersion: value.verdictVersion,
  };
}

function integerFromUnknown(value: unknown): number | null {
  if (Number.isInteger(value)) {
    return Number(value);
  }

  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) {
    const parsed = Number(value.trim());
    return Number.isInteger(parsed) ? parsed : null;
  }

  return null;
}

function coerceAiVerdictOutput(value: unknown): AiVerdictOutput | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const output = value as Record<string, unknown>;
  const delusionScore = integerFromUnknown(output.delusionScore);
  const verdictVersion = output.verdictVersion === undefined ? 1 : integerFromUnknown(output.verdictVersion);

  if (
    typeof output.verdictLabel !== 'string' ||
    !VERDICT_LABELS.has(output.verdictLabel as VerdictLabel) ||
    delusionScore === null ||
    delusionScore < 0 ||
    delusionScore > 100 ||
    typeof output.explanationText !== 'string' ||
    output.explanationText.trim().length === 0 ||
    typeof output.nextMoveText !== 'string' ||
    output.nextMoveText.trim().length === 0 ||
    verdictVersion === null ||
    verdictVersion < 1
  ) {
    return null;
  }

  return {
    verdictLabel: output.verdictLabel as VerdictLabel,
    delusionScore,
    explanationText: output.explanationText,
    nextMoveText: output.nextMoveText,
    verdictVersion,
  };
}

function isValidAiVerdictOutput(value: unknown): value is AiVerdictOutput {
  return coerceAiVerdictOutput(value) !== null;
}

function parseAiVerdictJson(
  value: string,
): Extract<AiVerdictProviderResult, { ok: true }> | { ok: false; code: 'invalid_ai_response'; reason: GeminiInvalidResponseReason } {
  const trimmed = value.trim();
  const directParse = parseUnknownJson(trimmed);
  let parsed: unknown;

  if (directParse.ok) {
    parsed = directParse.parsed;
  } else {
    const extracted = extractJsonObjectText(trimmed);

    if (!extracted) {
      return { ok: false, code: 'invalid_ai_response', reason: 'invalid_json' };
    }

    const extractedParse = parseUnknownJson(extracted);

    if (!extractedParse.ok) {
      return { ok: false, code: 'invalid_ai_response', reason: 'invalid_json' };
    }

    parsed = extractedParse.parsed;
  }

  const coerced = coerceAiVerdictOutput(parsed);

  if (!coerced) {
    return { ok: false, code: 'invalid_ai_response', reason: 'schema_validation_failed' };
  }

  const sanitized = sanitizeAiVerdictOutput(coerced);

  if (!isValidAiVerdictOutput(sanitized)) {
    return { ok: false, code: 'invalid_ai_response', reason: 'schema_validation_failed' };
  }

  return {
    ok: true,
    verdict: sanitized,
    modelVersion: null,
  };
}

export async function generateAiVerdictWithGemini(
  target: AiVerdictGenerationTarget,
  apiKey: string,
  modelName = MODEL_NAME,
): Promise<AiVerdictProviderResult> {
  if (!apiKey.trim()) {
    return { ok: false, code: 'ai_failed' };
  }

  for (let attempt = 1; attempt <= GEMINI_MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
    const strictJsonOnly = attempt > 1;
    const retryInvalidResponse = async (
      reason: GeminiInvalidResponseReason,
      metadata: {
        finishReason?: string | null;
        candidateCount?: number;
        partCount?: number;
        textLength?: number | null;
      } = {},
    ): Promise<AiVerdictProviderResult | null> => {
      const retrying = attempt < GEMINI_MAX_ATTEMPTS;

      logGeminiProviderDiagnostic('invalid_response', {
        attempt,
        maxAttempts: GEMINI_MAX_ATTEMPTS,
        modelName,
        reason,
        retrying,
        ...metadata,
      });

      if (retrying) {
        clearTimeout(timeout);
        await wait(GEMINI_RETRY_DELAY_MS);
        return null;
      }

      return { ok: false, code: 'invalid_ai_response' };
    };

    try {
      const response = await fetch(geminiUrl(apiKey, modelName), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: buildAiVerdictPrompt(target, strictJsonOnly) }],
            },
          ],
          generationConfig: {
            temperature: 0.55,
            topP: 0.9,
            maxOutputTokens: 2048,
            responseMimeType: 'application/json',
            responseSchema: aiVerdictJsonSchema(),
          },
        }),
      });

      if (!response.ok) {
        const providerError = await readGeminiError(response);
        const retryable = isTemporaryProviderStatus(
          response.status,
          providerError.errorStatus,
          providerError.errorMessage,
        );

        if (retryable && attempt < GEMINI_MAX_ATTEMPTS) {
          logGeminiProviderDiagnostic('http_retry', {
            attempt,
            maxAttempts: GEMINI_MAX_ATTEMPTS,
            modelName,
            status: response.status,
            errorCode: providerError.errorCode,
            errorStatus: providerError.errorStatus,
            retrying: true,
          });
          clearTimeout(timeout);
          await wait(GEMINI_RETRY_DELAY_MS);
          continue;
        }

        return { ok: false, code: 'ai_failed' };
      }

      let responseJson: GeminiGenerateContentResponse;

      try {
        responseJson = (await response.json()) as GeminiGenerateContentResponse;
      } catch {
        const retryResult = await retryInvalidResponse('response_json_parse_failed');

        if (retryResult === null) {
          continue;
        }

        return retryResult;
      }

      const firstCandidate = responseJson.candidates?.[0];
      const text = extractGeminiText(responseJson);
      const candidateCount = responseJson.candidates?.length ?? 0;
      const partCount = firstCandidate?.content?.parts?.length ?? 0;

      if (!text) {
        const retryResult = await retryInvalidResponse('missing_text', {
          finishReason: firstCandidate?.finishReason ?? null,
          candidateCount,
          partCount,
          textLength: null,
        });

        if (retryResult === null) {
          continue;
        }

        return retryResult;
      }

      const parsed = parseAiVerdictJson(text);

      if (!parsed.ok) {
        const retryResult = await retryInvalidResponse(parsed.reason, {
          finishReason: firstCandidate?.finishReason ?? null,
          candidateCount,
          partCount,
          textLength: text.length,
        });

        if (retryResult === null) {
          continue;
        }

        return retryResult;
      }

      return {
        ok: true,
        verdict: parsed.verdict,
        modelVersion: typeof responseJson.modelVersion === 'string' ? responseJson.modelVersion : null,
      };
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return { ok: false, code: 'ai_timeout' };
      }

      if (attempt < GEMINI_MAX_ATTEMPTS) {
        clearTimeout(timeout);
        await wait(GEMINI_RETRY_DELAY_MS);
        continue;
      }

      return { ok: false, code: 'ai_failed' };
    } finally {
      clearTimeout(timeout);
    }
  }

  return { ok: false, code: 'ai_failed' };
}
