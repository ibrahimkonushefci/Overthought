import { Pressable, StyleSheet, View } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import type { AiVerdictAccessState } from '../../../types/shared';
import type { AiVerdictQuotaLoadState } from '../../../store/aiVerdictQuotaStore';
import { AppText } from '../../../shared/ui/Text';
import { colors, radii, spacing, typography } from '../../../shared/theme/tokens';
import { smartAllowanceText } from '../smartVerdictPresentation';

interface SmartAllowanceStripProps {
  status: AiVerdictQuotaLoadState;
  access: AiVerdictAccessState | null;
  onSignIn: () => void;
  onUpgrade: () => void;
}

export function SmartAllowanceStrip({ status, access, onSignIn, onUpgrade }: SmartAllowanceStripProps) {
  const exhausted = status === 'ready' && access?.remaining === 0;
  const actionLabel = exhausted ? (access?.accessTier === 'guest' ? 'Sign in' : access?.accessTier === 'free' ? 'Upgrade' : null) : null;

  return (
    <View style={[styles.strip, exhausted && styles.exhausted]}>
      <Sparkles color={exhausted ? colors.brand.pink : colors.text.secondary} size={16} strokeWidth={2.5} />
      <AppText variant="meta" style={styles.copy}>
        {smartAllowanceText(status, access)}
      </AppText>
      {actionLabel ? (
        <Pressable accessibilityRole="button" onPress={access?.accessTier === 'guest' ? onSignIn : onUpgrade}>
          <AppText variant="body" color={colors.brand.pink} style={styles.action}>
            {actionLabel}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    alignItems: 'center',
    backgroundColor: colors.bg.muted,
    borderColor: colors.ui.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  exhausted: {
    backgroundColor: 'rgba(242, 34, 142, 0.08)',
    borderColor: colors.brand.pink,
  },
  copy: {
    flex: 1,
    fontFamily: typography.family.bodyMedium,
    fontSize: 11,
    lineHeight: 16,
  },
  action: {
    fontFamily: typography.family.displayBold,
    fontSize: 12,
  },
});
