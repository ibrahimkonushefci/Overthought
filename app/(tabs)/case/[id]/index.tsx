import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { ActivityIndicator, Alert, Animated, Modal, Pressable, Share, StyleSheet, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import ViewShot from 'react-native-view-shot';
import Svg, { Circle } from 'react-native-svg';
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronUp,
  CircleHelp,
  Crown,
  Plus,
  Share2,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import type {
  AnalysisOutput,
  AiVerdictOutput,
  AiVerdictRequestState,
  DeepReadAccessState,
  DeepReadResponse,
  OutcomeStatus,
} from '../../../../src/types/shared';
import { caseRepository } from '../../../../src/features/cases/repositories/caseRepository';
import { caseUpdateRepository } from '../../../../src/features/cases/repositories/caseUpdateRepository';
import { aiVerdictService } from '../../../../src/features/ai-verdict/aiVerdictService';
import { deepReadService } from '../../../../src/features/deep-read/deepReadService';
import type { CaseEntity, CaseUpdateEntity } from '../../../../src/features/cases/types';
import { getCaseId, isGuestCase } from '../../../../src/features/cases/types';
import { ScorePanel } from '../../../../src/features/cases/components/ScorePanel';
import { ShareResultCard } from '../../../../src/features/share/ShareResultCard';
import type { ShareCardPayload } from '../../../../src/features/share/shareTypes';
import { Screen } from '../../../../src/shared/ui/Screen';
import { AppText } from '../../../../src/shared/ui/Text';
import { Card } from '../../../../src/shared/ui/Card';
import { EmptyState } from '../../../../src/shared/ui/EmptyState';
import { colors, radii, spacing, typography } from '../../../../src/shared/theme/tokens';
import {
  categoryIcons,
  categoryLabels,
  getVerdictDisplayLabel,
  scoreColor,
  verdictIcons,
  verdictLabels,
} from '../../../../src/shared/utils/verdict';
import { relativeTime } from '../../../../src/shared/utils/date';
import { useAiVerdictStore } from '../../../../src/store/aiVerdictStore';

const detailScrollByCaseId = new Map<string, number>();
const quotaUpgradePromptedCaseIds = new Set<string>();
const caseDetailBackground = '#FBF9F2';
const aiVerdictTimeoutRecoveryDelaysMs = [2_000, 5_000, 10_000];

type DeepReadStatus = 'idle' | 'loading' | 'ready' | 'not_authenticated' | 'quota' | 'fair_use' | 'error';
const aiVerdictDeepReadLockStatuses = new Set<AiVerdictRequestState['status']>([
  'quota_exceeded',
  'fair_use_exceeded',
  'ip_daily_cap_exceeded',
  'global_daily_cap_exceeded',
  'ai_failed',
  'ai_timeout',
  'invalid_ai_response',
  'cache_write_failed',
  'unknown',
  'guest_key_required',
  'case_not_found',
]);

export default function CaseDetailRoute() {
  const router = useRouter();
  const { id, fromAnalysis } = useLocalSearchParams<{ id: string; fromAnalysis?: string }>();
  const [record, setRecord] = useState<CaseEntity | null>(null);
  const [updates, setUpdates] = useState<CaseUpdateEntity[]>([]);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [deepReadStatus, setDeepReadStatus] = useState<DeepReadStatus>('idle');
  const [deepReadResult, setDeepReadResult] = useState<Extract<DeepReadResponse, { ok: true }> | null>(null);
  const [deepReadMessage, setDeepReadMessage] = useState<string | null>(null);
  const [deepReadFailureAccess, setDeepReadFailureAccess] = useState<DeepReadAccessState | null>(null);
  const [sharePreviewVisible, setSharePreviewVisible] = useState(false);
  const [shareInProgress, setShareInProgress] = useState(false);
  const [quotaUpgradePromptVisible, setQuotaUpgradePromptVisible] = useState(false);
  const aiVerdictsByCaseId = useAiVerdictStore((state) => state.byCaseId);
  const aiVerdictRequestsByCaseId = useAiVerdictStore((state) => state.requestByCaseId);
  const shareCardRef = useRef<ViewShot | null>(null);
  const deepReadRequestInFlightRef = useRef(false);
  const shouldPresentNewResult = fromAnalysis === '1';
  const [shouldRunResultIntro, setShouldRunResultIntro] = useState(shouldPresentNewResult);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const refresh = useCallback(async () => {
    if (!id) {
      setInitialLoadComplete(true);
      return;
    }

    try {
      const nextRecord = await caseRepository.getCase(id);
      setRecord(nextRecord);
      setUpdates(nextRecord && isGuestCase(nextRecord) ? nextRecord.updates : await caseUpdateRepository.listUpdates(id));
    } catch (error) {
      Alert.alert('Could not refresh case', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setInitialLoadComplete(true);
    }
  }, [id]);

  useEffect(() => {
    setInitialLoadComplete(false);
    setRecord(null);
    setUpdates([]);
    setDeepReadStatus('idle');
    setDeepReadResult(null);
    setDeepReadMessage(null);
    setDeepReadFailureAccess(null);
    setShouldRunResultIntro(shouldPresentNewResult);
  }, [id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  useEffect(() => {
    if (!record) {
      return;
    }

    const currentCaseId = getCaseId(record);

    if (isGuestCase(record) || aiVerdictsByCaseId[currentCaseId]) {
      return;
    }

    void aiVerdictService.loadStoredVerdictForCase(record);
  }, [aiVerdictsByCaseId, record]);

  useEffect(() => {
    if (!record) {
      return;
    }

    const currentCaseId = getCaseId(record);
    const requestState = aiVerdictRequestsByCaseId[currentCaseId];

    if (isGuestCase(record) || aiVerdictsByCaseId[currentCaseId] || requestState?.status !== 'ai_timeout') {
      return;
    }

    const timers = aiVerdictTimeoutRecoveryDelaysMs.map((delayMs) =>
      setTimeout(() => {
        void aiVerdictService.loadStoredVerdictForCase(record);
      }, delayMs),
    );

    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [aiVerdictRequestsByCaseId, aiVerdictsByCaseId, record]);

  const routeToQuotaUpgrade = useCallback(
    (requestState?: AiVerdictRequestState) => {
      setQuotaUpgradePromptVisible(false);

      if (requestState?.access?.accessTier === 'guest') {
        router.push('/auth');
        return;
      }

      router.push('/paywall');
    },
    [router],
  );

  useEffect(() => {
    if (!record || !shouldPresentNewResult) {
      return;
    }

    const currentCaseId = getCaseId(record);
    const requestState = aiVerdictRequestsByCaseId[currentCaseId];

    if (!isUpgradeEligibleAiQuotaState(requestState) || quotaUpgradePromptedCaseIds.has(currentCaseId)) {
      return;
    }

    quotaUpgradePromptedCaseIds.add(currentCaseId);
    setQuotaUpgradePromptVisible(true);
  }, [aiVerdictRequestsByCaseId, record, shouldPresentNewResult]);

  const resultPresentationKey = shouldRunResultIntro
    ? record
      ? `new-analysis:${getCaseId(record)}`
      : `new-analysis:${id}`
    : undefined;
  const restoredScrollY = shouldRunResultIntro ? 0 : detailScrollByCaseId.get(id) ?? 0;

  useEffect(() => {
    if (!record || !shouldRunResultIntro) {
      fadeAnim.setValue(1);
      return;
    }

    fadeAnim.setValue(0);
    const animation = Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished) {
        setShouldRunResultIntro(false);
      }
    });

    return () => {
      animation.stop();
    };
  }, [fadeAnim, id, record, resultPresentationKey, shouldRunResultIntro]);

  if (!record) {
    return (
      <Screen scrollResetKey={resultPresentationKey}>
        {initialLoadComplete ? (
          <EmptyState title="Case not found." body="It may have been archived or deleted." />
        ) : (
          <View style={styles.initialLoadState}>
            <ActivityIndicator color={colors.brand.pink} />
            <AppText variant="meta" center>
              {shouldRunResultIntro ? 'Preparing verdict...' : 'Loading case...'}
            </AppText>
          </View>
        )}
      </Screen>
    );
  }

  const caseId = getCaseId(record);
  const aiVerdict = aiVerdictsByCaseId[caseId] ?? (isGuestCase(record) ? record.aiVerdict : undefined);
  const aiVerdictRequest = aiVerdictRequestsByCaseId[caseId];
  const aiVerdictLoading = aiVerdictRequest?.status === 'loading';
  const localVerdict = {
    verdictLabel: record.verdictLabel,
    delusionScore: record.delusionScore,
    explanationText: record.explanationText,
    nextMoveText: record.nextMoveText,
    verdictVersion: record.verdictVersion,
  };
  const visibleVerdict = !aiVerdictLoading && aiVerdict ? aiVerdict.verdict : localVerdict;
  const verdictSource = aiVerdictLoading
    ? 'loading'
    : aiVerdict
      ? aiVerdict.cache.source === 'cache'
        ? 'cache'
        : 'ai'
      : 'basic';
  const isAiVerdictVisible = verdictSource === 'ai' || verdictSource === 'cache';
  const aiVerdictDeepReadLocked = aiVerdictRequest
    ? aiVerdictDeepReadLockStatuses.has(aiVerdictRequest.status)
    : false;
  const quotaUpgradeEligible = isUpgradeEligibleAiQuotaState(aiVerdictRequest);
  const quotaRetryEligible = !shouldPresentNewResult && isRetryEligibleAiQuotaState(aiVerdictRequest) && !aiVerdict;
  const shouldShowDeepRead =
    !isAiVerdictVisible &&
    (verdictSource === 'basic' || deepReadStatus === 'loading' || deepReadStatus === 'ready' || aiVerdictDeepReadLocked);
  const heroDisplayLabel = aiVerdict
    ? aiVerdict.verdict.displayLabel
    : getVerdictDisplayLabel(visibleVerdict.verdictLabel, `${caseId}|${record.inputText}|${visibleVerdict.delusionScore}`);
  const displayCaseId = formatDisplayCaseId(getCaseId(record));
  const deepReadShare = deepReadStatus === 'ready' ? deepReadResult?.deepRead : null;
  const sharePayload: ShareCardPayload = {
    mode: deepReadShare ? 'deep_read' : 'result',
    title: heroDisplayLabel,
    caseDisplayId: displayCaseId,
    category: record.category,
    verdictLabel: visibleVerdict.verdictLabel,
    delusionScore: visibleVerdict.delusionScore,
    explanationText: visibleVerdict.explanationText,
    nextMoveText: visibleVerdict.nextMoveText,
    variant: isAiVerdictVisible ? 'ai' : 'basic',
    deepReadRoastLine: deepReadShare?.roastLine,
    deepReadTakeaway: deepReadShare?.whatToDoNext,
    appName: 'Overthought',
  };
  const shareMessage = deepReadShare
    ? `Overthought Deep Read: ${deepReadShare.roastLine} ${deepReadShare.whatToDoNext}`
    : `Overthought verdict: ${verdictLabels[visibleVerdict.verdictLabel]} (${visibleVerdict.delusionScore}/100). ${visibleVerdict.nextMoveText}`;

  const shareTextFallback = async () => {
    await Share.share({
      message: shareMessage,
    });
  };

  const retryAiVerdict = async () => {
    if (!record || aiVerdictLoading) {
      return;
    }

    await aiVerdictService.requestForCase(record);
  };

  const shareCard = async () => {
    if (shareInProgress) {
      return;
    }

    setShareInProgress(true);
    try {
      const canShareFiles = await Sharing.isAvailableAsync();
      const uri = await shareCardRef.current?.capture?.();

      if (canShareFiles && uri) {
        await Sharing.shareAsync(uri, {
          dialogTitle: 'Share your Overthought result',
          mimeType: 'image/png',
          UTI: 'public.png',
        });
        return;
      }

      await shareTextFallback();
    } catch (error) {
      try {
        await shareTextFallback();
      } catch {
        Alert.alert('Could not share result', error instanceof Error ? error.message : 'Try again.');
      }
    } finally {
      setShareInProgress(false);
    }
  };

  const setOutcome = async (outcomeStatus: OutcomeStatus) => {
    const previousRecord = record;
    setRecord({ ...record, outcomeStatus });

    try {
      await caseRepository.updateOutcome(id, outcomeStatus);
    } catch (error) {
      setRecord(previousRecord);
      Alert.alert('Could not update outcome', error instanceof Error ? error.message : 'Try again.');
    }
  };

  const archive = () => {
    Alert.alert('Delete this case?', 'This removes it from your active case file.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void caseRepository
            .archiveCase(id)
            .then(() => router.replace('/cases'))
            .catch((error) => {
              Alert.alert('Could not delete case', error instanceof Error ? error.message : 'Try again.');
            });
        },
      },
    ]);
  };

  const requestDeepRead = async () => {
    if (!record || deepReadStatus === 'loading' || deepReadRequestInFlightRef.current) {
      return;
    }

    deepReadRequestInFlightRef.current = true;
    setDeepReadStatus('loading');
    setDeepReadMessage(null);
    setDeepReadFailureAccess(null);

    try {
      const result = await deepReadService.requestCaseDeepRead(getCaseId(record));

      if (result.ok) {
        setDeepReadResult(result);
        setDeepReadFailureAccess(null);
        setDeepReadStatus('ready');
        return;
      }

      setDeepReadResult(null);
      setDeepReadMessage(result.message);
      setDeepReadFailureAccess(result.access ?? null);

      if (result.code === 'not_authenticated') {
        setDeepReadStatus('not_authenticated');
        return;
      }

      if (result.code === 'quota_exceeded') {
        setDeepReadStatus('quota');
        return;
      }

      if (result.code === 'fair_use_exceeded') {
        setDeepReadStatus('fair_use');
        return;
      }

      setDeepReadStatus('error');
    } finally {
      deepReadRequestInFlightRef.current = false;
    }
  };

  return (
    <Screen
      backgroundColor={caseDetailBackground}
      bottomInset={72}
      initialScrollY={restoredScrollY}
      onScrollYChange={(scrollY) => {
        if (!shouldRunResultIntro) {
          detailScrollByCaseId.set(id, scrollY);
        }
      }}
      scrollResetKey={resultPresentationKey}
    >
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <View style={styles.topRow}>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.iconButton}>
            <ArrowLeft color={colors.text.primary} size={21} strokeWidth={2.4} />
          </Pressable>
          <View style={styles.categoryPill}>
            <AppText variant="body" color={colors.text.secondary} style={styles.categoryText}>
              {categoryIcons[record.category]} {categoryLabels[record.category]}
            </AppText>
          </View>
          <Pressable accessibilityRole="button" onPress={() => setSharePreviewVisible(true)} style={styles.iconButton}>
            <Share2 color={colors.text.primary} size={21} strokeWidth={2.4} />
          </Pressable>
        </View>

        {isAiVerdictVisible && aiVerdict ? (
          <AiVerdictPremiumCard
            verdict={aiVerdict.verdict}
            displayLabel={heroDisplayLabel}
            caseDisplayId={displayCaseId}
            remainingLabel={aiVerdictAccessLabel(aiVerdict?.access ?? aiVerdictRequest?.access, isGuestCase(record))}
          />
        ) : (
          <>
            <AiVerdictStatusStrip
              source={verdictSource}
              requestState={aiVerdictRequest}
              access={aiVerdict?.access ?? aiVerdictRequest?.access}
              isGuest={isGuestCase(record)}
              onUpgrade={quotaUpgradeEligible && !quotaRetryEligible ? () => routeToQuotaUpgrade(aiVerdictRequest) : undefined}
              onRetry={quotaRetryEligible ? () => void retryAiVerdict() : undefined}
            />
            <ScorePanel
              caseId={caseId}
              score={visibleVerdict.delusionScore}
              verdictLabel={visibleVerdict.verdictLabel}
              displayLabel={heroDisplayLabel}
              readText={visibleVerdict.explanationText}
              nextMoveText={visibleVerdict.nextMoveText}
            />
          </>
        )}

        {shouldShowDeepRead ? (
          <View style={styles.deepRead}>
            <View style={styles.deepHeader}>
              <View style={styles.deepTitleRow}>
                <AppText variant="title" color={colors.text.onBrand} style={styles.deepTitle}>
                  Deep Read
                </AppText>
                <View style={styles.aiBadge}>
                  <Sparkles color={colors.text.onAccent} size={14} strokeWidth={2.8} />
                  <AppText variant="eyebrow" color={colors.text.onAccent} style={styles.aiBadgeText}>
                    AI
                  </AppText>
                </View>
              </View>
              <RemainingReads remaining={deepReadResult?.access.remaining ?? null} />
            </View>
            <AppText variant="subtitle" color="rgba(255, 255, 255, 0.72)" style={styles.deepSubtitle}>
              Extra context after a basic verdict: what is happening, what you are overreading, and what to do next.
            </AppText>
            <DeepReadContent
              locked={aiVerdictDeepReadLocked}
              status={deepReadStatus}
              result={deepReadResult}
              message={deepReadMessage}
              failureAccess={deepReadFailureAccess}
              quotaUpgradeRequestState={quotaUpgradeEligible && !quotaRetryEligible ? aiVerdictRequest : undefined}
              quotaRetryEligible={quotaRetryEligible}
              onRequest={() => void requestDeepRead()}
              onRetry={() => void retryAiVerdict()}
              onSignIn={() => router.push('/auth')}
              onUpgrade={() => routeToQuotaUpgrade(aiVerdictRequest)}
            />
          </View>
        ) : null}

        <View style={styles.caseFileSection}>
          <CaseFileDivider />

          <SectionLabel title="Original Situation" />
          <View style={styles.quote}>
            <AppText variant="subtitle" style={styles.quoteText}>
              {record.inputText}
            </AppText>
          </View>

          <View style={styles.sectionHeaderRow}>
            <SectionLabel title={`Updates · ${updates.length}`} noMargin />
            <Pressable accessibilityRole="button" onPress={() => router.push(`/case/${id}/add-update`)} style={styles.addUpdate}>
              <Plus color={colors.brand.pink} size={19} strokeWidth={2.6} />
              <AppText variant="body" color={colors.brand.pink} style={styles.addUpdateText}>
                Add update
              </AppText>
            </Pressable>
          </View>

          {updates.length > 0 ? (
            <View style={styles.updateList}>
              {updates.map((item) => (
                <Card key={'localId' in item ? item.localId : item.id} style={styles.updateCard}>
                  <AppText variant="meta">{relativeTime(item.createdAt)}</AppText>
                  <AppText variant="body" style={styles.updateText}>
                    {item.updateText}
                  </AppText>
                  {item.verdictLabel ? (
                    <AppText variant="meta">
                      {verdictLabels[item.verdictLabel]} · {item.delusionScore}/100
                    </AppText>
                  ) : null}
                </Card>
              ))}
            </View>
          ) : (
            <View style={styles.noUpdates}>
              <AppText variant="subtitle" center style={styles.noUpdatesText}>
                No updates yet. Plot still developing.
              </AppText>
            </View>
          )}

          <SectionLabel title="How Did It End?" />
          <View style={styles.outcomes}>
            <OutcomeButton icon={Check} label="I was right" selected={record.outcomeStatus === 'right'} onPress={() => void setOutcome('right')} />
            <OutcomeButton icon={X} label="I was wrong" selected={record.outcomeStatus === 'wrong'} onPress={() => void setOutcome('wrong')} />
            <OutcomeButton icon={CircleHelp} label="Still unclear" selected={record.outcomeStatus === 'unclear'} onPress={() => void setOutcome('unclear')} />
          </View>

          <Pressable accessibilityRole="button" onPress={archive} style={styles.deleteAction}>
            <Trash2 color={colors.text.secondary} size={17} strokeWidth={2.2} />
            <AppText variant="body" color={colors.text.secondary} style={styles.deleteText}>
              Delete this case
            </AppText>
          </Pressable>
        </View>
      </Animated.View>
      <SharePreviewModal
        payload={sharePayload}
        shareCardRef={shareCardRef}
        sharing={shareInProgress}
        visible={sharePreviewVisible}
        onClose={() => setSharePreviewVisible(false)}
        onShare={() => void shareCard()}
      />
      <AiQuotaUpgradeModal
        requestState={aiVerdictRequest}
        visible={quotaUpgradePromptVisible && quotaUpgradeEligible}
        onClose={() => setQuotaUpgradePromptVisible(false)}
        onUpgrade={() => routeToQuotaUpgrade(aiVerdictRequest)}
      />
    </Screen>
  );
}

