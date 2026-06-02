import { env, hasSupabaseEnv } from '../../lib/env';
import { supabase } from '../../lib/supabase/client';
import { useAiVerdictStore } from '../../store/aiVerdictStore';
import { useAuthStore } from '../../store/authStore';
import { useGuestStore } from '../../store/guestStore';
import { nowIso } from '../../shared/utils/date';
import type {
  AiVerdictAccessState,
  AiVerdictCacheMetadata,
  AiVerdictFailureCode,
  AiVerdictOutput,
  AiVerdictRequest,
  AiVerdictRequestState,
  AiVerdictRequestStatus,
  AiVerdictResponse,
  AnalysisOutput,
  CaseAiVerdictSnapshot,
  VerdictLabel,
} from '../../types/shared';
import type { CaseEntity } from '../cases/types';
import { getCaseId, isGuestCase } from '../cases/types';

interface StoredAiVerdictRow {
  id: string;
  target_fingerprint: string;
  verdict_label: VerdictLabel;
  delusion_score: number;
  display_label: string | null;
  explanation_text: string;
  evidence_check_text: string | null;
  overreading_text: string | null;
  what_matters_text: string | null;
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

const aiVerdictFailureCodes = new Set<AiVerdictFailureCode>([
  'not_authenticated',
  'case_not_found',
  'guest_key_required',
  'global_daily_cap_exceeded',
  'ip_daily_cap_exceeded',
  'quota_exceeded',
  'fair_use_exceeded',
  'ai_timeout',
  'ai_failed',
  'invalid_ai_response',
  'cache_write_failed',
  'unknown',
]);

const verdictLabels = new Set<VerdictLabel>([
  'barely_delusional',
  'slight_reach',
  'mild_delusion',
  'dangerous_overthinking',
  'full_clown_territory',
]);

function failure(code: AiVerdictFailureCode, message: string): Extract<AiVerdictResponse, { ok: false }> {
  return {
    ok: false,
    code,
    message,
  };
}

function safeUnavailableFailure(): Extract<AiVerdictResponse, { ok: false }> {
  return failure('unknown', 'Smart Verdict is unavailable right now.');
}

const AI_VERDICT_CLIENT_TIMEOUT_MS = 30_000;

function isAbortError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && (error as { name?: unknown }).name === 'AbortError');
}

function isAnalysisOutput(value: unknown): value is AnalysisOutput {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const output = value as Record<string, unknown>;

  return (
    typeof output.verdictLabel === 'string' &&
    verdictLabels.has(output.verdictLabel as VerdictLabel) &&
    Number.isInteger(output.delusionScore) &&
    Number(output.delusionScore) >= 0 &&
    Number(output.delusionScore) <= 100 &&
    typeof output.explanationText === 'string' &&
    output.explanationText.trim().length > 0 &&
    typeof output.nextMoveText === 'string' &&
    output.nextMoveText.trim().length > 0 &&
    Number.isInteger(output.verdictVersion) &&
    Number(output.verdictVersion) >= 1
  );
}

function isAiVerdictOutput(value: unknown): value is AiVerdictOutput {
  if (!isAnalysisOutput(value) || (value as { source?: unknown }).source !== 'ai') {
    return false;
  }

  const output = value as Partial<AiVerdictOutput>;

  return (
    typeof output.displayLabel === 'string' &&
    output.displayLabel.trim().length > 0 &&
    typeof output.evidenceCheckText === 'string' &&
    output.evidenceCheckText.trim().length > 0 &&
    typeof output.overreadingText === 'string' &&
    output.overreadingText.trim().length > 0 &&
    typeof output.whatMattersText === 'string' &&
    output.whatMattersText.trim().length > 0
  );
}

function isCacheMetadata(value: unknown): value is AiVerdictCacheMetadata {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const cache = value as Record<string, unknown>;

  return (
    typeof cache.id === 'string' &&
    (cache.source === 'cache' || cache.source === 'generated') &&
    typeof cache.targetFingerprint === 'string' &&
    typeof cache.modelProvider === 'string' &&
    typeof cache.modelName === 'string' &&
    (typeof cache.modelVersion === 'string' || cache.modelVersion === null) &&
    typeof cache.promptVersion === 'number' &&
    typeof cache.responseSchemaVersion === 'number' &&
    typeof cache.createdAt === 'string'
  );
}

