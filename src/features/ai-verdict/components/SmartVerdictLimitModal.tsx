import { Modal, StyleSheet, View } from 'react-native';
import { Clock3, FileCheck2, Sparkles } from 'lucide-react-native';
import type { AiVerdictAccessState } from '../../../types/shared';
import { Button } from '../../../shared/ui/Button';
import { AppText } from '../../../shared/ui/Text';
import { colors, radii, shadows, spacing, typography } from '../../../shared/theme/tokens';
import {
  buildSmartLimitPresentation,
  type SmartLimitProtectedContent,
  type SmartLimitVariant,
} from '../smartVerdictPresentation';

interface SmartVerdictLimitModalProps {
  visible: boolean;
  variant: SmartLimitVariant;
  access?: AiVerdictAccessState | null;
  protectedContent?: SmartLimitProtectedContent;
  onPrimary: () => void;
  onDismiss: () => void;
}

const rowIcons = [Sparkles, FileCheck2, Clock3] as const;

export function SmartVerdictLimitModal({
  visible,
  variant,
  access,
  protectedContent = 'draft',
  onPrimary,
  onDismiss,
}: SmartVerdictLimitModalProps) {
  const presentation = buildSmartLimitPresentation({ variant, access, protectedContent });

  return (
    <Modal animationType="fade" onRequestClose={onDismiss} transparent visible={visible}>
      <View style={styles.backdrop}>
        <View accessibilityViewIsModal style={styles.modal}>
          <View style={styles.badge}>
            <Sparkles color={colors.text.onAccent} size={14} strokeWidth={2.8} />
            <AppText variant="eyebrow" color={colors.text.onAccent} style={styles.badgeText}>
              Smart limit
            </AppText>
          </View>

          <AppText variant="display" style={styles.title}>
            {presentation.title}
          </AppText>

          <View style={styles.rows}>
            {presentation.rows.map((copy, index) => {
              const Icon = rowIcons[index];
              return (
                <View key={copy} style={styles.row}>
                  <View style={styles.icon}>
                    <Icon color={colors.brand.ink} size={17} strokeWidth={2.6} />
                  </View>
                  <AppText variant="body" style={styles.rowText}>
                    {copy}
                  </AppText>
                </View>
              );
            })}
          </View>

          <Button title={presentation.primaryLabel} variant="accent" onPress={onPrimary} />
          {presentation.secondaryLabel ? (
            <Button title={presentation.secondaryLabel} variant="ghost" onPress={onDismiss} />
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(31, 23, 34, 0.58)',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modal: {
    backgroundColor: colors.bg.surface,
    borderColor: colors.brand.ink,
    borderRadius: radii.xl,
    borderWidth: 2,
    gap: spacing.md,
    maxHeight: '88%',
    padding: spacing.xl,
    width: '100%',
    ...shadows.hard,
  },
  badge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.accent.lime,
    borderColor: colors.brand.ink,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  badgeText: {
    fontFamily: typography.family.displayBold,
    fontSize: 9,
    letterSpacing: 1.5,
    lineHeight: 12,
  },
  title: {
    fontSize: 29,
    lineHeight: 33,
  },
  rows: {
    gap: spacing.sm,
  },
  row: {
    alignItems: 'center',
    backgroundColor: colors.bg.muted,
    borderColor: colors.ui.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  icon: {
    alignItems: 'center',
    backgroundColor: colors.bg.surface,
    borderColor: colors.brand.ink,
    borderRadius: 15,
    borderWidth: 1.5,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  rowText: {
    flex: 1,
    fontFamily: typography.family.bodyMedium,
    fontSize: 13,
    lineHeight: 18,
  },
});