function SharePreviewModal({
  payload,
  shareCardRef,
  sharing,
  visible,
  onClose,
  onShare,
}: {
  payload: ShareCardPayload;
  shareCardRef: RefObject<ViewShot | null>;
  sharing: boolean;
  visible: boolean;
  onClose: () => void;
  onShare: () => void;
}) {
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.shareModalOverlay}>
        <View style={styles.shareModalContent}>
          <View style={styles.sharePreviewScale}>
            <ShareResultCard payload={payload} />
          </View>
          <View style={styles.shareHiddenCapture} pointerEvents="none">
            <ViewShot
              ref={shareCardRef}
              options={{ format: 'png', quality: 1, result: 'tmpfile' }}
              style={styles.shareCapture}
            >
              <ShareResultCard payload={payload} />
            </ViewShot>
          </View>

          <View style={styles.shareActions}>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.shareSecondaryButton}>
              <X color={colors.text.primary} size={18} strokeWidth={2.5} />
              <AppText variant="body" style={styles.shareSecondaryText}>
                Close
              </AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: sharing }}
              disabled={sharing}
              onPress={onShare}
              style={[styles.sharePrimaryButton, sharing && styles.sharePrimaryButtonDisabled]}
            >
              {sharing ? <ActivityIndicator color={colors.text.onAccent} /> : <Share2 color={colors.text.onAccent} size={18} strokeWidth={2.6} />}
              <AppText variant="body" color={colors.text.onAccent} style={styles.sharePrimaryText}>
                {sharing ? 'Preparing...' : 'Share'}
              </AppText>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function AiQuotaUpgradeModal({
  requestState,
  visible,
  onClose,
  onUpgrade,
}: {
  requestState?: AiVerdictRequestState;
  visible: boolean;
  onClose: () => void;
  onUpgrade: () => void;
}) {
  const copy = quotaUpgradeCopy(requestState);

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.upgradeModalOverlay}>
        <View style={styles.upgradeModalContent}>
          <View style={styles.upgradeModalBadge}>
            <Crown color={colors.text.onAccent} size={15} strokeWidth={2.6} />
            <AppText variant="eyebrow" color={colors.text.onAccent} style={styles.upgradeModalBadgeText}>
              Premium
            </AppText>
          </View>
          <AppText variant="display" center style={styles.upgradeModalTitle}>
            {copy.title}
          </AppText>
          <AppText variant="subtitle" center style={styles.upgradeModalBody}>
            {copy.body}
          </AppText>
          <Pressable accessibilityRole="button" onPress={onUpgrade} style={styles.upgradeModalPrimary}>
            <Sparkles color={colors.text.onAccent} size={18} strokeWidth={2.8} />
            <AppText variant="title" center color={colors.text.onAccent} style={styles.upgradeModalPrimaryText}>
              {copy.cta}
            </AppText>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.upgradeModalSecondary}>
            <AppText variant="body" center color={colors.text.secondary} style={styles.upgradeModalSecondaryText}>
              Keep Basic verdict
            </AppText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function formatDisplayCaseId(caseId: string): string {
  const suffix = caseId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase();
  return suffix ? `OT-${suffix}` : 'OT';
}

