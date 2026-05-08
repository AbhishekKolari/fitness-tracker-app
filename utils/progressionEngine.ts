export type SessionResult = {
  weightKg: number;
  success: boolean;
};

export function getIncrement(exerciseName: string): number {
  const lower = exerciseName.toLowerCase();
  return lower.includes('squat') || lower.includes('deadlift') ? 5 : 2.5;
}

export function roundToNearest1_25(kg: number): number {
  return Math.round(kg / 1.25) * 1.25;
}

export function computeNextWeight(
  sessions: SessionResult[],
  increment: number,
): { nextWeightKg: number; isDeload: boolean } | null {
  if (sessions.length === 0) return null;

  const lastWeight = sessions[0].weightKg;

  if (sessions[0].success) {
    return { nextWeightKg: lastWeight + increment, isDeload: false };
  }

  if (sessions.length === 3 && sessions.every((s) => !s.success)) {
    return { nextWeightKg: roundToNearest1_25(lastWeight * 0.9), isDeload: true };
  }

  return { nextWeightKg: lastWeight, isDeload: false };
}
