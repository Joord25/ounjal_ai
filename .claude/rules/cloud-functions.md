---
description: Cloud Functions 구조, Firebase Rewrites, 서버사이드 로직 참조 시
globs: functions/**/*
---

## Cloud Functions Module Structure

```
functions/src/
├── index.ts              ← Re-exports only (11 lines)
├── helpers.ts            ← verifyAuth, verifyAdmin, app, db
├── gemini.ts             ← getGemini(), GEMINI_MODEL
├── coachMessages.ts      ← Rule-based fallback messages (Gemini failure backup)
├── workoutEngine.ts      ← generateAdaptiveWorkout (server-side only, security)
├── ai/
│   ├── coach.ts          ← getCoachMessage — Gemini 3-bubble coach feedback
│   └── workout.ts        ← generateWorkout, analyzeWorkout — Gemini AI
├── plan/
│   └── session.ts        ← planSession — rule-based plan generation
├── billing/
│   └── subscription.ts   ← subscribe, getSubscription, cancelSubscription
└── admin/
    └── admin.ts          ← adminActivate, adminCheckUser, etc.
```

## Firebase Rewrites

Frontend calls Cloud Functions via `/api/*` paths, rewritten in `firebase.json`:
- `/api/generateWorkout`, `/api/analyzeWorkout` → AI functions (Gemini)
- `/api/planSession` → Rule-based plan generation (server-side)
- `/api/getCoachMessage` → AI coach 3-bubble feedback (Gemini)
- `/api/getSubscription`, `/api/subscribe`, `/api/cancelSubscription` → subscription functions
- `/api/admin*` → Admin functions

## Security Architecture

Core business logic is server-side only to prevent reverse-engineering:

| What | Where | Client Bundle |
|---|---|---|
| Workout generation algorithm | `functions/src/workoutEngine.ts` | **0 lines** |
| Coach message generation | `functions/src/ai/coach.ts` (Gemini) | **0 lines** |
| Exercise pool data (for algorithm) | `functions/src/workoutEngine.ts` | **0 lines** |
| Exercise pool data (for UI search) | `src/constants/workout.ts` | Exercise names only |
| Type definitions | `src/constants/workout.ts` | Types only (~110 lines) |

## Workout Generation

Two server-side paths:
1. **Rule-based** via `/api/planSession` → `generateAdaptiveWorkout()` in `workoutEngine.ts` — instant, cost-free
2. **AI** via `/api/generateWorkout` → Gemini 2.5 Flash — legacy path

Both adapt based on `UserCondition` (body state + energy) and `WorkoutGoal`. Client calls `/api/planSession` first; no client-side fallback (security).
