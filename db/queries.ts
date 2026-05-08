import { eq, desc, asc, and, sql, max } from 'drizzle-orm';
import { db } from './client';
import {
  exercises,
  programs,
  workoutTemplates,
  templateExercises,
  workoutSessions,
  setLogs,
  bodyStats,
} from './schema';
import type {
  WorkoutTemplate,
  TemplateExercise,
  Exercise,
  BodyStat,
} from './schema';
import {
  getIncrement,
  computeNextWeight,
  type SessionResult,
} from '../utils/progressionEngine';
import { EXERCISES } from '../data/exercises';
import { PROGRAMS } from '../data/programs';

type NextWorkout = {
  template: WorkoutTemplate;
  exercises: Array<{ templateExercise: TemplateExercise; exercise: Exercise }>;
} | null;

export function getNextWorkout(activeProgramId?: number | null, templateId?: number): NextWorkout {
  // Determine which program to schedule
  const programId = activeProgramId ?? (() => {
    const last = db
      .select({ programId: workoutSessions.programId })
      .from(workoutSessions)
      .orderBy(desc(workoutSessions.date))
      .limit(1)
      .get();
    return last?.programId ?? null;
  })();

  if (!programId) return null;

  // If a specific templateId is provided, use it directly
  if (templateId) {
    const selectedTemplate = db
      .select()
      .from(workoutTemplates)
      .where(eq(workoutTemplates.id, templateId))
      .get();

    if (!selectedTemplate || selectedTemplate.programId !== programId) return null;

    const exerciseRows = db
      .select({
        templateExercise: templateExercises,
        exercise: exercises,
      })
      .from(templateExercises)
      .innerJoin(exercises, eq(templateExercises.exerciseId, exercises.id))
      .where(eq(templateExercises.templateId, selectedTemplate.id))
      .orderBy(asc(templateExercises.order))
      .all();

    return { template: selectedTemplate, exercises: exerciseRows };
  }

  // Find the last session for this specific program to determine rotation
  const lastSessionForProgram = db
    .select({ templateId: workoutSessions.templateId })
    .from(workoutSessions)
    .where(eq(workoutSessions.programId, programId))
    .orderBy(desc(workoutSessions.date))
    .limit(1)
    .get();

  const allTemplates = db
    .select()
    .from(workoutTemplates)
    .where(eq(workoutTemplates.programId, programId))
    .orderBy(asc(workoutTemplates.dayOrder))
    .all();

  if (!allTemplates.length) return null;

  let nextTemplate: WorkoutTemplate;
  if (lastSessionForProgram) {
    const lastTemplate = db
      .select({ dayOrder: workoutTemplates.dayOrder })
      .from(workoutTemplates)
      .where(eq(workoutTemplates.id, lastSessionForProgram.templateId))
      .get();
    const lastDayOrder = lastTemplate?.dayOrder ?? -1;
    nextTemplate = allTemplates.find((t) => t.dayOrder > lastDayOrder) ?? allTemplates[0];
  } else {
    nextTemplate = allTemplates[0];
  }

  const exerciseRows = db
    .select({
      templateExercise: templateExercises,
      exercise: exercises,
    })
    .from(templateExercises)
    .innerJoin(exercises, eq(templateExercises.exerciseId, exercises.id))
    .where(eq(templateExercises.templateId, nextTemplate.id))
    .orderBy(asc(templateExercises.order))
    .all();

  return { template: nextTemplate, exercises: exerciseRows };
}

export function getAvailableTemplates(programId: number): WorkoutTemplate[] {
  return db
    .select()
    .from(workoutTemplates)
    .where(eq(workoutTemplates.programId, programId))
    .orderBy(asc(workoutTemplates.dayOrder))
    .all();
}

