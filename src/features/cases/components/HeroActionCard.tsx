import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Plus } from 'lucide-react-native';
import { Button } from '../../../shared/ui/Button';
import { AppText } from '../../../shared/ui/Text';
import { colors, gradients, radii, shadows, spacing } from '../../../shared/theme/tokens';

interface HeroActionCardProps {
  onStart: () => void;
}

export function HeroActionCard({ onStart }: HeroActionCardProps) {
  return (
    <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.wrap}>
      <View style={styles.badge}>
        <AppText variant="eyebrow" color={colors.text.onBrand}>
          New case
        </AppText>
      </View>
      <AppText variant="title" color={colors.text.onBrand} style={styles.title}>
        Tell me what they did.
      </AppText>
      <AppText variant="subtitle" color={colors.text.onBrand} style={styles.subtitle}>
        I will tell you if you are reading too much into it.
      </AppText>
      <View style={styles.buttonWrap}>
        <Button title="Start a case" variant="outline" icon={Plus} onPress={onStart} />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderColor: colors.brand.ink,
    borderRadius: radii.xl,
    borderWidth: 2,
    gap: spacing.sm,
    minHeight: 192,
    padding: spacing.lg,
    ...shadows.hard,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  title: {
    fontSize: 25,
    lineHeight: 30,
    fontWeight: '800',
    marginTop: 0,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '400',
    maxWidth: 280,
  },
  buttonWrap: {
    alignSelf: 'flex-start',
    marginTop: 0,
    minWidth: 176,
  },
});
