import { supabase } from '../../lib/supabase/client';
import { useAuthStore } from '../../store/authStore';
import { getAiVerdictDeepReadLockState } from '../ai-verdict/aiVerdictAccess';
import type { DeepReadCacheMetadata, DeepReadFailureCode, DeepReadOutput, DeepReadResponse } from '../../types/shared';
import type { CaseEntity } from '../cases/types';
import { getCaseId } from '../cases/types';

// Current Phase B Edge Function contract: authenticated case-level requests only.
// Expand this request body later when guest or update Deep Reads are supported.
interface DeepReadFunctionRequest {
  target: {
    targetType: 'case';
    caseId: string;
  };
}

interface StoredDeepReadRow {
  id: string;
  target_type: 'case';
  target_fingerprint: string;
  model_provider: string;
  model_name: string;
  model_version: string | null;
  prompt_version: number;
  response_schema_version: number;
  response_json: DeepReadOutput;
  category: string;
  local_verdict_label: string;
  local_delusion_score: number;
  local_verdict_version: number;
  created_at: string;
}

const deepReadFailureCodes = new Set<DeepReadFailureCode>([
  'not_authenticated',
  'case_not_found',
  'deep_read_not_configured',
  'quota_exceeded',
  'fair_use_exceeded',
  'ai_timeout',
  'ai_failed',
  'invalid_ai_response',
  'cache_write_failed',
  'unknown',
]);

function failure(
  code: Extract<DeepReadResponse, { ok: false }>['code'],
  message: string,
): Extract<DeepReadResponse, { ok: false }> {
  return {
    ok: false,
    code,
    message,
  };
}

function safeUnavailableFailure(): Extract<DeepReadResponse, { ok: false }> {
  return failure('unknown', 'Deep Read is unavailable right now.');
}

function isDeepReadOutput(value: unknown): value is DeepReadOutput {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const output = value as Partial<Record<keyof DeepReadOutput, unknown>>;

  return [
    output.whatsActuallyHappening,
    output.whatYoureOverreading,
    output.whatEvidenceActuallyMatters,
    output.whatToDoNext,
    output.roastLine,
  ].every((item) => typeof item === 'string' && item.trim().length > 0);
}

function isValidDeepReadResponse(value: unknown): value is DeepReadResponse {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const response = value as DeepReadResponse;

  if (!response.ok) {
    return deepReadFailureCodes.has(response.code) && typeof response.message === 'string';
  }

  return (
    isDeepReadOutput(response.deepRead) &&
    Boolean(response.cache) &&
    typeof response.cache.id === 'string' &&
    (response.cache.source === 'cache' || response.cache.source === 'generated') &&
    response.cache.targetType === 'case' &&
    typeof response.cache.targetFingerprint === 'string' &&
    typeof response.cache.modelProvider === 'string' &&
    typeof response.cache.modelName === 'string' &&
    typeof response.cache.promptVersion === 'number' &&
    typeof response.cache.responseSchemaVersion === 'number' &&
    typeof response.cache.createdAt === 'string' &&
    Boolean(response.access) &&
    (response.access.accessTier === 'free' || response.access.accessTier === 'premium') &&
    typeof response.access.allowed === 'boolean'
  );
}

function isStoredDeepReadRow(value: unknown): value is StoredDeepReadRow {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const row = value as Partial<StoredDeepReadRow>;

  return (
    typeof row.id === 'string' &&
    row.target_type === 'case' &&
    typeof row.target_fingerprint === 'string' &&
    typeof row.model_provider === 'string' &&
    typeof row.model_name === 'string' &&
    (typeof row.model_version === 'string' || row.model_version === null) &&
    typeof row.prompt_version === 'number' &&
    typeof row.response_schema_version === 'number' &&
    isDeepReadOutput(row.response_json) &&
    typeof row.category === 'string' &&
    typeof row.local_verdict_label === 'string' &&
    typeof row.local_delusion_score === 'number' &&
    typeof row.local_verdict_version === 'number' &&
    typeof row.created_at === 'string'
  );
}