export function seedIfEmpty(): void {
  const existing = db.select({ id: exercises.id }).from(exercises).limit(1).get();
  if (existing) return;

  for (const exercise of EXERCISES) {
    db.insert(exercises).values(exercise).run();
  }

  for (const p of PROGRAMS) {
    db.insert(programs).values({ name: p.name, description: p.description, type: p.type }).run();
    const { id: programId } = db
      .select({ id: programs.id })
      .from(programs)
      .where(eq(programs.name, p.name))
      .get()!;

    for (const t of p.templates) {
      db.insert(workoutTemplates).values({ programId, label: t.label, dayOrder: t.dayOrder }).run();
      const { id: templateId } = db
        .select({ id: workoutTemplates.id })
        .from(workoutTemplates)
        .where(and(eq(workoutTemplates.programId, programId), eq(workoutTemplates.label, t.label)))
        .get()!;

      for (const ex of t.exercises) {
        db.insert(templateExercises).values({
          templateId,
          exerciseId: ex.exerciseId,
          sets: ex.sets,
          reps: ex.reps,
          order: ex.order,
        }).run();
      }
    }
  }
}

export function logSet(params: {
  sessionId: number;
  exerciseId: number;
  setNumber: number;
  weightKg: number;
  reps: number;
}): void {
  db.insert(setLogs).values({ ...params, completed: true }).run();
}

export function completeSession(
  sessionId: number,
  durationSeconds: number,
  notes?: string,
): void {
  db.update(workoutSessions)
    .set({ durationSeconds, notes: notes ?? null })
    .where(eq(workoutSessions.id, sessionId))
    .run();
}

type ExerciseProgress = {
  date: string;
  maxWeightKg: number | null;
  totalVolume: number | null;
};

export function getProgressForExercise(exerciseId: number): ExerciseProgress[] {
  return db
    .select({
      date: workoutSessions.date,
      maxWeightKg: max(setLogs.weightKg),
      totalVolume: sql<number>`sum(${setLogs.weightKg} * ${setLogs.reps})`,
    })
    .from(setLogs)
    .innerJoin(workoutSessions, eq(setLogs.sessionId, workoutSessions.id))
    .where(and(eq(setLogs.exerciseId, exerciseId), eq(setLogs.completed, true)))
    .groupBy(workoutSessions.date)
    .orderBy(asc(workoutSessions.date))
    .all();
}

export function getBodyStats(): BodyStat[] {
  return db.select().from(bodyStats).orderBy(desc(bodyStats.date)).all();
}

export function saveBodyStat(params: {
  date: string;
  weightKg: number;
  heightCm?: number;
}): void {
  db.insert(bodyStats)
    .values({ date: params.date, weightKg: params.weightKg, heightCm: params.heightCm ?? null })
    .run();
}

export function getNextWeights(
  exerciseId: number,
  programId: number,
): { exerciseId: number; nextWeightKg: number; isDeload: boolean } | null {
  const exercise = db
    .select({ name: exercises.name })
    .from(exercises)
    .where(eq(exercises.id, exerciseId))
    .get();

  if (!exercise) return null;

  const increment = getIncrement(exercise.name);

  const recentSessions = db
    .select({
      id: workoutSessions.id,
      templateId: workoutSessions.templateId,
      date: workoutSessions.date,
    })
    .from(workoutSessions)
    .innerJoin(setLogs, eq(setLogs.sessionId, workoutSessions.id))
    .where(
      and(
        eq(workoutSessions.programId, programId),
        eq(setLogs.exerciseId, exerciseId),
      ),
    )
    .groupBy(workoutSessions.id)
    .orderBy(desc(workoutSessions.date))
    .limit(3)
    .all();

  if (recentSessions.length === 0) return null;

  const sessionResults: SessionResult[] = recentSessions.map((session) => {
    const logs = db
      .select({ reps: setLogs.reps, weightKg: setLogs.weightKg, completed: setLogs.completed })
      .from(setLogs)
      .where(and(eq(setLogs.sessionId, session.id), eq(setLogs.exerciseId, exerciseId)))
      .all();

    const target = db
      .select({ targetReps: templateExercises.reps, targetSets: templateExercises.sets })
      .from(templateExercises)
      .where(
        and(
          eq(templateExercises.templateId, session.templateId),
          eq(templateExercises.exerciseId, exerciseId),
        ),
      )
      .get();

    const weightKg = logs[0]?.weightKg ?? 0;
    const success =
      target !== undefined &&
      logs.length === target.targetSets &&
      logs.every((l) => l.completed && l.reps >= target.targetReps);

    return { weightKg, success };
  });

  const result = computeNextWeight(sessionResults, increment);
  if (!result) return null;

  return { exerciseId, ...result };
}
