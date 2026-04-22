import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, View } from 'react-native';
import { colors, radii, spacing } from '../theme/tokens';

interface CardProps {
  children: ReactNode;
  outlined?: boolean;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Card({ children, outlined = false, padded = true, style }: CardProps) {
  return <View style={[styles.card, outlined && styles.outlined, padded && styles.padded, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg.surface,
    borderColor: colors.ui.border,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  outlined: {
    borderColor: colors.brand.ink,
    borderWidth: 2,
  },
  padded: {
    padding: spacing.lg,
  },
});
