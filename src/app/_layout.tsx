import { Literata_400Regular, Literata_400Regular_Italic, Literata_600SemiBold, Literata_700Bold } from '@expo-google-fonts/literata';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useSettings } from '@/state/settings';
import { colors } from '@/ui/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const loaded = useSettings((s) => s.loaded);
  const load = useSettings((s) => s.load);
  const [fontsLoaded, fontError] = useFonts({ Literata_400Regular, Literata_400Regular_Italic, Literata_600SemiBold, Literata_700Bold });
  const ready = loaded && (fontsLoaded || !!fontError);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Taverna AI' }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="new" options={{ title: '' }} />
        <Stack.Screen name="settings" options={{ title: '' }} />
        <Stack.Screen name="game/[id]" options={{ title: '' }} />
      </Stack>
    </>
  );
}
