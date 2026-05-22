import type { AiVerdictRequestState } from '../../types/shared';
import { parseAppTimestamp } from '../../shared/utils/date';
import { useAiVerdictStore } from '../../store/aiVerdictStore';

interface AiVerdictLockOptions {
  premiumActive?: boolean;
}

const caseDeepReadLockStatuses = new Set<AiVerdictRequestState['status']>([
  'quota_exceeded',
  'fair_use_exceeded',
  'ip_daily_cap_exceeded',
  'global_daily_cap_exceeded',
  'ai_failed',
  'ai_timeout',
  'invalid_ai_response',
  'cache_write_failed',
  'unknown',
  'guest_key_required',
  'case_not_found',
]);

const accountDeepReadLockStatuses = new Set<AiVerdictRequestState['status']>([
  'quota_exceeded',
  'fair_use_exceeded',
  'ip_daily_cap_exceeded',
  'global_daily_cap_exceeded',
]);

function utcTodayBucket(): string {
  return new Date().toISOString().slice(0, 10);
}

function isCurrentDailyQuotaState(requestState: AiVerdictRequestState): boolean {
  const access = requestState.access;

  if (!access) {
    const updatedAt = parseAppTimestamp(requestState.updatedAt);
    return Number.isFinite(updatedAt) && new Date(updatedAt).toISOString().slice(0, 10) === utcTodayBucket();
  }

  if (access.quotaScope !== 'daily') {
    return true;
  }

  return access.quotaBucket === utcTodayBucket();
}

function isStaleFreeQuotaLockForPremium(
  requestState: AiVerdictRequestState,
  options: AiVerdictLockOptions = {},
): boolean {
  return Boolean(
    options.premiumActive &&
      requestState.status === 'quota_exceeded' &&
      requestState.access?.accessTier === 'free',
  );
}

export function isAiVerdictDeepReadCaseLocked(
  requestState?: AiVerdictRequestState,
  options: AiVerdictLockOptions = {},
): boolean {
  return Boolean(
    requestState &&
      caseDeepReadLockStatuses.has(requestState.status) &&
      !isStaleFreeQuotaLockForPremium(requestState, options),
  );
}

export function isAiVerdictDeepReadAccountLocked(
  requestState?: AiVerdictRequestState,
  options: AiVerdictLockOptions = {},
): boolean {
  return Boolean(
    requestState &&
      accountDeepReadLockStatuses.has(requestState.status) &&
      requestState.access?.allowed === false &&
      requestState.access.accessTier !== 'guest' &&
      !isStaleFreeQuotaLockForPremium(requestState, options) &&
      isCurrentDailyQuotaState(requestState),
  );
}

export function findAiVerdictDeepReadAccountLock(
  options: AiVerdictLockOptions = {},
): AiVerdictRequestState | undefined {
  const requestStates = Object.values(useAiVerdictStore.getState().requestByCaseId);
  return requestStates.find((requestState) => isAiVerdictDeepReadAccountLocked(requestState, options));
}

export function getAiVerdictDeepReadLockState(
  caseId: string,
  options: AiVerdictLockOptions = {},
): AiVerdictRequestState | undefined {
  const requestState = useAiVerdictStore.getState().requestByCaseId[caseId];

  if (isAiVerdictDeepReadCaseLocked(requestState, options)) {
    return requestState;
  }

  return findAiVerdictDeepReadAccountLock(options);
}
