import React, { useState, useCallback } from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, ActivityIndicator, Portal, Modal, Button } from 'react-native-paper';
import { router, useFocusEffect } from 'expo-router';
import { colors as C } from '../../theme';
import { eq, desc } from 'drizzle-orm';
import { db } from '../../db/client';
import { workoutSessions, workoutTemplates, programs, setLogs, templateExercises, exercises } from '../../db/schema';
import Calendar from '../../components/Calendar';

interface SessionRow {
  id: number;
  date: string;
  templateLabel: string;
  programName: string;
  setsCompleted: number;
}

interface DayDetail {
  sessionId: number;
  date: string;
  templateLabel: string;
  programName: string;
  exercises: Array<{ name: string; sets: number; reps: number }>;
  setsCompleted: number;
  templateId?: number;
  programId?: number;
  isCustom?: boolean;
  customExercises?: Array<{ exerciseId: number; sets: number; reps: number; order: number }> | null;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}

export default function HistoryScreen() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDayDetail, setSelectedDayDetail] = useState<DayDetail | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    try {
      const rows = db
        .select({
          id: workoutSessions.id,
          date: workoutSessions.date,
          templateLabel: workoutTemplates.label,
          programName: programs.name,
        })
        .from(workoutSessions)
        .innerJoin(workoutTemplates, eq(workoutSessions.templateId, workoutTemplates.id))
        .innerJoin(programs, eq(workoutSessions.programId, programs.id))
        .orderBy(desc(workoutSessions.date))
        .all();

      const allLogs = db
        .select({ sessionId: setLogs.sessionId, completed: setLogs.completed })
        .from(setLogs)
        .all();

      setSessions(
        rows.map((r) => ({
          ...r,
          setsCompleted: allLogs.filter((l) => l.sessionId === r.id && l.completed).length,
        })),
      );
    } catch (e) {
      console.error('Error loading history:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDayDetail = useCallback((dateStr: string) => {
    try {
      const session = db
        .select({
          id: workoutSessions.id,
          templateId: workoutSessions.templateId,
          programId: workoutSessions.programId,
          date: workoutSessions.date,
          templateLabel: workoutTemplates.label,
          programName: programs.name,
          isCustom: workoutSessions.isCustom,
          customExercises: workoutSessions.customExercises,
        })
        .from(workoutSessions)
        .innerJoin(workoutTemplates, eq(workoutSessions.templateId, workoutTemplates.id))
        .innerJoin(programs, eq(workoutSessions.programId, programs.id))
        .where(eq(workoutSessions.date, dateStr))
        .get();

      if (!session) return;

      let exerciseData: Array<{ name: string; sets: number; reps: number }>;

      if (session.isCustom && session.customExercises) {
        // Load custom exercises
        exerciseData = session.customExercises.map((ex: any) => {
          const exercise = db.select({ name: exercises.name }).from(exercises).where(eq(exercises.id, ex.exerciseId)).get();
          return {
            name: exercise?.name || 'Unknown',
            sets: ex.sets,
            reps: ex.reps,
          };
        });
      } else {
        // Load template exercises
        exerciseData = db
          .select({
            name: exercises.name,
            sets: templateExercises.sets,
            reps: templateExercises.reps,
          })
          .from(templateExercises)
          .innerJoin(exercises, eq(templateExercises.exerciseId, exercises.id))
          .where(eq(templateExercises.templateId, session.templateId))
          .all();
      }

      const allLogs = db
        .select({ sessionId: setLogs.sessionId, completed: setLogs.completed })
        .from(setLogs)
        .all();

      setSelectedDayDetail({
        sessionId: session.id,
        date: session.date,
        templateLabel: session.templateLabel,
        programName: session.programName,
        exercises: exerciseData,
        setsCompleted: allLogs.filter((l) => l.sessionId === session.id && l.completed).length,
        templateId: session.templateId,
        programId: session.programId,
        isCustom: session.isCustom,
        customExercises: session.customExercises,
      });
      setModalVisible(true);
    } catch (e) {
      console.error('Error loading day detail:', e);
    }
  }, []);

  const repeatWorkout = useCallback(() => {
    if (!selectedDayDetail) return;

    const today = new Date().toISOString().split('T')[0];

    if (selectedDayDetail.isCustom && selectedDayDetail.customExercises) {
      // Repeat custom workout
      db.insert(workoutSessions)
        .values({
          programId: selectedDayDetail.programId || 1,
          templateId: -1,
          date: today,
          isCustom: true,
          customExercises: selectedDayDetail.customExercises,
        })
        .run();
    } else if (selectedDayDetail.templateId) {
      // Repeat template workout
      db.insert(workoutSessions)
        .values({
          programId: selectedDayDetail.programId || 1,
          templateId: selectedDayDetail.templateId,
          date: today,
        })
        .run();
    }

    setModalVisible(false);
    router.navigate('/');
  }, [selectedDayDetail]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" /></View>;
  }

  if (sessions.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>No workouts yet</Text>
        <Text style={styles.emptySubText}>Complete your first workout to see history here.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>History</Text>
      <Text style={styles.subheading}>Your training journey</Text>
      <Calendar onDateSelect={loadDayDetail} sessions={sessions.map((s) => ({ date: s.date }))} />
      <Text style={styles.subheading}>Recent Sessions</Text>
      {sessions.map((s) => (
        <View key={s.id} style={styles.card}>
          <View style={styles.cardTop}>
            <Text style={styles.date}>{formatDate(s.date)}</Text>
            {s.setsCompleted > 0 && (
              <View style={styles.setsPill}>
                <Text style={styles.setsText}>{s.setsCompleted} sets</Text>
              </View>
            )}
          </View>
          <Text style={styles.programLabel}>{s.programName}</Text>
          <Text style={styles.templateLabel}>{s.templateLabel}</Text>
        </View>
      ))}
      <Portal>
        <Modal visible={modalVisible} onDismiss={() => setModalVisible(false)} contentContainerStyle={styles.modal}>
          {selectedDayDetail && (
            <>
              <Text style={styles.modalTitle}>{formatDate(selectedDayDetail.date)}</Text>
              <Text style={styles.modalProgram}>{selectedDayDetail.programName}</Text>
              <Text style={styles.modalTemplate}>{selectedDayDetail.templateLabel}</Text>
              <View style={styles.modalDivider} />
              <Text style={styles.modalSectionTitle}>Exercises</Text>
              {selectedDayDetail.exercises.map((ex, idx) => (
                <View key={idx} style={styles.modalExercise}>
                  <Text style={styles.modalExerciseName}>{ex.name}</Text>
                  <Text style={styles.modalExerciseDetail}>{ex.sets} × {ex.reps}</Text>
                </View>
              ))}
              <View style={styles.modalDivider} />
              <Text style={styles.modalSummary}>Total sets completed: {selectedDayDetail.setsCompleted}</Text>
              <Button mode="contained" style={styles.modalButton} onPress={repeatWorkout}>
                Repeat Workout
              </Button>
              <Button mode="outlined" style={styles.modalButton} onPress={() => setModalVisible(false)}>
                Close
              </Button>
            </>
          )}
        </Modal>
      </Portal>
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  container: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, paddingBottom: 120 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: C.bg },
  heading: { fontSize: 34, fontWeight: '800', color: C.textPrimary, letterSpacing: -0.5 },
  subheading: { fontSize: 15, color: C.textSecondary, marginBottom: 20, marginTop: 2 },
  card: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  date: { fontSize: 15, fontWeight: '700', color: C.textPrimary },
  setsPill: { backgroundColor: 'rgba(250, 17, 79, 0.15)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  setsText: { fontSize: 12, fontWeight: '600', color: C.move },
  programLabel: { fontSize: 13, color: C.textSecondary, marginBottom: 2 },
  templateLabel: { fontSize: 14, fontWeight: '600', color: C.textPrimary },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: C.textPrimary },
  emptySubText: { fontSize: 14, color: C.textSecondary, marginTop: 8, textAlign: 'center' },
  modal: { backgroundColor: C.surface, padding: 24, margin: 20, borderRadius: 20 },
  modalTitle: { fontSize: 22, fontWeight: '700', marginBottom: 4, color: C.textPrimary },
  modalProgram: { fontSize: 16, color: C.textSecondary, marginBottom: 2 },
  modalTemplate: { fontSize: 18, fontWeight: '600', marginBottom: 16, color: C.textPrimary },
  modalDivider: { height: 1, backgroundColor: C.border, marginVertical: 12 },
  modalSectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8, color: C.textPrimary },
  modalExercise: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, paddingVertical: 4 },
  modalExerciseName: { fontSize: 15, color: C.textPrimary },
  modalExerciseDetail: { fontSize: 14, color: C.textSecondary },
  modalSummary: { fontSize: 15, fontWeight: '600', marginBottom: 16, color: C.textPrimary },
  modalButton: { marginTop: 8 },
});
