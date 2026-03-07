import { ExerciseLog, ExerciseStep } from "@/constants/workout";

/**
 * Epley formula: e1RM = weight × (1 + reps / 30)
 * Only valid for reps <= 30 and weight > 0
 */
export function estimate1RM(weightKg: number, reps: number): number {
  if (reps <= 0 || weightKg <= 0) return 0;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

export type SessionCategory = "strength" | "cardio" | "mobility" | "mixed";

export interface WorkoutMetrics {
  sessionCategory: SessionCategory;
  totalVolume: number;
  totalSets: number;
  totalReps: number; // only strength/core reps
  totalDurationSec: number; // total seconds for timer-based exercises
  strengthSets: number;
  timerSets: number;
  bestE1RM: { exerciseName: string; value: number } | null;
  bwRatio: number | null;
  successRate: number;
  fatigueDrop: number | null;
  loadScore: number;
}

/**
 * Calculate fatigue drop per-exercise, then average.
 * For each exercise with 2+ sets, compare first-half vs second-half avg reps.
 * This avoids comparing reps across different exercises (e.g., 8-rep bench vs 20-rep crunches).
 */
function calcFatigueDrop(exercises: ExerciseStep[], logs: Record<number, ExerciseLog[]>): number | null {
  const perExerciseDrops: number[] = [];

  exercises.forEach((_, idx) => {
    const exLogs = logs[idx] || [];
    if (exLogs.length < 2) return;

    const mid = Math.floor(exLogs.length / 2);
    const firstHalf = exLogs.slice(0, mid || 1); // at least 1 in first half
    const secondHalf = exLogs.slice(mid || 1);

    const avgFirst = firstHalf.reduce((s, l) => s + l.repsCompleted, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((s, l) => s + l.repsCompleted, 0) / secondHalf.length;

    if (avgFirst > 0) {
      perExerciseDrops.push(((avgSecond - avgFirst) / avgFirst) * 100);
    }
  });

  if (perExerciseDrops.length === 0) return null;
  return Math.round(perExerciseDrops.reduce((s, d) => s + d, 0) / perExerciseDrops.length);
}

/**
 * Load score = totalVolume normalized. Simple proxy for session intensity.
 * Higher = heavier session. Can compare across sessions when divided by bodyweight.
 */
function calcLoadScore(totalVolume: number, bodyWeightKg?: number): number {
  if (bodyWeightKg && bodyWeightKg > 0) {
    return Math.round((totalVolume / bodyWeightKg) * 10) / 10;
  }
  return totalVolume;
}

function isTimerExercise(ex: ExerciseStep): boolean {
  return ex.type === "cardio" || ex.type === "warmup" || ex.type === "mobility";
}

function parseCountToSeconds(count: string): number {
  const match = count.match(/(\d+)/);
  const val = match ? parseInt(match[1]) : 0;
  if (count.includes("초") || count.toLowerCase().includes("sec")) return val;
  if (count.includes("분") || count.toLowerCase().includes("min")) return val * 60;
  return val;
}

function detectSessionCategory(exercises: ExerciseStep[]): SessionCategory {
  let strength = 0;
  let cardio = 0;
  let mobility = 0;
  for (const ex of exercises) {
    if (ex.type === "strength") strength++;
    else if (ex.type === "cardio") cardio++;
    else if (ex.type === "mobility") mobility++;
    // warmup & core are auxiliary — don't determine session category
  }
  if (strength > 0 && cardio === 0) return "strength";
  if (strength === 0 && cardio > 0) return "cardio";
  if (strength === 0 && cardio === 0 && mobility > 0) return "mobility";
  if (strength > 0 && cardio > 0) return "mixed";
  // fallback: only warmup+core exercises → treat as mobility/recovery
  return "mobility";
}

export function buildWorkoutMetrics(
  exercises: ExerciseStep[],
  logs: Record<number, ExerciseLog[]>,
  bodyWeightKg?: number
): WorkoutMetrics {
  let totalVolume = 0;
  let totalSets = 0;
  let totalReps = 0;
  let totalDurationSec = 0;
  let strengthSets = 0;
  let timerSets = 0;
  let targetOrBetter = 0;
  let totalLogEntries = 0;
  let bestE1RM: { exerciseName: string; value: number } | null = null;

  const sessionCategory = detectSessionCategory(exercises);

  exercises.forEach((exercise, idx) => {
    const exerciseLogs = logs[idx] || [];
    const isTimer = isTimerExercise(exercise);

    exerciseLogs.forEach((log) => {
      totalSets++;
      totalLogEntries++;

      if (log.feedback !== "fail") {
        targetOrBetter++;
      }

      if (isTimer) {
        timerSets++;
        // For timer exercises, repsCompleted = target count (seconds or reps for the timer)
        totalDurationSec += parseCountToSeconds(exercise.count) * (log.setNumber === 1 ? 1 : 0) || log.repsCompleted;
      } else {
        strengthSets++;
        totalReps += log.repsCompleted;

        // Parse weight for volume and e1RM
        const weightStr = log.weightUsed || exercise.weight;
        if (weightStr && weightStr !== "Bodyweight") {
          const weight = parseFloat(weightStr);
          if (!isNaN(weight) && weight > 0) {
            totalVolume += weight * log.repsCompleted;

            const e1rm = estimate1RM(weight, log.repsCompleted);
            if (!bestE1RM || e1rm > bestE1RM.value) {
              bestE1RM = { exerciseName: exercise.name, value: e1rm };
            }
          }
        }
      }
    });

    // For timer exercises with no logs, still accumulate planned duration
    if (isTimer && exerciseLogs.length === 0) {
      totalDurationSec += parseCountToSeconds(exercise.count) * exercise.sets;
    }
  });

  const successRate = totalLogEntries > 0
    ? Math.round((targetOrBetter / totalLogEntries) * 100)
    : 0;

  const finalE1RM = bestE1RM as { exerciseName: string; value: number } | null;
  const bwRatio = finalE1RM && bodyWeightKg && bodyWeightKg > 0
    ? Math.round((finalE1RM.value / bodyWeightKg) * 100) / 100
    : null;

  // Only compute fatigue drop for strength exercises (need at least 2 sets total)
  const fatigueDrop = strengthSets >= 2 ? calcFatigueDrop(
    exercises.filter(e => !isTimerExercise(e)),
    // Re-index logs for strength-only exercises
    (() => {
      const filtered: Record<number, ExerciseLog[]> = {};
      let newIdx = 0;
      exercises.forEach((ex, idx) => {
        if (!isTimerExercise(ex)) {
          filtered[newIdx] = logs[idx] || [];
          newIdx++;
        }
      });
      return filtered;
    })()
  ) : null;

  const loadScore = calcLoadScore(totalVolume, bodyWeightKg);

  return {
    sessionCategory,
    totalVolume,
    totalSets,
    totalReps,
    totalDurationSec,
    strengthSets,
    timerSets,
    bestE1RM: finalE1RM,
    bwRatio,
    successRate,
    fatigueDrop,
    loadScore,
  };
}
