import type {
  AiVerdictResponse,
  CreateCaseInput,
  GuestCaseLocal,
  OutcomeStatus,
  SmartCaseCreationInput,
} from '../../../types/shared';
import { trackEvent } from '../../../lib/analytics/analyticsService';
import { supabase } from '../../../lib/supabase/client';
import { nowIso, parseAppTimestamp } from '../../../shared/utils/date';
import { createId } from '../../../shared/utils/id';
import { titleFromInput } from '../../../shared/utils/verdict';
import { useAiVerdictStore } from '../../../store/aiVerdictStore';
import { useAuthStore } from '../../../store/authStore';
import { normalizeGuestCase, selectActiveGuestCases, useGuestStore } from '../../../store/guestStore';
import { analysisService } from '../../analysis/analysisService';
import { aiVerdictService } from '../../ai-verdict/aiVerdictService';
import type { CaseEntity } from '../types';
import { mapCanonicalCaseRow, mapCaseRow, type CanonicalCaseRow, type CaseRow } from './caseMappers';

export type SmartCaseCreationResult =
  | { ok: true; record: CaseEntity; response: Extract<AiVerdictResponse, { ok: true }> }
  | { ok: false; response: Extract<AiVerdictResponse, { ok: false }> };

function authenticatedCaseId(caseId: string): string {
  return useGuestStore.getState().migratedCaseMap[caseId] ?? caseId;
}

function sanitizeLogField(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const sanitized = value.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  return sanitized ? sanitized.slice(0, 220) : null;
}

function supabaseErrorDetails(error: unknown) {
  const record = error && typeof error === 'object' ? (error as Record<string, unknown>) : {};

  return {
    code: sanitizeLogField(record.code),
    message: sanitizeLogField(record.message),
    details: sanitizeLogField(record.details),
    hint: sanitizeLogField(record.hint),
  };
}

function normalizedSupabaseInsertError(error: unknown): Error {
  const details = supabaseErrorDetails(error);
  const normalized = new Error('Unable to save the case right now. Try again.');

  Object.assign(normalized, {
    code: details.code,
    supabaseMessage: details.message,
    details: details.details,
    hint: details.hint,
  });

  return normalized;
}

function logCaseCreateDiagnostic(event: string, details: Record<string, unknown>) {
  console.info(`[case-create] ${event}`, details);
}

function caseListTimestamp(record: CaseEntity): number {
  const timestamps = [
    parseAppTimestamp(record.updatedAt),
    parseAppTimestamp(record.createdAt),
    parseAppTimestamp(record.lastAnalyzedAt),
  ].filter(Number.isFinite);

  return timestamps.length > 0 ? Math.max(...timestamps) : 0;
}

function sortCasesNewestFirst(records: CaseEntity[]): CaseEntity[] {
  return [...records].sort((left, right) => caseListTimestamp(right) - caseListTimestamp(left));
}

async function getCanonicalAuthenticatedCase(caseId: string, userId: string): Promise<CaseEntity | null> {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase
    .from('canonical_case_results')
    .select('*')
    .eq('id', authenticatedCaseId(caseId))
    .eq('user_id', userId)
    .is('archived_at', null)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapCanonicalCaseRow(data as CanonicalCaseRow) : null;
}