function isAccessState(value: unknown): value is AiVerdictAccessState {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const access = value as Record<string, unknown>;

  return (
    (access.accessTier === 'guest' || access.accessTier === 'free' || access.accessTier === 'premium') &&
    typeof access.allowed === 'boolean' &&
    typeof access.used === 'number' &&
    typeof access.remaining === 'number' &&
    typeof access.limit === 'number' &&
    (access.quotaScope === 'daily' || access.quotaScope === 'lifetime') &&
    (typeof access.quotaBucket === 'string' || access.quotaBucket === null)
  );
}

function isValidAiVerdictResponse(value: unknown): value is AiVerdictResponse {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const response = value as AiVerdictResponse;

  if (!response.ok) {
    return (
      aiVerdictFailureCodes.has(response.code) &&
      typeof response.message === 'string' &&
      (response.access === undefined || isAccessState(response.access)) &&
      (response.localFallback === undefined || isAnalysisOutput(response.localFallback))
    );
  }

  return (
    isAiVerdictOutput(response.verdict) &&
    isAnalysisOutput(response.localFallback) &&
    isCacheMetadata(response.cache) &&
    isAccessState(response.access)
  );
}

function snapshotFromSuccess(response: Extract<AiVerdictResponse, { ok: true }>): CaseAiVerdictSnapshot {
  return {
    verdict: response.verdict,
    localFallback: response.localFallback,
    cache: response.cache,
    access: response.access,
    updatedAt: nowIso(),
  };
}

function statusFromFailure(code: AiVerdictFailureCode): AiVerdictRequestStatus {
  if (code === 'not_authenticated') {
    return 'unauthenticated';
  }

  return code;
}

function requestStateFromSuccess(
  response: Extract<AiVerdictResponse, { ok: true }>,
  httpStatus?: number,
): AiVerdictRequestState {
  return {
    status: response.cache.source === 'cache' ? 'cache' : 'success',
    access: response.access,
    httpStatus,
    updatedAt: nowIso(),
  };
}

function requestStateFromFailure(
  response: Extract<AiVerdictResponse, { ok: false }>,
  httpStatus?: number,
): AiVerdictRequestState {
  return {
    status: statusFromFailure(response.code),
    code: response.code,
    message: response.message,
    access: response.access,
    localFallback: response.localFallback,
    httpStatus,
    updatedAt: nowIso(),
  };
}

function loadingState(): AiVerdictRequestState {
  return {
    status: 'loading',
    updatedAt: nowIso(),
  };
}

function storedCacheState(): AiVerdictRequestState {
  return {
    status: 'cache',
    message: 'Saved Smart Verdict from your account.',
    updatedAt: nowIso(),
  };
}

function isValidStoredAiVerdictRow(value: unknown): value is StoredAiVerdictRow {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const row = value as Partial<Record<keyof StoredAiVerdictRow, unknown>>;

  return (
    typeof row.id === 'string' &&
    typeof row.target_fingerprint === 'string' &&
    typeof row.verdict_label === 'string' &&
    verdictLabels.has(row.verdict_label as VerdictLabel) &&
    Number.isInteger(row.delusion_score) &&
    Number(row.delusion_score) >= 0 &&
    Number(row.delusion_score) <= 100 &&
    typeof row.explanation_text === 'string' &&
    row.explanation_text.trim().length > 0 &&
    typeof row.next_move_text === 'string' &&
    row.next_move_text.trim().length > 0 &&
    Number.isInteger(row.verdict_version) &&
    Number(row.verdict_version) >= 1 &&
    typeof row.local_verdict_label === 'string' &&
    verdictLabels.has(row.local_verdict_label as VerdictLabel) &&
    Number.isInteger(row.local_delusion_score) &&
    Number(row.local_delusion_score) >= 0 &&
    Number(row.local_delusion_score) <= 100 &&
    typeof row.local_explanation_text === 'string' &&
    row.local_explanation_text.trim().length > 0 &&
    typeof row.local_next_move_text === 'string' &&
    row.local_next_move_text.trim().length > 0 &&
    Number.isInteger(row.local_verdict_version) &&
    Number(row.local_verdict_version) >= 1 &&
    typeof row.model_provider === 'string' &&
    typeof row.model_name === 'string' &&
    (typeof row.model_version === 'string' || row.model_version === null) &&
    typeof row.prompt_version === 'number' &&
    typeof row.response_schema_version === 'number' &&
    typeof row.created_at === 'string'
  );
}

