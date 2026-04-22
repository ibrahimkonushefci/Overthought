import type { ComponentType, ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { LucideProps } from 'lucide-react-native';
import { colors, gradients, radii, shadows, spacing } from '../theme/tokens';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'accent' | 'ghost' | 'danger';

interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  icon?: ComponentType<LucideProps>;
  children?: ReactNode;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  icon: Icon,
  children,
}: ButtonProps) {
  const isPrimary = variant === 'primary';
  const contentColor =
    variant === 'primary' || variant === 'secondary' || variant === 'danger'
      ? colors.text.onBrand
      : colors.text.primary;

  const inner = (
    <View style={styles.row}>
      {loading ? <ActivityIndicator color={contentColor} /> : null}
      {!loading && Icon ? <Icon color={contentColor} size={17} strokeWidth={2.7} /> : null}
      <Text style={[styles.text, { color: contentColor }]} numberOfLines={1}>
        {children ?? title}
      </Text>
    </View>
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      onPress={disabled || loading ? undefined : onPress}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        disabled && styles.disabled,
        pressed && !disabled ? styles.pressed : null,
      ]}
    >
      {isPrimary ? (
        <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradient}>
          {inner}
        </LinearGradient>
      ) : (
        inner
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 46,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.brand.ink,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: colors.brand.pink,
    ...shadows.hard,
  },
  secondary: {
    backgroundColor: colors.brand.lilac,
  },
  outline: {
    backgroundColor: colors.bg.surface,
  },
  accent: {
    backgroundColor: colors.accent.lime,
    ...shadows.hard,
  },
  ghost: {
    minHeight: 36,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: colors.ui.destructive,
  },
  gradient: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  text: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0,
  },
  disabled: {
    opacity: 0.55,
    shadowOpacity: 0,
  },
  pressed: {
    transform: [{ translateY: 2 }],
  },
});