type AiVerdictDisplaySource = 'loading' | 'ai' | 'cache' | 'basic';

function isUpgradeEligibleAiQuotaState(requestState?: AiVerdictRequestState): boolean {
  return (
    requestState?.status === 'quota_exceeded' &&
    (requestState.access?.accessTier === 'guest' || requestState.access?.accessTier === 'free')
  );
}

function isRetryEligibleAiQuotaState(requestState?: AiVerdictRequestState): boolean {
  return (
    requestState?.status === 'quota_exceeded' &&
    (requestState.access?.accessTier === 'free' || requestState.access?.quotaScope === 'daily')
  );
}

function quotaUpgradeCopy(requestState?: AiVerdictRequestState) {
  const isGuest = requestState?.access?.accessTier === 'guest';

  return {
    title: isGuest ? 'Your free AI verdicts are used up.' : "Today's free AI verdicts are used up.",
    body: isGuest
      ? 'Sign in to upgrade and get more AI verdicts for the cases you cannot stop replaying.'
      : 'Upgrade to Premium for more AI verdicts and sharper reads when Basic is not enough.',
    cta: isGuest ? 'Sign in to upgrade' : 'Upgrade',
  };
}

function accessCopy({
  requestState,
  isGuest,
}: {
  requestState: AiVerdictRequestState | undefined;
  isGuest: boolean;
}): string {
  const access = requestState?.access;

  if (!access) {
    return isGuest ? '2 free AI verdicts' : '2 AI verdicts/day';
  }

  if (access.accessTier === 'guest') {
    return `${access.remaining} of ${access.limit} free AI verdicts left`;
  }

  return `${access.remaining} of ${access.limit} AI verdicts left today`;
}