function snapshotFromStoredRow(row: StoredAiVerdictRow): CaseAiVerdictSnapshot {
  return {
    verdict: {
      verdictLabel: row.verdict_label,
      delusionScore: row.delusion_score,
      displayLabel: row.display_label ?? row.verdict_label.replace(/_/g, ' '),
      explanationText: row.explanation_text,
      evidenceCheckText:
        row.evidence_check_text ?? 'The saved Smart Verdict predates detailed evidence notes for this case.',
      overreadingText:
        row.overreading_text ?? 'The saved Smart Verdict predates detailed overreading notes for this case.',
      whatMattersText: row.what_matters_text ?? 'Use the saved next move as the cleanest read on what matters.',
      nextMoveText: row.next_move_text,
      verdictVersion: row.verdict_version,
      source: 'ai',
    },
    localFallback: {
      verdictLabel: row.local_verdict_label,
      delusionScore: row.local_delusion_score,
      explanationText: row.local_explanation_text,
      nextMoveText: row.local_next_move_text,
      verdictVersion: row.local_verdict_version,
    },
    cache: {
      id: row.id,
      source: 'cache',
      targetFingerprint: row.target_fingerprint,
      modelProvider: row.model_provider,
      modelName: row.model_name,
      modelVersion: row.model_version,
      promptVersion: row.prompt_version,
      responseSchemaVersion: row.response_schema_version,
      createdAt: row.created_at,
    },
    updatedAt: nowIso(),
  };
}

function logAiVerdictDiagnostic(
  caseId: string,
  response: AiVerdictResponse,
  diagnostic: {
    httpStatus?: number;
    elapsedMs?: number;
    timedOut?: boolean;
  } = {},
) {
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  console.info('[ai-verdict] response', {
    caseId,
    httpStatus: diagnostic.httpStatus ?? null,
    elapsedMs: diagnostic.elapsedMs ?? null,
    timedOut: diagnostic.timedOut ?? false,
    ok: response.ok,
    code: response.ok ? null : response.code,
    cacheSource: response.ok ? response.cache.source : null,
    access: response.ok ? response.access : response.access ?? null,
    fallbackReason: response.ok ? null : response.code,
  });
}

function functionUrl(): string {
  return `${env.supabaseUrl.replace(/\/$/, '')}/functions/v1/ai-verdict`;
}

async function authenticatedHeaders(): Promise<Record<string, string> | null> {
  if (!supabase) {
    return null;
  }

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  if (!token) {
    return null;
  }

  return {
    Authorization: `Bearer ${token}`,
  };
}