function cacheMetadataFromStoredRow(row: StoredDeepReadRow): DeepReadCacheMetadata {
  return {
    id: row.id,
    source: 'cache',
    targetType: row.target_type,
    targetFingerprint: row.target_fingerprint,
    modelProvider: row.model_provider,
    modelName: row.model_name,
    modelVersion: row.model_version,
    promptVersion: row.prompt_version,
    responseSchemaVersion: row.response_schema_version,
    createdAt: row.created_at,
  };
}

async function parseStructuredInvokeError(error: unknown): Promise<DeepReadResponse | null> {
  const context = error && typeof error === 'object' ? (error as { context?: unknown }).context : null;

  if (!context || typeof context !== 'object') {
    return null;
  }

  const responseLike = context as {
    clone?: () => { json?: () => Promise<unknown> };
    json?: () => Promise<unknown>;
  };

  try {
    const cloned = responseLike.clone?.();
    const parserTarget = cloned?.json ? cloned : responseLike;
    const parsed = parserTarget.json ? await parserTarget.json() : null;
    return isValidDeepReadResponse(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export const deepReadService = {
  async loadStoredCaseDeepRead(record: CaseEntity): Promise<Extract<DeepReadResponse, { ok: true }> | null> {
    const trimmedCaseId = getCaseId(record).trim();

    if (!trimmedCaseId || !supabase) {
      return null;
    }

    const auth = useAuthStore.getState();

    if (auth.sessionMode !== 'authenticated' || !auth.user) {
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('ai_deep_reads')
        .select(
          'id,target_type,target_fingerprint,model_provider,model_name,model_version,prompt_version,response_schema_version,response_json,category,local_verdict_label,local_delusion_score,local_verdict_version,created_at',
        )
        .eq('case_id', trimmedCaseId)
        .eq('category', record.category)
        .eq('local_verdict_label', record.verdictLabel)
        .eq('local_delusion_score', record.delusionScore)
        .eq('local_verdict_version', record.verdictVersion)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !isStoredDeepReadRow(data)) {
        return null;
      }

      return {
        ok: true,
        deepRead: data.response_json,
        cache: cacheMetadataFromStoredRow(data),
        access: {
          accessTier: 'free',
          allowed: true,
          remaining: null,
          limit: null,
          quotaBucket: null,
        },
      };
    } catch {
      return null;
    }
  },

  async requestCaseDeepRead(caseId: string): Promise<DeepReadResponse> {
    const trimmedCaseId = caseId.trim();

    if (!trimmedCaseId) {
      return failure('case_not_found', 'Case not found.');
    }

    const aiVerdictLockState = getAiVerdictDeepReadLockState(trimmedCaseId);

    if (aiVerdictLockState?.status === 'fair_use_exceeded') {
      return failure('fair_use_exceeded', 'AI reads are temporarily limited for fair use. Try again later.');
    }

    if (aiVerdictLockState) {
      return failure('quota_exceeded', 'AI verdict quota is used up for now. Deep Read stays locked for this case.');
    }

    if (!supabase) {
      return failure('deep_read_not_configured', 'Deep Read is not configured for this build.');
    }

    const auth = useAuthStore.getState();

    if (auth.sessionMode !== 'authenticated' || !auth.user) {
      return failure('not_authenticated', 'Sign in to use Deep Read.');
    }

    const body: DeepReadFunctionRequest = {
      target: {
        targetType: 'case',
        caseId: trimmedCaseId,
      },
    };

    try {
      const { data, error } = await supabase.functions.invoke<DeepReadResponse>('deep-read', {
        body,
      });

      if (error) {
        const structuredError = await parseStructuredInvokeError(error);
        return structuredError ?? safeUnavailableFailure();
      }

      if (!isValidDeepReadResponse(data)) {
        return failure('invalid_ai_response', 'Deep Read returned an invalid response.');
      }

      return data;
    } catch {
      return safeUnavailableFailure();
    }
  },
};
