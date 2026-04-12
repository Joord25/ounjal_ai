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

- `ohunjal_workout_history` — cached workout history
- `ohunjal_body_weight`, `ohunjal_gender`, `ohunjal_birth_year` — user profile
- `ohunjal_weight_{exerciseName}` — per-exercise last-used weight
- `ohunjal_fitness_profile` — FitnessReading profile data
- `ohunjal_language` — locale (ko/en)
- `ohunjal_settings_sound` — sound on/off (default: true)
- `ohunjal_settings_vibration` — vibration on/off (default: true)
- `ohunjal_weight_log` — weight tracking log
- `ohunjal_season_exp` — season EXP data
