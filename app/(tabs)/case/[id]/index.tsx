import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Check, CircleHelp, Plus, Share2, Trash2, X } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import type { OutcomeStatus } from '../../../../src/types/shared';
import { caseRepository } from '../../../../src/features/cases/repositories/caseRepository';
import { caseUpdateRepository } from '../../../../src/features/cases/repositories/caseUpdateRepository';
import type { CaseEntity, CaseUpdateEntity } from '../../../../src/features/cases/types';
import { isGuestCase } from '../../../../src/features/cases/types';
import { ScorePanel } from '../../../../src/features/cases/components/ScorePanel';
import { Screen } from '../../../../src/shared/ui/Screen';
import { AppText } from '../../../../src/shared/ui/Text';
import { Card } from '../../../../src/shared/ui/Card';
import { Button } from '../../../../src/shared/ui/Button';
import { EmptyState } from '../../../../src/shared/ui/EmptyState';
import { colors, radii, spacing } from '../../../../src/shared/theme/tokens';
import { categoryIcons, categoryLabels, verdictLabels } from '../../../../src/shared/utils/verdict';
import { relativeTime } from '../../../../src/shared/utils/date';

export default function CaseDetailRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [record, setRecord] = useState<CaseEntity | null>(null);
  const [updates, setUpdates] = useState<CaseUpdateEntity[]>([]);

  const refresh = useCallback(async () => {
    if (!id) {
      return;
    }

    const nextRecord = await caseRepository.getCase(id);
    setRecord(nextRecord);
    setUpdates(nextRecord && isGuestCase(nextRecord) ? nextRecord.updates : await caseUpdateRepository.listUpdates(id));
  }, [id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!record) {
    return (
      <Screen>
        <EmptyState title="Case not found." body="It may have been archived or deleted." />
      </Screen>
    );
  }

  const share = async () => {
    await Share.share({
      message: `Overthought verdict: ${verdictLabels[record.verdictLabel]} (${record.delusionScore}/100). ${record.nextMoveText}`,
    });
  };

  const setOutcome = async (outcomeStatus: OutcomeStatus) => {
    await caseRepository.updateOutcome(id, outcomeStatus);
    await refresh();
  };

  const archive = () => {
    Alert.alert('Delete this case?', 'This removes it from your active case file.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void caseRepository.archiveCase(id).then(() => router.replace('/cases'));
        },
      },
    ]);
  };

  return (
    <Screen>
      <View style={styles.topRow}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.iconButton}>
          <ArrowLeft color={colors.text.primary} size={22} />
        </Pressable>
        <View style={styles.categoryPill}>
          <AppText variant="body" color={colors.text.secondary}>
            {categoryIcons[record.category]} {categoryLabels[record.category]}
          </AppText>
        </View>
        <Pressable accessibilityRole="button" onPress={() => void share()} style={styles.iconButton}>
          <Share2 color={colors.text.primary} size={21} />
        </Pressable>
      </View>

      <ScorePanel score={record.delusionScore} verdictLabel={record.verdictLabel} />

      <Card>
        <AppText variant="eyebrow">The read</AppText>
        <AppText variant="body" style={styles.bigBody}>
          {record.explanationText}
        </AppText>
      </Card>

      <View style={styles.nextMove}>
        <AppText variant="eyebrow" color={colors.text.secondary}>
          Next move
        </AppText>
        <AppText variant="title" color={colors.text.onBrand}>
          {record.nextMoveText}
        </AppText>
      </View>

      <View style={styles.sectionHeader}>
        <AppText variant="eyebrow">Original situation</AppText>
      </View>
      <View style={styles.quote}>
        <AppText variant="subtitle" style={styles.italic}>
          "{record.inputText}"
        </AppText>
      </View>

      <View style={styles.sectionHeaderRow}>
        <AppText variant="eyebrow">Updates · {updates.length}</AppText>
        <Pressable accessibilityRole="button" onPress={() => router.push(`/case/${id}/add-update`)} style={styles.addUpdate}>
          <Plus color={colors.brand.pink} size={20} />
          <AppText variant="body" color={colors.brand.pink}>
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

      <AppText variant="eyebrow" style={styles.outcomeTitle}>
        How did it end?
      </AppText>
      <View style={styles.outcomes}>
        <OutcomeButton icon={Check} label="I was right" selected={record.outcomeStatus === 'right'} onPress={() => void setOutcome('right')} />
        <OutcomeButton icon={X} label="I was wrong" selected={record.outcomeStatus === 'wrong'} onPress={() => void setOutcome('wrong')} />
        <OutcomeButton icon={CircleHelp} label="Still unclear" selected={record.outcomeStatus === 'unclear'} onPress={() => void setOutcome('unclear')} />
      </View>

      <Button title="Delete this case" variant="ghost" icon={Trash2} onPress={archive} />
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
    marginBottom: spacing.lg,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: colors.bg.surface,
    borderColor: colors.ui.border,
    borderRadius: 16,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  categoryPill: {
    backgroundColor: colors.bg.muted,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  bigBody: {
    fontSize: 16,
    lineHeight: 25,
    marginTop: spacing.md,
  },
  nextMove: {
    backgroundColor: colors.brand.ink,
    borderRadius: radii.lg,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  sectionHeader: {
    marginTop: spacing.lg,
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
    marginTop: spacing.md,
    padding: spacing.lg,
  },
  italic: {
    fontStyle: 'italic',
  },
  addUpdate: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
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
    fontWeight: '500',
  },
  outcomeSelected: {
    backgroundColor: colors.accent.lime,
    borderColor: colors.brand.ink,
    borderWidth: 2,
  },
});
