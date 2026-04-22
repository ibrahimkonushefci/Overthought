import type { GuestMigrationPayload } from '../../types/shared';
import { supabase } from '../../lib/supabase/client';
import { useAuthStore } from '../../store/authStore';
import { useGuestStore } from '../../store/guestStore';

export interface MigrationResult {
  migrated: number;
  skipped: number;
  failed: number;
}

export const migrationService = {
  buildPayload(): GuestMigrationPayload | null {
    const guest = useGuestStore.getState();

    if (!guest.localGuestId || guest.cases.length === 0) {
      return null;
    }

    return {
      guestLocalId: guest.localGuestId,
      cases: guest.cases.map((item) => ({
        localId: item.localId,
        title: item.title,
        category: item.category,
        inputText: item.inputText,
        verdictLabel: item.verdictLabel,
        delusionScore: item.delusionScore,
        explanationText: item.explanationText,
        nextMoveText: item.nextMoveText,
        verdictVersion: item.verdictVersion,
        outcomeStatus: item.outcomeStatus,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        archivedAt: item.archivedAt,
        updates: item.updates.map((update) => ({
          localId: update.localId,
          updateText: update.updateText,
          verdictLabel: update.verdictLabel,
          delusionScore: update.delusionScore,
          explanationText: update.explanationText,
          nextMoveText: update.nextMoveText,
          verdictVersion: update.verdictVersion,
          createdAt: update.createdAt,
        })),
      })),
    };
  },
  async migrateGuestCases(): Promise<MigrationResult> {
    const auth = useAuthStore.getState();
    const guest = useGuestStore.getState();

    if (!supabase || auth.sessionMode !== 'authenticated' || !auth.user) {
      return { migrated: 0, skipped: 0, failed: 0 };
    }

    let migrated = 0;
    let skipped = 0;
    let failed = 0;

    for (const item of guest.cases) {
      if (guest.migratedCaseMap[item.localId]) {
        skipped += 1;
        continue;
      }

      try {
        const { data: existing, error: existingError } = await supabase
          .from('cases')
          .select('id')
          .eq('guest_local_id', item.localId)
          .maybeSingle();

        if (existingError) {
          throw existingError;
        }

        const remoteCaseId = existing?.id ?? null;
        const caseId = remoteCaseId ?? (await createRemoteCase(auth.user.id, item));

        for (const update of item.updates) {
          const { data: matchingUpdates, error: updateLookupError } = await supabase
            .from('case_updates')
            .select('id')
            .eq('case_id', caseId)
            .eq('created_at', update.createdAt)
            .eq('update_text', update.updateText)
            .limit(1);

          if (updateLookupError) {
            throw updateLookupError;
          }

          if (!matchingUpdates?.length) {
            const { error: insertUpdateError } = await supabase.from('case_updates').insert({
              case_id: caseId,
              update_text: update.updateText,
              verdict_label: update.verdictLabel,
              delusion_score: update.delusionScore,
              explanation_text: update.explanationText,
              next_move_text: update.nextMoveText,
              verdict_version: update.verdictVersion,
              created_at: update.createdAt,
            });

            if (insertUpdateError) {
              throw insertUpdateError;
            }
          }
        }

        useGuestStore.getState().markCaseMigrated(item.localId, caseId);
        migrated += 1;
      } catch {
        failed += 1;
      }
    }

    if (failed === 0 && migrated > 0) {
      useGuestStore.getState().clearMigratedCases();
    }

    return { migrated, skipped, failed };
  },
};

async function createRemoteCase(userId: string, item: ReturnType<typeof useGuestStore.getState>['cases'][number]) {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase
    .from('cases')
    .insert({
      user_id: userId,
      guest_local_id: item.localId,
      title: item.title,
      category: item.category,
      input_text: item.inputText,
      verdict_label: item.verdictLabel,
      delusion_score: item.delusionScore,
      explanation_text: item.explanationText,
      next_move_text: item.nextMoveText,
      outcome_status: item.outcomeStatus,
      latest_verdict_version: item.verdictVersion,
      last_analyzed_at: item.lastAnalyzedAt,
      created_at: item.createdAt,
      updated_at: item.updatedAt,
      archived_at: item.archivedAt,
    })
    .select('id')
    .single();

  if (error) {
    throw error;
  }

  return data.id as string;
}
