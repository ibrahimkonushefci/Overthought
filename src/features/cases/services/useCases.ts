import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useGuestStore } from '../../../store/guestStore';
import { useAuthStore } from '../../../store/authStore';
import { caseRepository } from '../repositories/caseRepository';
import type { CaseEntity } from '../types';

export function useCases() {
  const authMode = useAuthStore((state) => state.sessionMode);
  const rawGuestCases = useGuestStore((state) => state.cases);
  const migratedCaseCount = useGuestStore((state) => Object.keys(state.migratedCaseMap).length);
  const guestCases = useMemo(
    () =>
      rawGuestCases
        .filter((item) => !item.archivedAt && !item.deletedAt)
        .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()),
    [rawGuestCases],
  );
  const [remoteCases, setRemoteCases] = useState<CaseEntity[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (authMode !== 'authenticated') {
      setRemoteCases([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      setRemoteCases(await caseRepository.listCases());
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

  return {
    cases: authMode === 'authenticated' ? remoteCases : guestCases,
    loading,
    refresh,
  };
}
