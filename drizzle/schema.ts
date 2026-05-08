import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const workouts = sqliteTable('workouts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  date: text('date').notNull(),
  duration: integer('duration').notNull(),
  notes: text('notes'),
});

export const programs = sqliteTable('programs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: text('created_at').notNull(),
});

export const exercises = sqliteTable('exercises', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  targetSets: integer('target_sets').notNull(),
  targetReps: integer('target_reps').notNull(),
  workoutType: text('workout_type').notNull(),
});

export const workoutSessions = sqliteTable('workout_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: text('date').notNull(),
  workoutType: text('workout_type').notNull(),
  completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
});

export const sessionSets = sqliteTable('session_sets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: integer('session_id').notNull().references(() => workoutSessions.id),
  exerciseId: integer('exercise_id').notNull().references(() => exercises.id),
  setNumber: integer('set_number').notNull(),
  weight: real('weight').notNull(),
  reps: integer('reps').notNull(),
  completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
});

export const bodyStats = sqliteTable('body_stats', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: text('date').notNull(),
  weight: real('weight').notNull(),
  height: real('height').notNull(),
  weightUnit: text('weight_unit').notNull(),
  heightUnit: text('height_unit').notNull(),
  bmi: real('bmi').notNull(),
});