function aiVerdictStatusText({
  source,
  requestState,
  isGuest,
}: {
  source: AiVerdictDisplaySource;
  requestState?: AiVerdictRequestState;
  isGuest: boolean;
}) {
  if (source === 'loading') {
    return {
      label: 'AI verdict loading...',
      body: `Showing a basic preview while AI writes the final verdict. If AI succeeds, this result will update. ${accessCopy({ requestState, isGuest })}.`,
      loading: true,
      tone: 'loading' as const,
    };
  }

  if (source === 'ai' || source === 'cache') {
    return {
      label: 'AI verdict',
      body:
        source === 'cache'
          ? requestState?.message ?? `Cached result. ${accessCopy({ requestState, isGuest })}.`
          : `${accessCopy({ requestState, isGuest })}.`,
      loading: false,
      tone: 'ai' as const,
    };
  }

  if (!requestState || requestState.status === 'idle') {
    return {
      label: 'Basic verdict',
      body: isGuest ? 'AI verdict available for the first 2 guest cases.' : 'AI verdict available 2 times per day.',
      loading: false,
      tone: 'basic' as const,
    };
  }

  const quotaExceededMessage =
    requestState.status === 'quota_exceeded' && requestState.access?.accessTier === 'guest'
      ? requestState.access.reason === 'guest_lifetime_limit'
        ? "You've used your free guest AI verdicts. Sign in for daily AI verdicts."
        : "You've used today's guest AI verdicts. Showing basic verdict."
      : "You've used today's free AI verdicts. Showing basic verdict.";

  const fallbackMessageByStatus: Partial<Record<AiVerdictRequestState['status'], string>> = {
    quota_exceeded: quotaExceededMessage,
    ip_daily_cap_exceeded: 'AI verdicts are temporarily limited. Showing basic verdict.',
    global_daily_cap_exceeded: 'AI verdicts are temporarily limited. Showing basic verdict.',
    ai_failed: 'AI could not load. Showing basic verdict.',
    ai_timeout: 'AI timed out. Showing basic verdict.',
    unauthenticated: 'Sign in to use AI verdicts. Showing basic verdict.',
    guest_key_required: 'Guest AI access could not start. Showing basic verdict.',
    invalid_ai_response: 'AI returned an invalid result. Showing basic verdict.',
    case_not_found: 'AI could not find this case. Showing basic verdict.',
    fair_use_exceeded: 'AI is temporarily limited for fair use. Showing basic verdict.',
    cache_write_failed: 'AI could not save the result. Showing basic verdict.',
    unknown: 'AI is unavailable right now. Showing basic verdict.',
  };

  return {
    label: 'Basic verdict',
    body: fallbackMessageByStatus[requestState.status] ?? requestState.message ?? 'Showing basic verdict.',
    loading: false,
    tone: 'basic' as const,
  };
}

