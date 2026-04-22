import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuthStore } from '../src/store/authStore';
import { useGuestStore } from '../src/store/guestStore';
import { colors } from '../src/shared/theme/tokens';

export default function IndexRoute() {
  const sessionMode = useAuthStore((state) => state.sessionMode);
  const localGuestId = useGuestStore((state) => state.localGuestId);

  if (sessionMode === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg.base }}>
        <ActivityIndicator color={colors.brand.pink} />
      </View>
    );
  }

  if (sessionMode === 'authenticated' || localGuestId) {
    return <Redirect href="/home" />;
  }

  return <Redirect href="/welcome" />;
}
