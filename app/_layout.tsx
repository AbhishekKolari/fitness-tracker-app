import { useEffect, useRef } from 'react';
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

export default function RootLayout() {
  const { success, error } = useMigrations(db, migrations);
  const seeded = useRef(false);

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

  if (!success) return null;

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
