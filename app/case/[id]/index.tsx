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
  ScrollText,
  Share2,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import type {
  AnalysisOutput,
  AiVerdictOutput,
  AiVerdictResponse,
  DeepReadResponse,
  OutcomeStatus,
} from '../../../src/types/shared';
import { caseRepository } from '../../../src/features/cases/repositories/caseRepository';
import { caseUpdateRepository } from '../../../src/features/cases/repositories/caseUpdateRepository';
import { aiVerdictService } from '../../../src/features/ai-verdict/aiVerdictService';
import { getCachedCaseById } from '../../../src/features/cases/services/useCases';
import { deepReadService } from '../../../src/features/deep-read/deepReadService';
import type { CaseEntity, CaseUpdateEntity } from '../../../src/features/cases/types';
import { getCaseId, isGuestCase } from '../../../src/features/cases/types';
import { ScorePanel } from '../../../src/features/cases/components/ScorePanel';
import { ShareResultCard } from '../../../src/features/share/ShareResultCard';
import type { ShareCardPayload } from '../../../src/features/share/shareTypes';
import { Screen } from '../../../src/shared/ui/Screen';
import { AppText } from '../../../src/shared/ui/Text';
import { Card } from '../../../src/shared/ui/Card';
import { EmptyState } from '../../../src/shared/ui/EmptyState';
import { colors, radii, shadows, spacing, typography } from '../../../src/shared/theme/tokens';
import {
  categoryIcons,
  categoryLabels,
  getVerdictDisplayLabel,
  scoreColor,
  verdictIcons,
  verdictLabels,
} from '../../../src/shared/utils/verdict';
import { relativeTime } from '../../../src/shared/utils/date';

const detailScrollByCaseId = new Map<string, number>();
const caseDetailBackground = '#FBF9F2';

type DeepReadStatus = 'idle' | 'loading' | 'ready';

