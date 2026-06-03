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

let cachedRemoteCases: CaseEntity[] = [];
let cachedRemoteUserId: string | null = null;
let cachedRemoteLoading = false;
let cachedRemoteError: Error | null = null;
let remoteRefreshInFlight: Promise<void> | null = null;
let remoteRefreshInFlightUserId: string | null = null;
const remoteCaseSubscribers = new Set<() => void>();

function notifyRemoteCaseSubscribers() {
  remoteCaseSubscribers.forEach((listener) => listener());
}

function subscribeToRemoteCases(listener: () => void) {
  remoteCaseSubscribers.add(listener);
  return () => {
    remoteCaseSubscribers.delete(listener);
  };
}

function setRemoteCaseSnapshot(nextCases: CaseEntity[], userId: string | null) {
  cachedRemoteCases = nextCases;
  cachedRemoteUserId = userId;
  notifyRemoteCaseSubscribers();
}

function clearRemoteCaseSnapshot() {
  if (cachedRemoteCases.length === 0 && !cachedRemoteError && !cachedRemoteUserId && !cachedRemoteLoading) {
    return;
  }

  cachedRemoteCases = [];
  cachedRemoteUserId = null;
  cachedRemoteError = null;
  cachedRemoteLoading = false;
  remoteRefreshInFlight = null;
  remoteRefreshInFlightUserId = null;
  notifyRemoteCaseSubscribers();
}

async function refreshRemoteCaseSnapshot(userId: string) {
  if (remoteRefreshInFlight && remoteRefreshInFlightUserId === userId) {
    return remoteRefreshInFlight;
  }

  if (cachedRemoteUserId !== userId) {
    cachedRemoteCases = [];
    cachedRemoteError = null;
    cachedRemoteUserId = userId;
  }

  cachedRemoteLoading = true;
  remoteRefreshInFlightUserId = userId;
  notifyRemoteCaseSubscribers();

  remoteRefreshInFlight = caseRepository
    .listCases()
    .then((records) => {
      if (cachedRemoteUserId === userId) {
        cachedRemoteCases = records;
        cachedRemoteError = null;
      }
    })
    .catch((refreshError) => {
      if (cachedRemoteUserId === userId) {
        cachedRemoteError = refreshError instanceof Error ? refreshError : new Error('Unable to refresh cases.');
      }
    })
    .finally(() => {
      if (remoteRefreshInFlightUserId === userId) {
        cachedRemoteLoading = false;
        remoteRefreshInFlight = null;
        remoteRefreshInFlightUserId = null;
        notifyRemoteCaseSubscribers();
      }
    });

  return remoteRefreshInFlight;
}

export function getCachedCaseById(caseId: string): CaseEntity | null {
  const remoteCaseId = useGuestStore.getState().migratedCaseMap[caseId] ?? caseId;

  return (
    cachedRemoteCases.find((item) => {
      const itemId = getCaseId(item);
      return itemId === caseId || itemId === remoteCaseId;
    }) ?? null
  );
}

export function useCases() {
  const authMode = useAuthStore((state) => state.sessionMode);
  const authUserId = useAuthStore((state) => state.user?.id ?? null);
  const rawGuestCases = useGuestStore((state) => state.cases);
  const aiVerdictsByCaseId = useAiVerdictStore((state) => state.byCaseId);
  const migratedCaseCount = useGuestStore((state) => Object.keys(state.migratedCaseMap).length);
  const [remoteCaseVersion, setRemoteCaseVersion] = useState(0);
  const guestCases = useMemo(
    () =>
      rawGuestCases
        .filter((item) => !item.archivedAt && !item.deletedAt)
        .sort((left, right) => caseListTimestamp(right) - caseListTimestamp(left)),
    [rawGuestCases],
  );
  useEffect(() => subscribeToRemoteCases(() => setRemoteCaseVersion((version) => version + 1)), []);

  const refresh = useCallback(async () => {
    if (authMode !== 'authenticated' || !authUserId) {
      clearRemoteCaseSnapshot();
      return;
    }

    await refreshRemoteCaseSnapshot(authUserId);
  }, [authMode, authUserId]);

  useEffect(() => {
    void refresh();
  }, [migratedCaseCount, rawGuestCases.length, refresh]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const casesWithAiVerdicts = useMemo(() => {
    const sourceCases =
      authMode === 'authenticated'
        ? authUserId && cachedRemoteUserId === authUserId
          ? cachedRemoteCases
          : []
        : guestCases;

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
  }, [aiVerdictsByCaseId, authMode, authUserId, guestCases, remoteCaseVersion]);

  return {
    cases: casesWithAiVerdicts,
    loading: authMode === 'authenticated' && authUserId ? cachedRemoteLoading : false,
    error: authMode === 'authenticated' && authUserId ? cachedRemoteError : null,
    refresh,
  };
}
