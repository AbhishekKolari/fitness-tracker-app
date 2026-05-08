import {
  getIncrement,
  roundToNearest1_25,
  computeNextWeight,
} from '../progressionEngine';

describe('getIncrement', () => {
  it('returns 5 for squat', () => {
    expect(getIncrement('Squat')).toBe(5);
  });

  it('returns 5 for deadlift', () => {
    expect(getIncrement('deadlift')).toBe(5);
  });

  it('returns 5 for Romanian Deadlift', () => {
    expect(getIncrement('Romanian Deadlift')).toBe(5);
  });

  it('returns 2.5 for upper body exercises', () => {
    expect(getIncrement('Bench Press')).toBe(2.5);
    expect(getIncrement('Overhead Press')).toBe(2.5);
    expect(getIncrement('Barbell Row')).toBe(2.5);
  });
});

describe('roundToNearest1_25', () => {
  it('rounds 81 up to 81.25', () => {
    expect(roundToNearest1_25(81)).toBe(81.25);
  });

  it('keeps 90 as 90', () => {
    expect(roundToNearest1_25(90)).toBe(90);
  });

  it('rounds 76.5 down to 76.25', () => {
    expect(roundToNearest1_25(76.5)).toBe(76.25);
  });

  it('rounds 72 up to 72.5', () => {
    expect(roundToNearest1_25(72)).toBe(72.5);
  });
});

describe('computeNextWeight', () => {
  it('returns null with no session history', () => {
    expect(computeNextWeight([], 2.5)).toBeNull();
  });

  it('increments weight after a successful session', () => {
    const result = computeNextWeight([{ weightKg: 80, success: true }], 2.5);
    expect(result).toEqual({ nextWeightKg: 82.5, isDeload: false });
  });

  it('uses 5kg increment for heavy compounds', () => {
    const result = computeNextWeight([{ weightKg: 100, success: true }], 5);
    expect(result).toEqual({ nextWeightKg: 105, isDeload: false });
  });

  it('holds weight after 1 failure', () => {
    const result = computeNextWeight([{ weightKg: 80, success: false }], 2.5);
    expect(result).toEqual({ nextWeightKg: 80, isDeload: false });
  });

  it('holds weight after 2 consecutive failures', () => {
    const sessions = [
      { weightKg: 80, success: false },
      { weightKg: 80, success: false },
    ];
    const result = computeNextWeight(sessions, 2.5);
    expect(result).toEqual({ nextWeightKg: 80, isDeload: false });
  });

  it('triggers deload after 3 consecutive failures', () => {
    const sessions = [
      { weightKg: 80, success: false },
      { weightKg: 80, success: false },
      { weightKg: 80, success: false },
    ];
    const result = computeNextWeight(sessions, 2.5);
    // 80 * 0.9 = 72 → nearest 1.25 = 72.5
    expect(result).toEqual({ nextWeightKg: 72.5, isDeload: true });
  });

  it('does not deload when most recent session succeeded despite prior failures', () => {
    const sessions = [
      { weightKg: 80, success: true },
      { weightKg: 80, success: false },
      { weightKg: 80, success: false },
    ];
    const result = computeNextWeight(sessions, 2.5);
    expect(result).toEqual({ nextWeightKg: 82.5, isDeload: false });
  });

  it('deload weight is rounded to nearest 1.25', () => {
    // 90 * 0.9 = 81 → nearest 1.25 = 81.25
    const sessions = [
      { weightKg: 90, success: false },
      { weightKg: 90, success: false },
      { weightKg: 90, success: false },
    ];
    const result = computeNextWeight(sessions, 2.5);
    expect(result).toEqual({ nextWeightKg: 81.25, isDeload: true });
  });
});
