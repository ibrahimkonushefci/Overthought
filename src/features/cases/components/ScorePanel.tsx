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
}

export function ScorePanel({ score, verdictLabel, displayLabel }: ScorePanelProps) {
  const stroke = scoreColor(score);
  const circumference = 2 * Math.PI * 50;
  const offset = circumference - (score / 100) * circumference;

  return (
    <LinearGradient colors={gradients.result} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.panel}>
      <View style={styles.ringWrap}>
        <Svg width={124} height={124} viewBox="0 0 124 124">
          <Circle cx="62" cy="62" r="50" stroke={colors.bg.muted} strokeWidth="11" fill="none" />
          <Circle
            cx="62"
            cy="62"
            r="50"
            stroke={stroke}
            strokeWidth="11"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={offset}
            rotation="-90"
            origin="62, 62"
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
      <AppText variant="title" center style={styles.icon}>
        {verdictIcons[verdictLabel]}
      </AppText>
      <AppText variant="display" center style={styles.verdict} numberOfLines={2}>
        {displayLabel ?? verdictLabels[verdictLabel]}
      </AppText>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  panel: {
    alignItems: 'center',
    backgroundColor: colors.bg.surface,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: radii.signature,
    borderWidth: 1,
    gap: spacing.xs,
    marginBottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    ...shadows.soft,
  },
  icon: {
    fontSize: 20,
    lineHeight: 24,
  },
  verdict: {
    fontFamily: typography.family.displayBold,
    fontSize: 22,
    lineHeight: 27,
    maxWidth: 260,
  },
  ringWrap: {
    alignItems: 'center',
    height: 124,
    justifyContent: 'center',
    width: 124,
  },
  score: {
    fontFamily: typography.family.displayBold,
    fontSize: 38,
    lineHeight: 41,
  },
  scoreLabel: {
    fontFamily: typography.family.displaySemiBold,
    fontSize: 9,
    letterSpacing: 1,
    lineHeight: 11,
  },
  center: {
    alignItems: 'center',
    position: 'absolute',
  },
});
