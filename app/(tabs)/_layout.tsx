import { Tabs } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { BarChart3, Home, Layers3, Plus, UserRound } from 'lucide-react-native';
import { colors, radii, typography } from '../../src/shared/theme/tokens';

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
          fontFamily: typography.family.displaySemiBold,
          fontSize: 10,
          textTransform: 'uppercase',
          marginTop: 1,
        },
        tabBarStyle: {
          backgroundColor: colors.bg.surface,
          borderColor: colors.brand.ink,
          borderRadius: radii.xl,
          borderTopWidth: 2,
          borderWidth: 2,
          height: 64,
          left: 24,
          right: 24,
          bottom: 4,
          paddingBottom: 5,
          paddingTop: 5,
          position: 'absolute',
          shadowColor: colors.brand.ink,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 1,
          shadowRadius: 0,
        },
        tabBarItemStyle: {
          height: 48,
          paddingVertical: 1,
        },
        tabBarIconStyle: {
          marginTop: 0,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarLabel: ({ focused, color }) => <TabLabel focused={focused} color={color} title="HOME" />,
          tabBarIcon: ({ color, focused }) => <Home color={color} size={21} strokeWidth={focused ? 2.6 : 2} />,
        }}
      />
      <Tabs.Screen
        name="cases"
        options={{
          title: 'Cases',
          tabBarLabel: ({ focused, color }) => <TabLabel focused={focused} color={color} title="CASES" />,
          tabBarIcon: ({ color, focused }) => <Layers3 color={color} size={21} strokeWidth={focused ? 2.6 : 2} />,
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
                height: 40,
                width: 40,
                shadowColor: colors.brand.ink,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 1,
                shadowRadius: 0,
                transform: [{ translateY: 1 }],
              }}
            >
              <Plus color={colors.text.onBrand} size={18} strokeWidth={3} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: 'Stats',
          tabBarLabel: ({ focused, color }) => <TabLabel focused={focused} color={color} title="STATS" />,
          tabBarIcon: ({ color, focused }) => <BarChart3 color={color} size={21} strokeWidth={focused ? 2.6 : 2} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'You',
          tabBarLabel: ({ focused, color }) => <TabLabel focused={focused} color={color} title="YOU" />,
          tabBarIcon: ({ color, focused }) => <UserRound color={color} size={21} strokeWidth={focused ? 2.6 : 2} />,
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
    justifyContent: 'center',
    minHeight: 16,
    paddingBottom: 3,
    position: 'relative',
  },
  label: {
    fontFamily: typography.family.displaySemiBold,
    fontSize: 9,
    letterSpacing: 0,
    lineHeight: 12,
  },
  activeDot: {
    backgroundColor: colors.brand.ink,
    borderRadius: 2,
    bottom: -3,
    height: 4,
    opacity: 0,
    position: 'absolute',
    width: 4,
  },
  activeDotVisible: {
    opacity: 1,
  },
});
