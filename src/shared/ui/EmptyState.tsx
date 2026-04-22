import type { ComponentType } from 'react';
import { StyleSheet, View } from 'react-native';
import type { LucideProps } from 'lucide-react-native';
import { AppText } from './Text';
import { Button } from './Button';
import { colors, radii, spacing } from '../theme/tokens';

interface EmptyStateProps {
  title: string;
  body: string;
  emoji?: string;
  icon?: ComponentType<LucideProps>;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ title, body, emoji, icon: Icon, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.wrap}>
      {emoji ? <AppText variant="title" center style={styles.emoji}>{emoji}</AppText> : null}
      {!emoji && Icon ? <Icon color={colors.text.secondary} size={36} strokeWidth={2.2} /> : null}
      <AppText variant="title" center style={styles.title}>
        {title}
      </AppText>
      <AppText variant="subtitle" center>
        {body}
      </AppText>
      {actionLabel && onAction ? (
        <View style={styles.action}>
          <Button title={actionLabel} onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    borderColor: colors.ui.border,
    borderRadius: radii.lg,
    borderStyle: 'dashed',
    borderWidth: 1,
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: 168,
    padding: spacing.lg,
  },
  title: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '700',
  },
  emoji: {
    fontSize: 30,
    lineHeight: 34,
  },
  action: {
    marginTop: spacing.md,
    minWidth: 220,
  },
});
