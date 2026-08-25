import { useEffect } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { CaseAiVerdictSnapshot, GuestCaseLocal } from '../src/types/shared';
import { authService } from '../src/features/auth/authService';
import { useAiVerdictStore } from '../src/store/aiVerdictStore';
import { useGuestStore } from '../src/store/guestStore';
import { useUiPreferencesStore } from '../src/store/uiPreferencesStore';
import { AppText } from '../src/shared/ui/Text';

const SCREENSHOT_CASE_ID = 'case-screenshot-mixed-signals';
const SCREENSHOT_TIMESTAMP = '2026-08-25T12:00:00.000Z';

const smartVerdict: CaseAiVerdictSnapshot = {
  verdict: {
    verdictLabel: 'dangerous_overthinking',
    delusionScore: 78,
    explanationText:
      'He is saying exactly what you want to hear while doing nothing to back it up. That “miss you” is pure lip service.',
    nextMoveText: 'Reply once: “Great—when are you free to actually make a plan?” Then let his follow-through answer.',
    verdictVersion: 1,
    displayLabel: 'Empty Miss You',
    evidenceCheckText:
      'His “miss you” text is a verbal receipt, but the lack of any actual plan is a glaring hole in his follow-through.',
    overreadingText: 'You are treating affectionate words as if they already count as changed behavior.',
    whatMattersText: 'A date, a day, and a time matter more than another emotional late-night message.',
    source: 'ai',
  },
  localFallback: {
    verdictLabel: 'dangerous_overthinking',
    delusionScore: 78,
    explanationText: 'His words and actions are not matching.',
    nextMoveText: 'Ask for a concrete plan once, then step back.',
    verdictVersion: 1,
  },
  cache: {
    id: 'screenshot-cache',
    source: 'generated',
    targetFingerprint: 'screenshot-fixture',
    modelProvider: 'fixture',
    modelName: 'fixture',
    modelVersion: '1',
    promptVersion: 1,
    responseSchemaVersion: 1,
    createdAt: SCREENSHOT_TIMESTAMP,
  },
  access: {
    accessTier: 'guest',
    allowed: true,
    used: 1,
    remaining: 1,
    limit: 2,
    quotaScope: 'lifetime',
    quotaBucket: 'screenshot',
  },
  updatedAt: SCREENSHOT_TIMESTAMP,
};

const screenshotCases: GuestCaseLocal[] = [
  {
    localId: SCREENSHOT_CASE_ID,
    localOwnerId: 'guest-screenshot',
    title: 'He says he misses me but never makes a plan.',
    category: 'romance',
    inputText: 'He says he misses me, but every time I ask when we can meet he changes the subject or disappears.',
    verdictLabel: smartVerdict.verdict.verdictLabel,
    delusionScore: smartVerdict.verdict.delusionScore,
    explanationText: smartVerdict.verdict.explanationText,
    nextMoveText: smartVerdict.verdict.nextMoveText,
    verdictVersion: 1,
    outcomeStatus: 'unknown',
    lastAnalyzedAt: SCREENSHOT_TIMESTAMP,
    createdAt: SCREENSHOT_TIMESTAMP,
    updatedAt: SCREENSHOT_TIMESTAMP,
    archivedAt: null,
    deletedAt: null,
    updates: [],
    syncStatus: 'local_only',
    aiVerdict: smartVerdict,
  },
  {
    localId: 'case-screenshot-friday',
    localOwnerId: 'guest-screenshot',
    title: 'He asked if I was free Friday, then never made a plan.',
    category: 'romance',
    inputText: 'He asked if I was free Friday, then never made a plan.',
    verdictLabel: 'dangerous_overthinking',
    delusionScore: 72,
    explanationText: 'A question is not a plan without follow-through.',
    nextMoveText: 'Do not chase unfinished logistics.',
    verdictVersion: 1,
    outcomeStatus: 'wrong',
    lastAnalyzedAt: '2026-08-23T12:00:00.000Z',
    createdAt: '2026-08-23T12:00:00.000Z',
    updatedAt: '2026-08-24T12:00:00.000Z',
    archivedAt: null,
    deletedAt: null,
    updates: [],
    syncStatus: 'local_only',
  },
  {
    localId: 'case-screenshot-date',
    localOwnerId: 'guest-screenshot',
    title: 'She picked Saturday, booked dinner, then replied dry.',
    category: 'romance',
    inputText: 'She picked Saturday, booked dinner, then replied dry.',
    verdictLabel: 'slight_reach',
    delusionScore: 24,
    explanationText: 'The concrete plan matters more than one dry reply.',
    nextMoveText: 'Keep the date and stop grading every message.',
    verdictVersion: 1,
    outcomeStatus: 'right',
    lastAnalyzedAt: '2026-08-20T12:00:00.000Z',
    createdAt: '2026-08-20T12:00:00.000Z',
    updatedAt: '2026-08-22T12:00:00.000Z',
    archivedAt: null,
    deletedAt: null,
    updates: [],
    syncStatus: 'local_only',
  },
  {
    localId: 'case-screenshot-profile',
    localOwnerId: 'guest-screenshot',
    title: 'His dating profile is still active after three dates.',
    category: 'romance',
    inputText: 'His dating profile is still active after three dates.',
    verdictLabel: 'mild_delusion',
    delusionScore: 68,
    explanationText: 'Three dates do not create exclusivity by default.',
    nextMoveText: 'Ask directly what you are both looking for.',
    verdictVersion: 1,
    outcomeStatus: 'unclear',
    lastAnalyzedAt: '2026-08-18T12:00:00.000Z',
    createdAt: '2026-08-18T12:00:00.000Z',
    updatedAt: '2026-08-19T12:00:00.000Z',
    archivedAt: null,
    deletedAt: null,
    updates: [],
    syncStatus: 'local_only',
  },
];

export default function ScreenshotLabRoute() {
  const router = useRouter();
  const { scene = 'home' } = useLocalSearchParams<{ scene?: string }>();

  useEffect(() => {
    if (!__DEV__) {
      router.replace('/home');
      return;
    }

    authService.continueAsGuest();

    if (scene === 'welcome') {
      router.replace('/welcome');
      return;
    }

    useGuestStore.setState({
      localGuestId: 'guest-screenshot',
      guestAiKey: 'guest-ai-screenshot',
      cases: screenshotCases,
    });
    useAiVerdictStore.setState({
      byCaseId: { [SCREENSHOT_CASE_ID]: smartVerdict },
      requestByCaseId: {
        [SCREENSHOT_CASE_ID]: {
          status: 'success',
          access: smartVerdict.access,
          updatedAt: SCREENSHOT_TIMESTAMP,
        },
      },
    });
    useUiPreferencesStore.setState({ hasSeenFirstUseHelp: true });

    const routeByScene: Record<string, '/home' | '/new-case' | '/cases' | '/stats'> = {
      home: '/home',
      'new-case': '/new-case',
      cases: '/cases',
      stats: '/stats',
    };

    if (scene === 'smart-verdict') {
      router.replace(`/case/${SCREENSHOT_CASE_ID}`);
      return;
    }

    router.replace(routeByScene[scene] ?? '/home');
  }, [router, scene]);

  return (
    <View>
      <AppText>Preparing screenshot scene…</AppText>
    </View>
  );
}
