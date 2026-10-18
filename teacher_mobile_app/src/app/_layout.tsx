import { Caprasimo_400Regular } from '@expo-google-fonts/caprasimo';
import { Figtree_400Regular, Figtree_700Bold } from '@expo-google-fonts/figtree';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { AppProvider, useApp } from '../lib/AppContext';
import { colors, fonts } from '../theme';

export default function RootLayout() {
  const [loaded] = useFonts({ Caprasimo_400Regular, Figtree_400Regular, Figtree_700Bold });
  if (!loaded) return <Loading />;
  return (
    <AppProvider>
      <StatusBar style="dark" />
      <Screens />
    </AppProvider>
  );
}

function Loading() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}

function Screens() {
  const { ready, teacher } = useApp();
  if (!ready) return <Loading />;
  const signedIn = Boolean(teacher);
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        // SDK 58 / iOS 26 headers use system fonts unless set here.
        headerTitleStyle: { fontFamily: fonts.heading },
        headerBackTitleStyle: { fontFamily: fonts.body },
        headerTransparent: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="index" options={{ title: 'TedTronics' }} />
        <Stack.Screen name="bancada" options={{ title: 'Bancada' }} />
        <Stack.Screen name="turmas/index" options={{ title: 'Turmas' }} />
        <Stack.Screen name="turmas/[id]" options={{ title: 'Alunos' }} />
        <Stack.Screen name="modulos" options={{ title: 'Enviar módulo' }} />
      </Stack.Protected>
    </Stack>
  );
}