export const caseRepository = {
  async createSmartCase(input: SmartCaseCreationInput): Promise<SmartCaseCreationResult> {
    const auth = useAuthStore.getState();
    const smartInput = { ...input, title: input.title ?? titleFromInput(input.inputText) };
    const response = await aiVerdictService.createSmartCase(smartInput);

    if (!response.ok) {
      const failureEvent =
        response.code === 'invalid_input' || response.code === 'safety_routed'
          ? 'smart_verdict_validation_failed'
          : response.code === 'quota_exceeded' ||
              response.code === 'fair_use_exceeded' ||
              response.code === 'ip_daily_cap_exceeded' ||
              response.code === 'global_daily_cap_exceeded'
            ? 'smart_verdict_quota_blocked'
            : 'smart_verdict_generation_failed';
      trackEvent(failureEvent, {
        code: response.code,
        tier: response.access?.accessTier ?? null,
        scope: response.access?.quotaScope ?? null,
        reason: response.access?.reason ?? null,
      });
      return { ok: false, response };
    }

    let record: CaseEntity;

    if (auth.sessionMode === 'authenticated') {
      if (!auth.user || !response.caseId) {
        return { ok: false, response: { ok: false, code: 'cache_write_failed', message: 'The saved Smart Verdict could not be reopened yet. Retry to recover it.' } };
      }

      const canonical = await getCanonicalAuthenticatedCase(String(response.caseId), auth.user.id);

      if (!canonical) {
        return { ok: false, response: { ok: false, code: 'cache_write_failed', message: 'The saved Smart Verdict could not be reopened yet. Retry to recover it.' } };
      }

      record = canonical;
    } else {
      const timestamp = nowIso();
      const localOwnerId = useGuestStore.getState().ensureGuestSession();
      const snapshot = {
        verdict: response.verdict,
        localFallback: response.localCalibration ?? response.localFallback,
        cache: response.cache,
        access: response.access,
        updatedAt: timestamp,
      };
      record = {
        localId: createId('case'),
        localOwnerId,
        title: smartInput.title,
        category: input.category,
        inputText: input.inputText,
        verdictLabel: response.verdict.verdictLabel,
        delusionScore: response.verdict.delusionScore,
        explanationText: response.verdict.explanationText,
        nextMoveText: response.verdict.nextMoveText,
        verdictVersion: response.verdict.verdictVersion,
        triggeredSignals: undefined,
        outcomeStatus: 'unknown',
        lastAnalyzedAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
        archivedAt: null,
        deletedAt: null,
        resultSource: 'smart',
        smartVerdict: response.verdict,
        legacyBasicSnapshot: snapshot.localFallback,
        aiVerdict: snapshot,
        updates: [],
        syncStatus: 'local_only',
      };
      useGuestStore.getState().addCase(record);
    }

    trackEvent('case_analyzed', {
      category: input.category,
      score: response.verdict.delusionScore,
      source: 'smart',
    });
    trackEvent('case_saved', { mode: auth.sessionMode === 'authenticated' ? 'authenticated' : 'guest', source: 'smart' });
    return { ok: true, record, response };
  },

  async createCase(input: CreateCaseInput): Promise<CaseEntity> {
    const analysis = await analysisService.analyzeCase(input);
    const title = input.title ?? titleFromInput(input.inputText);
    const timestamp = nowIso();
    const auth = useAuthStore.getState();

    logCaseCreateDiagnostic('case_create_start', {
      sessionMode: auth.sessionMode,
      hasAuthUser: Boolean(auth.user),
      supabaseConfigured: Boolean(supabase),
      category: input.category,
      inputLength: input.inputText.length,
    });

    trackEvent('case_analyzed', {
      category: input.category,
      score: analysis.delusionScore,
    });

    if (auth.sessionMode === 'authenticated' && !supabase) {
      throw new Error('Supabase is not configured.');
    }

    if (auth.sessionMode === 'authenticated' && supabase) {
      logCaseCreateDiagnostic('case_create_path', {
        path: 'authenticated_supabase',
      });

      if (!auth.user) {
        throw new Error('Authenticated session is missing a user.');
      }

      const { data, error } = await supabase
        .from('cases')
        .insert({
          user_id: auth.user.id,
          title,
          category: input.category,
          input_text: input.inputText,
          verdict_label: analysis.verdictLabel,
          delusion_score: analysis.delusionScore,
          explanation_text: analysis.explanationText,
          next_move_text: analysis.nextMoveText,
          latest_verdict_version: analysis.verdictVersion,
          last_analyzed_at: timestamp,
        })
        .select('*')
        .single();

      if (error) {
        const profileLookup = await supabase
          .from('profiles')
          .select('id')
          .eq('id', auth.user.id)
          .maybeSingle();

        logCaseCreateDiagnostic('case_create_supabase_insert_failed', {
          sessionMode: auth.sessionMode,
          hasAuthUser: Boolean(auth.user),
          supabaseConfigured: Boolean(supabase),
          ...supabaseErrorDetails(error),
          profileLookupOk: !profileLookup.error,
          profileExists: Boolean(profileLookup.data),
          profileLookupError: profileLookup.error ? supabaseErrorDetails(profileLookup.error) : null,
        });

        throw normalizedSupabaseInsertError(error);
      }

      trackEvent('case_saved', { mode: 'authenticated' });
      return mapCaseRow(data as CaseRow);
    }

    logCaseCreateDiagnostic('case_create_path', {
      path: 'guest_local',
    });

    const localOwnerId = useGuestStore.getState().ensureGuestSession();
    const record: GuestCaseLocal = {
      localId: createId('case'),
      localOwnerId,
      title,
      category: input.category,
      inputText: input.inputText,
      verdictLabel: analysis.verdictLabel,
      delusionScore: analysis.delusionScore,
      explanationText: analysis.explanationText,
      nextMoveText: analysis.nextMoveText,
      verdictVersion: analysis.verdictVersion,
      triggeredSignals: analysis.triggeredSignals,
      outcomeStatus: 'unknown',
      lastAnalyzedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
      archivedAt: null,
      deletedAt: null,
      resultSource: 'legacy_basic',
      updates: [],
      syncStatus: 'local_only',
    };

    useGuestStore.getState().addCase(record);
    trackEvent('case_saved', { mode: 'guest' });
    return record;
  },
  async listCases(): Promise<CaseEntity[]> {
    const auth = useAuthStore.getState();

    if (auth.sessionMode === 'authenticated' && !supabase) {
      throw new Error('Supabase is not configured.');
    }

    if (auth.sessionMode === 'authenticated' && supabase) {
      if (!auth.user) {
        throw new Error('Authenticated session is missing a user.');
      }

      const { data, error } = await supabase
        .from('canonical_case_results')
        .select('*')
        .eq('user_id', auth.user.id)
        .is('archived_at', null)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false });

      if (error) {
        throw error;
      }

      return sortCasesNewestFirst((data as CanonicalCaseRow[]).map(mapCanonicalCaseRow));
    }

    return sortCasesNewestFirst(selectActiveGuestCases(useGuestStore.getState()));
  },
  async getCase(caseId: string): Promise<CaseEntity | null> {
    const auth = useAuthStore.getState();

    if (auth.sessionMode !== 'authenticated') {
      return (
        useGuestStore
          .getState()
          .cases.map(normalizeGuestCase)
          .find((item) => item.localId === caseId && !item.archivedAt && !item.deletedAt) ?? null
      );
    }

    if (!supabase) {
      throw new Error('Supabase is not configured.');
    }

    if (!auth.user) {
      throw new Error('Authenticated session is missing a user.');
    }

    return getCanonicalAuthenticatedCase(caseId, auth.user.id);
  },
  async updateOutcome(caseId: string, outcomeStatus: OutcomeStatus): Promise<void> {
    const auth = useAuthStore.getState();

    if (auth.sessionMode !== 'authenticated') {
      const guestCase = useGuestStore.getState().cases.find((item) => item.localId === caseId);

      if (!guestCase) {
        throw new Error('Case not found.');
      }

      useGuestStore.getState().updateOutcome(caseId, outcomeStatus);
      trackEvent('outcome_marked', { outcomeStatus, mode: 'guest' });
      return;
    }

    if (!supabase) {
      throw new Error('Supabase is not configured.');
    }

    if (!auth.user) {
      throw new Error('Sign in again before updating this case.');
    }

    const { error } = await supabase
      .from('cases')
      .update({ outcome_status: outcomeStatus })
      .eq('id', authenticatedCaseId(caseId))
      .eq('user_id', auth.user.id)
      .is('deleted_at', null);

    if (error) {
      throw error;
    }

    trackEvent('outcome_marked', { outcomeStatus, mode: 'authenticated' });
  },
  async archiveCase(caseId: string): Promise<void> {
    const auth = useAuthStore.getState();

    if (auth.sessionMode !== 'authenticated') {
      const guestCase = useGuestStore.getState().cases.find((item) => item.localId === caseId);

      if (!guestCase) {
        throw new Error('Case not found.');
      }

      useGuestStore.getState().archiveCase(caseId);
      useAiVerdictStore.getState().clearAiVerdict(caseId);
      return;
    }

    if (!supabase) {
      throw new Error('Supabase is not configured.');
    }

    if (!auth.user) {
      throw new Error('Sign in again before archiving this case.');
    }

    const { error } = await supabase
      .from('cases')
      .update({ archived_at: nowIso() })
      .eq('id', authenticatedCaseId(caseId))
      .eq('user_id', auth.user.id)
      .is('deleted_at', null);

    if (error) {
      throw error;
    }

    useAiVerdictStore.getState().clearAiVerdict(caseId);
  },
  async archiveAllCases(): Promise<void> {
    const auth = useAuthStore.getState();

    if (auth.sessionMode !== 'authenticated') {
      useGuestStore.getState().clearCases();
      useAiVerdictStore.getState().clearAllAiVerdicts();
      return;
    }

    if (!supabase) {
      throw new Error('Supabase is not configured.');
    }

    if (!auth.user) {
      throw new Error('Sign in again before deleting cases.');
    }

    const { error } = await supabase
      .from('cases')
      .update({ archived_at: nowIso() })
      .eq('user_id', auth.user.id)
      .is('archived_at', null)
      .is('deleted_at', null);

    if (error) {
      throw error;
    }

    useAiVerdictStore.getState().clearAllAiVerdicts();
  },
};
