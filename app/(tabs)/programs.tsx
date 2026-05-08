import React, { useState, useCallback } from 'react';
import { ScrollView, View, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Button, Text, ActivityIndicator, FAB, Portal, Modal, TextInput, Searchbar } from 'react-native-paper';
import { colors as C } from '../../theme';
import { router, useFocusEffect } from 'expo-router';
import { eq, asc, and } from 'drizzle-orm';
import { db } from '../../db/client';
import { programs, workoutTemplates, templateExercises, exercises, workoutSessions } from '../../db/schema';
import { useSettings } from '../../contexts/SettingsContext';

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
        const today = new Date().toISOString().split('T')[0];
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

  const activate = (programId: number) => {
    setActiveProgramId(programId);
    router.navigate('/');
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

    const today = new Date().toISOString().split('T')[0];

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

    setShowCustomBuilder(false);
    router.navigate('/');
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
                      <Text style={styles.templateLabel}>{t.label}</Text>
                      <Text style={styles.templateExercises}>{t.exerciseNames.join(' · ')}</Text>
                    </View>
                  ))}
                </View>
              </Card.Content>

              <Card.Actions>
                {isActive ? (
                  <Button mode="outlined" onPress={() => router.navigate('/')}>
                    Go to Today
                  </Button>
                ) : (
                  <Button mode="contained" onPress={() => activate(p.id)}>
                    Start This Program
                  </Button>
                )}
              </Card.Actions>
            </Card>
          );
        })}
      </ScrollView>

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={openCustomBuilder}
        label="Custom Workout"
      />

      <Portal>
        <Modal visible={showCustomBuilder} onDismiss={() => setShowCustomBuilder(false)} contentContainerStyle={styles.customBuilderModal}>
          <Text style={styles.modalTitle}>Build Custom Workout</Text>
          <Button mode="outlined" onPress={openExercisePicker} style={styles.addExerciseButton}>
            + Add Exercise
          </Button>

          {customExercises.map((ex, index) => (
            <Card key={index} style={styles.customExerciseCard}>
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
          ))}

          {customExercises.length > 0 && (
            <Button mode="contained" onPress={startCustomWorkout} style={styles.startCustomButton}>
              Start Custom Workout
            </Button>
          )}

          <Button mode="outlined" onPress={() => setShowCustomBuilder(false)} style={styles.cancelButton}>
            Cancel
          </Button>
        </Modal>

        <Modal visible={showExercisePicker} onDismiss={() => setShowExercisePicker(false)} contentContainerStyle={styles.exercisePickerModal}>
          <Text style={styles.modalTitle}>Select Exercise</Text>
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
              <Card style={styles.exerciseCard} onPress={() => addExerciseToCustomWorkout(item.id, item.name)}>
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
  templateRow: { backgroundColor: C.surfaceElevated, borderRadius: 10, padding: 12 },
  templateLabel: { fontSize: 13, fontWeight: '700', color: C.textPrimary, marginBottom: 2 },
  templateExercises: { fontSize: 12, color: C.textSecondary },
  emptyText: { fontSize: 18, fontWeight: '600', color: C.textPrimary },
  emptySubText: { fontSize: 14, color: '#9CA3AF', marginTop: 8 },
  fab: { position: 'absolute', right: 16, bottom: 16 },
  customBuilderModal: { backgroundColor: C.surface, padding: 20, margin: 20, borderRadius: 20, maxHeight: '80%' },
  modalTitle: { fontSize: 22, fontWeight: '700', marginBottom: 16, color: C.textPrimary },
  addExerciseButton: { marginBottom: 16 },
  customExerciseCard: { marginBottom: 12 },
  customExerciseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  customExerciseName: { fontSize: 16, fontWeight: '600', color: C.textPrimary },
  customExerciseCardBg: { backgroundColor: C.surfaceElevated },
  customExerciseInputs: { flexDirection: 'row', gap: 8 },
  customInput: { flex: 1 },
  startCustomButton: { marginTop: 16, marginBottom: 8 },
  cancelButton: { marginTop: 8 },
  exercisePickerModal: { backgroundColor: C.surface, padding: 20, margin: 20, borderRadius: 20, maxHeight: '80%' },
  searchBar: { marginBottom: 12 },
  exerciseList: { maxHeight: 300, marginBottom: 12 },
  exerciseCard: { marginBottom: 8 },
  exerciseCardTitle: { fontSize: 16, fontWeight: '600' },
  exerciseCardSubtitle: { fontSize: 14, color: '#6B7280' },
  closeButton: { marginTop: 8 },
});
