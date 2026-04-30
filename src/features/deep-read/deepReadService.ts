import { supabase } from '../../lib/supabase/client';
import { useAuthStore } from '../../store/authStore';
import type { DeepReadFailureCode, DeepReadOutput, DeepReadResponse } from '../../types/shared';

// Current Phase B Edge Function contract: authenticated case-level requests only.
// Expand this request body later when guest or update Deep Reads are supported.
interface DeepReadFunctionRequest {
  target: {
    targetType: 'case';
    caseId: string;
  };
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
  async requestCaseDeepRead(caseId: string): Promise<DeepReadResponse> {
    const trimmedCaseId = caseId.trim();

    if (!trimmedCaseId) {
      return failure('case_not_found', 'Case not found.');
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