function AiVerdictStatusStrip({
  source,
  requestState,
  access,
  isGuest,
  onUpgrade,
  onRetry,
}: {
  source: AiVerdictDisplaySource;
  requestState?: AiVerdictRequestState;
  access?: AiVerdictRequestState['access'];
  isGuest: boolean;
  onUpgrade?: () => void;
  onRetry?: () => void;
}) {
  const statusText = aiVerdictStatusText({
    source,
    requestState: requestState ?? (access ? { status: 'idle', access, updatedAt: '' } : undefined),
    isGuest,
  });
  const upgradeCopy = onUpgrade ? quotaUpgradeCopy(requestState) : null;
  const bodyText = onRetry
    ? 'AI quota may be available again. Try AI Verdict when you want to use one for this case.'
    : statusText.body;

  return (
    <View style={[styles.aiVerdictStatus, statusText.tone === 'ai' && styles.aiVerdictStatusReady]}>
      <View style={styles.aiVerdictStatusHeader}>
        <View style={[styles.aiVerdictStatusBadge, statusText.tone === 'ai' && styles.aiVerdictStatusBadgeReady]}>
          {statusText.loading ? (
            <ActivityIndicator color={colors.text.secondary} size="small" />
          ) : (
            <Sparkles
              color={statusText.tone === 'ai' ? colors.text.onAccent : colors.text.secondary}
              size={13}
              strokeWidth={2.6}
            />
          )}
          <AppText
            variant="eyebrow"
            color={statusText.tone === 'ai' ? colors.text.onAccent : colors.text.secondary}
            style={styles.aiVerdictStatusLabel}
          >
            {statusText.label}
          </AppText>
        </View>
      </View>
      <AppText variant="meta" color={colors.text.secondary} style={styles.aiVerdictStatusBody}>
        {bodyText}
      </AppText>
      {upgradeCopy && onUpgrade ? (
        <QuotaUpgradeButton label={upgradeCopy.cta} onPress={onUpgrade} />
      ) : null}
      {onRetry ? <QuotaUpgradeButton label="Try AI Verdict" onPress={onRetry} /> : null}
    </View>
  );
}

function QuotaUpgradeButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.quotaUpgradeButton}>
      <Sparkles color={colors.text.onAccent} size={16} strokeWidth={2.7} />
      <AppText variant="body" center color={colors.text.onAccent} style={styles.quotaUpgradeButtonText}>
        {label}
      </AppText>
      <ArrowUpRight color={colors.text.onAccent} size={17} strokeWidth={2.8} />
    </Pressable>
  );
}

function aiVerdictAccessLabel(access: AiVerdictRequestState['access'] | undefined, isGuest: boolean): string {
  if (!access) {
    return isGuest ? '2 free' : '2/day';
  }

  if (access.accessTier === 'guest') {
    return `${access.remaining} left`;
  }

  return `${access.remaining} left today`;
}

function AiVerdictPremiumCard({
  verdict,
  displayLabel,
  caseDisplayId,
  remainingLabel,
}: {
  verdict: AiVerdictOutput;
  displayLabel: string;
  caseDisplayId: string;
  remainingLabel: string;
}) {
  const [openSection, setOpenSection] = useState<AiVerdictInsightKey>('evidenceCheck');
  const stroke = scoreColor(verdict.delusionScore);
  const circumference = 2 * Math.PI * 44;
  const offset = circumference - (verdict.delusionScore / 100) * circumference;
  const sections: AiVerdictInsightSection[] = [
    {
      key: 'evidenceCheck',
      label: 'Evidence check',
      body: verdict.evidenceCheckText,
    },
    {
      key: 'youreOverreading',
      label: "You're overreading",
      body: verdict.overreadingText,
    },
    {
      key: 'whatMatters',
      label: 'What matters',
      body: verdict.whatMattersText,
    },
  ];

  return (
    <View style={styles.aiPremiumCard}>
      <View style={styles.deepHeader}>
        <View style={styles.deepTitleRow}>
          <AppText variant="title" color={colors.text.onBrand} style={styles.deepTitle}>
            AI Verdict
          </AppText>
          <View style={styles.aiBadge}>
            <Sparkles color={colors.text.onAccent} size={14} strokeWidth={2.8} />
            <AppText variant="eyebrow" color={colors.text.onAccent} style={styles.aiBadgeText}>
              AI
            </AppText>
          </View>
        </View>
        <AppText variant="eyebrow" color="rgba(255, 255, 255, 0.58)" style={styles.remainingReads}>
          {remainingLabel}
        </AppText>
      </View>

      <AppText variant="subtitle" color="rgba(255, 255, 255, 0.72)" style={styles.deepSubtitle}>
        The version your group chat would actually send.
      </AppText>

      <View style={styles.aiPremiumHero}>
        <View style={styles.aiPremiumRingWrap}>
          <Svg width={112} height={112} viewBox="0 0 112 112">
            <Circle cx="56" cy="56" r="44" stroke="rgba(255, 255, 255, 0.14)" strokeWidth="10" fill="none" />
            <Circle
              cx="56"
              cy="56"
              r="44"
              stroke={stroke}
              strokeWidth="10"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={offset}
              rotation="-90"
              origin="56, 56"
            />
          </Svg>
          <View style={styles.aiPremiumScoreCenter}>
            <AppText variant="display" color={stroke} center style={styles.aiPremiumScore}>
              {verdict.delusionScore}
            </AppText>
            <AppText variant="eyebrow" color="rgba(255, 255, 255, 0.72)" center style={styles.aiPremiumScoreLabel}>
              Delusion
            </AppText>
          </View>
        </View>

        <View style={styles.aiPremiumHeroCopy}>
          <View style={styles.aiPremiumVerdictPill}>
            <AppText variant="eyebrow" color={colors.text.onBrand} style={styles.aiPremiumVerdictPillText} numberOfLines={1}>
              {verdictIcons[verdict.verdictLabel]} {verdictLabels[verdict.verdictLabel]}
            </AppText>
          </View>
          <AppText variant="display" color={colors.text.onBrand} style={styles.aiPremiumTitle} numberOfLines={3}>
            {displayLabel}
          </AppText>
          <AppText variant="eyebrow" color="rgba(255, 255, 255, 0.62)" style={styles.aiPremiumCaseId} numberOfLines={1}>
            Case {caseDisplayId}
          </AppText>
        </View>
      </View>

      <View style={styles.groupChatRead}>
        <View style={styles.groupChatBadge}>
          <AppText variant="eyebrow" color={colors.text.onAccent} style={styles.groupChatBadgeText}>
            The Read
          </AppText>
        </View>
        <AppText variant="title" color={colors.text.onBrand} style={styles.groupChatText}>
          {verdict.explanationText}
        </AppText>
      </View>

      <View style={styles.deepSections}>
        {sections.map((section) => (
          <AiVerdictInsightRow
            key={section.key}
            section={section}
            expanded={openSection === section.key}
            onPress={() => setOpenSection((current) => (current === section.key ? 'none' : section.key))}
          />
        ))}
      </View>

      <AppText variant="eyebrow" color={colors.accent.lime} style={styles.deepTakeawayLabel}>
        Do this →
      </AppText>
      <View style={styles.roastLine}>
        <AppText variant="body" color={colors.text.onAccent} style={styles.roastLineText}>
          {verdict.nextMoveText}
        </AppText>
      </View>
    </View>
  );
}

