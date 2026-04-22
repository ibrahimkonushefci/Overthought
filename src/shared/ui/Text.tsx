import type { ReactNode } from 'react';
import type { TextProps as NativeTextProps, TextStyle } from 'react-native';
import { StyleSheet, Text as NativeText } from 'react-native';
import { colors, typography } from '../theme/tokens';

type TextVariant = 'eyebrow' | 'display' | 'title' | 'subtitle' | 'body' | 'meta';

interface TextProps extends NativeTextProps {
  children: ReactNode;
  variant?: TextVariant;
  color?: string;
  center?: boolean;
  style?: TextStyle | TextStyle[];
}

export function AppText({
  children,
  variant = 'body',
  color,
  center = false,
  style,
  ...props
}: TextProps) {
  return (
    <NativeText
      {...props}
      style={[
        styles.base,
        styles[variant],
        center && styles.center,
        color ? { color } : null,
        style,
      ]}
    >
      {children}
    </NativeText>
  );
}

const styles = StyleSheet.create({
  base: {
    color: colors.text.primary,
    fontFamily: typography.family.regular,
  },
  eyebrow: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    fontWeight: '700',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  display: {
    fontFamily: typography.family.display,
    fontSize: typography.size.display,
    lineHeight: 40,
    fontWeight: '800',
    letterSpacing: 0,
  },
  title: {
    fontFamily: typography.family.display,
    fontSize: typography.size.xl,
    lineHeight: 26,
    fontWeight: '700',
    letterSpacing: 0,
  },
  subtitle: {
    color: colors.text.secondary,
    fontSize: typography.size.lg,
    lineHeight: 21,
    fontWeight: '400',
  },
  body: {
    fontSize: typography.size.md,
    lineHeight: 20,
    fontWeight: '400',
  },
  meta: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    lineHeight: 17,
    fontWeight: '600',
  },
  center: {
    textAlign: 'center',
  },
});
