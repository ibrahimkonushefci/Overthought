import type { ReactNode } from 'react';
import type { StyleProp, TextProps as NativeTextProps, TextStyle } from 'react-native';
import { StyleSheet, Text as NativeText } from 'react-native';
import { colors, typography } from '../theme/tokens';

type TextVariant = 'eyebrow' | 'display' | 'title' | 'subtitle' | 'body' | 'meta';

interface TextProps extends NativeTextProps {
  children: ReactNode;
  variant?: TextVariant;
  color?: string;
  center?: boolean;
  style?: StyleProp<TextStyle>;
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
    fontFamily: typography.family.body,
  },
  eyebrow: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    fontFamily: typography.family.displaySemiBold,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  display: {
    fontFamily: typography.family.displayBold,
    fontSize: typography.size.display,
    lineHeight: 35,
    letterSpacing: 0,
  },
  title: {
    fontFamily: typography.family.displaySemiBold,
    fontSize: typography.size.xl,
    lineHeight: 26,
    letterSpacing: 0,
  },
  subtitle: {
    color: colors.text.secondary,
    fontSize: typography.size.lg,
    lineHeight: 21,
    fontFamily: typography.family.body,
  },
  body: {
    fontSize: typography.size.md,
    lineHeight: 20,
    fontFamily: typography.family.body,
  },
  meta: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    lineHeight: 17,
    fontFamily: typography.family.bodyMedium,
  },
  center: {
    textAlign: 'center',
  },
});
