import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { AppText } from '../../../shared/ui/Text';
import { colors, gradients, radii, shadows, spacing } from '../../../shared/theme/tokens';
import { scoreColor, verdictIcons, verdictLabels } from '../../../shared/utils/verdict';
import type { VerdictLabel } from '../../../types/shared';

interface ScorePanelProps {
  score: number;
  verdictLabel: VerdictLabel;
}

export function ScorePanel({ score, verdictLabel }: ScorePanelProps) {
  const stroke = scoreColor(score);
  const circumference = 2 * Math.PI * 72;
  const offset = circumference - (score / 100) * circumference;

  return (
    <LinearGradient colors={gradients.result} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.panel}>
      <AppText variant="title" center style={styles.icon}>
        {verdictIcons[verdictLabel]}
      </AppText>
      <AppText variant="display" center style={styles.verdict}>
        {verdictLabels[verdictLabel]}
      </AppText>
      <View style={styles.ringWrap}>
        <Svg width={190} height={190} viewBox="0 0 190 190">
          <Circle cx="95" cy="95" r="72" stroke={colors.bg.muted} strokeWidth="22" fill="none" />
          <Circle
            cx="95"
            cy="95"
            r="72"
            stroke={stroke}
            strokeWidth="22"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={offset}
            rotation="-90"
            origin="95, 95"
          />
        </Svg>
        <View style={styles.center}>
          <AppText variant="display" color={stroke} center style={styles.score}>
            {score}
          </AppText>
          <AppText variant="eyebrow" center>
            Delusion
          </AppText>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  panel: {
    alignItems: 'center',
    backgroundColor: colors.bg.surface,
    borderColor: colors.brand.ink,
    borderRadius: radii.xl,
    borderWidth: 2,
    gap: spacing.md,
    padding: spacing.lg,
    ...shadows.hard,
  },
  icon: {
    fontSize: 26,
    lineHeight: 30,
  },
  verdict: {
    fontSize: 29,
    lineHeight: 34,
    fontWeight: '800',
  },
  ringWrap: {
    alignItems: 'center',
    height: 190,
    justifyContent: 'center',
    width: 190,
  },
  score: {
    fontSize: 50,
    lineHeight: 54,
  },
  center: {
    alignItems: 'center',
    position: 'absolute',
  },
});
