import React, { useState, useCallback, useRef } from 'react';
import { View, ScrollView, StyleSheet, Animated, FlatList } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import {
  Card,
  TextInput,
  Button,
  Text,
  Portal,
  Modal,
  ActivityIndicator,
  FAB,
  Searchbar,
} from 'react-native-paper';
import Svg, { Circle } from 'react-native-svg';
import { eq, asc, like } from 'drizzle-orm';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors as C } from '../../theme';
import { db } from '../../db/client';
import {
  workoutSessions,
  workoutTemplates,
  setLogs,
  templateExercises,
  exercises as exercisesTable,
} from '../../db/schema';
import { getNextWorkout, logSet, completeSession as completeSessionQuery, getAvailableTemplates } from '../../db/queries';
import { useSettings } from '../../contexts/SettingsContext';

const CIRCLE_SIZE = 150;
const CIRCLE_RADIUS = 70;
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;

interface SetState {
  setNumber: number;
  weightKg: number;
  reps: number;
  completed: boolean;
}

interface ExerciseState {
  exerciseId: number;
  name: string;
  targetSets: number;
  targetReps: number;
  sets: SetState[];
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function TodayScreen() {
  const { settings, loaded } = useSettings();
  const [loading, setLoading] = useState(true);
  const [workoutLabel, setWorkoutLabel] = useState('');
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [exercises, setExercises] = useState<ExerciseState[]>([]);
  const [noProgram, setNoProgram] = useState(false);
  const [restTimer, setRestTimer] = useState({ visible: false, seconds: 90, totalSeconds: 90 });
  const [showWorkoutSelector, setShowWorkoutSelector] = useState(false);
  const [availableTemplates, setAvailableTemplates] = useState<any[]>([]);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [exerciseSearchQuery, setExerciseSearchQuery] = useState('');
  const [availableExercises, setAvailableExercises] = useState<any[]>([]);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadWorkout = useCallback((selectedTemplateId?: number) => {
    if (!loaded) return;
    setLoading(true);
    setNoProgram(false);
    setShowWorkoutSelector(false);

    try {
      const today = new Date().toISOString().split('T')[0];

      const todaySession = db
        .select({ id: workoutSessions.id, templateId: workoutSessions.templateId })
        .from(workoutSessions)
        .where(eq(workoutSessions.date, today))
        .get();

      let currentSessionId: number;
      let currentTemplateId: number;

      if (todaySession) {
        currentSessionId = todaySession.id;
        currentTemplateId = todaySession.templateId;
      } else {
        // Check if program has multiple templates and show selector if so
        if (settings.activeProgramId) {
          const templates = getAvailableTemplates(settings.activeProgramId);
          if (templates.length > 1 && !selectedTemplateId) {
            setAvailableTemplates(templates);
            setShowWorkoutSelector(true);
            setLoading(false);
            return;
          }
        }

        const next = getNextWorkout(settings.activeProgramId, selectedTemplateId);
        if (!next) {
          setNoProgram(true);
          setLoading(false);
          return;
        }

        db.insert(workoutSessions)
          .values({
            programId: next.template.programId,
            templateId: next.template.id,
            date: today,
          })
          .run();

        const created = db
          .select({ id: workoutSessions.id, templateId: workoutSessions.templateId })
          .from(workoutSessions)
          .where(eq(workoutSessions.date, today))
          .get()!;

        currentSessionId = created.id;
        currentTemplateId = created.templateId;
      }

      const template = db
        .select({ label: workoutTemplates.label })
        .from(workoutTemplates)
        .where(eq(workoutTemplates.id, currentTemplateId))
        .get();
      setWorkoutLabel(template?.label ?? "Today's Workout");

      const templateExList = db
        .select({ te: templateExercises, ex: exercisesTable })
        .from(templateExercises)
        .innerJoin(exercisesTable, eq(templateExercises.exerciseId, exercisesTable.id))
        .where(eq(templateExercises.templateId, currentTemplateId))
        .orderBy(asc(templateExercises.order))
        .all();

      const existingLogs = db
        .select()
        .from(setLogs)
        .where(eq(setLogs.sessionId, currentSessionId))
        .all();

      const exerciseStates: ExerciseState[] = templateExList.map(({ te, ex }) => {
        const logs = existingLogs
          .filter((l) => l.exerciseId === te.exerciseId)
          .sort((a, b) => a.setNumber - b.setNumber);

        const sets: SetState[] = Array.from({ length: te.sets }, (_, i) => {
          const log = logs[i];
          return {
            setNumber: i + 1,
            weightKg: log?.weightKg ?? 60,
            reps: log?.reps ?? te.reps,
            completed: log?.completed ?? false,
          };
        });

        return { exerciseId: ex.id, name: ex.name, targetSets: te.sets, targetReps: te.reps, sets };
      });

      setSessionId(currentSessionId);
      setExercises(exerciseStates);
    } catch (error) {
      console.error('Error loading workout:', error);
    } finally {
      setLoading(false);
    }
  }, [loaded, settings.activeProgramId]);

  useFocusEffect(
    useCallback(() => {
      loadWorkout();
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }, [loadWorkout]),
  );

  // Rest timer countdown
  const timerRunning = useRef(false);
  const startTimer = useCallback(() => {
    if (timerRunning.current) return;
    timerRunning.current = true;
    timerRef.current = setInterval(() => {
      setRestTimer((prev) => {
        if (prev.seconds <= 1) {
          clearInterval(timerRef.current!);
          timerRunning.current = false;
          return { ...prev, visible: false, seconds: prev.totalSeconds };
        }
        return { ...prev, seconds: prev.seconds - 1 };
      });
    }, 1000);
  }, []);

  const showRestTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRunning.current = false;
    setRestTimer({ visible: true, seconds: 90, totalSeconds: 90 });
    setTimeout(startTimer, 0);
  }, [startTimer]);

  const dismissTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRunning.current = false;
    setRestTimer((p) => ({ ...p, visible: false, seconds: p.totalSeconds }));
  }, []);

  const loadAvailableExercises = useCallback(() => {
    const allExercises = db.select().from(exercisesTable).orderBy(asc(exercisesTable.name)).all();
    setAvailableExercises(allExercises);
  }, []);

  const openExercisePicker = useCallback(() => {
    loadAvailableExercises();
    setShowExercisePicker(true);
  }, [loadAvailableExercises]);

  const addCustomExercise = useCallback((exerciseId: number, exerciseName: string) => {
    const newExercise: ExerciseState = {
      exerciseId,
      name: exerciseName,
      targetSets: 3,
      targetReps: 10,
      sets: Array.from({ length: 3 }, (_, i) => ({
        setNumber: i + 1,
        weightKg: 20,
        reps: 10,
        completed: false,
      })),
    };
    setExercises((prev) => [...prev, newExercise]);
    setShowExercisePicker(false);
    setExerciseSearchQuery('');
  }, []);

  const updateSet = (exIndex: number, setIndex: number, field: 'weightKg' | 'reps', value: number) => {
    setExercises((prev) =>
      prev.map((ex, i) =>
        i !== exIndex
          ? ex
          : { ...ex, sets: ex.sets.map((s, j) => (j === setIndex ? { ...s, [field]: value } : s)) },
      ),
    );
  };

  const completeSet = (exIndex: number, setIndex: number) => {
    const ex = exercises[exIndex];
    const set = ex.sets[setIndex];

    if (sessionId) {
      logSet({ sessionId, exerciseId: ex.exerciseId, setNumber: set.setNumber, weightKg: set.weightKg, reps: set.reps });
    }

    setExercises((prev) =>
      prev.map((e, i) =>
        i !== exIndex
          ? e
          : { ...e, sets: e.sets.map((s, j) => (j === setIndex ? { ...s, completed: true } : s)) },
      ),
    );

    showRestTimer();
  };

  const handleCompleteSession = () => {
    if (sessionId) {
      completeSessionQuery(sessionId, 0);
      router.push(`/summary?sessionId=${sessionId}`);
    } else {
      router.push('/');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = (restTimer.totalSeconds - restTimer.seconds) / restTimer.totalSeconds;
  const strokeDashoffset = progress * -CIRCLE_CIRCUMFERENCE;

  if (!loaded || loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (noProgram) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.workoutTitle}>No Program Active</Text>
        <Text style={styles.subText}>Select a training program to get started.</Text>
        <Button mode="contained" style={{ marginTop: 24 }} onPress={() => router.navigate('/programs')}>
          Go to Programs
        </Button>
      </View>
    );
  }

  if (showWorkoutSelector) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.workoutTitle}>Choose Your Workout</Text>
        <Text style={styles.subText}>Select which workout you want to do today.</Text>
        <View style={styles.workoutSelectorContainer}>
          {availableTemplates.map((template) => (
            <Card key={template.id} style={styles.workoutSelectorCard}>
              <Card.Content>
                <Text style={styles.workoutSelectorLabel}>{template.label}</Text>
              </Card.Content>
              <Card.Actions>
                <Button mode="contained" onPress={() => loadWorkout(template.id)}>
                  Start
                </Button>
              </Card.Actions>
            </Card>
          ))}
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        <Text style={styles.sectionEyebrow}>Today's Workout</Text>
        <Text style={styles.workoutTitle}>{workoutLabel}</Text>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {exercises.map((ex, exIndex) => (
            <Card key={ex.exerciseId} style={styles.card}>
              <Card.Title
                title={ex.name}
                subtitle={`${ex.targetSets} × ${ex.targetReps}`}
                right={() => (
                  <Button compact onPress={() => router.push(`/exercise/${ex.exerciseId}`)}>
                    Info
                  </Button>
                )}
              />
              <Card.Content>
                {ex.sets.map((set, setIndex) => (
                  <View key={setIndex} style={styles.setRow}>
                    <Text style={styles.setNumber}>Set {set.setNumber}</Text>
                    <TextInput
                      style={styles.input}
                      label="kg"
                      value={set.weightKg.toString()}
                      onChangeText={(t) => updateSet(exIndex, setIndex, 'weightKg', parseFloat(t) || 0)}
                      keyboardType="numeric"
                      mode="outlined"
                      dense
                      disabled={set.completed}
                    />
                    <TextInput
                      style={styles.input}
                      label="Reps"
                      value={set.reps.toString()}
                      onChangeText={(t) => updateSet(exIndex, setIndex, 'reps', parseInt(t) || 0)}
                      keyboardType="numeric"
                      mode="outlined"
                      dense
                      disabled={set.completed}
                    />
                    {!set.completed ? (
                      <Button mode="contained" onPress={() => completeSet(exIndex, setIndex)} style={styles.completeButton}>
                        ✓
                      </Button>
                    ) : (
                      <Button mode="outlined" disabled style={styles.completeButton}>
                        ✓
                      </Button>
                    )}
                  </View>
                ))}
              </Card.Content>
            </Card>
          ))}
          <Button mode="contained" onPress={handleCompleteSession} style={styles.finishButton}>
            Finish Workout
          </Button>
        </ScrollView>

        <FAB
          icon="plus"
          style={styles.fab}
          onPress={openExercisePicker}
        />

        <Portal>
          <Modal visible={showExercisePicker} onDismiss={() => setShowExercisePicker(false)} contentContainerStyle={styles.exercisePickerModal}>
            <Text style={styles.modalTitle}>Add Exercise</Text>
            <Searchbar
              placeholder="Search exercises..."
              onChangeText={setExerciseSearchQuery}
              value={exerciseSearchQuery}
              style={styles.searchBar}
            />
            <FlatList
              data={availableExercises.filter((ex) =>
                ex.name.toLowerCase().includes(exerciseSearchQuery.toLowerCase())
              )}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <Card style={styles.exerciseCard} onPress={() => addCustomExercise(item.id, item.name)}>
                  <Card.Content>
                    <Text style={styles.exerciseCardTitle}>{item.name}</Text>
                    <Text style={styles.exerciseCardSubtitle}>{item.category}</Text>
                  </Card.Content>
                </Card>
              )}
              style={styles.exerciseList}
            />
            <Button mode="outlined" onPress={() => setShowExercisePicker(false)} style={styles.closeButton}>
              Cancel
            </Button>
          </Modal>

          <Modal visible={restTimer.visible} onDismiss={dismissTimer} contentContainerStyle={styles.modal}>
            <Text style={styles.timerText}>Rest Timer</Text>
            <View style={styles.circleContainer}>
              <Svg width={CIRCLE_SIZE} height={CIRCLE_SIZE}>
                <Circle cx={CIRCLE_SIZE / 2} cy={CIRCLE_SIZE / 2} r={CIRCLE_RADIUS} stroke="#e0e0e0" strokeWidth={8} fill="transparent" />
                <Circle
                  cx={CIRCLE_SIZE / 2}
                  cy={CIRCLE_SIZE / 2}
                  r={CIRCLE_RADIUS}
                  stroke="#6200ee"
                  strokeWidth={8}
                  fill="transparent"
                  strokeDasharray={CIRCLE_CIRCUMFERENCE}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  rotation="-90"
                  origin={`${CIRCLE_SIZE / 2}, ${CIRCLE_SIZE / 2}`}
                />
              </Svg>
              <View style={styles.timerOverlay}>
                <Text style={styles.timerValue}>{formatTime(restTimer.seconds)}</Text>
              </View>
            </View>
            <Button onPress={dismissTimer}>Skip</Button>
          </Modal>
        </Portal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  container: { flex: 1, backgroundColor: C.bg, paddingTop: 8 },
  centerContainer: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 24 },
  sectionEyebrow: { fontSize: 12, color: C.move, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', paddingHorizontal: 16, marginTop: 4 },
  workoutTitle: { fontSize: 34, fontWeight: '800', color: C.textPrimary, letterSpacing: -0.5, paddingHorizontal: 16, marginTop: 2, marginBottom: 12 },
  subText: { fontSize: 15, color: C.textSecondary, textAlign: 'center', marginTop: 8 },
  workoutSelectorContainer: { width: '100%', marginTop: 24, gap: 12 },
  workoutSelectorCard: { marginBottom: 8, backgroundColor: C.surface, borderRadius: 16 },
  workoutSelectorLabel: { fontSize: 18, fontWeight: '600', color: C.textPrimary },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 140 },
  card: { marginBottom: 14, borderRadius: 16, backgroundColor: C.surface },
  setRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  setNumber: { width: 50, fontSize: 13, fontWeight: '600', color: C.textSecondary },
  input: { flex: 1, height: 44, backgroundColor: C.surfaceElevated },
  completeButton: { minWidth: 50 },
  finishButton: { marginTop: 16, marginBottom: 16, borderRadius: 14, paddingVertical: 4 },
  fab: { position: 'absolute', right: 16, bottom: 24, backgroundColor: C.move },
  exercisePickerModal: { backgroundColor: C.surface, padding: 20, margin: 20, borderRadius: 20, maxHeight: '80%' },
  modalTitle: { fontSize: 22, fontWeight: '700', marginBottom: 16, color: C.textPrimary },
  searchBar: { marginBottom: 12, borderRadius: 12, backgroundColor: C.surfaceElevated },
  exerciseList: { maxHeight: 300, marginBottom: 12 },
  exerciseCard: { marginBottom: 8, borderRadius: 12, backgroundColor: C.surfaceElevated },
  exerciseCardTitle: { fontSize: 16, fontWeight: '600', color: C.textPrimary },
  exerciseCardSubtitle: { fontSize: 13, color: C.textSecondary },
  closeButton: { marginTop: 8, borderRadius: 8 },
  modal: { backgroundColor: C.surface, padding: 24, margin: 20, borderRadius: 20, alignItems: 'center' },
  timerText: { fontSize: 22, fontWeight: '700', marginBottom: 16, color: C.textPrimary },
  circleContainer: { position: 'relative', marginBottom: 16 },
  timerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  timerValue: { fontSize: 40, fontWeight: '800', color: C.textPrimary, letterSpacing: -1 },
});
