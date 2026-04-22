import { Pressable, StyleSheet, View } from 'react-native';
import { ArrowLeft, UserRound } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { AppText } from './Text';
import { colors, radii, spacing, typography } from '../theme/tokens';

interface HeaderProps {
  eyebrow?: string;
  title: string;
  accent?: string;
  showBack?: boolean;
  showProfile?: boolean;
}

export function Header({ eyebrow, title, accent, showBack, showProfile }: HeaderProps) {
  const router = useRouter();

  return (
    <View style={styles.wrap}>
      <View style={styles.topRow}>
        {showBack ? (
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.iconButton}>
            <ArrowLeft color={colors.text.primary} size={20} strokeWidth={2.4} />
          </Pressable>
        ) : (
          <View />
        )}
        {showProfile ? (
          <Pressable accessibilityRole="button" onPress={() => router.push('/profile')} style={styles.iconButton}>
            <UserRound color={colors.text.primary} size={20} strokeWidth={2.4} />
          </Pressable>
        ) : null}
      </View>
      {eyebrow ? <AppText variant="eyebrow">{eyebrow}</AppText> : null}
      <AppText variant="display" style={styles.title}>
        {title}
        {accent ? <AppText variant="display" color={colors.brand.pink} style={styles.accent}> {accent}</AppText> : null}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 50,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: colors.bg.surface,
    borderColor: colors.ui.border,
    borderRadius: radii.sm,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  title: {
    flexWrap: 'wrap',
  },
  accent: {
    fontFamily: typography.family.editorial,
  },
});
