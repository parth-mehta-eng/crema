import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font, spacing } from '@/constants/theme';

const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
  index: 'home-outline',
  search: 'search-outline',
  bar: 'cafe-outline',
  favorites: 'heart-outline',
  profile: 'person-outline',
};

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarHideOnKeyboard: false,
        tabBarActiveTintColor: colors.espresso,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontFamily: font.medium,
          fontSize: 11,
        },
        tabBarIconStyle: {
          marginTop: spacing.xs,
        },
        tabBarStyle: {
          height: 62 + insets.bottom,
          paddingTop: spacing.xs,
          paddingBottom: Math.max(insets.bottom, spacing.sm),
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          elevation: 0,
        },
        tabBarIcon: ({ color }) => (
          <Ionicons name={icons[route.name] ?? 'ellipse-outline'} color={color} size={22} />
        ),
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="search" options={{ title: 'Search' }} />
      <Tabs.Screen name="bar" options={{ title: 'Coffee Bar' }} />
      <Tabs.Screen name="favorites" options={{ title: 'Favorites' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
