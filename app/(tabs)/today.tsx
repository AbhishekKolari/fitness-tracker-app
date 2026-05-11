import React, { useState, useCallback, useRef } from 'react';
import { View, ScrollView, StyleSheet, Animated, FlatList, Alert } from 'react-native';
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
import { eq, asc, like, isNull, and, desc, inArray } from 'drizzle-orm';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors as C } from '../../theme';
import { localDateStr } from '../../utils/date';
import { db } from '../../db/client';
import {
  workoutSessions,
  workoutTemplates,
  setLogs,
  templateExercises,
  exercises as exercisesTable,
} from '../../db/schema';
import { logSet, completeSession as completeSessionQuery, getAvailableTemplates } from '../../db/queries';
import { useSettings } from '../../contexts/SettingsContext';
import { consumePendingIntent } from '../../utils/pendingWorkout';

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
  const { settings, loaded, setActiveProgramId } = useSettings();
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
  // In-memory store of custom exercises added per session — survives navigation refocus
  const extraExercisesBySession = useRef<Record<number, ExerciseState[]>>({});

  /**
   * Build ExerciseState[] for a given session. Handles both template-based
   * and custom (isCustom) sessions.
   */
  const buildExercisesForSession = useCallback((
    sessionRow: { id: number; templateId: number; isCustom: boolean; customExercises: any },
  ): { label: string; exerciseStates: ExerciseState[] } => {
    const existingLogs = db
      .select()
      .from(setLogs)
      .where(eq(setLogs.sessionId, sessionRow.id))
      .all();

    let label = "Today's Workout";
    let exerciseStates: ExerciseState[] = [];

    if (sessionRow.isCustom && Array.isArray(sessionRow.customExercises)) {
      label = 'Custom Workout';
      const ids = sessionRow.customExercises.map((e: any) => e.exerciseId);
      const exRows = ids.length
        ? db.select().from(exercisesTable).where(inArray(exercisesTable.id, ids)).all()
        : [];
      const nameById = new Map(exRows.map((r) => [r.id, r.name]));
      const sorted = [...sessionRow.customExercises].sort((a: any, b: any) => a.order - b.order);
      exerciseStates = sorted.map((ce: any) => {
        const logs = existingLogs
          .filter((l) => l.exerciseId === ce.exerciseId)
          .sort((a, b) => a.setNumber - b.setNumber);
        const sets: SetState[] = Array.from({ length: ce.sets }, (_, i) => {
          const log = logs[i];
          return {
            setNumber: i + 1,
            weightKg: log?.weightKg ?? 60,
            reps: log?.reps ?? ce.reps,
            completed: log?.completed ?? false,
          };
        });
        return {
          exerciseId: ce.exerciseId,
          name: nameById.get(ce.exerciseId) ?? 'Exercise',
          targetSets: ce.sets,
          targetReps: ce.reps,
          sets,
        };
      });
    } else {
      const template = db
        .select({ label: workoutTemplates.label })
        .from(workoutTemplates)
        .where(eq(workoutTemplates.id, sessionRow.templateId))
        .get();
      label = template?.label ?? "Today's Workout";

      const templateExList = db
        .select({ te: templateExercises, ex: exercisesTable })
        .from(templateExercises)
        .innerJoin(exercisesTable, eq(templateExercises.exerciseId, exercisesTable.id))
        .where(eq(templateExercises.templateId, sessionRow.templateId))
        .orderBy(asc(templateExercises.order))
        .all();

      exerciseStates = templateExList.map(({ te, ex }) => {
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
    }

    return { label, exerciseStates };
  }, []);

  /**
   * Load the "active" in-progress session for today (durationSeconds IS NULL,
   * highest id). If no active session exists, either:
   *   - if selectedTemplateId is provided: create a new session with that template
   *   - else if program has multiple templates: show selector
   *   - else: auto-create from getNextWorkout
   */
  const loadWorkout = useCallback((selectedTemplateId?: number, explicitSessionId?: number) => {
    if (!loaded) return;
    setLoading(true);
    setNoProgram(false);
    setShowWorkoutSelector(false);

    try {
      const today = localDateStr();

      // Explicit session id takes priority (e.g. from Programs → startCustomWorkout)
      let sessionRow = explicitSessionId
        ? db
            .select({
              id: workoutSessions.id,
              templateId: workoutSessions.templateId,
              isCustom: workoutSessions.isCustom,
              customExercises: workoutSessions.customExercises,
            })
            .from(workoutSessions)
            .where(eq(workoutSessions.id, explicitSessionId))
            .get()
        : db
            .select({
              id: workoutSessions.id,
              templateId: workoutSessions.templateId,
              isCustom: workoutSessions.isCustom,
              customExercises: workoutSessions.customExercises,
            })
            .from(workoutSessions)
            .where(and(eq(workoutSessions.date, today), isNull(workoutSessions.durationSeconds)))
            .orderBy(desc(workoutSessions.id))
            .limit(1)
            .get();

      if (!sessionRow) {
        // No in-progress session for today — decide how to start one.
        if (selectedTemplateId) {
          // Direct template lookup — bypass getNextWorkout's program-match guard
          // so cross-program repeats from History work (we already know exactly
          // which template the user picked, and its program is auto-switched
          // in the focus-effect below).
          const tpl = db
            .select()
            .from(workoutTemplates)
            .where(eq(workoutTemplates.id, selectedTemplateId))
            .get();
          if (!tpl) {
            setNoProgram(true);
            setLoading(false);
            return;
          }
          db.insert(workoutSessions)
            .values({ programId: tpl.programId, templateId: tpl.id, date: today })
            .run();
          const created = db
            .select({
              id: workoutSessions.id,
              templateId: workoutSessions.templateId,
              isCustom: workoutSessions.isCustom,
              customExercises: workoutSessions.customExercises,
            })
            .from(workoutSessions)
            .where(and(eq(workoutSessions.date, today), isNull(workoutSessions.durationSeconds)))
            .orderBy(desc(workoutSessions.id))
            .limit(1)
            .get()!;
          sessionRow = created;
        } else {
          // Show selector if active program exists, else no-program state
          if (settings.activeProgramId) {
            const templates = getAvailableTemplates(settings.activeProgramId);
            if (templates.length > 0) {
              setAvailableTemplates(templates);
              setShowWorkoutSelector(true);
              setLoading(false);
              return;
            }
          }
          setNoProgram(true);
          setLoading(false);
          return;
        }
      }

      if (!sessionRow) {
        setNoProgram(true);
        setLoading(false);
        return;
      }

      const { label, exerciseStates } = buildExercisesForSession(sessionRow);
      setWorkoutLabel(label);
      setSessionId(sessionRow.id);
      const extras = extraExercisesBySession.current[sessionRow.id] ?? [];
      setExercises([...exerciseStates, ...extras]);
    } catch (error) {
      console.error('Error loading workout:', error);
    } finally {
      setLoading(false);
    }
  }, [loaded, settings.activeProgramId, buildExercisesForSession]);

  const clearTodaysWorkout = useCallback(() => {
    Alert.alert(
      'Clear this workout?',
      'Only this in-progress workout will be cleared. Completed workouts today will remain in History.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            try {
              const today = localDateStr();
              // Only delete the latest in-progress session (active card)
              const active = db
                .select({ id: workoutSessions.id })
                .from(workoutSessions)
                .where(and(eq(workoutSessions.date, today), isNull(workoutSessions.durationSeconds)))
                .orderBy(desc(workoutSessions.id))
                .limit(1)
                .get();
              if (active) {
                db.delete(setLogs).where(eq(setLogs.sessionId, active.id)).run();
                db.delete(workoutSessions).where(eq(workoutSessions.id, active.id)).run();
                delete extraExercisesBySession.current[active.id];
              }
              setSessionId(null);
              setExercises([]);
              loadWorkout();
            } catch (e) {
              console.error('Error clearing workout:', e);
              Alert.alert('Error', 'Failed to clear workout');
            }
          },
        },
      ],
    );
  }, [loadWorkout]);

  useFocusEffect(
    useCallback(() => {
      const intent = consumePendingIntent();

      if (intent?.kind === 'session') {
        // Direct session handoff (e.g. from Programs → startCustomWorkout)
        loadWorkout(undefined, intent.sessionId);
      } else if (intent?.kind === 'customRepeat') {
        const today = localDateStr();
        // Fetch the source custom session to clone its exercise list + program.
        const source = db
          .select({
            programId: workoutSessions.programId,
            customExercises: workoutSessions.customExercises,
          })
          .from(workoutSessions)
          .where(eq(workoutSessions.id, intent.sourceSessionId))
          .get();

        if (!source || !source.customExercises) {
          // Source missing — fall back to default load.
          loadWorkout();
          return () => {
            if (timerRef.current) clearInterval(timerRef.current);
          };
        }

        const active = db
          .select({ id: workoutSessions.id })
          .from(workoutSessions)
          .where(and(eq(workoutSessions.date, today), isNull(workoutSessions.durationSeconds)))
          .orderBy(desc(workoutSessions.id))
          .limit(1)
          .get();

        const applyCustom = () => {
          if (active) {
            db.delete(setLogs).where(eq(setLogs.sessionId, active.id)).run();
            db.delete(workoutSessions).where(eq(workoutSessions.id, active.id)).run();
            delete extraExercisesBySession.current[active.id];
          }
          // Auto-switch active program to match the repeated workout's program.
          if (settings.activeProgramId !== source.programId) {
            setActiveProgramId(source.programId);
          }
          db.insert(workoutSessions)
            .values({
              programId: source.programId,
              templateId: -1,
              date: today,
              isCustom: true,
              customExercises: source.customExercises,
            })
            .run();
          const created = db
            .select({ id: workoutSessions.id })
            .from(workoutSessions)
            .where(and(eq(workoutSessions.date, today), isNull(workoutSessions.durationSeconds)))
            .orderBy(desc(workoutSessions.id))
            .limit(1)
            .get();
          if (created) {
            loadWorkout(undefined, created.id);
          } else {
            loadWorkout();
          }
        };

        if (active) {
          Alert.alert(
            'Discard in-progress workout?',
            'You have a workout in progress. Discard it and start the selected one?',
            [
              { text: 'Cancel', style: 'cancel', onPress: () => loadWorkout() },
              { text: 'Discard', style: 'destructive', onPress: applyCustom },
            ],
          );
        } else {
          applyCustom();
        }
      } else if (intent?.kind === 'template') {
        const pendingTpl = intent.templateId;
        // Auto-switch active program if the repeated workout belongs to a
        // different program. This is fire-and-forget; loadWorkout below uses
        // the template's own programId for the new session, so it doesn't
        // depend on the settings state being flushed yet.
        if (settings.activeProgramId !== intent.programId) {
          setActiveProgramId(intent.programId);
        }
        const today = localDateStr();
        // Only consider existing IN-PROGRESS sessions for the replace prompt;
        // completed sessions for today are preserved untouched.
        const active = db
          .select({ id: workoutSessions.id, templateId: workoutSessions.templateId })
          .from(workoutSessions)
          .where(and(eq(workoutSessions.date, today), isNull(workoutSessions.durationSeconds)))
          .orderBy(desc(workoutSessions.id))
          .limit(1)
          .get();

        const apply = () => {
          if (active) {
            db.delete(setLogs).where(eq(setLogs.sessionId, active.id)).run();
            db.delete(workoutSessions).where(eq(workoutSessions.id, active.id)).run();
            delete extraExercisesBySession.current[active.id];
          }
          loadWorkout(pendingTpl);
        };

        if (active && active.templateId !== pendingTpl) {
          Alert.alert(
            'Discard in-progress workout?',
            'You have a workout in progress. Discard it and start the selected one?',
            [
              { text: 'Cancel', style: 'cancel', onPress: () => loadWorkout() },
              { text: 'Discard', style: 'destructive', onPress: apply },
            ],
          );
        } else {
          apply();
        }
      } else {
        loadWorkout();
      }
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
    if (sessionId !== null) {
      const list = extraExercisesBySession.current[sessionId] ?? [];
      extraExercisesBySession.current[sessionId] = [...list, newExercise];
    }
    setShowExercisePicker(false);
    setExerciseSearchQuery('');
  }, [sessionId]);

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
      router.push('/today');
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
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (noProgram) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centerContainer}>
          <Text style={styles.workoutTitle}>No Program Active</Text>
          <Text style={styles.subText}>Select a training program to get started.</Text>
          <Button mode="contained" style={{ marginTop: 24 }} onPress={() => router.navigate('/programs')}>
            Go to Programs
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  if (showWorkoutSelector) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={[styles.centerContainer, { paddingTop: 24, justifyContent: 'flex-start' }]}>
          <Text style={styles.sectionEyebrow}>Today</Text>
          <Text
            style={[styles.workoutTitle, styles.workoutTitleSelector]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            Choose Your Workout
          </Text>
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
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        <Text style={styles.sectionEyebrow}>Today's Workout</Text>
        <View style={styles.titleRow}>
          <Text style={styles.workoutTitle}>{workoutLabel}</Text>
          {sessionId !== null && (
            <Button compact onPress={clearTodaysWorkout} textColor={C.textSecondary} icon="close-circle-outline">
              Clear
            </Button>
          )}
        </View>
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
          color={C.move}
          style={styles.fab}
          onPress={openExercisePicker}
          label="Add Exercise"
        />

        <Portal>
          <Modal visible={showExercisePicker} onDismiss={() => setShowExercisePicker(false)} contentContainerStyle={styles.exercisePickerModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Exercise</Text>
              <Button compact icon="close" onPress={() => setShowExercisePicker(false)} textColor={C.textSecondary}>
                {''}
              </Button>
            </View>
            <Searchbar
              placeholder="Search exercises..."
              onChangeText={setExerciseSearchQuery}
              value={exerciseSearchQuery}
              style={styles.searchBar}
            />
            <View style={styles.modalBody}>
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
              />
            </View>
            <View style={styles.modalFooter}>
              <Button mode="outlined" onPress={() => setShowExercisePicker(false)} style={styles.closeButton}>
                Cancel
              </Button>
            </View>
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
  container: { flex: 1, backgroundColor: C.bg, paddingTop: 16 },
  centerContainer: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 24 },
  sectionEyebrow: { fontSize: 12, color: C.move, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', paddingHorizontal: 16, marginTop: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 8 },
  workoutTitle: { fontSize: 34, fontWeight: '800', color: C.textPrimary, letterSpacing: -0.5, paddingHorizontal: 16, marginTop: 2, marginBottom: 12, flex: 1 },
  workoutTitleSelector: { fontSize: 30, letterSpacing: -0.8, textAlign: 'center', flex: 0, paddingHorizontal: 0, alignSelf: 'stretch' },
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
  fab: { position: 'absolute', right: 16, bottom: 24, backgroundColor: C.surfaceElevated },
  exercisePickerModal: {
    backgroundColor: '#3A3A3C',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    marginHorizontal: 16,
    marginVertical: 40,
    borderRadius: 24,
    height: '88%',
    alignSelf: 'center',
    width: '92%',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  modalBody: { flex: 1, marginTop: 4 },
  modalFooter: { paddingTop: 8 },
  modalTitle: { fontSize: 22, fontWeight: '700', color: C.textPrimary, letterSpacing: -0.3 },
  searchBar: { marginBottom: 12, borderRadius: 12, backgroundColor: C.surfaceElevated },
  exerciseList: { flex: 1 },
  exerciseCard: { marginBottom: 8, borderRadius: 12, backgroundColor: C.surfaceElevated },
  exerciseCardTitle: { fontSize: 16, fontWeight: '600', color: C.textPrimary },
  exerciseCardSubtitle: { fontSize: 13, color: C.textSecondary, textTransform: 'capitalize' },
  closeButton: { borderRadius: 12 },
  modal: { backgroundColor: C.surface, padding: 24, margin: 20, borderRadius: 20, alignItems: 'center' },
  timerText: { fontSize: 22, fontWeight: '700', marginBottom: 16, color: C.textPrimary },
  circleContainer: { position: 'relative', marginBottom: 16 },
  timerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  timerValue: { fontSize: 40, fontWeight: '800', color: C.textPrimary, letterSpacing: -1 },
});