function sortUpdatesNewestFirst(items: CaseUpdateEntity[]): CaseUpdateEntity[] {
  return [...items].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

export default function CaseDetailRoute() {
  const router = useRouter();
  const { id, fromAnalysis } = useLocalSearchParams<{ id: string; fromAnalysis?: string }>();
  const initialCachedRecord = id ? getCachedCaseById(id) : null;
  const [record, setRecord] = useState<CaseEntity | null>(initialCachedRecord);
  const [updates, setUpdates] = useState<CaseUpdateEntity[]>([]);
  const [initialLoadComplete, setInitialLoadComplete] = useState(Boolean(initialCachedRecord));
  const [deepReadStatus, setDeepReadStatus] = useState<DeepReadStatus>('idle');
  const [deepReadResult, setDeepReadResult] = useState<Extract<DeepReadResponse, { ok: true }> | null>(null);
  const [sharePreviewVisible, setSharePreviewVisible] = useState(false);
  const [shareInProgress, setShareInProgress] = useState(false);
  const [legacyUpgradeLoading, setLegacyUpgradeLoading] = useState(false);
  const shareCardRef = useRef<ViewShot | null>(null);
  const recordRef = useRef<CaseEntity | null>(initialCachedRecord);
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

      if (!nextRecord) {
        setRecord(null);
        setUpdates([]);
        return;
      }

      setRecord(nextRecord);
      recordRef.current = nextRecord;

      if (isGuestCase(nextRecord)) {
        setUpdates(sortUpdatesNewestFirst(nextRecord.updates));
        return;
      }

      try {
        const nextUpdates = await caseUpdateRepository.listUpdates(getCaseId(nextRecord));
        setUpdates(sortUpdatesNewestFirst(nextUpdates));
      } catch {
        setUpdates([]);
      }
    } catch (error) {
      const cachedRecord = getCachedCaseById(id);

      if (cachedRecord) {
        setRecord(cachedRecord);
        recordRef.current = cachedRecord;
        setUpdates(isGuestCase(cachedRecord) ? sortUpdatesNewestFirst(cachedRecord.updates) : []);
      } else if (!recordRef.current) {
        Alert.alert('Could not refresh case', error instanceof Error ? error.message : 'Try again.');
      }
    } finally {
      setInitialLoadComplete(true);
    }
  }, [id]);

  useEffect(() => {
    const cachedRecord = id ? getCachedCaseById(id) : null;
    recordRef.current = cachedRecord;
    setInitialLoadComplete(Boolean(cachedRecord));
    setRecord(cachedRecord);
    setUpdates(cachedRecord && isGuestCase(cachedRecord) ? sortUpdatesNewestFirst(cachedRecord.updates) : []);
    setDeepReadStatus('idle');
    setDeepReadResult(null);
    setShouldRunResultIntro(shouldPresentNewResult);
  }, [id]);

  useEffect(() => {
    recordRef.current = record;
  }, [record]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  useEffect(() => {
    if (!record || isGuestCase(record) || deepReadStatus === 'loading' || deepReadStatus === 'ready') {
      return;
    }

    let cancelled = false;

    void deepReadService.loadStoredCaseDeepRead(record).then((storedDeepRead) => {
      if (cancelled || !storedDeepRead) {
        return;
      }

      setDeepReadResult(storedDeepRead);
      setDeepReadStatus('ready');
    });

    return () => {
      cancelled = true;
    };
  }, [deepReadStatus, record]);

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
  const legacyVerdict: AnalysisOutput = record.legacyBasicSnapshot ?? {
    verdictLabel: record.verdictLabel,
    delusionScore: record.delusionScore,
    explanationText: record.explanationText,
    nextMoveText: record.nextMoveText,
    verdictVersion: record.verdictVersion,
  };
  const smartVerdict = record.resultSource === 'smart' ? record.smartVerdict : undefined;
  const isSmartVerdictVisible = record.resultSource === 'smart' && Boolean(smartVerdict);
  const visibleVerdict = smartVerdict ?? legacyVerdict;
  const heroDisplayLabel = smartVerdict
    ? smartVerdict.displayLabel
    : getVerdictDisplayLabel(visibleVerdict.verdictLabel, `${caseId}|${record.inputText}|${visibleVerdict.delusionScore}`);
  const displayCaseId = formatDisplayCaseId(getCaseId(record));
  const sharePayload: ShareCardPayload = {
    mode: 'result',
    title: heroDisplayLabel,
    caseDisplayId: displayCaseId,
    category: record.category,
    verdictLabel: visibleVerdict.verdictLabel,
    delusionScore: visibleVerdict.delusionScore,
    explanationText: visibleVerdict.explanationText,
    nextMoveText: visibleVerdict.nextMoveText,
    variant: isSmartVerdictVisible ? 'ai' : 'basic',
    appName: 'Overthought',
  };
  const shareMessage = `Overthought verdict: ${verdictLabels[visibleVerdict.verdictLabel]} (${visibleVerdict.delusionScore}/100). ${visibleVerdict.nextMoveText}`;

  const shareTextFallback = async () => {
    await Share.share({
      message: shareMessage,
    });
  };

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/cases');
  };

  const upgradeLegacyVerdict = async () => {
    if (!record || record.resultSource !== 'legacy_basic' || legacyUpgradeLoading) {
      return;
    }

    setLegacyUpgradeLoading(true);
    const result = await aiVerdictService.requestForCase(record);

    if (result.ok) {
      await refresh();
      setLegacyUpgradeLoading(false);
      return;
    }

    setLegacyUpgradeLoading(false);
    showLegacyUpgradeFailure(result, router);
  };

  const confirmLegacyUpgrade = () => {
    Alert.alert(
      'Upgrade this legacy case?',
      'This explicitly uses one Smart Verdict allowance. The original Basic result will be kept internally.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Upgrade', onPress: () => void upgradeLegacyVerdict() },
      ],
    );
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

  return (
    <Screen
      backgroundColor={caseDetailBackground}
      bottomInset={44}
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
          <Pressable accessibilityRole="button" onPress={goBack} style={styles.iconButton}>
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

        {isSmartVerdictVisible && smartVerdict ? (
          <AiVerdictPremiumCard
            verdict={smartVerdict}
            displayLabel={heroDisplayLabel}
            remainingLabel={record.aiVerdict?.access ? aiVerdictAccessLabel(record.aiVerdict.access, isGuestCase(record)) : 'Saved'}
          />
        ) : (
          <>
            <LegacyBasicVerdictBanner loading={legacyUpgradeLoading} onUpgrade={confirmLegacyUpgrade} />
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

        {deepReadStatus === 'ready' && deepReadResult ? (
          <View style={styles.deepRead}>
            <View style={styles.deepHeader}>
              <View style={styles.deepTitleRow}>
                <AppText variant="title" color={colors.text.onBrand} style={styles.deepTitle}>
                  Saved Deep Read (legacy)
                </AppText>
                <View style={styles.aiBadge}>
                  <Sparkles color={colors.text.onAccent} size={14} strokeWidth={2.8} />
                  <AppText variant="eyebrow" color={colors.text.onAccent} style={styles.aiBadgeText}>
                    Read only
                  </AppText>
                </View>
              </View>
            </View>
            <AppText variant="subtitle" color="rgba(255, 255, 255, 0.72)" style={styles.deepSubtitle}>
              This saved result remains available, but new Deep Reads are no longer generated.
            </AppText>
            <DeepReadContent
              result={deepReadResult}
            />
          </View>
        ) : null}

        <View style={styles.caseFileSection}>
          <CaseFileDivider />

          <SectionLabel title="Original Situation" />
          <View style={styles.quote}>
            <AppText variant="body" style={styles.quoteText}>
              {record.inputText}
            </AppText>
          </View>

          <View style={styles.plotHeader}>
            <View style={styles.plotHeaderCopy}>
              <AppText variant="title" style={styles.plotTitle}>
                Plot Updates
              </AppText>
              <AppText variant="body" color={colors.text.secondary} style={styles.plotSubtitle}>
                Receipts from what happened next
              </AppText>
            </View>
            <View style={styles.receiptCountBadge}>
              <AppText variant="eyebrow" color={colors.text.onAccent} style={styles.receiptCountText}>
                {updates.length} {updates.length === 1 ? 'Receipt' : 'Receipts'}
              </AppText>
            </View>
          </View>

          {updates.length > 0 ? (
            <View style={styles.updateList}>
              {updates.map((item, index) => (
                <View key={'localId' in item ? item.localId : item.id} style={styles.timelineRow}>
                  <View style={styles.timelineRail}>
                    <View style={styles.timelineDot} />
                    {index < updates.length - 1 ? <View style={styles.timelineLine} /> : null}
                  </View>
                  <Card style={styles.updateCard}>
                    <AppText variant="meta" style={styles.updateTime}>
                      {relativeTime(item.createdAt)}
                    </AppText>
                    <AppText variant="body" style={styles.updateText}>
                      {item.updateText}
                    </AppText>
                  </Card>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.noUpdates}>
              <AppText variant="body" center style={styles.noUpdatesText}>
                No receipts yet.{'\n'}
                Add what happened next when the plot moves.
              </AppText>
            </View>
          )}

          <Pressable accessibilityRole="button" onPress={() => router.push(`/case/${id}/add-update`)} style={styles.addUpdate}>
            <Plus color={colors.text.primary} size={18} strokeWidth={2.8} />
            <AppText variant="body" color={colors.text.primary} style={styles.addUpdateText}>
              Add a receipt
            </AppText>
          </Pressable>

          <View style={styles.closeCaseHeader}>
            <AppText variant="title" style={styles.closeCaseTitle}>
              Close the case
            </AppText>
            <AppText variant="body" color={colors.text.secondary} style={styles.closeCaseSubtitle}>
              Was your original read right?
            </AppText>
          </View>
          <View style={styles.outcomes}>
            <OutcomeButton icon={Check} label="I was right" selected={record.outcomeStatus === 'right'} onPress={() => void setOutcome('right')} />
            <OutcomeButton icon={X} label="I overthought" selected={record.outcomeStatus === 'wrong'} onPress={() => void setOutcome('wrong')} />
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

function formatDisplayCaseId(caseId: string): string {
  const suffix = caseId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase();
  return suffix ? `OT-${suffix}` : 'OT';
}
function LegacyBasicVerdictBanner({ loading, onUpgrade }: { loading: boolean; onUpgrade: () => void }) {
  return (
    <View style={styles.aiVerdictStatus}>
      <View style={styles.aiVerdictStatusBadge}>
        <ScrollText color={colors.text.secondary} size={13} strokeWidth={2.5} />
        <AppText variant="eyebrow" color={colors.text.secondary} style={styles.aiVerdictStatusLabel}>
          Legacy Basic Verdict
        </AppText>
      </View>
      <AppText variant="meta" color={colors.text.secondary} style={styles.aiVerdictStatusBody}>
        This result was saved before Smart-only cases. Upgrade only when you choose to use a Smart Verdict allowance.
      </AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: loading }}
        disabled={loading}
        onPress={onUpgrade}
        style={[styles.quotaUpgradeButton, loading && styles.deepButtonDisabled]}
      >
        {loading ? <ActivityIndicator color={colors.text.onAccent} /> : <Sparkles color={colors.text.onAccent} size={16} strokeWidth={2.7} />}
        <AppText variant="body" center color={colors.text.onAccent} style={styles.quotaUpgradeButtonText}>
          {loading ? 'Upgrading...' : 'Upgrade to Smart Verdict'}
        </AppText>
      </Pressable>
    </View>
  );
}

function aiVerdictAccessLabel(access: { remaining: number; accessTier?: string } | undefined, isGuest: boolean): string {
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
  remainingLabel,
}: {
  verdict: AiVerdictOutput;
  displayLabel: string;
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
      <View style={styles.aiPremiumHeader}>
        <View style={styles.deepTitleRow}>
          <AppText variant="title" color={colors.text.onBrand} style={styles.deepTitle}>
            Smart Verdict
          </AppText>
          <View style={styles.aiBadge}>
            <Sparkles color={colors.text.onAccent} size={14} strokeWidth={2.8} />
            <AppText variant="eyebrow" color={colors.text.onAccent} style={styles.aiBadgeText}>
              Smart
            </AppText>
          </View>
        </View>
        <AppText variant="eyebrow" color="rgba(255, 255, 255, 0.5)" style={styles.aiPremiumRemainingReads}>
          {remainingLabel}
        </AppText>
      </View>

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
        </View>
      </View>

      <View style={styles.groupChatRead}>
        <View style={styles.groupChatBadge}>
          <AppText variant="eyebrow" color={colors.text.onAccent} style={styles.groupChatBadgeText}>
            The Read
          </AppText>
        </View>
        <AppText variant="title" color={colors.text.onBrand} style={[styles.groupChatText, styles.aiPremiumGroupChatText]}>
          {verdict.explanationText}
        </AppText>
      </View>

      <View style={styles.aiPremiumSections}>
        {sections.map((section) => (
          <AiVerdictInsightRow
            key={section.key}
            section={section}
            expanded={openSection === section.key}
            onPress={() => setOpenSection((current) => (current === section.key ? 'none' : section.key))}
          />
        ))}
      </View>

      <AppText variant="eyebrow" color={colors.accent.lime} style={styles.aiPremiumTakeawayLabel}>
        Do this →
      </AppText>
      <View style={[styles.roastLine, styles.aiPremiumRoastLine]}>
        <AppText variant="body" color={colors.text.onAccent} style={[styles.roastLineText, styles.aiPremiumRoastLineText]}>
          {verdict.nextMoveText}
        </AppText>
      </View>
    </View>
  );
}

function showLegacyUpgradeFailure(
  result: Extract<AiVerdictResponse, { ok: false }>,
  router: ReturnType<typeof useRouter>,
) {
  if (result.code === 'quota_exceeded' && result.access?.accessTier === 'guest') {
    Alert.alert('Free guest Smart Verdicts used', 'Sign in to get a daily Smart Verdict allowance.', [
      { text: 'Not now', style: 'cancel' },
      { text: 'Sign in', onPress: () => router.push('/auth') },
    ]);
    return;
  }

  if (result.code === 'quota_exceeded' && result.access?.accessTier === 'free') {
    Alert.alert("Today's free Smart Verdicts are used", 'You can keep this Legacy Basic Verdict or view Premium.', [
      { text: 'Keep legacy result', style: 'cancel' },
      { text: 'View Premium', onPress: () => router.push('/paywall') },
    ]);
    return;
  }

  if (result.code === 'fair_use_exceeded') {
    Alert.alert('Smart Verdict limit reached', 'Premium fair-use protection is active. Try again after the reset.');
    return;
  }

  if (result.code === 'ip_daily_cap_exceeded' || result.code === 'global_daily_cap_exceeded') {
    Alert.alert('Smart Verdicts temporarily limited', 'The service limit has been reached. Try again later.');
    return;
  }

  Alert.alert('Could not upgrade', 'The Legacy Basic Verdict is unchanged. Check your internet connection and try again.');
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
    <View style={styles.aiPremiumSection}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={onPress}
        style={styles.aiPremiumSectionHeader}
      >
        <AppText variant="eyebrow" color="rgba(255, 255, 255, 0.78)" style={styles.aiPremiumFieldLabel}>
          {section.label}
        </AppText>
        <Icon color="rgba(255, 255, 255, 0.78)" size={19} strokeWidth={2.25} />
      </Pressable>
      {expanded ? (
        <AppText variant="body" color="rgba(255, 255, 255, 0.94)" style={styles.aiPremiumFieldBody}>
          {section.body}
        </AppText>
      ) : null}
    </View>
  );
}

function DeepReadContent({
  result,
}: {
  result: Extract<DeepReadResponse, { ok: true }> | null;
}) {
  const [openSection, setOpenSection] = useState<DeepReadSectionKey>('whatsActuallyHappening');

  if (result) {
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

  return null;
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
      <View style={styles.caseFileBadge}>
        <ScrollText color={colors.text.primary} size={14} strokeWidth={2.3} />
        <AppText variant="eyebrow" style={styles.caseFileLabel}>
          Case File
        </AppText>
      </View>
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
      <View style={[styles.outcomeIconWrap, selected && styles.outcomeIconWrapSelected]}>
        <Icon color={contentColor} size={18} strokeWidth={2.6} />
      </View>
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
    borderColor: colors.brand.ink,
    borderRadius: radii.pill,
    borderWidth: 2,
    height: 48,
    justifyContent: 'center',
    width: 48,
    ...shadows.hardSmall,
  },
  categoryPill: {
    backgroundColor: '#F8C7D4',
    borderColor: colors.brand.ink,
    borderWidth: 2,
    borderRadius: radii.pill,
    minWidth: 128,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    ...shadows.hardSmall,
  },
  categoryText: {
    color: colors.text.primary,
    fontFamily: typography.family.displayBold,
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
    marginTop: spacing.md,
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
    backgroundColor: '#0A0A0D',
    borderColor: '#0A0A0D',
    borderRadius: radii.xl,
    borderWidth: 2,
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    shadowColor: colors.brand.ink,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  aiPremiumHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  aiPremiumRemainingReads: {
    flexShrink: 0,
    fontFamily: typography.family.displayBold,
    fontSize: 8.5,
    letterSpacing: 1.2,
    lineHeight: 12,
  },
  aiPremiumHero: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xl,
    marginTop: spacing.xs,
  },
  aiPremiumRingWrap: {
    alignItems: 'center',
    height: 106,
    justifyContent: 'center',
    width: 106,
  },
  aiPremiumScoreCenter: {
    alignItems: 'center',
    position: 'absolute',
  },
  aiPremiumScore: {
    fontFamily: typography.family.displayBold,
    fontSize: 34,
    lineHeight: 37,
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
    backgroundColor: 'rgba(210, 247, 61, 0.12)',
    borderRadius: radii.pill,
    maxWidth: '100%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  aiPremiumVerdictPillText: {
    fontFamily: typography.family.displayBold,
    fontSize: 8,
    letterSpacing: 1.1,
    lineHeight: 12,
  },
  aiPremiumTitle: {
    fontFamily: typography.family.displayBold,
    fontSize: 22,
    lineHeight: 27,
  },
  aiPremiumGroupChatText: {
    fontSize: 16.5,
    lineHeight: 24,
  },
  aiPremiumSections: {
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    borderBottomWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    borderTopWidth: 1,
  },
  aiPremiumSection: {
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    borderTopWidth: 1,
    gap: spacing.sm,
    paddingVertical: 17,
  },
  aiPremiumSectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 28,
  },
  aiPremiumFieldLabel: {
    fontFamily: typography.family.displayBold,
    fontSize: 11,
    letterSpacing: 1,
    lineHeight: 15,
  },
  aiPremiumFieldBody: {
    fontFamily: typography.family.body,
    fontSize: 15.5,
    lineHeight: 24,
  },
  aiPremiumTakeawayLabel: {
    fontFamily: typography.family.displayBold,
    fontSize: 10.5,
    letterSpacing: 1,
    lineHeight: 14,
  },
  aiPremiumRoastLine: {
    paddingBottom: 22,
    paddingTop: 22,
  },
  aiPremiumRoastLineText: {
    fontSize: 16.5,
    lineHeight: 24,
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
    fontSize: 24,
    lineHeight: 29,
  },
  aiBadge: {
    alignItems: 'center',
    backgroundColor: colors.brand.pink,
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
    fontSize: 15,
    lineHeight: 20,
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
    backgroundColor: '#101014',
    borderRadius: radii.xl,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    paddingTop: spacing.xxl,
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
    fontSize: 16,
    lineHeight: 23,
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
    fontSize: 15,
    lineHeight: 23,
  },
  deepTakeawayLabel: {
    fontFamily: typography.family.displayBold,
    fontSize: 10,
    letterSpacing: 1.3,
    lineHeight: 13,
  },
  roastLine: {
    backgroundColor: colors.accent.lime,
    borderRadius: radii.xl,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
  },
  roastLineText: {
    fontFamily: typography.family.displayBold,
    fontSize: 16,
    lineHeight: 22,
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
  caseFileSection: {
    backgroundColor: caseDetailBackground,
    marginHorizontal: -spacing.xl,
    marginTop: spacing.xxl,
    paddingBottom: 0,
    paddingHorizontal: spacing.xl,
  },
  quote: {
    backgroundColor: '#FCE8EF',
    borderColor: colors.brand.ink,
    borderRadius: radii.xl,
    borderWidth: 2,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    ...shadows.hardSmall,
  },
  quoteText: {
    color: colors.text.primary,
    fontFamily: typography.family.displayBold,
    fontSize: 15,
    lineHeight: 21,
  },
  plotHeader: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: spacing.lg,
    justifyContent: 'space-between',
    marginTop: spacing.xxl,
  },
  plotHeaderCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  plotTitle: {
    color: colors.text.primary,
    fontFamily: typography.family.displayBold,
    fontSize: 20,
    lineHeight: 25,
  },
  plotSubtitle: {
    fontFamily: typography.family.body,
    fontSize: 14,
    lineHeight: 18,
  },
  receiptCountBadge: {
    backgroundColor: colors.accent.lime,
    borderColor: colors.brand.ink,
    borderRadius: radii.pill,
    borderWidth: 2,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  receiptCountText: {
    fontFamily: typography.family.displayBold,
    fontSize: 10,
    letterSpacing: 1,
    lineHeight: 13,
  },
  addUpdate: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: colors.bg.surface,
    borderColor: 'rgba(31, 23, 34, 0.34)',
    borderRadius: radii.pill,
    borderWidth: 1.25,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    marginTop: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.lg,
  },
  addUpdateText: {
    fontFamily: typography.family.displayBold,
    fontSize: 15,
    lineHeight: 20,
  },
  updateList: {
    gap: spacing.md,
    marginTop: spacing.md,
  },
  timelineRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  timelineRail: {
    alignItems: 'center',
    width: 16,
  },
  timelineDot: {
    backgroundColor: colors.accent.lime,
    borderColor: colors.brand.ink,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 12,
    marginTop: 18,
    width: 12,
  },
  timelineLine: {
    backgroundColor: '#C9BFAE',
    flex: 1,
    marginTop: 2,
    minHeight: 48,
    width: 1,
  },
  updateCard: {
    borderColor: colors.brand.ink,
    borderRadius: radii.xl,
    borderWidth: 2,
    flex: 1,
    minHeight: 82,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    ...shadows.hardSmall,
  },
  updateTime: {
    color: colors.text.secondary,
    fontFamily: typography.family.displayBold,
    fontSize: 9,
    letterSpacing: 1.5,
    lineHeight: 13,
  },
  updateText: {
    fontFamily: typography.family.displaySemiBold,
    fontSize: 15,
    lineHeight: 20,
    marginTop: spacing.sm,
  },
  noUpdates: {
    backgroundColor: '#FFFDF8',
    borderColor: 'rgba(31, 23, 34, 0.16)',
    borderRadius: radii.lg,
    borderWidth: 1,
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  noUpdatesText: {
    fontFamily: typography.family.bodyMedium,
    fontSize: 15,
    lineHeight: 20,
  },
  caseFileDivider: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 0,
    marginTop: 0,
    marginBottom: spacing.md,
    paddingTop: spacing.sm,
  },
  caseFileLine: {
    backgroundColor: colors.brand.ink,
    flex: 1,
    height: 2,
  },
  caseFileBadge: {
    alignItems: 'center',
    backgroundColor: caseDetailBackground,
    borderColor: colors.brand.ink,
    borderRadius: radii.pill,
    borderWidth: 2,
    flexDirection: 'row',
    gap: spacing.xs,
    marginHorizontal: -1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    ...shadows.hardSmall,
  },
  caseFileLabel: {
    color: colors.text.primary,
    fontFamily: typography.family.displayBold,
    fontSize: 10,
    letterSpacing: 2.1,
    lineHeight: 13,
  },
  outcomes: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  outcome: {
    alignItems: 'center',
    backgroundColor: '#FFFDF8',
    borderColor: 'rgba(31, 23, 34, 0.34)',
    borderRadius: radii.lg,
    borderWidth: 1.25,
    flex: 1,
    minHeight: 64,
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  outcomeIconWrap: {
    alignItems: 'center',
    borderColor: 'rgba(31, 23, 34, 0.42)',
    borderRadius: radii.pill,
    borderWidth: 1.25,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  outcomeIconWrapSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    borderColor: colors.brand.ink,
  },
  outcomeLabel: {
    fontFamily: typography.family.displayBold,
    fontSize: 9.5,
    lineHeight: 13,
  },
  outcomeSelected: {
    backgroundColor: colors.accent.lime,
    borderColor: colors.brand.ink,
    borderWidth: 1.5,
  },
  closeCaseHeader: {
    gap: 3,
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },
  closeCaseTitle: {
    color: colors.text.primary,
    fontFamily: typography.family.displayBold,
    fontSize: 20,
    lineHeight: 25,
  },
  closeCaseSubtitle: {
    fontFamily: typography.family.body,
    fontSize: 14,
    lineHeight: 18,
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
    backgroundColor: 'rgba(20, 15, 22, 0.96)',
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
