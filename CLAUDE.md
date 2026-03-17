# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm run dev       # Start dev server (Next.js with Turbopack)
npm run build     # Production build
npm run lint      # ESLint check
```

**Cloud Functions** (separate npm project in `functions/`):
```bash
cd functions && npm run build        # Compile TypeScript
cd functions && npm run serve        # Build + emulators
firebase deploy --only functions     # Deploy functions only
```

There is no test suite configured.

Deployed to Firebase Hosting (project: `ohunjal`). CI/CD via GitHub Actions auto-deploys on push to main and creates preview deployments on PRs. Deployment requires `FIREBASE_CLI_EXPERIMENTS: webframeworks`.

### Required Environment Variables (`.env.local`)

All are `NEXT_PUBLIC_*` (client-side accessible):
- `NEXT_PUBLIC_FIREBASE_API_KEY`, `_AUTH_DOMAIN`, `_PROJECT_ID`, `_STORAGE_BUCKET`, `_MESSAGING_SENDER_ID`, `_APP_ID` — Firebase config
- `NEXT_PUBLIC_GEMINI_API_KEY` — Gemini AI (client-side calls)
- `NEXT_PUBLIC_PORTONE_STORE_ID`, `NEXT_PUBLIC_PORTONE_CHANNEL_KEY` — PortOne billing integration

Cloud Functions use `GEMINI_API_KEY` (server-side, set via Firebase config).

## Architecture

**Next.js 16 + React 19 + TypeScript (strict) + TailwindCSS 4** single-page app simulating a phone-frame workout tracker. Uses Gemini 2.5 Flash (`@google/genai`) for AI workout plan generation and post-workout analysis.

### Core Data Flow

`src/app/page.tsx` is the sole orchestrator — it owns all app state and passes props/callbacks down to child components. There is no external state library. View routing is managed via a `ViewState` type (`login → condition_check → master_plan_preview → workout_session → workout_report → home`). Tab navigation uses `BottomTabs` with a `TabId` type.

### Three Codebases in One Repo

1. **Next.js frontend** (root `package.json`, `src/`) — the main app
2. **`functions/`** — Firebase Cloud Functions (Node 22, `firebase-functions` v6). Handles server-side Gemini calls and subscription management via PortOne billing API. Function rewrites in `firebase.json` point to `us-central1`. This is the active codebase.
3. **`ohunjal/`** — Separate Cloud Functions codebase (Node 24, `firebase-functions` v7) with subscription/payment endpoints. Has its own manual CORS handling. **Not actively deployed** — not referenced in `firebase.json` rewrites.

Each has its own `package.json`, `tsconfig.json`, and `node_modules`. The root `tsconfig.json` excludes `functions` and `ohunjal`.

### Firebase Rewrites

Frontend calls Cloud Functions via `/api/*` paths, rewritten in `firebase.json`:
- `/api/generateWorkout`, `/api/analyzeWorkout` → AI functions
- `/api/getSubscription`, `/api/subscribe`, `/api/cancelSubscription` → subscription functions

### Key Directories

- **`src/components/`** — All UI components. `FitScreen.tsx` handles exercise execution (timer + reps modes). `WorkoutSession.tsx` manages session flow with adaptive rep logic. `ShareCard.tsx` uses `html2canvas-pro` for workout screenshot sharing.
- **`src/constants/`** — `workout.ts` contains all TypeScript interfaces, exercise pools, and the algorithmic workout generator (`generateAdaptiveWorkout`). `theme.ts` has design tokens.
- **`src/utils/`** — `gemini.ts` (AI integration), `workoutHistory.ts` (Firestore persistence), `workoutMetrics.ts` (stats), `userProfile.ts` (profile loading).
- **`src/hooks/`** — `useSafeArea.ts` sets `--safe-area-bottom` CSS variable for iOS/Android PWA bottom spacing.
- **`src/app/`** — Next.js App Router pages: main app (`page.tsx`), `landing/` (marketing page), `terms/`, `privacy/`, `sitemap.ts`.
- **`src/lib/firebase.ts`** — Firebase client SDK initialization.

### Workout Generation

Two paths: (1) AI via Gemini with structured JSON output and Korean-language coaching, (2) rule-based generator `generateAdaptiveWorkout()` in `workout.ts` using day-of-week scheduling (Push/Pull/Legs/Run/Mobility). Both adapt based on `UserCondition` (body state + energy) and `WorkoutGoal`. Plan adjustments (regeneration, intensity changes) use the rule-based path for instant, cost-free results — AI is reserved for initial generation and post-workout analysis.

### Intensity System

Three-tier intensity (`"high" | "moderate" | "low"`) based on ACSM guidelines flows through the app:
- `page.tsx` holds `recommendedIntensity` state, passes it to `MasterPlanPreview` (intensity picker UI) and into `generateAdaptiveWorkout()`
- `generateAdaptiveWorkout()` accepts `intensityOverride` parameter that adjusts sets (high +1, low -1), compound reps, isolation reps (`isoRepsKo`/`isoRepsVal`), and weight guides via `getWeightGuide(role, goal, intensityOverride)`
- Gender-aware adjustments: female users get different rep ranges at the same %1RM

### Exercise Swap

Users can swap individual exercises in both `MasterPlanPreview` and `FitScreen` via a bottom-sheet UI with text search + muscle group filter tabs. `LABELED_EXERCISE_POOLS` (in `workout.ts`) provides categorized exercise lists. `getAlternativeExercises()` returns same-muscle-group alternatives. Note: `FitScreen` has dual render paths (weight picker vs main exercise view) — the swap bottom sheet must be present in both paths.

### Adaptive Exercise Logic

In `WorkoutSession.tsx`, feedback from each set adjusts subsequent sets: "easy" → +2 reps, "too_easy" → +5 reps, "fail" → clamp to actual reps completed.

### Authentication

Firebase Auth with Google sign-in (real auth, not mocked). The `onAuthStateChanged` listener in `page.tsx` drives login state. Cloud Functions verify tokens via `Authorization: Bearer <idToken>` headers.

## UI Conventions

- Phone frame container: 384×824px on desktop, full viewport on mobile (`PhoneFrame.tsx`)
- CTA button: 160×160px circle, emerald color palette
- Theme colors defined in both `src/constants/theme.ts` and CSS variables in `globals.css`
- All user-facing workout feedback and AI analysis is in **Korean**
- Path alias: `@/*` maps to `src/*`
- `Cross-Origin-Opener-Policy: same-origin-allow-popups` header set in both `next.config.ts` and `firebase.json` (required for Google sign-in popup)

## Important Patterns

- Subscription gating: free plan limited to 3 workouts (`FREE_PLAN_LIMIT` in `page.tsx`)
- `page.tsx` is a `"use client"` component — all app state lives there, no SSR for the main app
- `WorkoutReport` uses `sessionDate` prop to distinguish history view (share button only) from current session (share + complete buttons)
- Bottom sheets in `FitScreen` use `rounded-[2rem]` with `bottom-2 left-2 right-2` floating style (no nav bar present, unlike `MasterPlanPreview`)