type AiVerdictInsightKey = 'none' | 'evidenceCheck' | 'youreOverreading' | 'whatMatters';

interface AiVerdictInsightSection {
  key: Exclude<AiVerdictInsightKey, 'none'>;
  label: string;
  body: string;
}

function AiVerdictInsightRow({
  section,
  expanded,
  onPress,
}: {
  section: AiVerdictInsightSection;
  expanded: boolean;
  onPress: () => void;
}) {
  const Icon = expanded ? ChevronUp : ChevronDown;

  return (
    <View style={styles.deepSection}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={onPress} style={styles.deepSectionHeader}>
        <AppText variant="eyebrow" color="rgba(255, 255, 255, 0.62)" style={styles.deepFieldLabel}>
          {section.label}
        </AppText>
        <Icon color="rgba(255, 255, 255, 0.62)" size={18} strokeWidth={2.2} />
      </Pressable>
      {expanded ? (
        <AppText variant="body" color={colors.text.onBrand} style={styles.deepFieldBody}>
          {section.body}
        </AppText>
      ) : null}
    </View>
  );
}

function DeepReadContent({
  locked,
  status,
  result,
  message,
  failureAccess,
  quotaUpgradeRequestState,
  quotaRetryEligible,
  onRequest,
  onRetry,
  onSignIn,
  onUpgrade,
}: {
  locked?: boolean;
  status: DeepReadStatus;
  result: Extract<DeepReadResponse, { ok: true }> | null;
  message: string | null;
  failureAccess: DeepReadAccessState | null;
  quotaUpgradeRequestState?: AiVerdictRequestState;
  quotaRetryEligible?: boolean;
  onRequest: () => void;
  onRetry: () => void;
  onSignIn: () => void;
  onUpgrade: () => void;
}) {
  const [openSection, setOpenSection] = useState<DeepReadSectionKey>('whatsActuallyHappening');

  if (locked) {
    const upgradeCopy = quotaUpgradeRequestState ? quotaUpgradeCopy(quotaUpgradeRequestState) : null;

    return (
      <View style={styles.deepStateStack}>
        <DeepReadStateText
          text={
            quotaRetryEligible
              ? 'AI quota may be available again. Try AI Verdict before opening Deep Read for this case.'
              : upgradeCopy
                ? `${upgradeCopy.title} Your basic verdict is still available.`
                : 'AI reads are used up for now. Your basic verdict is still available.'
          }
        />
        {upgradeCopy ? <DeepReadButton label={upgradeCopy.cta} onPress={onUpgrade} /> : null}
        {quotaRetryEligible ? <DeepReadButton label="Try AI Verdict" onPress={onRetry} /> : null}
      </View>
    );
  }

  if (status === 'ready' && result) {
    const sections: DeepReadSection[] = [
      {
        key: 'whatsActuallyHappening',
        label: "What's happening",
        body: result.deepRead.whatsActuallyHappening,
      },
      {
        key: 'whatYoureOverreading',
        label: "You're overreading",
        body: result.deepRead.whatYoureOverreading,
      },
      {
        key: 'whatEvidenceActuallyMatters',
        label: 'What matters',
        body: result.deepRead.whatEvidenceActuallyMatters,
      },
    ];

    return (
      <View style={styles.deepResult}>
        <View style={styles.groupChatRead}>
          <View style={styles.groupChatBadge}>
            <AppText variant="eyebrow" color={colors.text.onAccent} style={styles.groupChatBadgeText}>
              Group Chat Read
            </AppText>
          </View>
          <AppText variant="title" color={colors.text.onBrand} style={styles.groupChatText}>
            {result.deepRead.roastLine}
          </AppText>
        </View>

        <View style={styles.deepSections}>
          {sections.map((section) => (
            <DeepReadSectionRow
              key={section.key}
              section={section}
              expanded={openSection === section.key}
              onPress={() => setOpenSection((current) => (current === section.key ? 'none' : section.key))}
            />
          ))}
        </View>

        <AppText variant="eyebrow" color={colors.accent.lime} style={styles.deepTakeawayLabel}>
          Do this →
        </AppText>
        <View style={styles.roastLine}>
          <AppText variant="body" color={colors.text.onAccent} style={styles.roastLineText}>
            {result.deepRead.whatToDoNext}
          </AppText>
        </View>
      </View>
    );
  }

  if (status === 'not_authenticated') {
    return (
      <View style={styles.deepStateStack}>
        <DeepReadStateText text="Sign in to use Deep Read. AI verdicts and Deep Reads use separate limits." />
        <DeepReadButton label="Sign in" onPress={onSignIn} />
      </View>
    );
  }

  if (status === 'quota') {
    const quotaCopy =
      failureAccess?.limit === null || failureAccess?.limit === undefined
        ? "You've used today's free Deep Reads."
        : `You've used today's free Deep Reads (${failureAccess.remaining} of ${failureAccess.limit} left).`;

    return (
      <View style={styles.deepStateStack}>
        <DeepReadStateText text={`${quotaCopy} AI verdict quota is separate; your verdict above is unchanged.`} />
      </View>
    );
  }

  if (status === 'fair_use') {
    return (
      <View style={styles.deepStateStack}>
        <DeepReadStateText text="Deep Read is temporarily limited for fair use. AI verdict quota is separate; your verdict above is unchanged." />
        <DeepReadButton label="Try again" onPress={onRequest} />
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={styles.deepStateStack}>
        <DeepReadStateText text={message ?? "Deep Read couldn't load. Your verdict above is unchanged."} />
        <DeepReadStateText text="AI verdict and Deep Read are separate." compact />
        <DeepReadButton label="Try again" onPress={onRequest} />
      </View>
    );
  }

  return (
    <DeepReadButton
      label={status === 'loading' ? 'Reading...' : 'Get Deep Read'}
      loading={status === 'loading'}
      onPress={onRequest}
    />
  );
}

type DeepReadSectionKey =
  | 'none'
  | 'whatsActuallyHappening'
  | 'whatYoureOverreading'
  | 'whatEvidenceActuallyMatters';

interface DeepReadSection {
  key: Exclude<DeepReadSectionKey, 'none'>;
  label: string;
  body: string;
}

function DeepReadSectionRow({
  section,
  expanded,
  onPress,
}: {
  section: DeepReadSection;
  expanded: boolean;
  onPress: () => void;
}) {
  const Icon = expanded ? ChevronUp : ChevronDown;

  return (
    <View style={styles.deepSection}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={onPress}
        style={styles.deepSectionHeader}
      >
        <AppText variant="eyebrow" color="rgba(255, 255, 255, 0.62)" style={styles.deepFieldLabel}>
          {section.label}
        </AppText>
        <Icon color="rgba(255, 255, 255, 0.62)" size={18} strokeWidth={2.2} />
      </Pressable>
      {expanded ? (
        <AppText variant="body" color={colors.text.onBrand} style={styles.deepFieldBody}>
          {section.body}
        </AppText>
      ) : null}
    </View>
  );
}

