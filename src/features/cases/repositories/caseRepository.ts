import type { CreateCaseInput, GuestCaseLocal, OutcomeStatus } from '../../../types/shared';
import { trackEvent } from '../../../lib/analytics/analyticsService';
import { supabase } from '../../../lib/supabase/client';
import { nowIso } from '../../../shared/utils/date';
import { createId } from '../../../shared/utils/id';
import { titleFromInput } from '../../../shared/utils/verdict';
import { useAuthStore } from '../../../store/authStore';
import { selectActiveGuestCases, useGuestStore } from '../../../store/guestStore';
import { analysisService } from '../../analysis/analysisService';
import type { CaseEntity } from '../types';
import { mapCaseRow, type CaseRow } from './caseMappers';

export const caseRepository = {
  async createCase(input: CreateCaseInput): Promise<CaseEntity> {
    const analysis = await analysisService.analyzeCase(input);
    const title = input.title ?? titleFromInput(input.inputText);
    const timestamp = nowIso();
    const auth = useAuthStore.getState();

    trackEvent('case_analyzed', {
      category: input.category,
      score: analysis.delusionScore,
    });

    if (auth.sessionMode === 'authenticated' && !supabase) {
      throw new Error('Supabase is not configured.');
    }

    if (auth.sessionMode === 'authenticated' && supabase) {
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
        throw error;
      }

      trackEvent('case_saved', { mode: 'authenticated' });
      return mapCaseRow(data as CaseRow);
    }

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
        .from('cases')
        .select('*')
        .eq('user_id', auth.user.id)
        .is('archived_at', null)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false });

      if (error) {
        throw error;
      }

      return (data as CaseRow[]).map(mapCaseRow);
    }

    return selectActiveGuestCases(useGuestStore.getState());
  },
  async getCase(caseId: string): Promise<CaseEntity | null> {
    const guestCase = useGuestStore.getState().cases.find((item) => item.localId === caseId);

    if (guestCase) {
      return guestCase;
    }

    if (!supabase) {
      return null;
    }

    const auth = useAuthStore.getState();

    if (auth.sessionMode !== 'authenticated' || !auth.user) {
      return null;
    }

    const { data, error } = await supabase
      .from('cases')
      .select('*')
      .eq('id', caseId)
      .eq('user_id', auth.user.id)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data ? mapCaseRow(data as CaseRow) : null;
  },
  async updateOutcome(caseId: string, outcomeStatus: OutcomeStatus): Promise<void> {
    const guestCase = useGuestStore.getState().cases.find((item) => item.localId === caseId);

    if (guestCase) {
      useGuestStore.getState().updateOutcome(caseId, outcomeStatus);
      trackEvent('outcome_marked', { outcomeStatus, mode: 'guest' });
      return;
    }

    if (!supabase) {
      throw new Error('Supabase is not configured.');
    }

    const auth = useAuthStore.getState();

    if (auth.sessionMode !== 'authenticated' || !auth.user) {
      throw new Error('Sign in again before updating this case.');
    }

    const { error } = await supabase
      .from('cases')
      .update({ outcome_status: outcomeStatus })
      .eq('id', caseId)
      .eq('user_id', auth.user.id)
      .is('deleted_at', null);

    if (error) {
      throw error;
    }

    trackEvent('outcome_marked', { outcomeStatus, mode: 'authenticated' });
  },
  async archiveCase(caseId: string): Promise<void> {
    const guestCase = useGuestStore.getState().cases.find((item) => item.localId === caseId);

    if (guestCase) {
      useGuestStore.getState().archiveCase(caseId);
      return;
    }

    if (!supabase) {
      throw new Error('Supabase is not configured.');
    }

    const auth = useAuthStore.getState();

    if (auth.sessionMode !== 'authenticated' || !auth.user) {
      throw new Error('Sign in again before archiving this case.');
    }

    const { error } = await supabase
      .from('cases')
      .update({ archived_at: nowIso() })
      .eq('id', caseId)
      .eq('user_id', auth.user.id)
      .is('deleted_at', null);

    if (error) {
      throw error;
    }
  },
};
