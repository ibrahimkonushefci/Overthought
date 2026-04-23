import { useEffect, useMemo, useRef } from 'react';
import { Alert } from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { useGuestStore } from '../../store/guestStore';
import { migrationService } from './migrationService';

export function MigrationPrompt() {
  const sessionMode = useAuthStore((state) => state.sessionMode);
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const cases = useGuestStore((state) => state.cases);
  const promptDecision = useGuestStore((state) =>
    userId ? state.migrationPromptByUserId[userId] : undefined,
  );
  const promptVisibleRef = useRef(false);

  const hasMigratableCases = useMemo(
    () => cases.some((item) => !item.deletedAt && !useGuestStore.getState().migratedCaseMap[item.localId]),
    [cases],
  );

  useEffect(() => {
    if (
      sessionMode !== 'authenticated' ||
      !userId ||
      promptDecision ||
      !hasMigratableCases ||
      promptVisibleRef.current
    ) {
      return;
    }

    promptVisibleRef.current = true;
    Alert.alert('Move your saved cases to your account?', 'Your local guest cases can be synced so they are available after you sign in.', [
      {
        text: 'Not now',
        style: 'cancel',
        onPress: () => {
          useGuestStore.getState().markMigrationPromptSkipped(userId);
          useGuestStore.getState().clearGuestSessionData();
          promptVisibleRef.current = false;
        },
      },
      {
        text: 'Move cases',
        onPress: () => {
          void migrate(userId).finally(() => {
            promptVisibleRef.current = false;
          });
        },
      },
    ]);
  }, [hasMigratableCases, promptDecision, sessionMode, userId]);

  return null;
}

async function migrate(userId: string) {
  const result = await migrationService.migrateGuestCases();

  if (result.failed > 0) {
    Alert.alert(
      'Migration paused',
      'Some saved cases could not be moved. Your local guest cases were kept so you can try again later.',
    );
    return;
  }

  useGuestStore.getState().markMigrationPromptCompleted(userId);
}