function DeepReadStateText({ text, compact = false }: { text: string; compact?: boolean }) {
  return (
    <AppText
      variant="subtitle"
      color="rgba(255, 255, 255, 0.76)"
      style={[styles.deepStateText, compact && styles.deepStateTextCompact]}
    >
      {text}
    </AppText>
  );
}

function DeepReadButton({
  label,
  loading = false,
  onPress,
}: {
  label: string;
  loading?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: loading }}
      disabled={loading}
      onPress={onPress}
      style={[styles.deepButton, loading && styles.deepButtonDisabled]}
    >
      {loading ? <ActivityIndicator color={colors.text.onAccent} /> : null}
      <AppText variant="title" center color={colors.text.onAccent} style={styles.deepButtonText}>
        {label}
      </AppText>
      {!loading ? <ArrowUpRight color={colors.text.onAccent} size={19} strokeWidth={2.8} /> : null}
    </Pressable>
  );
}

function RemainingReads({ remaining }: { remaining: number | null }) {
  if (remaining === null) {
    return null;
  }

  return (
    <AppText variant="eyebrow" color="rgba(255, 255, 255, 0.58)" style={styles.remainingReads}>
      {remaining} left
    </AppText>
  );
}

function CaseFileDivider() {
  return (
    <View style={styles.caseFileDivider}>
      <View style={styles.caseFileLine} />
      <AppText variant="eyebrow" style={styles.caseFileLabel}>
        Case File
      </AppText>
      <View style={styles.caseFileLine} />
    </View>
  );
}

function SectionLabel({ title, noMargin = false }: { title: string; noMargin?: boolean }) {
  return (
    <AppText variant="eyebrow" style={[styles.sectionLabel, !noMargin && styles.sectionLabelSpaced]}>
      {title}
    </AppText>
  );
}

