import React, { useState, useCallback } from 'react';
import { ScrollView, View, StyleSheet, FlatList, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Button, Text, ActivityIndicator, FAB, Portal, Modal, TextInput, Searchbar } from 'react-native-paper';
import { colors as C } from '../../theme';
import { localDateStr } from '../../utils/date';
import { router, useFocusEffect } from 'expo-router';
import { eq, asc, and, isNull, desc } from 'drizzle-orm';
import { db } from '../../db/client';
import { programs, workoutTemplates, templateExercises, exercises, workoutSessions } from '../../db/schema';
import { useSettings } from '../../contexts/SettingsContext';
import { setPendingIntent } from '../../utils/pendingWorkout';

interface TemplateInfo {
  id: number;
  label: string;
  exerciseNames: string[];
}

interface ProgramInfo {
  id: number;
  name: string;
  description: string | null;
  type: 'beginner' | 'intermediate' | 'advanced';
  templates: TemplateInfo[];
}

interface CustomExercise {
  id: number;
  name: string;
  sets: number;
  reps: number;
}

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  beginner:     { bg: 'rgba(146, 232, 42, 0.15)', text: '#92E82A' },
  intermediate: { bg: 'rgba(255, 214, 10, 0.15)', text: '#FFD60A' },
  advanced:     { bg: 'rgba(250, 17, 79, 0.15)',  text: '#FA114F' },
};

