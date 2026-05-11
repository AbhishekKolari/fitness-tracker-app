import React, { useState, useCallback, useRef } from 'react';
import {
  ScrollView,
  View,
  StyleSheet,
  FlatList,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, ActivityIndicator, Portal, Modal, Button } from 'react-native-paper';
import { router, useFocusEffect } from 'expo-router';
import { colors as C } from '../../theme';
import { eq, desc, asc } from 'drizzle-orm';
import { db } from '../../db/client';
import {
  workoutSessions,
  workoutTemplates,
  programs,
  setLogs,
  templateExercises,
  exercises,
  bodyStats,
} from '../../db/schema';
import { useSettings } from '../../contexts/SettingsContext';
import Calendar from '../../components/Calendar';
import { setPendingIntent } from '../../utils/pendingWorkout';

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
  templateId: number;
  programId: number | null;
  isCustom: boolean;
}

interface DayBody {
  weightKg: number;
  heightCm: number | null;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}

export default function HistoryScreen() {
  const { settings } = useSettings();
  const { width } = useWindowDimensions();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [daySessions, setDaySessions] = useState<DayDetail[]>([]);
  const [dayBody, setDayBody] = useState<DayBody | null>(null);
  const [dayDate, setDayDate] = useState<string>('');
  const [dayIndex, setDayIndex] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const pagerRef = useRef<FlatList<DayDetail>>(null);

  // Inner modal page width (modal margin: 20 each side, no internal h-padding on FlatList)
  const pageWidth = width - 40;

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
        .leftJoin(workoutTemplates, eq(workoutSessions.templateId, workoutTemplates.id))
        .leftJoin(programs, eq(workoutSessions.programId, programs.id))
        .orderBy(desc(workoutSessions.date), desc(workoutSessions.id))
        .all();

      const allLogs = db
        .select({ sessionId: setLogs.sessionId, completed: setLogs.completed })
        .from(setLogs)
        .all();

      setSessions(
        rows.map((r) => ({
          id: r.id,
          date: r.date,
          templateLabel: r.templateLabel ?? 'Custom Workout',
          programName: r.programName ?? 'Custom',
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
      // ALL sessions for the day (oldest first), including custom (templateId may be -1)
      const sessionRows = db
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
        .leftJoin(workoutTemplates, eq(workoutSessions.templateId, workoutTemplates.id))
        .leftJoin(programs, eq(workoutSessions.programId, programs.id))
        .where(eq(workoutSessions.date, dateStr))
        .orderBy(asc(workoutSessions.id))
        .all();

      if (sessionRows.length === 0) {
        // No workout but maybe a body-stats entry exists for the day
        const body = db.select().from(bodyStats).where(eq(bodyStats.date, dateStr)).get();
        if (!body) return;
        setDaySessions([]);
        setDayBody({ weightKg: body.weightKg, heightCm: body.heightCm ?? null });
        setDayDate(dateStr);
        setDayIndex(0);
        setModalVisible(true);
        return;
      }

      const allLogs = db
        .select({ sessionId: setLogs.sessionId, completed: setLogs.completed })
        .from(setLogs)
        .all();

      const details: DayDetail[] = sessionRows.map((s) => {
        let exerciseData: Array<{ name: string; sets: number; reps: number }>;
        if (s.isCustom && Array.isArray(s.customExercises)) {
          exerciseData = (s.customExercises as any[]).map((ex) => {
            const ex0 = db.select({ name: exercises.name }).from(exercises).where(eq(exercises.id, ex.exerciseId)).get();
            return { name: ex0?.name || 'Unknown', sets: ex.sets, reps: ex.reps };
          });
        } else {
          exerciseData = db
            .select({ name: exercises.name, sets: templateExercises.sets, reps: templateExercises.reps })
            .from(templateExercises)
            .innerJoin(exercises, eq(templateExercises.exerciseId, exercises.id))
            .where(eq(templateExercises.templateId, s.templateId))
            .all();
        }
        return {
          sessionId: s.id,
          date: s.date,
          templateLabel: s.templateLabel ?? 'Custom Workout',
          programName: s.programName ?? 'Custom',
          exercises: exerciseData,
          setsCompleted: allLogs.filter((l) => l.sessionId === s.id && l.completed).length,
          templateId: s.templateId,
          programId: s.programId,
          isCustom: !!s.isCustom,
        };
      });

      const body = db.select().from(bodyStats).where(eq(bodyStats.date, dateStr)).get();
      setDayBody(body ? { weightKg: body.weightKg, heightCm: body.heightCm ?? null } : null);
      setDaySessions(details);
      setDayDate(dateStr);
      setDayIndex(0);
      setModalVisible(true);
    } catch (e) {
      console.error('Error loading day detail:', e);
    }
  }, []);

  const repeatWorkout = useCallback((d: DayDetail) => {
    setModalVisible(false);
    if (d.isCustom) {
      // Custom workouts are stored per-session (no shared template); clone the
      // original session's customExercises into a new in-progress session.
      setPendingIntent({ kind: 'customRepeat', sourceSessionId: d.sessionId });
    } else if (d.templateId > 0 && d.programId != null) {
      setPendingIntent({
        kind: 'template',
        templateId: d.templateId,
        programId: d.programId,
      });
    }
    router.navigate('/today');
  }, []);

  const onPagerScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
    if (idx !== dayIndex) setDayIndex(idx);
  };

  const formatBody = (b: DayBody) => {
    const w = settings.weightUnit === 'kg'
      ? `${b.weightKg.toFixed(1)} kg`
      : `${(b.weightKg * 2.20462).toFixed(1)} lbs`;
    const bmi = b.heightCm && b.heightCm > 0
      ? (b.weightKg / Math.pow(b.heightCm / 100, 2)).toFixed(1)
      : null;
    return bmi ? `${w}  ·  BMI ${bmi}` : w;
  };


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
      <Calendar
        onDateSelect={loadDayDetail}
        sessions={sessions.map((s) => ({ date: s.date }))}
      />
      <Text style={styles.subheading}>Recent Sessions</Text>
      {sessions.slice(0, 5).map((s) => (
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
        <Modal
          visible={modalVisible}
          onDismiss={() => setModalVisible(false)}
          contentContainerStyle={styles.modal}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{formatDate(dayDate)}</Text>
            {dayBody && <Text style={styles.modalBody}>{formatBody(dayBody)}</Text>}
            {daySessions.length > 1 && (
              <View style={styles.dotsRow}>
                {daySessions.map((_, i) => (
                  <View
                    key={i}
                    style={[styles.dot, i === dayIndex && styles.dotActive]}
                  />
                ))}
                <Text style={styles.pageCounter}>
                  {dayIndex + 1} of {daySessions.length}
                </Text>
              </View>
            )}
          </View>

          {daySessions.length === 0 ? (
            <View style={styles.bodyOnly}>
              <Text style={styles.modalSummary}>No workouts logged on this day.</Text>
              <Button mode="outlined" style={styles.modalButton} onPress={() => setModalVisible(false)}>
                Close
              </Button>
            </View>
          ) : (
            <FlatList
              ref={pagerRef}
              data={daySessions}
              keyExtractor={(d) => String(d.sessionId)}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={onPagerScrollEnd}
              getItemLayout={(_, i) => ({ length: pageWidth, offset: pageWidth * i, index: i })}
              renderItem={({ item, index }) => (
                <ScrollView style={{ width: pageWidth }} contentContainerStyle={styles.pageContent}>
                  <Text style={styles.modalProgram}>
                    {item.programName}
                    {daySessions.length > 1 ? `  ·  Session ${index + 1}` : ''}
                  </Text>
                  <Text style={styles.modalTemplate}>{item.templateLabel}</Text>
                  <View style={styles.modalDivider} />
                  <Text style={styles.modalSectionTitle}>Exercises</Text>
                  {item.exercises.map((ex, idx) => (
                    <View key={idx} style={styles.modalExercise}>
                      <Text style={styles.modalExerciseName}>{ex.name}</Text>
                      <Text style={styles.modalExerciseDetail}>{ex.sets} × {ex.reps}</Text>
                    </View>
                  ))}
                  <View style={styles.modalDivider} />
                  <Text style={styles.modalSummary}>
                    Total sets completed: {item.setsCompleted}
                  </Text>
                  <Button mode="contained" style={styles.modalButton} onPress={() => repeatWorkout(item)}>
                    Repeat Workout
                  </Button>
                  <Button mode="outlined" style={styles.modalButton} onPress={() => setModalVisible(false)}>
                    Close
                  </Button>
                </ScrollView>
              )}
            />
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
  modal: { backgroundColor: C.surface, marginHorizontal: 20, marginVertical: 60, borderRadius: 20, paddingVertical: 20, overflow: 'hidden' },
  modalHeader: { paddingHorizontal: 24, paddingBottom: 12 },
  modalTitle: { fontSize: 22, fontWeight: '700', marginBottom: 4, color: C.textPrimary },
  modalBody: { fontSize: 13, color: C.move, fontWeight: '700', marginBottom: 4 },
  modalProgram: { fontSize: 16, color: C.textSecondary, marginBottom: 2 },
  modalTemplate: { fontSize: 18, fontWeight: '600', marginBottom: 16, color: C.textPrimary },
  modalDivider: { height: 1, backgroundColor: C.border, marginVertical: 12 },
  modalSectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8, color: C.textPrimary },
  modalExercise: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, paddingVertical: 4 },
  modalExerciseName: { fontSize: 15, color: C.textPrimary },
  modalExerciseDetail: { fontSize: 14, color: C.textSecondary },
  modalSummary: { fontSize: 15, fontWeight: '600', marginBottom: 16, color: C.textPrimary },
  modalButton: { marginTop: 8 },
  pageContent: { paddingHorizontal: 24, paddingBottom: 8 },
  bodyOnly: { paddingHorizontal: 24, paddingBottom: 12 },
  dotsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.border },
  dotActive: { backgroundColor: C.move, width: 18 },
  pageCounter: { marginLeft: 8, fontSize: 12, color: C.textSecondary, fontWeight: '600' },
});
