import { useEffect, useRef, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Text, View } from 'react-native';
import { Provider as PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { db, useMigrations } from '../db/client';
import migrations from '../drizzle/migrations/migrations';
import { seedIfEmpty } from '../db/queries';
import { SettingsProvider } from '../contexts/SettingsContext';
import { paperTheme, colors } from '../theme';
import Splash from '../components/Splash';

// Minimum on-screen time for the custom splash so the animation is visible
// even when migrations finish near-instantly.
const MIN_SPLASH_MS = 1500;

export default function RootLayout() {
  const { success, error } = useMigrations(db, migrations);
  const seeded = useRef(false);
  const [minElapsed, setMinElapsed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMinElapsed(true), MIN_SPLASH_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (success && !seeded.current) {
      seedIfEmpty();
      seeded.current = true;
    }
  }, [success]);

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Migration error: {error.message}</Text>
      </View>
    );
  }

  if (!success || !minElapsed) return <Splash />;

  return (
    <SafeAreaProvider>
      <PaperProvider theme={paperTheme}>
        <SettingsProvider>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          </Stack>
        </SettingsProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
