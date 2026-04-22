import type { GuestCaseUpdateLocal } from '../../../types/shared';
import { trackEvent } from '../../../lib/analytics/analyticsService';
import { supabase } from '../../../lib/supabase/client';
import { nowIso } from '../../../shared/utils/date';
import { createId } from '../../../shared/utils/id';
import { useGuestStore } from '../../../store/guestStore';
import { analysisService } from '../../analysis/analysisService';
import type { CaseUpdateEntity } from '../types';
import { isGuestCase } from '../types';
import { mapCaseUpdateRow, type CaseUpdateRow } from './caseMappers';
import { caseRepository } from './caseRepository';

export const caseUpdateRepository = {
  async listUpdates(caseId: string): Promise<CaseUpdateEntity[]> {
    const guestCase = useGuestStore.getState().cases.find((item) => item.localId === caseId);

    if (guestCase) {
      return guestCase.updates;
    }

    if (!supabase) {
      return [];
    }

    const { data, error } = await supabase
      .from('case_updates')
      .select('*')
      .eq('case_id', caseId)
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    return (data as CaseUpdateRow[]).map(mapCaseUpdateRow);
  },
  async addUpdate(caseId: string, updateText: string): Promise<CaseUpdateEntity> {
    const parentCase = await caseRepository.getCase(caseId);

    if (!parentCase) {
      throw new Error('Case not found.');
    }

    const updates = isGuestCase(parentCase)
      ? parentCase.updates
      : await caseUpdateRepository.listUpdates(caseId);

    const analysis = await analysisService.analyzeCase({
      category: parentCase.category,
      inputText: parentCase.inputText,
      updateText,
      previousCaseContext: {
        originalInputText: parentCase.inputText,
        priorScore: parentCase.delusionScore,
        priorVerdictLabel: parentCase.verdictLabel,
        priorTriggeredSignals: parentCase.triggeredSignals ?? [],
        priorUpdateCount: updates.length,
      },
    });

    const timestamp = nowIso();

    if (isGuestCase(parentCase)) {
      const update: GuestCaseUpdateLocal = {
        localId: createId('update'),
        localCaseId: parentCase.localId,
        updateText,
        verdictLabel: analysis.verdictLabel,
        delusionScore: analysis.delusionScore,
        explanationText: analysis.explanationText,
        nextMoveText: analysis.nextMoveText,
        verdictVersion: analysis.verdictVersion,
        createdAt: timestamp,
      };

      useGuestStore.getState().addUpdate(parentCase.localId, update);
      trackEvent('case_update_added', { mode: 'guest' });
      return update;
    }

    if (!supabase) {
      throw new Error('Supabase is not configured.');
    }

    const { data, error } = await supabase
      .from('case_updates')
      .insert({
        case_id: parentCase.id,
        update_text: updateText,
        verdict_label: analysis.verdictLabel,
        delusion_score: analysis.delusionScore,
        explanation_text: analysis.explanationText,
        next_move_text: analysis.nextMoveText,
        verdict_version: analysis.verdictVersion,
        created_at: timestamp,
      })
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    const { error: updateError } = await supabase
      .from('cases')
      .update({
        verdict_label: analysis.verdictLabel,
        delusion_score: analysis.delusionScore,
        explanation_text: analysis.explanationText,
        next_move_text: analysis.nextMoveText,
        latest_verdict_version: analysis.verdictVersion,
        last_analyzed_at: timestamp,
      })
      .eq('id', parentCase.id);

    if (updateError) {
      throw updateError;
    }

    trackEvent('case_update_added', { mode: 'authenticated' });
    return mapCaseUpdateRow(data as CaseUpdateRow);
  },
};
