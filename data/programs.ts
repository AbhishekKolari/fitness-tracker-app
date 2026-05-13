type TemplateExerciseSeed = {
  exerciseId: number;
  sets: number;
  reps: number;
  order: number;
};

type TemplateSeed = {
  label: string;
  dayOrder: number;
  exercises: TemplateExerciseSeed[];
};

export type ProgramSeed = {
  name: string;
  description: string;
  type: 'beginner' | 'intermediate' | 'advanced';
  templates: TemplateSeed[];
};

// Exercise IDs (matches data/exercises.ts)
const SQUAT = 1;
const BENCH = 2;
const DEADLIFT = 3;
const OHP = 4;
const ROW = 5;

export const PROGRAMS: ProgramSeed[] = [
  {
    name: 'Classic 5×5',
    description:
      'Two alternating full-body workouts, 3 days a week. Add 2.5 kg each session on upper lifts and 5 kg on squat/deadlift.',
    type: 'beginner',
    templates: [
      {
        label: 'Workout A',
        dayOrder: 1,
        exercises: [
          { exerciseId: SQUAT, sets: 5, reps: 5, order: 1 },
          { exerciseId: BENCH, sets: 5, reps: 5, order: 2 },
          { exerciseId: ROW,   sets: 5, reps: 5, order: 3 },
        ],
      },
      {
        label: 'Workout B',
        dayOrder: 2,
        exercises: [
          { exerciseId: SQUAT,    sets: 5, reps: 5, order: 1 },
          { exerciseId: OHP,      sets: 5, reps: 5, order: 2 },
          { exerciseId: DEADLIFT, sets: 1, reps: 5, order: 3 },
        ],
      },
    ],
  },
  {
    name: 'Novice Barbell',
    description:
      'Classic barbell novice program. Three big compound lifts per session, 3 days a week, adding weight every workout.',
    type: 'beginner',
    templates: [
      {
        label: 'Workout A',
        dayOrder: 1,
        exercises: [
          { exerciseId: SQUAT,    sets: 3, reps: 5, order: 1 },
          { exerciseId: BENCH,    sets: 3, reps: 5, order: 2 },
          { exerciseId: DEADLIFT, sets: 1, reps: 5, order: 3 },
        ],
      },
      {
        label: 'Workout B',
        dayOrder: 2,
        exercises: [
          { exerciseId: SQUAT, sets: 3, reps: 5, order: 1 },
          { exerciseId: OHP,   sets: 3, reps: 5, order: 2 },
          { exerciseId: ROW,   sets: 3, reps: 5, order: 3 },
        ],
      },
    ],
  },
  {
    name: 'Madcow 5×5',
    description:
      'Intermediate 3-day programme with weekly volume and peak-day loading. Progress is added weekly, not each session.',
    type: 'intermediate',
    templates: [
      {
        label: 'Monday',
        dayOrder: 1,
        exercises: [
          { exerciseId: SQUAT, sets: 5, reps: 5, order: 1 },
          { exerciseId: BENCH, sets: 5, reps: 5, order: 2 },
          { exerciseId: ROW,   sets: 5, reps: 5, order: 3 },
        ],
      },
      {
        label: 'Wednesday',
        dayOrder: 2,
        exercises: [
          { exerciseId: SQUAT,    sets: 5, reps: 5, order: 1 },
          { exerciseId: OHP,      sets: 5, reps: 5, order: 2 },
          { exerciseId: DEADLIFT, sets: 5, reps: 5, order: 3 },
        ],
      },
      {
        label: 'Friday',
        dayOrder: 3,
        exercises: [
          { exerciseId: SQUAT, sets: 5, reps: 5, order: 1 },
          { exerciseId: BENCH, sets: 5, reps: 5, order: 2 },
          { exerciseId: ROW,   sets: 5, reps: 5, order: 3 },
        ],
      },
    ],
  },
];