function OutcomeButton({
  icon: Icon,
  label,
  selected,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const contentColor = selected ? colors.text.onAccent : colors.text.secondary;

  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.outcome, selected && styles.outcomeSelected]}>
      <Icon color={contentColor} size={18} strokeWidth={2.2} />
      <AppText variant="body" center color={contentColor} style={styles.outcomeLabel}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    backgroundColor: caseDetailBackground,
    marginHorizontal: -spacing.xl,
    paddingBottom: 0,
    paddingHorizontal: spacing.xl,
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: colors.bg.surface,
    borderColor: colors.ui.border,
    borderRadius: 16,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  categoryPill: {
    backgroundColor: colors.bg.muted,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  categoryText: {
    fontFamily: typography.family.bodyMedium,
    fontSize: 14,
    lineHeight: 18,
  },
  sectionLabel: {
    fontFamily: typography.family.displayMedium,
    fontSize: 9,
    letterSpacing: 0.8,
    lineHeight: 12,
  },
  sectionLabelSpaced: {
    marginBottom: spacing.sm,
    marginTop: spacing.xl,
  },
  deepRead: {
    backgroundColor: '#090910',
    borderColor: '#090910',
    borderRadius: radii.xl,
    borderWidth: 2,
    gap: spacing.sm,
    marginTop: spacing.xl,
    padding: spacing.lg,
    shadowColor: '#090910',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  aiPremiumCard: {
    backgroundColor: '#090910',
    borderColor: '#090910',
    borderRadius: radii.xl,
    borderWidth: 2,
    gap: spacing.md,
    padding: spacing.lg,
    shadowColor: '#090910',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  aiPremiumHero: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.xs,
  },
  aiPremiumRingWrap: {
    alignItems: 'center',
    height: 112,
    justifyContent: 'center',
    width: 112,
  },
  aiPremiumScoreCenter: {
    alignItems: 'center',
    position: 'absolute',
  },
  aiPremiumScore: {
    fontFamily: typography.family.displayBold,
    fontSize: 38,
    lineHeight: 41,
  },
  aiPremiumScoreLabel: {
    fontFamily: typography.family.displaySemiBold,
    fontSize: 8,
    letterSpacing: 1,
    lineHeight: 11,
  },
  aiPremiumHeroCopy: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  aiPremiumVerdictPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#171720',
    borderRadius: radii.pill,
    maxWidth: '100%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  aiPremiumVerdictPillText: {
    fontFamily: typography.family.displayBold,
    fontSize: 8,
    letterSpacing: 1.4,
    lineHeight: 12,
  },
  aiPremiumTitle: {
    fontFamily: typography.family.displayBold,
    fontSize: 20,
    lineHeight: 25,
  },
  aiPremiumCaseId: {
    fontFamily: typography.family.displayBold,
    fontSize: 8,
    letterSpacing: 1.8,
    lineHeight: 12,
  },
  aiVerdictStatus: {
    backgroundColor: colors.bg.surface,
    borderColor: colors.ui.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.xs,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  aiVerdictStatusReady: {
    borderColor: colors.accent.lime,
  },
  aiVerdictStatusHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  aiVerdictStatusBadge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.bg.muted,
    borderRadius: radii.pill,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  aiVerdictStatusBadgeReady: {
    backgroundColor: colors.accent.lime,
  },
  aiVerdictStatusLabel: {
    fontFamily: typography.family.displayBold,
    fontSize: 9,
    letterSpacing: 1.1,
    lineHeight: 12,
  },
  aiVerdictStatusBody: {
    fontFamily: typography.family.bodyMedium,
    fontSize: 12,
    lineHeight: 17,
  },
  quotaUpgradeButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.accent.lime,
    borderColor: colors.brand.ink,
    borderRadius: radii.pill,
    borderWidth: 2,
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  quotaUpgradeButtonText: {
    fontFamily: typography.family.displayBold,
    fontSize: 13,
    lineHeight: 17,
  },
  deepHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  deepTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1,
    gap: spacing.sm,
  },
  deepTitle: {
    fontFamily: typography.family.displayBold,
    fontSize: 18,
    lineHeight: 23,
  },
  aiBadge: {
    alignItems: 'center',
    backgroundColor: colors.accent.lime,
    borderRadius: radii.pill,
    flexDirection: 'row',
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  aiBadgeText: {
    fontFamily: typography.family.displayBold,
    fontSize: 10,
    letterSpacing: 0,
    lineHeight: 12,
  },
  remainingReads: {
    flexShrink: 0,
    fontFamily: typography.family.displayBold,
    fontSize: 9,
    letterSpacing: 1.7,
    lineHeight: 13,
  },
  deepSubtitle: {
    fontFamily: typography.family.body,
    fontSize: 11,
    lineHeight: 17,
  },
  deepButton: {
    alignItems: 'center',
    backgroundColor: colors.accent.lime,
    borderRadius: radii.md,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: 52,
  },
  deepButtonDisabled: {
    opacity: 0.72,
  },
  deepButtonText: {
    fontFamily: typography.family.displayBold,
    fontSize: 14,
    lineHeight: 19,
  },
  deepResult: {
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  groupChatRead: {
    backgroundColor: '#111119',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.xl,
    position: 'relative',
  },
  groupChatBadge: {
    backgroundColor: colors.accent.lime,
    borderRadius: radii.pill,
    left: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
    position: 'absolute',
    top: -spacing.sm,
  },
  groupChatBadgeText: {
    fontFamily: typography.family.displayBold,
    fontSize: 9,
    letterSpacing: 1.1,
    lineHeight: 12,
  },
  groupChatText: {
    fontFamily: typography.family.displayBold,
    fontSize: 17,
    lineHeight: 24,
  },
  deepSections: {
    borderBottomColor: 'rgba(255, 255, 255, 0.09)',
    borderBottomWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.09)',
    borderTopWidth: 1,
  },
  deepSection: {
    borderTopColor: 'rgba(255, 255, 255, 0.09)',
    borderTopWidth: 1,
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  deepSectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 22,
  },
  deepFieldLabel: {
    fontFamily: typography.family.displayBold,
    fontSize: 9,
    letterSpacing: 1.5,
    lineHeight: 12,
  },
  deepFieldBody: {
    fontFamily: typography.family.body,
    fontSize: 14,
    lineHeight: 21,
  },
  deepTakeawayLabel: {
    fontFamily: typography.family.displayBold,
    fontSize: 10,
    letterSpacing: 1.3,
    lineHeight: 13,
  },
  roastLine: {
    backgroundColor: colors.accent.lime,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  roastLineText: {
    fontFamily: typography.family.displayBold,
    fontSize: 15,
    lineHeight: 20,
  },
  deepStateStack: {
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  deepStateText: {
    fontFamily: typography.family.body,
    fontSize: 13,
    lineHeight: 19,
  },
  deepStateTextCompact: {
    marginTop: -spacing.sm,
  },
  sectionHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
  },
  caseFileSection: {
    backgroundColor: caseDetailBackground,
    marginHorizontal: -spacing.xl,
    marginTop: spacing.xl,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  quote: {
    backgroundColor: '#F0ECE5',
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  quoteText: {
    color: colors.text.primary,
    fontFamily: typography.family.body,
    fontSize: 13,
    lineHeight: 20,
  },
  addUpdate: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  addUpdateText: {
    fontFamily: typography.family.bodyMedium,
    fontSize: 13,
  },
  updateList: {
    gap: spacing.md,
    marginTop: spacing.md,
  },
  updateCard: {
    padding: spacing.lg,
  },
  updateText: {
    fontFamily: typography.family.body,
    fontSize: 14,
    lineHeight: 21,
    marginVertical: spacing.sm,
  },
  noUpdates: {
    borderColor: colors.ui.border,
    borderRadius: radii.lg,
    borderStyle: 'dashed',
    borderWidth: 1,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  noUpdatesText: {
    fontFamily: typography.family.bodyMedium,
    fontSize: 14,
    lineHeight: 19,
  },
  caseFileDivider: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: 0,
    marginBottom: spacing.lg,
    paddingTop: spacing.sm,
  },
  caseFileLine: {
    backgroundColor: colors.ui.border,
    flex: 1,
    height: 1,
  },
  caseFileLabel: {
    color: colors.text.secondary,
    fontFamily: typography.family.displayBold,
    fontSize: 10,
    letterSpacing: 2.1,
    lineHeight: 13,
  },
  outcomes: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  outcome: {
    alignItems: 'center',
    backgroundColor: colors.bg.surface,
    borderColor: colors.ui.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flex: 1,
    minHeight: 78,
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
  },
  outcomeLabel: {
    fontFamily: typography.family.displayMedium,
    fontSize: 12,
    lineHeight: 16,
  },
  outcomeSelected: {
    backgroundColor: colors.accent.lime,
    borderColor: colors.brand.ink,
    borderWidth: 2,
  },
  deleteAction: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: spacing.lg,
  },
  deleteText: {
    fontFamily: typography.family.bodyMedium,
    fontSize: 14,
    lineHeight: 19,
  },
  initialLoadState: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center',
  },
  shareModalOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(31, 23, 34, 0.72)',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
  },
  shareModalContent: {
    alignItems: 'center',
    gap: spacing.lg,
    maxWidth: 360,
    width: '100%',
  },
  sharePreviewScale: {
    transform: [{ scale: 0.96 }],
  },
  shareHiddenCapture: {
    left: -10000,
    position: 'absolute',
    top: 0,
  },
  shareCapture: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    justifyContent: 'center',
  },
  shareActions: {
    flexDirection: 'row',
    gap: spacing.md,
    width: '100%',
  },
  sharePrimaryButton: {
    alignItems: 'center',
    backgroundColor: colors.accent.lime,
    borderColor: colors.brand.ink,
    borderRadius: radii.pill,
    borderWidth: 2,
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: spacing.lg,
  },
  sharePrimaryButtonDisabled: {
    opacity: 0.72,
  },
  sharePrimaryText: {
    fontFamily: typography.family.displayBold,
    fontSize: 15,
    lineHeight: 20,
  },
  shareSecondaryButton: {
    alignItems: 'center',
    backgroundColor: colors.bg.surface,
    borderColor: colors.brand.ink,
    borderRadius: radii.pill,
    borderWidth: 2,
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: spacing.lg,
  },
  shareSecondaryText: {
    fontFamily: typography.family.displayBold,
    fontSize: 15,
    lineHeight: 20,
  },
  upgradeModalOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(31, 23, 34, 0.72)',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
  },
  upgradeModalContent: {
    alignItems: 'center',
    backgroundColor: colors.bg.surface,
    borderColor: colors.brand.ink,
    borderRadius: radii.xl,
    borderWidth: 2,
    gap: spacing.md,
    maxWidth: 360,
    padding: spacing.xl,
    shadowColor: colors.brand.ink,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 1,
    shadowRadius: 0,
    width: '100%',
    elevation: 7,
  },
  upgradeModalBadge: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.accent.lime,
    borderRadius: radii.pill,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  upgradeModalBadgeText: {
    fontFamily: typography.family.displayBold,
    fontSize: 10,
    letterSpacing: 1.1,
    lineHeight: 13,
  },
  upgradeModalTitle: {
    fontFamily: typography.family.displayBold,
    fontSize: 30,
    lineHeight: 34,
  },
  upgradeModalBody: {
    color: colors.text.secondary,
    fontFamily: typography.family.bodyMedium,
    fontSize: 15,
    lineHeight: 21,
  },
  upgradeModalPrimary: {
    alignItems: 'center',
    backgroundColor: colors.accent.lime,
    borderColor: colors.brand.ink,
    borderRadius: radii.pill,
    borderWidth: 2,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    marginTop: spacing.xs,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    width: '100%',
  },
  upgradeModalPrimaryText: {
    fontFamily: typography.family.displayBold,
    fontSize: 15,
    lineHeight: 20,
  },
  upgradeModalSecondary: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: spacing.lg,
  },
  upgradeModalSecondaryText: {
    fontFamily: typography.family.displaySemiBold,
    fontSize: 14,
    lineHeight: 18,
  },
});
