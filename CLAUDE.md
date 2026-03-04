# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm run dev       # Start dev server (Next.js with Turbopack)
npm run build     # Production build
npm run start     # Start production server
npm run lint      # ESLint check
```

Deployed to Firebase Hosting (project: `ounjal`, region: asia-east1). CI/CD via GitHub Actions auto-deploys on push to main and creates preview deployments on PRs.

## Architecture

**Next.js 16 + React 19 + TypeScript (strict) + TailwindCSS 4** single-page app simulating a phone-frame workout tracker. Uses Gemini 2.5 Flash (`@google/genai`) for AI workout plan generation and post-workout analysis.

### Core Data Flow

`page.tsx` is the sole orchestrator — it owns all app state and passes props/callbacks down to child components. There is no external state library. View routing is managed via a `ViewState` enum (`login → condition_check → master_plan_preview → workout_session → workout_report → home`). Persistence is localStorage-only (keys prefixed `alpha_`).

### Key Directories

- **`src/components/`** — All UI components. `FitScreen.tsx` handles exercise execution (timer + reps modes). `WorkoutSession.tsx` manages session flow with adaptive rep logic.
- **`src/constants/`** — `workout.ts` contains all TypeScript interfaces, exercise pools, and the algorithmic workout generator (`generateAdaptiveWorkout`). `theme.ts` has design tokens.
- **`src/utils/gemini.ts`** — Gemini API integration: `generateAIWorkoutPlan()` and `analyzeWorkoutSession()`. Falls back to algorithm if AI fails.

### Workout Generation

Two paths: (1) AI via Gemini with structured JSON output and Korean-language coaching, (2) algorithm-based fallback in `workout.ts` using day-of-week scheduling (Push/Pull/Legs/Run/Mobility). Both adapt based on `UserCondition` (body state + energy) and `WorkoutGoal`.

### Adaptive Exercise Logic

In `WorkoutSession.tsx`, feedback from each set adjusts subsequent sets: "easy" → +2 reps, "too_easy" → +5 reps, "fail" → clamp to actual reps completed.

## UI Conventions

- Phone frame container: 384×824px on desktop, full viewport on mobile (`PhoneFrame.tsx`)
- CTA button: 160×160px circle, emerald color palette
- Theme colors defined in both `src/constants/theme.ts` and CSS variables in `globals.css`
- All user-facing workout feedback and AI analysis is in **Korean**
- Path alias: `@/*` maps to `src/*`

## Important Notes

- Gemini API key is exposed client-side via `NEXT_PUBLIC_GEMINI_API_KEY` in `.env.local`
- Authentication is currently mocked (no real Firebase Auth)
- No backend database — all data lives in localStorage
- The PRD (`prd.md`) contains detailed product requirements and design specs
