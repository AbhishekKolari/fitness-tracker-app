import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

export const exercises = sqliteTable('exercises', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  category: text('category').notNull(),
  muscleGroups: text('muscle_groups', { mode: 'json' }).$type<string[]>().notNull(),
  youtubeUrl: text('youtube_url'),
  formCues: text('form_cues', { mode: 'json' }).$type<string[]>().notNull(),
});

export const programs = sqliteTable('programs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  type: text('type', { enum: ['beginner', 'intermediate', 'advanced'] }).notNull(),
});

export const workoutTemplates = sqliteTable('workout_templates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  programId: integer('program_id').notNull().references(() => programs.id),
  label: text('label').notNull(),
  dayOrder: integer('day_order').notNull(),
});

export const templateExercises = sqliteTable('template_exercises', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  templateId: integer('template_id').notNull().references(() => workoutTemplates.id),
  exerciseId: integer('exercise_id').notNull().references(() => exercises.id),
  sets: integer('sets').notNull(),
  reps: integer('reps').notNull(),
  order: integer('order').notNull(),
});

export const workoutSessions = sqliteTable('workout_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  programId: integer('program_id').notNull().references(() => programs.id),
  templateId: integer('template_id').notNull().references(() => workoutTemplates.id),
  date: text('date').notNull(),
  durationSeconds: integer('duration_seconds'),
  notes: text('notes'),
  isCustom: integer('is_custom', { mode: 'boolean' }).notNull().default(false),
  customExercises: text('custom_exercises', { mode: 'json' }).$type<Array<{exerciseId: number, sets: number, reps: number, order: number}> | null>(),
});

export const setLogs = sqliteTable('set_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: integer('session_id').notNull().references(() => workoutSessions.id),
  exerciseId: integer('exercise_id').notNull().references(() => exercises.id),
  setNumber: integer('set_number').notNull(),
  weightKg: real('weight_kg').notNull(),
  reps: integer('reps').notNull(),
  completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
});

export const bodyStats = sqliteTable('body_stats', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: text('date').notNull(),
  weightKg: real('weight_kg').notNull(),
  heightCm: real('height_cm'),
});

// Relations

export const programsRelations = relations(programs, ({ many }) => ({
  workoutTemplates: many(workoutTemplates),
  workoutSessions: many(workoutSessions),
}));

export const workoutTemplatesRelations = relations(workoutTemplates, ({ one, many }) => ({
  program: one(programs, { fields: [workoutTemplates.programId], references: [programs.id] }),
  templateExercises: many(templateExercises),
  workoutSessions: many(workoutSessions),
}));

export const templateExercisesRelations = relations(templateExercises, ({ one }) => ({
  template: one(workoutTemplates, { fields: [templateExercises.templateId], references: [workoutTemplates.id] }),
  exercise: one(exercises, { fields: [templateExercises.exerciseId], references: [exercises.id] }),
}));

export const exercisesRelations = relations(exercises, ({ many }) => ({
  templateExercises: many(templateExercises),
  setLogs: many(setLogs),
}));

export const workoutSessionsRelations = relations(workoutSessions, ({ one, many }) => ({
  program: one(programs, { fields: [workoutSessions.programId], references: [programs.id] }),
  template: one(workoutTemplates, { fields: [workoutSessions.templateId], references: [workoutTemplates.id] }),
  setLogs: many(setLogs),
}));

export const setLogsRelations = relations(setLogs, ({ one }) => ({
  session: one(workoutSessions, { fields: [setLogs.sessionId], references: [workoutSessions.id] }),
  exercise: one(exercises, { fields: [setLogs.exerciseId], references: [exercises.id] }),
}));

// Inferred types

export type Exercise = typeof exercises.$inferSelect;
export type NewExercise = typeof exercises.$inferInsert;

export type Program = typeof programs.$inferSelect;
export type NewProgram = typeof programs.$inferInsert;

export type WorkoutTemplate = typeof workoutTemplates.$inferSelect;
export type NewWorkoutTemplate = typeof workoutTemplates.$inferInsert;

export type TemplateExercise = typeof templateExercises.$inferSelect;
export type NewTemplateExercise = typeof templateExercises.$inferInsert;

export type WorkoutSession = typeof workoutSessions.$inferSelect;
export type NewWorkoutSession = typeof workoutSessions.$inferInsert;

export type SetLog = typeof setLogs.$inferSelect;
export type NewSetLog = typeof setLogs.$inferInsert;

export type BodyStat = typeof bodyStats.$inferSelect;
export type NewBodyStat = typeof bodyStats.$inferInsert;
