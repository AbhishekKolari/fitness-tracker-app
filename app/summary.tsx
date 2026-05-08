import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Provider as PaperProvider, Card, Text, Button, ActivityIndicator } from 'react-native-paper';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { workoutSessions, workoutTemplates, programs, setLogs, exercises } from '../db/schema';
import { useSettings } from '../contexts/SettingsContext';

interface SetRow {
  exerciseName: string;
  setNumber: number;
  weightKg: number;
  reps: number;
}

interface SummaryData {
  date: string;
  programName: string;
  templateLabel: string;
  sets: SetRow[];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export default function SummaryScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { settings } = useSettings();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<SummaryData | null>(null);

  useEffect(() => {
    try {
      const id = sessionId ? Number(sessionId) : null;
      if (!id) { setLoading(false); return; }

      const session = db
        .select({
          date: workoutSessions.date,
          templateId: workoutSessions.templateId,
          programId: workoutSessions.programId,
        })
        .from(workoutSessions)
        .where(eq(workoutSessions.id, id))
        .get();

      if (!session) { setLoading(false); return; }

      const template = db
        .select({ label: workoutTemplates.label })
        .from(workoutTemplates)
        .where(eq(workoutTemplates.id, session.templateId))
        .get();

      const program = db
        .select({ name: programs.name })
        .from(programs)
        .where(eq(programs.id, session.programId))
        .get();

      const sets = db
        .select({
          exerciseName: exercises.name,
          setNumber: setLogs.setNumber,
          weightKg: setLogs.weightKg,
          reps: setLogs.reps,
        })
        .from(setLogs)
        .innerJoin(exercises, eq(setLogs.exerciseId, exercises.id))
        .where(eq(setLogs.sessionId, id))
        .all()
        .sort((a, b) => a.exerciseName.localeCompare(b.exerciseName) || a.setNumber - b.setNumber);

      setSummary({
        date: session.date,
        programName: program?.name ?? '',
        templateLabel: template?.label ?? '',
        sets,
      });
    } catch (error) {
      console.error('Error loading summary:', error);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  const toDisplay = (kg: number) =>
    settings.weightUnit === 'kg' ? `${kg} kg` : `${(kg * 2.20462).toFixed(1)} lbs`;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!summary) {
    return (
      <PaperProvider>
        <View style={styles.center}>
          <Text style={styles.title}>No session data found.</Text>
          <Button mode="contained" onPress={() => router.replace('/')} style={styles.button}>
            Back to Today
          </Button>
        </View>
      </PaperProvider>
    );
  }

  // Group sets by exercise
  const grouped = summary.sets.reduce<Record<string, SetRow[]>>((acc, s) => {
    (acc[s.exerciseName] ??= []).push(s);
    return acc;
  }, {});

  const totalVolume = summary.sets.reduce((sum, s) => sum + s.weightKg * s.reps, 0);
  const displayVolume = settings.weightUnit === 'kg'
    ? `${totalVolume.toFixed(0)} kg`
    : `${(totalVolume * 2.20462).toFixed(0)} lbs`;

  return (
    <PaperProvider>
      <View style={styles.container}>
        <Text style={styles.title}>Workout Complete!</Text>
        <Text style={styles.date}>{formatDate(summary.date)}</Text>
        <Text style={styles.subtitle}>{summary.programName} · {summary.templateLabel}</Text>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{summary.sets.length}</Text>
            <Text style={styles.statLabel}>Sets</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{Object.keys(grouped).length}</Text>
            <Text style={styles.statLabel}>Exercises</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{displayVolume}</Text>
            <Text style={styles.statLabel}>Volume</Text>
          </View>
        </View>

        <ScrollView style={styles.scrollView}>
          {Object.entries(grouped).map(([name, sets]) => (
            <Card key={name} style={styles.card}>
              <Card.Title title={name} subtitle={`${sets.length} sets`} />
              <Card.Content>
                {sets.map((s, i) => (
                  <View key={i} style={styles.setRow}>
                    <Text style={styles.setLabel}>Set {s.setNumber}</Text>
                    <Text style={styles.setDetail}>{toDisplay(s.weightKg)} × {s.reps} reps</Text>
                  </View>
                ))}
              </Card.Content>
            </Card>
          ))}
        </ScrollView>

        <Button mode="contained" onPress={() => router.replace('/')} style={styles.button}>
          Back to Today
        </Button>
      </View>
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', color: '#111827', marginBottom: 4 },
  date: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 2 },
  subtitle: { fontSize: 15, fontWeight: '600', color: '#374151', textAlign: 'center', marginBottom: 20 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  statBox: {
    flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14,
    alignItems: 'center', elevation: 1,
  },
  statValue: { fontSize: 20, fontWeight: '700', color: '#6200ee' },
  statLabel: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  scrollView: { flex: 1, marginBottom: 12 },
  card: { marginBottom: 12 },
  setRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  setLabel: { fontSize: 14, color: '#6B7280' },
  setDetail: { fontSize: 14, fontWeight: '600', color: '#111827' },
  button: { marginBottom: 8 },
});
