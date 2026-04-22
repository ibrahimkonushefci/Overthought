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
}

export function ScorePanel({ score, verdictLabel }: ScorePanelProps) {
  const stroke = scoreColor(score);
  const circumference = 2 * Math.PI * 91;
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
        <Svg width={200} height={200} viewBox="0 0 200 200">
          <Circle cx="100" cy="100" r="91" stroke={colors.bg.muted} strokeWidth="18" fill="none" />
          <Circle
            cx="100"
            cy="100"
            r="91"
            stroke={stroke}
            strokeWidth="18"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={offset}
            rotation="-90"
            origin="100, 100"
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
    borderRadius: radii.signature,
    borderWidth: 2,
    gap: spacing.lg,
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
    ...shadows.hard,
  },
  icon: {
    fontSize: 26,
    lineHeight: 30,
  },
  verdict: {
    fontFamily: typography.family.displaySemiBold,
    fontSize: 31,
    lineHeight: 35,
  },
  ringWrap: {
    alignItems: 'center',
    height: 200,
    justifyContent: 'center',
    width: 200,
  },
  score: {
    fontFamily: typography.family.displayBold,
    fontSize: 56,
    lineHeight: 60,
  },
  center: {
    alignItems: 'center',
    position: 'absolute',
  },
});
