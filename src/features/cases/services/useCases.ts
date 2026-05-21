import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useGuestStore } from '../../../store/guestStore';
import { useAuthStore } from '../../../store/authStore';
import { useAiVerdictStore } from '../../../store/aiVerdictStore';
import { parseAppTimestamp } from '../../../shared/utils/date';
import { caseRepository } from '../repositories/caseRepository';
import { getCaseId } from '../types';
import type { CaseEntity } from '../types';

function caseListTimestamp(record: CaseEntity): number {
  const timestamps = [
    parseAppTimestamp(record.updatedAt),
    parseAppTimestamp(record.createdAt),
    parseAppTimestamp(record.lastAnalyzedAt),
  ].filter(Number.isFinite);

  return timestamps.length > 0 ? Math.max(...timestamps) : 0;
}

export function useCases() {
  const authMode = useAuthStore((state) => state.sessionMode);
  const rawGuestCases = useGuestStore((state) => state.cases);
  const aiVerdictsByCaseId = useAiVerdictStore((state) => state.byCaseId);
  const migratedCaseCount = useGuestStore((state) => Object.keys(state.migratedCaseMap).length);
  const guestCases = useMemo(
    () =>
      rawGuestCases
        .filter((item) => !item.archivedAt && !item.deletedAt)
        .sort((left, right) => caseListTimestamp(right) - caseListTimestamp(left)),
    [rawGuestCases],
  );
  const [remoteCases, setRemoteCases] = useState<CaseEntity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (authMode !== 'authenticated') {
      setRemoteCases([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    try {
      setRemoteCases(await caseRepository.listCases());
      setError(null);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError : new Error('Unable to refresh cases.'));
    } finally {
      setLoading(false);
    }
  }, [authMode]);

  useEffect(() => {
    void refresh();
  }, [migratedCaseCount, rawGuestCases.length, refresh]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const casesWithAiVerdicts = useMemo(() => {
    const sourceCases = authMode === 'authenticated' ? remoteCases : guestCases;

    return sourceCases.map((item) => {
      const caseId = getCaseId(item);
      const aiVerdict = aiVerdictsByCaseId[caseId] ?? ('aiVerdict' in item ? item.aiVerdict : undefined);

      if (!aiVerdict) {
        return item;
      }

      return {
        ...item,
        verdictLabel: aiVerdict.verdict.verdictLabel,
        delusionScore: aiVerdict.verdict.delusionScore,
        explanationText: aiVerdict.verdict.explanationText,
        nextMoveText: aiVerdict.verdict.nextMoveText,
        verdictVersion: aiVerdict.verdict.verdictVersion,
      };
    });
  }, [aiVerdictsByCaseId, authMode, guestCases, remoteCases]);

  return {
    cases: casesWithAiVerdicts,
    loading,
    error,
    refresh,
  };
}
