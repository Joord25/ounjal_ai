---
description: Firestore 데이터 스키마, 워크아웃 히스토리 저장/로드 시
globs: src/utils/workoutHistory.ts, functions/src/**
---

## Collection: `users/{uid}/workout_history`

```typescript
{
  id: string;                    // timestamp-based ID
  date: string;                  // ISO date
  sessionData: {
    title: string;
    description: string;
    exercises: ExerciseStep[];
  };
  logs: Record<number, ExerciseLog[]>;  // keyed by exercise index
  stats: {
    totalVolume: number;
    totalSets: number;
    totalReps: number;
    totalDurationSec?: number;
    bestE1RM?: number;
    bwRatio?: number;
    successRate?: number;
    loadScore?: number;
  };
  exerciseTimings?: ExerciseTiming[];
  analysis?: WorkoutAnalysis;
  coachMessages?: string[];      // Gemini-generated 3-bubble coach feedback
  runningStats?: RunningStats;   // GPS running data + km splits
  createdAt: Timestamp;          // Firestore server timestamp
}
```

## localStorage Keys

- `alpha_workout_history` — cached workout history
- `alpha_body_weight`, `alpha_gender`, `alpha_birth_year` — user profile
- `alpha_weight_{exerciseName}` — per-exercise last-used weight
- `alpha_fitness_profile` — FitnessReading profile data
- `alpha_language` — locale (ko/en)
- `alpha_settings_sound` — sound on/off (default: true)
- `alpha_settings_vibration` — vibration on/off (default: true)
- `alpha_weight_log` — weight tracking log
- `alpha_season_exp` — season EXP data
