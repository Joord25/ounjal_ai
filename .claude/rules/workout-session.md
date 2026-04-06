---
description: 운동 세션 실행, FitScreen, 강도 시스템, 운동 교체, 적응형 로직 수정 시
globs: src/components/workout/**, src/components/plan/**
---

## Intensity System

Three-tier intensity (`"high" | "moderate" | "low"`) based on ACSM guidelines:
- `page.tsx` holds `recommendedIntensity` state → `MasterPlanPreview` (intensity picker)
- Server `generateAdaptiveWorkout()` accepts `intensityOverride`: high +1 set, low min 3 sets
- Gender-aware: female users get different rep ranges at same %1RM
- Core/ab exercises always start at 20 reps minimum

## Exercise Swap

Bottom-sheet UI with text search + muscle group filter in both `MasterPlanPreview` and `FitScreen`.
- `LABELED_EXERCISE_POOLS` (workout.ts) for client-side search
- `getAlternativeExercises()` returns same-group alternatives
- FitScreen has dual render paths (weight picker vs main view) — swap sheet in both

## Exercise Name Display

`getExerciseName(name, locale)` in `exerciseName.ts`:
- KO: Korean only (strips English parenthetical)
- EN: English from parentheses
- Font size: <=6 chars → 5xl, <=9 → 4xl, <=12 → 3xl, else 2xl

## Adaptive Exercise Logic

`WorkoutSession.tsx` feedback adjusts next sets: "easy" → +2 reps, "too_easy" → +5 reps, "fail" → clamp.
Bodyweight exercises use expanded rep pool: [5, 8, 10, 15, 20, 30, 40, 50, 60, 80, 100].

## Equipment-Based Default Weights

`FitScreen.tsx` `getDefaultWeight()` — first-time only (localStorage history takes priority):

| Equipment | Male <60 | Female/60+ |
|-----------|---------|-----------|
| Barbell | 20kg | 15kg |
| Smith | 15kg | 10kg |
| Dumbbell | 10kg | 5kg |
| Kettlebell | 12kg | 8kg |
| Cable/Machine | 15kg | 10kg |

## Set Transition Feedback

On set change: content area 150ms fade-reset + SET counter 500ms emerald flash.

## Settings (MyProfileTab)

- Sound ON/OFF: `alpha_settings_sound` → guards `useAlarmSynthesizer`
- Vibration ON/OFF: `alpha_settings_vibration` → guards `navigator.vibrate` (4 sites in FitScreen)
- Language: KO/EN toggle via `setLocale()`
