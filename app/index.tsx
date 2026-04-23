import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuthStore } from '../src/store/authStore';
import { colors } from '../src/shared/theme/tokens';

export default function IndexRoute() {
  const sessionMode = useAuthStore((state) => state.sessionMode);
  const hasCompletedEntry = useAuthStore((state) => state.hasCompletedEntry);

  if (sessionMode === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg.base }}>
        <ActivityIndicator color={colors.brand.pink} />
      </View>
    );
  }

  if (sessionMode === 'authenticated' || (sessionMode === 'guest' && hasCompletedEntry)) {
    return <Redirect href="/home" />;
  }

  return <Redirect href="/welcome" />;
}
