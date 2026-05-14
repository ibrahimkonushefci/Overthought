import { Tabs } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { BarChart3, Home, Layers3, Plus, UserRound } from 'lucide-react-native';
import { colors, typography } from '../../src/shared/theme/tokens';

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
          fontSize: 8,
          textTransform: 'uppercase',
          marginTop: 0,
        },
        tabBarStyle: {
          backgroundColor: colors.bg.surface,
          borderColor: colors.brand.ink,
          borderRadius: 39,
          borderTopWidth: 2,
          borderWidth: 2,
          alignSelf: 'center',
          bottom: 18,
          height: 66,
          marginHorizontal: '5%',
          paddingBottom: 5,
          paddingTop: 5,
          position: 'absolute',
          shadowColor: colors.brand.ink,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 1,
          shadowRadius: 0,
          width: '90%',
        },
        tabBarItemStyle: {
          height: 50,
          justifyContent: 'center',
          paddingVertical: 2,
        },
        tabBarIconStyle: {
          marginTop: 1,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarLabel: ({ focused, color }) => <TabLabel focused={focused} color={color} title="HOME" />,
          tabBarIcon: ({ color, focused }) => <Home color={color} size={20} strokeWidth={focused ? 2.6 : 2} />,
        }}
      />
      <Tabs.Screen
        name="cases"
        options={{
          title: 'Cases',
          tabBarLabel: ({ focused, color }) => <TabLabel focused={focused} color={color} title="CASES" />,
          tabBarIcon: ({ color, focused }) => <Layers3 color={color} size={20} strokeWidth={focused ? 2.6 : 2} />,
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
                borderRadius: 19,
                borderWidth: 2,
                alignItems: 'center',
                justifyContent: 'center',
                height: 38,
                width: 38,
                shadowColor: colors.brand.ink,
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 1,
                shadowRadius: 0,
                transform: [{ translateY: 0 }],
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
          tabBarIcon: ({ color, focused }) => <BarChart3 color={color} size={20} strokeWidth={focused ? 2.6 : 2} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'You',
          tabBarLabel: ({ focused, color }) => <TabLabel focused={focused} color={color} title="YOU" />,
          tabBarIcon: ({ color, focused }) => <UserRound color={color} size={20} strokeWidth={focused ? 2.6 : 2} />,
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
    height: 20,
    justifyContent: 'flex-start',
    paddingTop: 1,
    position: 'relative',
  },
  label: {
    fontFamily: typography.family.displaySemiBold,
    fontSize: 8,
    letterSpacing: 0,
    lineHeight: 10,
  },
  activeDot: {
    backgroundColor: colors.brand.ink,
    borderRadius: 2,
    bottom: 1,
    height: 3,
    opacity: 0,
    position: 'absolute',
    width: 3,
  },
  activeDotVisible: {
    opacity: 1,
  },
});
