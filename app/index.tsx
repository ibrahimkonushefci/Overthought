import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuthStore } from '../src/store/authStore';
import { colors } from '../src/shared/theme/tokens';

export default function IndexRoute() {
  const sessionMode = useAuthStore((state) => state.sessionMode);

  if (sessionMode === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg.base }}>
        <ActivityIndicator color={colors.brand.pink} />
      </View>
    );
  }

  return <Redirect href="/welcome" />;
}
