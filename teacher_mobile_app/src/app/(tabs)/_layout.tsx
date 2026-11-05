import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';
import { useApp } from '../../lib/AppContext';
import { colors, fonts } from '../../theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

const tab = (title: string, icon: IconName, iconOn: IconName) => ({
  title,
  tabBarIcon: ({ color, focused }: { color: ColorValue; focused: boolean }) => (
    <Ionicons name={focused ? iconOn : icon} size={24} color={color as string} />
  ),
});

/** Bottom tabs: Início, Turmas, Módulos, Bancada. */
export default function TabsLayout() {
  const { bench } = useApp();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerTintColor: colors.text,
        headerTitleStyle: { fontFamily: fonts.heading },
        sceneStyle: { backgroundColor: colors.bg },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontFamily: fonts.bodyBold, fontSize: 12 },
        tabBarStyle: { backgroundColor: colors.white, borderTopColor: colors.divider, height: 64, paddingTop: 6 },
      }}
    >
      <Tabs.Screen name="index" options={{ ...tab('Início', 'home-outline', 'home'), headerShown: false }} />
      <Tabs.Screen name="turmas" options={tab('Turmas', 'people-outline', 'people')} />
      <Tabs.Screen name="modulos" options={tab('Módulos', 'albums-outline', 'albums')} />
      <Tabs.Screen
        name="bancada"
        options={{
          ...tab('Bancada', 'hardware-chip-outline', 'hardware-chip'),
          // a dot on the tab while a bench is connected
          tabBarBadge: bench ? '' : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.olive, minWidth: 10, height: 10, borderRadius: 5, top: 4 },
        }}
      />
    </Tabs>
  );
}
