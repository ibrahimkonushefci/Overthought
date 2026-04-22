import { Stack } from 'expo-router';
import { colors } from '../../src/shared/theme/tokens';

export default function PublicLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg.base },
      }}
    />
  );
}
