import { Tabs } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { BarChart3, Home, Layers3, Plus, UserRound } from 'lucide-react-native';
import { colors, radii } from '../../src/shared/theme/tokens';

function TabLabel({ focused, color, title }: { focused: boolean; color: string; title: string }) {
  return (
    <View style={styles.labelWrap}>
      <Text style={[styles.label, { color }]}>{title}</Text>
      <View style={[styles.activeDot, focused && styles.activeDotVisible]} />
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.text.primary,
        tabBarInactiveTintColor: colors.text.secondary,
        tabBarLabelStyle: {
          fontSize: 9,
          fontWeight: '700',
          textTransform: 'uppercase',
          marginTop: 1,
        },
        tabBarStyle: {
          backgroundColor: colors.bg.surface,
          borderColor: colors.brand.ink,
          borderRadius: radii.xl,
          borderTopWidth: 2,
          borderWidth: 2,
          height: 70,
          left: 10,
          right: 10,
          bottom: 8,
          paddingBottom: 7,
          paddingTop: 7,
          position: 'absolute',
          shadowColor: colors.brand.ink,
          shadowOffset: { width: 0, height: 7 },
          shadowOpacity: 1,
          shadowRadius: 0,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarLabel: ({ focused, color }) => <TabLabel focused={focused} color={color} title="HOME" />,
          tabBarIcon: ({ color }) => <Home color={color} size={21} strokeWidth={2.4} />,
        }}
      />
      <Tabs.Screen
        name="cases"
        options={{
          title: 'Cases',
          tabBarLabel: ({ focused, color }) => <TabLabel focused={focused} color={color} title="CASES" />,
          tabBarIcon: ({ color }) => <Layers3 color={color} size={21} strokeWidth={2.4} />,
        }}
      />
      <Tabs.Screen
        name="new-case"
        options={{
          title: '',
          tabBarIcon: ({ focused }) => (
            <View
              style={{
                backgroundColor: focused ? colors.brand.lilac : colors.brand.pink,
                borderColor: colors.brand.ink,
                borderRadius: 20,
                borderWidth: 2,
                alignItems: 'center',
                justifyContent: 'center',
                height: 44,
                width: 44,
                shadowColor: colors.brand.ink,
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 1,
                shadowRadius: 0,
              }}
            >
              <Plus color={colors.text.onBrand} size={24} strokeWidth={2.8} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: 'Stats',
          tabBarLabel: ({ focused, color }) => <TabLabel focused={focused} color={color} title="STATS" />,
          tabBarIcon: ({ color }) => <BarChart3 color={color} size={21} strokeWidth={2.4} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'You',
          tabBarLabel: ({ focused, color }) => <TabLabel focused={focused} color={color} title="YOU" />,
          tabBarIcon: ({ color }) => <UserRound color={color} size={21} strokeWidth={2.4} />,
        }}
      />
      <Tabs.Screen name="case/[id]/index" options={{ href: null }} />
      <Tabs.Screen name="case/[id]/add-update" options={{ href: null }} />
      <Tabs.Screen name="account/profile/delete-account" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  labelWrap: {
    alignItems: 'center',
    gap: 3,
    minHeight: 16,
  },
  label: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0,
  },
  activeDot: {
    backgroundColor: colors.brand.ink,
    borderRadius: 2,
    height: 4,
    opacity: 0,
    width: 4,
  },
  activeDotVisible: {
    opacity: 1,
  },
});
