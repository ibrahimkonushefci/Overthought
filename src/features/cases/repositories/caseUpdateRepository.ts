import type { GuestCaseUpdateLocal } from '../../../types/shared';
import { trackEvent } from '../../../lib/analytics/analyticsService';
import { supabase } from '../../../lib/supabase/client';
import { nowIso } from '../../../shared/utils/date';
import { createId } from '../../../shared/utils/id';
import { useAuthStore } from '../../../store/authStore';
import { useGuestStore } from '../../../store/guestStore';
import type { CaseUpdateEntity } from '../types';
import { isGuestCase } from '../types';
import { mapCaseUpdateRow, type CaseUpdateRow } from './caseMappers';
import { caseRepository } from './caseRepository';

async function listRemoteUpdates(caseId: string): Promise<CaseUpdateEntity[]> {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase
    .from('case_updates')
    .select('*')
    .eq('case_id', caseId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data as CaseUpdateRow[]).map(mapCaseUpdateRow);
}

export const caseUpdateRepository = {
  async listUpdates(caseId: string): Promise<CaseUpdateEntity[]> {
    const auth = useAuthStore.getState();

    if (auth.sessionMode !== 'authenticated') {
      const guestCase = useGuestStore
        .getState()
        .cases.find((item) => item.localId === caseId && !item.archivedAt && !item.deletedAt);

      return guestCase?.updates ?? [];
    }

    if (!supabase) {
      throw new Error('Supabase is not configured.');
    }

    const parentCase = await caseRepository.getCase(caseId);

    if (!parentCase || isGuestCase(parentCase)) {
      return [];
    }

    return listRemoteUpdates(parentCase.id);
  },
  async addUpdate(caseId: string, updateText: string): Promise<CaseUpdateEntity> {
    const parentCase = await caseRepository.getCase(caseId);

    if (!parentCase) {
      throw new Error('Case not found.');
    }

    const timestamp = nowIso();

    if (isGuestCase(parentCase)) {
      const update: GuestCaseUpdateLocal = {
        localId: createId('update'),
        localCaseId: parentCase.localId,
        updateText,
        verdictLabel: null,
        delusionScore: null,
        explanationText: null,
        nextMoveText: null,
        verdictVersion: null,
        createdAt: timestamp,
      };

      useGuestStore.getState().addUpdate(parentCase.localId, update);
      trackEvent('case_update_added', { mode: 'guest' });
      return update;
    }

    if (!supabase) {
      throw new Error('Supabase is not configured.');
    }

    const auth = useAuthStore.getState();

    if (auth.sessionMode !== 'authenticated' || !auth.user) {
      throw new Error('Sign in again before adding an update.');
    }

    const { data, error } = await supabase
      .from('case_updates')
      .insert({
        case_id: parentCase.id,
        update_text: updateText,
        created_at: timestamp,
      })
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    trackEvent('case_update_added', { mode: 'authenticated' });
    return mapCaseUpdateRow(data as CaseUpdateRow);
  },
};
