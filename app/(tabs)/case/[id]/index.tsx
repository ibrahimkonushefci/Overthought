import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Pressable, Share, StyleSheet, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Check, CircleHelp, Plus, Share2, Sparkles, Trash2, X } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import type { DeepReadResponse, OutcomeStatus } from '../../../../src/types/shared';
import { caseRepository } from '../../../../src/features/cases/repositories/caseRepository';
import { caseUpdateRepository } from '../../../../src/features/cases/repositories/caseUpdateRepository';
import { deepReadService } from '../../../../src/features/deep-read/deepReadService';
import type { CaseEntity, CaseUpdateEntity } from '../../../../src/features/cases/types';
import { getCaseId, isGuestCase } from '../../../../src/features/cases/types';
import { ScorePanel } from '../../../../src/features/cases/components/ScorePanel';
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

  const share = async () => {
    await Share.share({
      message: `Overthought verdict: ${verdictLabels[record.verdictLabel]} (${record.delusionScore}/100). ${record.nextMoveText}`,
    });
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
      bottomInset={92}
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
          <Pressable accessibilityRole="button" onPress={() => void share()} style={styles.iconButton}>
            <Share2 color={colors.text.primary} size={21} strokeWidth={2.4} />
          </Pressable>
        </View>

        <ScorePanel
          score={record.delusionScore}
          verdictLabel={record.verdictLabel}
          displayLabel={heroDisplayLabel}
        />

        <SectionLabel title="The Read" />
        <View style={styles.readCard}>
          <AppText variant="body" style={styles.readText}>
            {record.explanationText}
          </AppText>
        </View>

        <SectionLabel title="Next Move" />
        <View style={styles.nextMove}>
          <AppText variant="title" style={styles.nextMoveText}>
            {record.nextMoveText}
          </AppText>
        </View>

        <View style={styles.deepRead}>
          <View style={styles.deepHeader}>
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

        <SectionLabel title="Original Situation" />
        <View style={styles.quote}>
          <AppText variant="subtitle" style={styles.quoteText}>
            {record.inputText}
          </AppText>
        </View>

        <View style={styles.sectionHeaderRow}>
          <SectionLabel title={`Updates · ${updates.length}`} noMargin />
          <Pressable accessibilityRole="button" onPress={() => router.push(`/case/${id}/add-update`)} style={styles.addUpdate}>
            <Plus color={colors.brand.pink} size={20} strokeWidth={2.6} />
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
          <Trash2 color={colors.text.secondary} size={18} strokeWidth={2.2} />
          <AppText variant="body" color={colors.text.secondary} style={styles.deleteText}>
            Delete this case
          </AppText>
        </Pressable>
      </Animated.View>
    </Screen>
  );
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
  if (status === 'ready' && result) {
    return (
      <View style={styles.deepResult}>
        <AppText variant="eyebrow" color={colors.accent.lime} style={styles.deepResultMeta}>
          {result.cache.source === 'cache' ? 'Saved Deep Read' : 'Fresh Deep Read'}
        </AppText>
        <DeepReadField label="What's actually happening" body={result.deepRead.whatsActuallyHappening} />
        <DeepReadField label="What you're overreading" body={result.deepRead.whatYoureOverreading} />
        <DeepReadField label="What evidence matters" body={result.deepRead.whatEvidenceActuallyMatters} />
        <DeepReadField label="What to do next" body={result.deepRead.whatToDoNext} />
        <View style={styles.roastLine}>
          <AppText variant="body" color={colors.text.onAccent} style={styles.roastLineText}>
            {result.deepRead.roastLine}
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

function DeepReadField({ label, body }: { label: string; body: string }) {
  return (
    <View style={styles.deepField}>
      <AppText variant="eyebrow" color="rgba(255, 255, 255, 0.62)" style={styles.deepFieldLabel}>
        {label}
      </AppText>
      <AppText variant="body" color={colors.text.onBrand} style={styles.deepFieldBody}>
        {body}
      </AppText>
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
    </Pressable>
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
    paddingBottom: 0,
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
  readCard: {
    backgroundColor: colors.bg.surface,
    borderColor: colors.ui.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
  },
  sectionLabel: {
    fontFamily: typography.family.displayMedium,
    fontSize: 10,
    letterSpacing: 0.8,
    lineHeight: 13,
  },
  sectionLabelSpaced: {
    marginBottom: spacing.md,
    marginTop: spacing.xxl,
  },
  readText: {
    fontFamily: typography.family.body,
    fontSize: 15,
    lineHeight: 22,
  },
  nextMove: {
    backgroundColor: colors.bg.surface,
    borderColor: colors.brand.ink,
    borderRadius: radii.lg,
    borderWidth: 2,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    shadowColor: colors.brand.ink,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  nextMoveText: {
    color: colors.text.primary,
    fontFamily: typography.family.displayBold,
    fontSize: 16,
    lineHeight: 22,
  },
  deepRead: {
    backgroundColor: colors.brand.ink,
    borderColor: colors.brand.ink,
    borderRadius: radii.xl,
    borderWidth: 2,
    gap: spacing.sm,
    marginTop: spacing.xxl,
    padding: spacing.lg,
    shadowColor: colors.brand.ink,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  deepHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  deepTitle: {
    fontFamily: typography.family.displayBold,
    fontSize: 19,
    lineHeight: 24,
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
  deepSubtitle: {
    fontFamily: typography.family.body,
    fontSize: 12,
    lineHeight: 18,
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
    fontSize: 15,
    lineHeight: 20,
  },
  deepResult: {
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  deepResultMeta: {
    fontFamily: typography.family.displayBold,
    fontSize: 10,
    letterSpacing: 0.8,
    lineHeight: 13,
  },
  deepField: {
    borderTopColor: 'rgba(255, 255, 255, 0.14)',
    borderTopWidth: 1,
    gap: 4,
    paddingTop: spacing.sm,
  },
  deepFieldLabel: {
    fontFamily: typography.family.displayBold,
    fontSize: 9,
    letterSpacing: 0.8,
    lineHeight: 12,
  },
  deepFieldBody: {
    fontFamily: typography.family.body,
    fontSize: 14,
    lineHeight: 20,
  },
  roastLine: {
    backgroundColor: colors.accent.lime,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  roastLineText: {
    fontFamily: typography.family.displaySemiBold,
    fontSize: 14,
    lineHeight: 19,
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
    marginTop: spacing.xxl,
  },
  quote: {
    backgroundColor: colors.bg.muted,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
  },
  quoteText: {
    color: colors.text.primary,
    fontFamily: typography.family.body,
    fontSize: 14,
    lineHeight: 21,
  },
  addUpdate: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  addUpdateText: {
    fontFamily: typography.family.bodyMedium,
    fontSize: 14,
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
    fontSize: 16,
    lineHeight: 23,
    marginVertical: spacing.sm,
  },
  noUpdates: {
    borderColor: colors.ui.border,
    borderRadius: radii.lg,
    borderStyle: 'dashed',
    borderWidth: 1,
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xxl,
  },
  noUpdatesText: {
    fontFamily: typography.family.bodyMedium,
    fontSize: 15,
    lineHeight: 20,
  },
  outcomes: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  outcome: {
    alignItems: 'center',
    backgroundColor: colors.bg.surface,
    borderColor: colors.ui.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flex: 1,
    minHeight: 98,
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
  },
  outcomeLabel: {
    fontFamily: typography.family.displayMedium,
    fontSize: 13,
    lineHeight: 17,
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
    minHeight: 40,
    paddingHorizontal: spacing.lg,
  },
  deleteText: {
    fontFamily: typography.family.bodyMedium,
    fontSize: 15,
    lineHeight: 20,
  },
  initialLoadState: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center',
  },
});
