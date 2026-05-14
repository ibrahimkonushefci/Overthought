import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { AppText } from '../../../shared/ui/Text';
import { colors, gradients, radii, shadows, spacing, typography } from '../../../shared/theme/tokens';
import { scoreColor, verdictIcons, verdictLabels } from '../../../shared/utils/verdict';
import type { VerdictLabel } from '../../../types/shared';

interface ScorePanelProps {
  score: number;
  verdictLabel: VerdictLabel;
  displayLabel?: string;
  caseId: string;
  readText: string;
  nextMoveText: string;
}

export function ScorePanel({ score, verdictLabel, displayLabel, caseId, readText, nextMoveText }: ScorePanelProps) {
  const stroke = scoreColor(score);
  const circumference = 2 * Math.PI * 46;
  const offset = circumference - (score / 100) * circumference;
  const displayCaseId = formatDisplayCaseId(caseId);

  return (
    <LinearGradient colors={gradients.result} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.panel}>
      <View style={styles.heroRow}>
        <View style={styles.ringWrap}>
          <Svg width={116} height={116} viewBox="0 0 116 116">
            <Circle cx="58" cy="58" r="46" stroke={colors.bg.muted} strokeWidth="10" fill="none" />
            <Circle
              cx="58"
              cy="58"
              r="46"
              stroke={stroke}
              strokeWidth="10"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={offset}
              rotation="-90"
              origin="58, 58"
            />
          </Svg>
          <View style={styles.center}>
            <AppText variant="display" color={stroke} center style={styles.score}>
              {score}
            </AppText>
            <AppText variant="eyebrow" center style={styles.scoreLabel}>
              Delusion
            </AppText>
          </View>
        </View>
        <View style={styles.heroCopy}>
          <View style={styles.verdictPill}>
            <AppText variant="eyebrow" color={colors.text.onBrand} style={styles.verdictPillText} numberOfLines={1}>
              {verdictIcons[verdictLabel]} {verdictLabels[verdictLabel]}
            </AppText>
          </View>
          <AppText variant="display" style={styles.verdict} numberOfLines={3}>
            {displayLabel ?? verdictLabels[verdictLabel]}
          </AppText>
          <AppText variant="eyebrow" style={styles.caseId} numberOfLines={1}>
            Case {displayCaseId}
          </AppText>
        </View>
      </View>

      <View style={styles.resultBlock}>
        <AppText variant="eyebrow" style={styles.sectionLabel}>
          The Read
        </AppText>
        <View style={styles.readCard}>
          <AppText variant="body" style={styles.readText}>
            {readText}
          </AppText>
        </View>
      </View>

      <View style={styles.resultBlock}>
        <AppText variant="eyebrow" style={styles.sectionLabel}>
          Next Move
        </AppText>
        <View style={styles.nextMove}>
          <View style={[styles.nextMoveAccent, { backgroundColor: stroke }]} />
          <AppText variant="title" style={styles.nextMoveText}>
            {nextMoveText}
          </AppText>
        </View>
      </View>
    </LinearGradient>
  );
}

function formatDisplayCaseId(caseId: string): string {
  const suffix = caseId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase();
  return suffix ? `OT-${suffix}` : 'OT';
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.bg.surface,
    borderColor: colors.brand.ink,
    borderRadius: radii.signature,
    borderWidth: 2,
    gap: spacing.md,
    marginBottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    ...shadows.hardSmall,
  },
  heroRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.lg,
  },
  verdict: {
    fontFamily: typography.family.displayBold,
    fontSize: 19,
    lineHeight: 23,
  },
  verdictPill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.brand.ink,
    borderRadius: radii.pill,
    maxWidth: '100%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  verdictPillText: {
    fontFamily: typography.family.displayBold,
    fontSize: 8,
    letterSpacing: 1.4,
    lineHeight: 12,
  },
  caseId: {
    color: colors.text.secondary,
    fontFamily: typography.family.displayBold,
    fontSize: 8,
    letterSpacing: 1.8,
    lineHeight: 12,
  },
  heroCopy: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  ringWrap: {
    alignItems: 'center',
    height: 116,
    justifyContent: 'center',
    width: 116,
  },
  score: {
    fontFamily: typography.family.displayBold,
    fontSize: 40,
    lineHeight: 43,
  },
  scoreLabel: {
    fontFamily: typography.family.displaySemiBold,
    fontSize: 8,
    letterSpacing: 1,
    lineHeight: 11,
  },
  center: {
    alignItems: 'center',
    position: 'absolute',
  },
  resultBlock: {
    gap: spacing.sm,
  },
  sectionLabel: {
    color: colors.text.secondary,
    fontFamily: typography.family.displayBold,
    fontSize: 9,
    letterSpacing: 1.7,
    lineHeight: 13,
  },
  readCard: {
    backgroundColor: colors.bg.surface,
    borderColor: colors.brand.ink,
    borderRadius: radii.lg,
    borderWidth: 2,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  readText: {
    fontFamily: typography.family.body,
    fontSize: 14,
    lineHeight: 20,
  },
  nextMove: {
    backgroundColor: colors.bg.surface,
    borderColor: colors.brand.ink,
    borderRadius: radii.lg,
    borderWidth: 2,
    minHeight: 54,
    justifyContent: 'center',
    overflow: 'hidden',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    shadowColor: colors.brand.ink,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  nextMoveAccent: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    top: 0,
    width: 8,
  },
  nextMoveText: {
    color: colors.text.primary,
    fontFamily: typography.family.displayBold,
    fontSize: 14,
    lineHeight: 20,
  },
});