async function invokeAiVerdict(
  body: AiVerdictRequest,
  authHeaders: Record<string, string> = {},
): Promise<{ response: AiVerdictResponse; httpStatus?: number; elapsedMs: number; timedOut: boolean }> {
  const startedAt = Date.now();

  if (!hasSupabaseEnv()) {
    return { response: safeUnavailableFailure(), elapsedMs: Date.now() - startedAt, timedOut: false };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_VERDICT_CLIENT_TIMEOUT_MS);

  try {
    const result = await fetch(functionUrl(), {
      method: 'POST',
      signal: controller.signal,
      headers: {
        apikey: env.supabaseAnonKey,
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify(body),
    });
    const parsed = (await result.json().catch(() => null)) as unknown;

    if (isValidAiVerdictResponse(parsed)) {
      return { response: parsed, httpStatus: result.status, elapsedMs: Date.now() - startedAt, timedOut: false };
    }

    return {
      response: failure('invalid_ai_response', 'Smart Verdict returned an invalid response.'),
      httpStatus: result.status,
      elapsedMs: Date.now() - startedAt,
      timedOut: false,
    };
  } catch (error) {
    const timedOut = isAbortError(error);
    return {
      response: timedOut ? failure('ai_timeout', 'Smart Verdict timed out. Showing Basic Verdict.') : safeUnavailableFailure(),
      elapsedMs: Date.now() - startedAt,
      timedOut,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function guestRequest(record: Extract<CaseEntity, { localId: string }>): AiVerdictRequest {
  return {
    guestKey: useGuestStore.getState().ensureGuestAiKey(),
    target: {
      targetType: 'guest_case',
      guestCaseId: record.localId,
      category: record.category,
      inputText: record.inputText,
      localVerdictLabel: record.verdictLabel,
      localDelusionScore: record.delusionScore,
      localExplanationText: record.explanationText,
      localNextMoveText: record.nextMoveText,
      localVerdictVersion: record.verdictVersion,
    },
  };
}

function authenticatedRequest(caseId: string): AiVerdictRequest {
  return {
    target: {
      targetType: 'case',
      caseId,
    },
  };
}

export const aiVerdictService = {
  async loadStoredVerdictForCase(record: CaseEntity): Promise<CaseAiVerdictSnapshot | null> {
    const caseId = getCaseId(record);

    if (isGuestCase(record) || !supabase) {
      return null;
    }

    const auth = useAuthStore.getState();

    if (auth.sessionMode !== 'authenticated' || !auth.user) {
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('ai_case_verdicts')
        .select(
          'id,target_fingerprint,verdict_label,delusion_score,display_label,explanation_text,evidence_check_text,overreading_text,what_matters_text,next_move_text,verdict_version,local_verdict_label,local_delusion_score,local_explanation_text,local_next_move_text,local_verdict_version,model_provider,model_name,model_version,prompt_version,response_schema_version,created_at',
        )
        .eq('case_id', caseId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !isValidStoredAiVerdictRow(data)) {
        return null;
      }

      const snapshot = snapshotFromStoredRow(data);
      useAiVerdictStore.getState().setAiVerdict(caseId, snapshot);
      useAiVerdictStore.getState().setRequestState(caseId, storedCacheState());
      return snapshot;
    } catch {
      return null;
    }
  },

  async requestForCase(record: CaseEntity): Promise<AiVerdictResponse> {
    const caseId = getCaseId(record);

    try {
      const auth = useAuthStore.getState();
      const aiStore = useAiVerdictStore.getState();

      if (isGuestCase(record)) {
        aiStore.setRequestState(record.localId, loadingState());
        const { response, httpStatus, elapsedMs, timedOut } = await invokeAiVerdict(guestRequest(record));
        logAiVerdictDiagnostic(record.localId, response, { httpStatus, elapsedMs, timedOut });

        if (response.ok) {
          const snapshot = snapshotFromSuccess(response);
          useGuestStore.getState().attachAiVerdict(record.localId, snapshot);
          useAiVerdictStore.getState().setAiVerdict(record.localId, snapshot);
          useAiVerdictStore.getState().setRequestState(record.localId, requestStateFromSuccess(response, httpStatus));
        } else {
          useAiVerdictStore.getState().setRequestState(record.localId, requestStateFromFailure(response, httpStatus));
        }

        return response;
      }

      if (auth.sessionMode !== 'authenticated' || !auth.user) {
        const response = failure('not_authenticated', 'Sign in to use Smart Verdicts.');
        aiStore.setRequestState(caseId, requestStateFromFailure(response));
        return response;
      }

      aiStore.setRequestState(caseId, loadingState());
      const headers = await authenticatedHeaders();

      if (!headers) {
        const response = failure('not_authenticated', 'Sign in to use Smart Verdicts.');
        aiStore.setRequestState(caseId, requestStateFromFailure(response));
        return response;
      }

      const { response, httpStatus, elapsedMs, timedOut } = await invokeAiVerdict(authenticatedRequest(caseId), headers);
      logAiVerdictDiagnostic(caseId, response, { httpStatus, elapsedMs, timedOut });

      if (response.ok) {
        useAiVerdictStore.getState().setAiVerdict(caseId, snapshotFromSuccess(response));
        useAiVerdictStore.getState().setRequestState(caseId, requestStateFromSuccess(response, httpStatus));
      } else {
        useAiVerdictStore.getState().setRequestState(caseId, requestStateFromFailure(response, httpStatus));
      }

      return response;
    } catch {
      const response = safeUnavailableFailure();
      useAiVerdictStore.getState().setRequestState(caseId, requestStateFromFailure(response));
      return response;
    }
  },
};
