import React from 'react';
import { ScrollView, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Text, SegmentedButtons, Divider, Button } from 'react-native-paper';
import { colors as C } from '../../theme';
import { useSettings } from '../../contexts/SettingsContext';
import BMICalculator from '../../components/BMICalculator';
import { db } from '../../db/client';
import { workoutSessions, setLogs, bodyStats, programs, workoutTemplates, templateExercises, exercises } from '../../db/schema';

export default function ProfileScreen() {
  const { settings, updateWeightUnit, updateHeightUnit } = useSettings();

  const resetDatabase = () => {
    Alert.alert(
      'Reset App Data',
      'This will delete all your workout history and reset the app to its initial state. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            try {
              // Delete all data
              db.delete(setLogs).run();
              db.delete(workoutSessions).run();
              db.delete(templateExercises).run();
              db.delete(workoutTemplates).run();
              db.delete(programs).run();
              db.delete(exercises).run();
              db.delete(bodyStats).run();

              // Reload the app to reseed data
              Alert.alert('Success', 'App data has been reset. Please restart the app.');
            } catch (error) {
              Alert.alert('Error', 'Failed to reset database');
              console.error('Error resetting database:', error);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Profile</Text>
        <Text style={styles.subheading}>Preferences & data</Text>
        <Card style={styles.card}>
          <Card.Title title="Unit Preferences" />
          <Card.Content>
            <Text style={styles.label}>Weight Unit</Text>
            <SegmentedButtons
              value={settings.weightUnit}
              onValueChange={(value) => updateWeightUnit(value as 'kg' | 'lbs')}
              buttons={[
                { value: 'kg', label: 'kg' },
                { value: 'lbs', label: 'lbs' },
              ]}
              style={styles.segmentedButton}
            />

            <Text style={styles.label}>Height Unit</Text>
            <SegmentedButtons
              value={settings.heightUnit}
              onValueChange={(value) => updateHeightUnit(value as 'cm' | 'ft')}
              buttons={[
                { value: 'cm', label: 'cm' },
                { value: 'ft', label: 'ft/in' },
              ]}
              style={styles.segmentedButton}
            />
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Title title="Plate Configuration" />
          <Card.Content>
            <Text style={styles.label}>Barbell Weight</Text>
            <Text style={styles.value}>20 kg (45 lbs)</Text>
            <Divider style={styles.divider} />
            <Text style={styles.label}>Available Plates</Text>
            <Text style={styles.value}>20, 15, 10, 5, 2.5 kg</Text>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Title title="Data Management" />
          <Card.Content>
            <Text style={styles.description}>
              Reset all app data including workout history, programs, and settings. This action cannot be undone.
            </Text>
            <Button mode="contained" onPress={resetDatabase} style={styles.resetButton} buttonColor="#EF4444">
              Reset All Data
            </Button>
          </Card.Content>
        </Card>

        <BMICalculator />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scrollView: { flex: 1 },
  content: { padding: 16, paddingBottom: 120 },
  heading: { fontSize: 34, fontWeight: '800', color: C.textPrimary, letterSpacing: -0.5 },
  subheading: { fontSize: 15, color: C.textSecondary, marginBottom: 20, marginTop: 2 },
  card: { marginBottom: 14, borderRadius: 16, backgroundColor: C.surface },
  label: { fontSize: 14, marginBottom: 8, marginTop: 8, color: C.textSecondary },
  segmentedButton: { marginBottom: 8 },
  value: { fontSize: 16, marginBottom: 8, color: C.textPrimary },
  divider: { marginVertical: 8, backgroundColor: C.border },
  description: { fontSize: 14, color: C.textSecondary, marginBottom: 12, lineHeight: 20 },
  resetButton: { marginTop: 8, borderRadius: 12 },
});
