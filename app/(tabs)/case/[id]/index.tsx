import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { ActivityIndicator, Alert, Animated, Modal, Pressable, Share, StyleSheet, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import ViewShot from 'react-native-view-shot';
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronUp,
  CircleHelp,
  Plus,
  Share2,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import type { DeepReadResponse, OutcomeStatus } from '../../../../src/types/shared';
import { caseRepository } from '../../../../src/features/cases/repositories/caseRepository';
import { caseUpdateRepository } from '../../../../src/features/cases/repositories/caseUpdateRepository';
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
  verdictLabels,
} from '../../../../src/shared/utils/verdict';
import { relativeTime } from '../../../../src/shared/utils/date';

const detailScrollByCaseId = new Map<string, number>();
const caseDetailBackground = '#FBF9F2';

type DeepReadStatus = 'idle' | 'loading' | 'ready' | 'not_authenticated' | 'quota' | 'fair_use' | 'error';

export default function CaseDetailRoute() {
  const router = useRouter();
  const { id, fromAnalysis } = useLocalSearchParams<{ id: string; fromAnalysis?: string }>();
  const [record, setRecord] = useState<CaseEntity | null>(null);
  const [updates, setUpdates] = useState<CaseUpdateEntity[]>([]);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [deepReadStatus, setDeepReadStatus] = useState<DeepReadStatus>('idle');
  const [deepReadResult, setDeepReadResult] = useState<Extract<DeepReadResponse, { ok: true }> | null>(null);
  const [deepReadMessage, setDeepReadMessage] = useState<string | null>(null);
  const [sharePreviewVisible, setSharePreviewVisible] = useState(false);
  const [shareInProgress, setShareInProgress] = useState(false);
  const shareCardRef = useRef<ViewShot | null>(null);
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

  const heroDisplayLabel = getVerdictDisplayLabel(
    record.verdictLabel,
    `${getCaseId(record)}|${record.inputText}|${record.delusionScore}`,
  );
  const displayCaseId = formatDisplayCaseId(getCaseId(record));
  const deepReadShare = deepReadStatus === 'ready' ? deepReadResult?.deepRead : null;
  const sharePayload: ShareCardPayload = {
    mode: deepReadShare ? 'deep_read' : 'result',
    title: heroDisplayLabel,
    caseDisplayId: displayCaseId,
    category: record.category,
    verdictLabel: record.verdictLabel,
    delusionScore: record.delusionScore,
    explanationText: record.explanationText,
    nextMoveText: record.nextMoveText,
    deepReadRoastLine: deepReadShare?.roastLine,
    deepReadTakeaway: deepReadShare?.whatToDoNext,
    appName: 'Overthought',
  };
  const shareMessage = deepReadShare
    ? `Overthought Deep Read: ${deepReadShare.roastLine} ${deepReadShare.whatToDoNext}`
    : `Overthought verdict: ${verdictLabels[record.verdictLabel]} (${record.delusionScore}/100). ${record.nextMoveText}`;

  const shareTextFallback = async () => {
    await Share.share({
      message: shareMessage,
    });
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
    if (!record || deepReadStatus === 'loading') {
      return;
    }

    setDeepReadStatus('loading');
    setDeepReadMessage(null);

    const result = await deepReadService.requestCaseDeepRead(getCaseId(record));

    if (result.ok) {
      setDeepReadResult(result);
      setDeepReadStatus('ready');
      return;
    }

    setDeepReadResult(null);
    setDeepReadMessage(result.message);

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

        <ScorePanel
          caseId={getCaseId(record)}
          score={record.delusionScore}
          verdictLabel={record.verdictLabel}
          displayLabel={heroDisplayLabel}
          readText={record.explanationText}
          nextMoveText={record.nextMoveText}
        />

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
            The version your group chat would actually send.
          </AppText>
          <DeepReadContent
            status={deepReadStatus}
            result={deepReadResult}
            message={deepReadMessage}
            onRequest={() => void requestDeepRead()}
            onSignIn={() => router.push('/auth')}
          />
        </View>

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

function DeepReadContent({
  status,
  result,
  message,
  onRequest,
  onSignIn,
}: {
  status: DeepReadStatus;
  result: Extract<DeepReadResponse, { ok: true }> | null;
  message: string | null;
  onRequest: () => void;
  onSignIn: () => void;
}) {
  const [openSection, setOpenSection] = useState<DeepReadSectionKey>('whatsActuallyHappening');

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
        <DeepReadStateText text="Sign in to use Deep Read. The local verdict still works either way." />
        <DeepReadButton label="Sign in" onPress={onSignIn} />
      </View>
    );
  }

  if (status === 'quota') {
    return (
      <View style={styles.deepStateStack}>
        <DeepReadStateText text="You've used today's free Deep Reads. Local verdicts still work unlimited." />
      </View>
    );
  }

  if (status === 'fair_use') {
    return (
      <View style={styles.deepStateStack}>
        <DeepReadStateText text="Deep Read is temporarily limited for fair use. Your local verdict is still available." />
        <DeepReadButton label="Try again" onPress={onRequest} />
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={styles.deepStateStack}>
        <DeepReadStateText text={message ?? "Deep Read couldn't load. Your local verdict is unchanged."} />
        <DeepReadStateText text="Your local verdict is unchanged." compact />
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
    transform: [{ scale: 0.9 }],
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
});
