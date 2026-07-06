import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
import { Check, ScrollText, Sparkles } from 'lucide-react-native';
import { AppText } from '../../../shared/ui/Text';
import { colors, gradients, radii, shadows, spacing, typography } from '../../../shared/theme/tokens';
import { categoryIcons, categoryLabels, scoreColor, verdictLabels } from '../../../shared/utils/verdict';
import type { CaseCategory, VerdictLabel } from '../../../types/shared';

export interface VerdictRevealOutcome {
  displayLabel: string;
  score: number;
  source: 'basic' | 'smart';
  verdictLabel: VerdictLabel;
}

interface VerdictRevealOverlayProps {
  category: CaseCategory;
  outcome: VerdictRevealOutcome | null;
  onComplete: () => void;
}

const beats = ['Reading the receipts…', 'Checking the delusion level…', 'Preparing the ruling…'];
const receiptLabels = ['Receipts filed', 'Vibes checked', 'Timeline reviewed'];
const meterSize = 176;
const meterRadius = 68;
const meterCircumference = 2 * Math.PI * meterRadius;

function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    let mounted = true;

    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) {
        setReducedMotion(enabled);
      }
    });

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reducedMotion;
}

export function VerdictRevealOverlay({ category, outcome, onComplete }: VerdictRevealOverlayProps) {
  const reducedMotion = useReducedMotion();
  const [beatIndex, setBeatIndex] = useState(0);
  const [displayScore, setDisplayScore] = useState(0);
  const [stampVisible, setStampVisible] = useState(false);
  const [finalCopyVisible, setFinalCopyVisible] = useState(false);
  const entryAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const stampAnim = useRef(new Animated.Value(0)).current;
  const scoreAnim = useRef(new Animated.Value(0)).current;
  const receiptAnims = useRef(receiptLabels.map(() => new Animated.Value(0))).current;
  const completedOutcomeRef = useRef<VerdictRevealOutcome | null>(null);
  const completionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stroke = scoreColor(outcome?.score ?? 74);
  const displayedBeat = outcome ? 'Preparing the ruling…' : beats[beatIndex];
  const dashOffset = meterCircumference - (displayScore / 100) * meterCircumference;
  const categoryLabel = `${categoryIcons[category]} ${categoryLabels[category]}`;
  const finalLabel = outcome ? (outcome.source === 'smart' ? 'Smart Verdict ready' : 'Basic Verdict ready') : 'Verdict in session';

  const pulseStyle = useMemo(
    () => ({
      transform: [
        {
          scale: pulseAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 1.035],
          }),
        },
      ],
    }),
  [pulseAnim]);

  useEffect(() => {
    entryAnim.setValue(1);

    if (reducedMotion) {
      receiptAnims.forEach((receiptAnim) => receiptAnim.setValue(1));
      return;
    }

    receiptAnims.forEach((receiptAnim, index) => {
      receiptAnim.setValue(0);
      Animated.timing(receiptAnim, {
        toValue: 1,
        delay: 120 + index * 180,
        duration: 220,
        easing: Easing.out(Easing.back(1.15)),
        useNativeDriver: true,
      }).start();
    });
  }, [entryAnim, receiptAnims, reducedMotion]);

  useEffect(() => {
    if (reducedMotion) {
      return;
    }

    pulseAnim.setValue(0);
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 760,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 760,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    );

    pulse.start();

    return () => {
      pulse.stop();
    };
  }, [pulseAnim, reducedMotion]);

  useEffect(() => {
    if (outcome) {
      return;
    }

    setBeatIndex(0);
    const secondBeatDelay = reducedMotion ? 700 : 560;
    const finalBeatDelay = reducedMotion ? 1250 : 1120;
    const timers = [
      setTimeout(() => setBeatIndex(1), secondBeatDelay),
      setTimeout(() => setBeatIndex(2), finalBeatDelay),
    ];

    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [outcome, reducedMotion]);

  useEffect(() => {
    const scoreListener = scoreAnim.addListener(({ value }) => {
      setDisplayScore(Math.round(value));
    });

    return () => {
      scoreAnim.removeListener(scoreListener);
    };
  }, [scoreAnim]);

  useEffect(() => {
    if (!outcome || completedOutcomeRef.current === outcome) {
      return;
    }

    completedOutcomeRef.current = outcome;
    setBeatIndex(2);
    setStampVisible(false);
    setFinalCopyVisible(false);
    stampAnim.setValue(0);
    scoreAnim.setValue(0);
    setDisplayScore(0);

    if (completionTimeoutRef.current) {
      clearTimeout(completionTimeoutRef.current);
      completionTimeoutRef.current = null;
    }

    if (reducedMotion) {
      setDisplayScore(outcome.score);
      setStampVisible(true);
      setFinalCopyVisible(true);
      stampAnim.setValue(1);
      completionTimeoutRef.current = setTimeout(onComplete, 450);
      return;
    }

    Animated.timing(scoreAnim, {
      toValue: outcome.score,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (!finished) {
        return;
      }

      setStampVisible(true);
      setFinalCopyVisible(true);
      Animated.spring(stampAnim, {
        toValue: 1,
        friction: 6,
        tension: 150,
        useNativeDriver: true,
      }).start(({ finished: stampFinished }) => {
        if (stampFinished) {
          completionTimeoutRef.current = setTimeout(onComplete, 300);
        }
      });
    });
  }, [onComplete, outcome, reducedMotion, scoreAnim, stampAnim]);

  useEffect(
    () => () => {
      if (completionTimeoutRef.current) {
        clearTimeout(completionTimeoutRef.current);
      }
    },
    [],
  );

  return (
    <Animated.View
      accessible
      accessibilityLabel={outcome ? `${finalLabel}. Delusion score ${outcome.score}.` : displayedBeat}
      accessibilityLiveRegion="polite"
      style={[
        styles.wrap,
        {
          opacity: entryAnim,
          transform: [
            {
              scale: entryAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.98, 1],
              }),
            },
          ],
        },
      ]}
    >
      <LinearGradient colors={gradients.cream} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.backdrop}>
        <View style={styles.topStack}>
          <View style={styles.categoryBadge}>
            <AppText variant="body" center style={styles.categoryText}>
              {categoryLabel}
            </AppText>
          </View>
          <AppText variant="eyebrow" center style={styles.sessionText}>
            Verdict in session
          </AppText>
        </View>

        <Animated.View style={[styles.meterCard, !reducedMotion && pulseStyle]}>
          <Svg width={meterSize} height={meterSize} viewBox={`0 0 ${meterSize} ${meterSize}`}>
            <Circle
              cx={meterSize / 2}
              cy={meterSize / 2}
              r={meterRadius}
              stroke={colors.bg.muted}
              strokeWidth="14"
              fill="none"
            />
            <Circle
              cx={meterSize / 2}
              cy={meterSize / 2}
              r={meterRadius}
              stroke={stroke}
              strokeWidth="14"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${meterCircumference} ${meterCircumference}`}
              strokeDashoffset={dashOffset}
              rotation="-90"
              origin={`${meterSize / 2}, ${meterSize / 2}`}
            />
          </Svg>
          <View style={styles.meterCenter}>
            <AppText variant="display" center color={stroke} style={styles.scoreText}>
              {displayScore}
            </AppText>
            <AppText variant="eyebrow" center style={styles.scoreLabel}>
              Delusion
            </AppText>
          </View>
        </Animated.View>

        <View style={styles.beatStack}>
          <AppText variant="title" center style={styles.beatText}>
            {displayedBeat}
          </AppText>
          <AppText variant="meta" center style={styles.beatSubtext}>
            Receipts, vibes, and one deeply dramatic ruling.
          </AppText>
        </View>

        <View style={styles.receiptGrid}>
          {receiptLabels.map((label, index) => {
            const receiptAnim = receiptAnims[index];

            return (
              <Animated.View
                key={label}
                style={[
                  styles.receiptChip,
                  {
                    opacity: receiptAnim,
                    transform: [
                      {
                        translateY: receiptAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [10, 0],
                        }),
                      },
                      {
                        rotate: `${[-2, 1.5, -1][index]}deg`,
                      },
                    ],
                  },
                ]}
              >
                <Check color={colors.brand.pink} size={14} strokeWidth={3} />
                <AppText variant="meta" style={styles.receiptText}>
                  {label}
                </AppText>
              </Animated.View>
            );
          })}
        </View>

        {stampVisible ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.stamp,
              {
                opacity: stampAnim,
                transform: [
                  {
                    scale: reducedMotion
                      ? 1
                      : stampAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1.7, 1],
                        }),
                  },
                  { rotate: '-7deg' },
                ],
              },
            ]}
          >
            <ScrollText color={colors.brand.ink} size={19} strokeWidth={2.7} />
            <AppText variant="eyebrow" center style={styles.stampText}>
              Case judged
            </AppText>
          </Animated.View>
        ) : null}

        {outcome && finalCopyVisible ? (
          <View style={styles.finalCopy}>
            <View style={[styles.sourcePill, outcome.source === 'smart' && styles.sourcePillSmart]}>
              <Sparkles
                color={outcome.source === 'smart' ? colors.text.onAccent : colors.text.onBrand}
                size={13}
                strokeWidth={2.7}
              />
              <AppText
                variant="eyebrow"
                color={outcome.source === 'smart' ? colors.text.onAccent : colors.text.onBrand}
                style={styles.sourceText}
              >
                {outcome.source === 'smart' ? 'Smart' : 'Basic'}
              </AppText>
            </View>
            <AppText variant="title" center style={styles.finalTitle} numberOfLines={2}>
              {outcome.displayLabel}
            </AppText>
            <AppText variant="meta" center style={styles.finalSubtitle}>
              {verdictLabels[outcome.verdictLabel]}
            </AppText>
          </View>
        ) : null}
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    marginHorizontal: -spacing.xl,
    marginTop: -spacing.lg,
  },
  backdrop: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    overflow: 'hidden',
    paddingHorizontal: spacing.xl,
  },
  topStack: {
    alignItems: 'center',
    gap: spacing.sm,
    position: 'absolute',
    top: spacing.xxl,
  },
  categoryBadge: {
    backgroundColor: '#F7C9DF',
    borderColor: colors.brand.ink,
    borderRadius: radii.pill,
    borderWidth: 2,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    ...shadows.hardSmall,
  },
  categoryText: {
    color: colors.text.primary,
    fontFamily: typography.family.displayBold,
    fontSize: 13,
    lineHeight: 17,
  },
  sessionText: {
    color: colors.text.secondary,
    fontSize: 10,
    letterSpacing: 1.7,
  },
  meterCard: {
    alignItems: 'center',
    backgroundColor: colors.bg.surface,
    borderColor: colors.brand.ink,
    borderRadius: radii.signature,
    borderWidth: 2,
    height: 214,
    justifyContent: 'center',
    width: 214,
    ...shadows.hardSmall,
  },
  meterCenter: {
    alignItems: 'center',
    position: 'absolute',
  },
  scoreText: {
    fontFamily: typography.family.displayBold,
    fontSize: 55,
    lineHeight: 58,
  },
  scoreLabel: {
    color: colors.text.secondary,
    fontFamily: typography.family.displayBold,
    fontSize: 9,
    letterSpacing: 1.4,
    lineHeight: 13,
  },
  beatStack: {
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
    minHeight: 76,
  },
  beatText: {
    fontFamily: typography.family.displayBold,
    fontSize: 25,
    lineHeight: 30,
  },
  beatSubtext: {
    maxWidth: 260,
  },
  receiptGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
    marginTop: spacing.md,
    maxWidth: 300,
  },
  receiptChip: {
    alignItems: 'center',
    backgroundColor: colors.bg.surface,
    borderColor: colors.brand.ink,
    borderRadius: radii.sm,
    borderWidth: 2,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    shadowColor: colors.brand.ink,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  receiptText: {
    color: colors.text.primary,
    fontFamily: typography.family.displaySemiBold,
    fontSize: 11,
    lineHeight: 15,
  },
  stamp: {
    alignItems: 'center',
    backgroundColor: 'rgba(246, 240, 226, 0.86)',
    borderColor: colors.brand.ink,
    borderRadius: radii.md,
    borderWidth: 3,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    position: 'absolute',
    top: '37%',
    ...shadows.hardSmall,
  },
  stampText: {
    color: colors.brand.ink,
    fontFamily: typography.family.displayBold,
    fontSize: 17,
    letterSpacing: 1.2,
    lineHeight: 21,
  },
  finalCopy: {
    alignItems: 'center',
    bottom: spacing.xxxl,
    gap: spacing.sm,
    left: spacing.xl,
    position: 'absolute',
    right: spacing.xl,
  },
  sourcePill: {
    alignItems: 'center',
    backgroundColor: colors.brand.ink,
    borderRadius: radii.pill,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  sourcePillSmart: {
    backgroundColor: colors.accent.lime,
  },
  sourceText: {
    fontFamily: typography.family.displayBold,
    fontSize: 9,
    letterSpacing: 1.2,
    lineHeight: 12,
  },
  finalTitle: {
    fontFamily: typography.family.displayBold,
    fontSize: 24,
    lineHeight: 29,
    maxWidth: 300,
  },
  finalSubtitle: {
    color: colors.text.secondary,
  },
});
