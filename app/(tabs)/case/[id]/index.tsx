import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Pressable, Share, StyleSheet, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Check, CircleHelp, Plus, Share2, Trash2, X } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import type { OutcomeStatus } from '../../../../src/types/shared';
import { caseRepository } from '../../../../src/features/cases/repositories/caseRepository';
import { caseUpdateRepository } from '../../../../src/features/cases/repositories/caseUpdateRepository';
import type { CaseEntity, CaseUpdateEntity } from '../../../../src/features/cases/types';
import { getCaseId, isGuestCase } from '../../../../src/features/cases/types';
import { ScorePanel } from '../../../../src/features/cases/components/ScorePanel';
import { Screen } from '../../../../src/shared/ui/Screen';
import { AppText } from '../../../../src/shared/ui/Text';
import { Card } from '../../../../src/shared/ui/Card';
import { Button } from '../../../../src/shared/ui/Button';
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

export default function CaseDetailRoute() {
  const router = useRouter();
  const { id, fromAnalysis } = useLocalSearchParams<{ id: string; fromAnalysis?: string }>();
  const [record, setRecord] = useState<CaseEntity | null>(null);
  const [updates, setUpdates] = useState<CaseUpdateEntity[]>([]);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
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

  return (
    <Screen
      initialScrollY={restoredScrollY}
      onScrollYChange={(scrollY) => {
        if (!shouldRunResultIntro) {
          detailScrollByCaseId.set(id, scrollY);
        }
      }}
      scrollResetKey={resultPresentationKey}
    >
      <Animated.View style={{ opacity: fadeAnim }}>
      <View style={styles.topRow}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.iconButton}>
          <ArrowLeft color={colors.text.primary} size={20} />
        </Pressable>
        <View style={styles.categoryPill}>
          <AppText variant="body" color={colors.text.secondary} style={styles.categoryText}>
            {categoryIcons[record.category]} {categoryLabels[record.category]}
          </AppText>
        </View>
        <Pressable accessibilityRole="button" onPress={() => void share()} style={styles.iconButton}>
          <Share2 color={colors.text.primary} size={20} />
        </Pressable>
      </View>

      <ScorePanel
        score={record.delusionScore}
        verdictLabel={record.verdictLabel}
        displayLabel={heroDisplayLabel}
      />

      <Card style={styles.readCard}>
        <AppText variant="eyebrow" style={styles.sectionLabel}>The read</AppText>
        <AppText variant="body" style={styles.bigBody}>
          {record.explanationText}
        </AppText>
      </Card>

      <View style={styles.nextMove}>
        <AppText variant="eyebrow" color="rgba(246, 240, 226, 0.56)" style={styles.sectionLabel}>
          Next move
        </AppText>
        <AppText variant="title" color={colors.text.onBrand} style={styles.nextMoveText}>
          {record.nextMoveText}
        </AppText>
      </View>

      <View style={styles.sectionHeader}>
        <AppText variant="eyebrow" style={styles.sectionLabel}>Original situation</AppText>
      </View>
      <View style={styles.quote}>
        <AppText variant="subtitle" style={styles.italic}>
          "{record.inputText}"
        </AppText>
      </View>

      <View style={styles.sectionHeaderRow}>
        <AppText variant="eyebrow" style={styles.sectionLabel}>Updates · {updates.length}</AppText>
        <Pressable accessibilityRole="button" onPress={() => router.push(`/case/${id}/add-update`)} style={styles.addUpdate}>
          <Plus color={colors.brand.pink} size={20} />
          <AppText variant="body" color={colors.brand.pink} style={styles.addUpdateText}>
            Add update
          </AppText>
        </Pressable>
      </View>

      {updates.length > 0 ? (
        <View style={styles.updateList}>
          {updates.map((item) => (
            <Card key={'localId' in item ? item.localId : item.id}>
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
          <AppText variant="subtitle" center>
            No updates yet. Plot still developing.
          </AppText>
        </View>
      )}

      <AppText variant="eyebrow" style={[styles.sectionLabel, styles.outcomeTitle]}>
        How did it end?
      </AppText>
      <View style={styles.outcomes}>
        <OutcomeButton icon={Check} label="I was right" selected={record.outcomeStatus === 'right'} onPress={() => void setOutcome('right')} />
        <OutcomeButton icon={X} label="I was wrong" selected={record.outcomeStatus === 'wrong'} onPress={() => void setOutcome('wrong')} />
        <OutcomeButton icon={CircleHelp} label="Still unclear" selected={record.outcomeStatus === 'unclear'} onPress={() => void setOutcome('unclear')} />
      </View>

      <Button title="Delete this case" variant="ghost" icon={Trash2} onPress={archive} />
      </Animated.View>
    </Screen>
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
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xxl,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: colors.bg.surface,
    borderColor: colors.ui.border,
    borderRadius: 14,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  categoryPill: {
    backgroundColor: colors.bg.muted,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  categoryText: {
    fontFamily: typography.family.bodyMedium,
    fontSize: 13,
    lineHeight: 17,
  },
  readCard: {
    padding: spacing.xl,
  },
  sectionLabel: {
    fontFamily: typography.family.displayMedium,
    fontSize: 10,
    letterSpacing: 1.6,
    lineHeight: 13,
  },
  bigBody: {
    fontFamily: typography.family.body,
    fontSize: 15,
    lineHeight: 24,
    marginTop: spacing.lg,
  },
  nextMove: {
    backgroundColor: colors.brand.ink,
    borderRadius: radii.lg,
    gap: spacing.sm,
    marginTop: spacing.xl,
    padding: spacing.xl,
    shadowColor: colors.brand.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  nextMoveText: {
    fontFamily: typography.family.displayMedium,
    fontSize: 18,
    lineHeight: 24,
  },
  sectionHeader: {
    marginTop: spacing.xxl,
  },
  sectionHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
  },
  quote: {
    backgroundColor: colors.bg.muted,
    borderRadius: radii.lg,
    marginTop: spacing.lg,
    padding: spacing.xl,
  },
  italic: {
    fontFamily: typography.family.editorial,
    fontSize: 16,
    lineHeight: 20,
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
  updateText: {
    marginVertical: spacing.sm,
  },
  noUpdates: {
    borderColor: colors.ui.border,
    borderRadius: radii.lg,
    borderStyle: 'dashed',
    borderWidth: 1,
    marginTop: spacing.md,
    padding: spacing.lg,
  },
  outcomeTitle: {
    marginTop: spacing.xl,
    marginBottom: spacing.md,
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
    minHeight: 62,
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  outcomeLabel: {
    fontFamily: typography.family.displayMedium,
    fontSize: 12,
    lineHeight: 15,
  },
  outcomeSelected: {
    backgroundColor: colors.accent.lime,
    borderColor: colors.brand.ink,
    borderWidth: 2,
  },
  initialLoadState: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center',
  },
});
