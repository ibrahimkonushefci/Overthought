import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { authService } from '../src/features/auth/authService';
import { colors } from '../src/shared/theme/tokens';

export default function RootLayout() {
  useEffect(() => {
    void authService.bootstrap();
  }, []);

  return (
    <>
      <StatusBar style="dark" backgroundColor={colors.bg.base} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg.base },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(public)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(modals)" options={{ presentation: 'modal' }} />
      </Stack>
    </>
  );
}
