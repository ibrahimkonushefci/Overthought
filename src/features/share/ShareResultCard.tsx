import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
import { AppText } from '../../shared/ui/Text';
import { colors, gradients, radii, spacing, typography } from '../../shared/theme/tokens';
import { categoryIcons, categoryLabels, scoreColor, verdictIcons, verdictLabels } from '../../shared/utils/verdict';
import type { ShareCardPayload } from './shareTypes';

export function ShareResultCard({ payload }: { payload: ShareCardPayload }) {
  const stroke = scoreColor(payload.delusionScore);
  const circumference = 2 * Math.PI * 46;
  const offset = circumference - (payload.delusionScore / 100) * circumference;
  const isDeepRead = payload.mode === 'deep_read' && payload.deepReadRoastLine && payload.deepReadTakeaway;
  const isAiResult = payload.mode === 'result' && payload.variant === 'ai';
  const isDark = Boolean(isDeepRead || isAiResult);

  return (
    <LinearGradient
      colors={isDark ? ['#090910', '#111119', '#090910'] : gradients.result}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.card, isDark && styles.deepCard]}
    >
      <View style={styles.header}>
        <AppText variant="eyebrow" style={[styles.brand, isDark && styles.deepMutedText]}>
          Overthought
        </AppText>
        <View style={styles.categoryPill}>
          <AppText variant="eyebrow" style={styles.categoryText} numberOfLines={1}>
            {categoryIcons[payload.category]} {categoryLabels[payload.category]}
          </AppText>
        </View>
      </View>

      <View style={styles.heroRow}>
        <View style={styles.ringWrap}>
          <Svg width={122} height={122} viewBox="0 0 116 116">
            <Circle
              cx="58"
              cy="58"
              r="46"
              stroke={isDark ? 'rgba(255, 255, 255, 0.14)' : colors.bg.muted}
              strokeWidth="10"
              fill="none"
            />
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
              {payload.delusionScore}
            </AppText>
            <AppText variant="eyebrow" center style={[styles.scoreLabel, isDark && styles.deepMutedText]}>
              Delusion
            </AppText>
          </View>
        </View>

        <View style={styles.heroCopy}>
          <View style={styles.verdictPill}>
            <AppText variant="eyebrow" color={colors.text.onBrand} style={styles.verdictPillText} numberOfLines={1}>
              {verdictIcons[payload.verdictLabel]} {verdictLabels[payload.verdictLabel]}
            </AppText>
          </View>
          <AppText variant="title" color={isDark ? colors.text.onBrand : colors.text.primary} style={styles.title} numberOfLines={3}>
            {payload.title}
          </AppText>
          <AppText variant="eyebrow" style={[styles.caseId, isDark && styles.deepMutedText]} numberOfLines={1}>
            Case {payload.caseDisplayId}
          </AppText>
        </View>
      </View>

      {isDeepRead || isAiResult ? (
        <>
          <View style={styles.groupChatRead}>
            <View style={styles.groupChatBadge}>
              <AppText variant="eyebrow" color={colors.text.onAccent} style={styles.groupChatBadgeText}>
                Group Chat Read
              </AppText>
            </View>
            <AppText
              variant="title"
              color={colors.text.onBrand}
              style={[styles.groupChatText, isDark && styles.darkGroupChatText]}
              numberOfLines={isAiResult ? 4 : 5}
            >
              {isDeepRead ? payload.deepReadRoastLine : payload.explanationText}
            </AppText>
          </View>

          <View style={styles.deepTakeawayBlock}>
            <AppText variant="eyebrow" color={colors.accent.lime} style={styles.deepTakeawayLabel}>
              Do this →
            </AppText>
            <View style={styles.deepTakeaway}>
              <AppText
                variant="title"
                color={colors.text.onAccent}
                style={[styles.deepTakeawayText, isDark && styles.darkDeepTakeawayText]}
                numberOfLines={isAiResult ? 4 : 5}
              >
                {isDeepRead ? payload.deepReadTakeaway : payload.nextMoveText}
              </AppText>
            </View>
          </View>
        </>
      ) : (
        <>
          <View style={styles.block}>
            <AppText variant="eyebrow" style={styles.blockLabel}>
              The Read
            </AppText>
            <View style={styles.readBox}>
              <AppText variant="body" style={styles.readText} numberOfLines={4}>
                {payload.explanationText}
              </AppText>
            </View>
          </View>

          <View style={styles.block}>
            <AppText variant="eyebrow" style={styles.blockLabel}>
              Next Move
            </AppText>
            <View style={styles.nextMove}>
              <View style={[styles.nextMoveAccent, { backgroundColor: stroke }]} />
              <AppText variant="title" style={styles.nextMoveText} numberOfLines={4}>
                {payload.nextMoveText}
              </AppText>
            </View>
          </View>
        </>
      )}

      <View style={styles.footer}>
        <AppText variant="eyebrow" style={[styles.footerText, isDark && styles.deepMutedText]}>
          {payload.appName}
        </AppText>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg.surface,
    borderColor: colors.brand.ink,
    borderRadius: radii.signature,
    borderWidth: 2,
    gap: spacing.md,
    height: 520,
    overflow: 'hidden',
    padding: spacing.xl,
    width: 320,
  },
  deepCard: {
    borderColor: '#090910',
  },
  deepMutedText: {
    color: 'rgba(255, 255, 255, 0.62)',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  brand: {
    color: colors.text.secondary,
    fontFamily: typography.family.displayBold,
    fontSize: 10,
    letterSpacing: 2.2,
    lineHeight: 13,
  },
  categoryPill: {
    backgroundColor: colors.bg.muted,
    borderRadius: radii.pill,
    maxWidth: 150,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  categoryText: {
    color: colors.text.secondary,
    fontFamily: typography.family.bodyMedium,
    fontSize: 11,
    letterSpacing: 0,
    lineHeight: 14,
    textTransform: 'none',
  },
  heroRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  ringWrap: {
    alignItems: 'center',
    height: 122,
    justifyContent: 'center',
    width: 122,
  },
  center: {
    alignItems: 'center',
    position: 'absolute',
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
  heroCopy: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
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
    letterSpacing: 1.1,
    lineHeight: 11,
  },
  title: {
    fontFamily: typography.family.displayBold,
    fontSize: 19,
    lineHeight: 23,
  },
  caseId: {
    color: colors.text.secondary,
    fontFamily: typography.family.displayBold,
    fontSize: 8,
    letterSpacing: 1.6,
    lineHeight: 12,
  },
  block: {
    gap: spacing.sm,
  },
  blockLabel: {
    color: colors.text.secondary,
    fontFamily: typography.family.displayBold,
    fontSize: 9,
    letterSpacing: 1.7,
    lineHeight: 13,
  },
  readBox: {
    backgroundColor: colors.bg.surface,
    borderColor: colors.brand.ink,
    borderRadius: radii.lg,
    borderWidth: 2,
    minHeight: 88,
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
    justifyContent: 'center',
    minHeight: 92,
    overflow: 'hidden',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    shadowColor: colors.brand.ink,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
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
    fontSize: 15,
    lineHeight: 20,
  },
  footer: {
    alignItems: 'center',
    borderTopColor: colors.ui.border,
    borderTopWidth: 1,
    marginTop: 'auto',
    paddingTop: spacing.md,
  },
  footerText: {
    color: colors.text.secondary,
    fontFamily: typography.family.displayBold,
    fontSize: 10,
    letterSpacing: 2,
    lineHeight: 13,
  },
  groupChatRead: {
    backgroundColor: '#111119',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
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
    fontSize: 20,
    lineHeight: 27,
  },
  darkGroupChatText: {
    fontSize: 18,
    lineHeight: 24,
  },
  deepTakeawayBlock: {
    gap: spacing.sm,
  },
  deepTakeawayLabel: {
    fontFamily: typography.family.displayBold,
    fontSize: 10,
    letterSpacing: 1.3,
    lineHeight: 13,
  },
  deepTakeaway: {
    backgroundColor: colors.accent.lime,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  deepTakeawayText: {
    fontFamily: typography.family.displayBold,
    fontSize: 17,
    lineHeight: 23,
  },
  darkDeepTakeawayText: {
    fontSize: 15,
    lineHeight: 21,
  },
});