export default function ProgramsScreen() {
  const { settings, loaded, setActiveProgramId } = useSettings();
  const [programList, setProgramList] = useState<ProgramInfo[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [activeSessionExists, setActiveSessionExists] = useState(false);
  const [showCustomBuilder, setShowCustomBuilder] = useState(false);
  const [customExercises, setCustomExercises] = useState<CustomExercise[]>([]);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [exerciseSearchQuery, setExerciseSearchQuery] = useState('');
  const [availableExercises, setAvailableExercises] = useState<any[]>([]);

  const loadPrograms = useCallback(() => {
    try {
      const allPrograms = db.select().from(programs).orderBy(asc(programs.id)).all();
      const allTemplates = db.select().from(workoutTemplates).orderBy(asc(workoutTemplates.dayOrder)).all();
      const allTe = db
        .select({ templateId: templateExercises.templateId, name: exercises.name })
        .from(templateExercises)
        .innerJoin(exercises, eq(templateExercises.exerciseId, exercises.id))
        .orderBy(asc(templateExercises.order))
        .all();

      const built: ProgramInfo[] = allPrograms.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description ?? null,
        type: p.type as ProgramInfo['type'],
        templates: allTemplates
          .filter((t) => t.programId === p.id)
          .map((t) => ({
            id: t.id,
            label: t.label,
            exerciseNames: allTe.filter((te) => te.templateId === t.id).map((te) => te.name),
          })),
      }));

      setProgramList(built);

      // Check if there's a session for today for the active program
      if (settings.activeProgramId) {
        const today = localDateStr();
        const todaySession = db
          .select({ id: workoutSessions.id })
          .from(workoutSessions)
          .where(and(eq(workoutSessions.programId, settings.activeProgramId), eq(workoutSessions.date, today)))
          .get();
        setActiveSessionExists(!!todaySession);
      } else {
        setActiveSessionExists(false);
      }
    } catch (e) {
      console.error('Error loading programs:', e);
    } finally {
      setDataLoaded(true);
    }
  }, [settings.activeProgramId]);

  useFocusEffect(useCallback(() => { loadPrograms(); }, [loadPrograms]));

  const startTemplate = (programId: number, templateId: number) => {
    const today = localDateStr();
    // Only look for an IN-PROGRESS session (durationSeconds IS NULL).
    // Completed sessions for today are kept untouched — multiple workouts per day are allowed.
    const activeInProgress = db
      .select({ id: workoutSessions.id, templateId: workoutSessions.templateId })
      .from(workoutSessions)
      .where(and(eq(workoutSessions.date, today), isNull(workoutSessions.durationSeconds)))
      .orderBy(desc(workoutSessions.id))
      .limit(1)
      .get();

    const proceed = () => {
      setActiveProgramId(programId);
      setPendingIntent({ kind: 'template', templateId, programId });
      router.navigate('/today');
    };

    if (activeInProgress && activeInProgress.templateId !== templateId) {
      Alert.alert(
        'Discard in-progress workout?',
        'You have a workout in progress. Discard it and start the selected one? Completed workouts today will be kept.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: proceed },
        ],
      );
    } else {
      proceed();
    }
  };

  const activate = (programId: number) => {
    setActiveProgramId(programId);
    router.navigate('/today');
  };

  const openCustomBuilder = useCallback(() => {
    setCustomExercises([]);
    setShowCustomBuilder(true);
  }, []);

  const loadAvailableExercises = useCallback(() => {
    const allExercises = db.select().from(exercises).orderBy(asc(exercises.name)).all();
    setAvailableExercises(allExercises);
  }, []);

  const openExercisePicker = useCallback(() => {
    loadAvailableExercises();
    setShowExercisePicker(true);
  }, [loadAvailableExercises]);

  const addExerciseToCustomWorkout = useCallback((exerciseId: number, exerciseName: string) => {
    const newExercise: CustomExercise = {
      id: exerciseId,
      name: exerciseName,
      sets: 3,
      reps: 10,
    };
    setCustomExercises((prev) => [...prev, newExercise]);
    setShowExercisePicker(false);
    setExerciseSearchQuery('');
  }, []);

  const removeExerciseFromCustomWorkout = useCallback((index: number) => {
    setCustomExercises((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateCustomExercise = useCallback((index: number, field: 'sets' | 'reps', value: number) => {
    setCustomExercises((prev) =>
      prev.map((ex, i) => (i === index ? { ...ex, [field]: value } : ex))
    );
  }, []);

  const startCustomWorkout = useCallback(() => {
    if (customExercises.length === 0) return;

    const today = localDateStr();

    // Create a temporary custom workout session
    const customTemplateId = -1; // Use -1 as a marker for custom workouts
    const programId = settings.activeProgramId || 1; // Use active program or default to 1

    db.insert(workoutSessions)
      .values({
        programId,
        templateId: customTemplateId,
        date: today,
        isCustom: true,
        customExercises: customExercises.map((ex) => ({
          exerciseId: ex.id,
          sets: ex.sets,
          reps: ex.reps,
          order: customExercises.indexOf(ex),
        })),
      })
      .run();

    // Look up the id we just inserted and hand it off so Today can load it directly
    const created = db
      .select({ id: workoutSessions.id })
      .from(workoutSessions)
      .where(and(eq(workoutSessions.date, today), isNull(workoutSessions.durationSeconds)))
      .orderBy(desc(workoutSessions.id))
      .limit(1)
      .get();

    setShowCustomBuilder(false);
    if (created?.id) {
      setPendingIntent({ kind: 'session', sessionId: created.id });
    }
    router.navigate('/today');
  }, [customExercises, settings.activeProgramId]);

  if (!loaded || !dataLoaded) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (programList.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>No programs found.</Text>
        <Text style={styles.emptySubText}>Restart the app to seed program data.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Programs</Text>
        <Text style={styles.subheading}>Choose your training plan</Text>

        {programList.map((p) => {
          const isActive = settings.activeProgramId === p.id && activeSessionExists;
          const colors = TYPE_COLORS[p.type];

          return (
            <Card key={p.id} style={[styles.card, isActive && styles.activeCard]}>
              <Card.Content>
                <View style={styles.titleRow}>
                  <Text style={styles.programName}>{p.name}</Text>
                  <View style={[styles.badge, { backgroundColor: colors.bg }]}>
                    <Text style={[styles.badgeText, { color: colors.text }]}>{p.type}</Text>
                  </View>
                </View>

                {isActive && (
                  <Text style={styles.activePill}>● Active</Text>
                )}

                <Text style={styles.description}>{p.description}</Text>

                <View style={styles.templatesContainer}>
                  {p.templates.map((t) => (
                    <View key={t.id} style={styles.templateRow}>
                      <View style={styles.templateInfo}>
                        <Text style={styles.templateLabel}>{t.label}</Text>
                        <Text style={styles.templateExercises}>{t.exerciseNames.join(' · ')}</Text>
                      </View>
                      <Button
                        mode="contained-tonal"
                        compact
                        onPress={() => startTemplate(p.id, t.id)}
                        style={styles.startTemplateBtn}
                      >
                        Start
                      </Button>
                    </View>
                  ))}
                </View>
              </Card.Content>
            </Card>
          );
        })}
      </ScrollView>

      <FAB
        icon="plus"
        color={C.move}
        style={styles.fab}
        onPress={openCustomBuilder}
        label="Custom Workout"
      />

      <Portal>
        <Modal visible={showCustomBuilder} onDismiss={() => setShowCustomBuilder(false)} contentContainerStyle={styles.customBuilderModal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Build Custom Workout</Text>
            <Button compact icon="close" onPress={() => setShowCustomBuilder(false)} textColor={C.textSecondary}>
              {''}
            </Button>
          </View>
          <Button mode="outlined" onPress={openExercisePicker} style={styles.addExerciseButton}>
            + Add Exercise
          </Button>

          <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: 8 }}>
            {customExercises.length === 0 ? (
              <View style={styles.customEmpty}>
                <Text style={styles.customEmptyText}>No exercises yet. Tap "+ Add Exercise" to build your workout.</Text>
              </View>
            ) : (
              customExercises.map((ex, index) => (
                <Card key={index} style={[styles.customExerciseCard, styles.customExerciseCardBg]}>
                  <Card.Content>
                    <View style={styles.customExerciseHeader}>
                      <Text style={styles.customExerciseName}>{ex.name}</Text>
                      <Button compact onPress={() => removeExerciseFromCustomWorkout(index)} textColor="#EF4444">
                        Remove
                      </Button>
                    </View>
                    <View style={styles.customExerciseInputs}>
                      <TextInput
                        label="Sets"
                        value={ex.sets.toString()}
                        onChangeText={(t) => updateCustomExercise(index, 'sets', parseInt(t) || 3)}
                        keyboardType="numeric"
                        mode="outlined"
                        dense
                        style={styles.customInput}
                      />
                      <TextInput
                        label="Reps"
                        value={ex.reps.toString()}
                        onChangeText={(t) => updateCustomExercise(index, 'reps', parseInt(t) || 10)}
                        keyboardType="numeric"
                        mode="outlined"
                        dense
                        style={styles.customInput}
                      />
                    </View>
                  </Card.Content>
                </Card>
              ))
            )}
          </ScrollView>

          <View style={styles.modalFooter}>
            {customExercises.length > 0 && (
              <Button mode="contained" onPress={startCustomWorkout} style={styles.startCustomButton}>
                Start Custom Workout
              </Button>
            )}
            <Button mode="outlined" onPress={() => setShowCustomBuilder(false)} style={styles.cancelButton}>
              Cancel
            </Button>
          </View>
        </Modal>

        <Modal visible={showExercisePicker} onDismiss={() => setShowExercisePicker(false)} contentContainerStyle={styles.exercisePickerModal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Exercise</Text>
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
                <Card style={[styles.exerciseCard, styles.exerciseCardBg]} onPress={() => addExerciseToCustomWorkout(item.id, item.name)}>
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
      </Portal>
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
  card: { marginBottom: 14, borderRadius: 16, backgroundColor: C.surface },
  activeCard: { borderWidth: 1, borderColor: C.move },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  programName: { fontSize: 20, fontWeight: '700', color: C.textPrimary, flex: 1, marginRight: 8, letterSpacing: -0.3 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  activePill: { fontSize: 12, color: C.move, fontWeight: '700', marginBottom: 8, letterSpacing: 0.5, textTransform: 'uppercase' },
  description: { fontSize: 14, color: C.textSecondary, lineHeight: 20, marginBottom: 12 },
  templatesContainer: { gap: 8 },
  templateRow: { backgroundColor: C.surfaceElevated, borderRadius: 10, padding: 12, flexDirection: 'row', alignItems: 'center' },
  templateInfo: { flex: 1 },
  startTemplateBtn: { marginLeft: 8 },
  templateLabel: { fontSize: 13, fontWeight: '700', color: C.textPrimary, marginBottom: 2 },
  templateExercises: { fontSize: 12, color: C.textSecondary },
  emptyText: { fontSize: 18, fontWeight: '600', color: C.textPrimary },
  emptySubText: { fontSize: 14, color: '#9CA3AF', marginTop: 8 },
  fab: { position: 'absolute', right: 16, bottom: 24, backgroundColor: C.surfaceElevated },
  customBuilderModal: {
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
  addExerciseButton: { marginBottom: 12, borderRadius: 12 },
  customEmpty: { padding: 20, alignItems: 'center' },
  customEmptyText: { color: C.textSecondary, fontSize: 13, textAlign: 'center' },
  customExerciseCard: { marginBottom: 10, borderRadius: 12 },
  customExerciseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  customExerciseName: { fontSize: 16, fontWeight: '600', color: C.textPrimary },
  customExerciseCardBg: { backgroundColor: C.surfaceElevated },
  customExerciseInputs: { flexDirection: 'row', gap: 8 },
  customInput: { flex: 1, backgroundColor: C.surface },
  startCustomButton: { marginBottom: 8, borderRadius: 12 },
  cancelButton: { borderRadius: 12 },
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
  searchBar: { marginBottom: 12, borderRadius: 12, backgroundColor: C.surfaceElevated },
  exerciseList: { flex: 1 },
  exerciseCard: { marginBottom: 8, borderRadius: 12 },
  exerciseCardBg: { backgroundColor: C.surfaceElevated },
  exerciseCardTitle: { fontSize: 16, fontWeight: '600', color: C.textPrimary },
  exerciseCardSubtitle: { fontSize: 13, color: C.textSecondary, textTransform: 'capitalize' },
  closeButton: { borderRadius: 12 },
});
