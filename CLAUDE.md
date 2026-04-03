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
cd functions && npm run serve        # Build + emulators (required for local dev)
firebase deploy --only functions     # Deploy functions only
```

**⚠ Local Development:** `npm run dev` alone will NOT work for plan generation or coach messages. Cloud Functions must run locally via `cd functions && npm run serve` in a separate terminal.

There is no test suite configured.

Deployed to Firebase Hosting (project: `ohunjal`). CI/CD via GitHub Actions auto-deploys on push to main and creates preview deployments on PRs. Deployment requires `FIREBASE_CLI_EXPERIMENTS: webframeworks`.

### Required Environment Variables (`.env.local`)

All are `NEXT_PUBLIC_*` (client-side accessible):
- `NEXT_PUBLIC_FIREBASE_API_KEY`, `_AUTH_DOMAIN`, `_PROJECT_ID`, `_STORAGE_BUCKET`, `_MESSAGING_SENDER_ID`, `_APP_ID` — Firebase config
- `NEXT_PUBLIC_GEMINI_API_KEY` — Gemini AI (client-side calls)
- `NEXT_PUBLIC_PORTONE_STORE_ID`, `NEXT_PUBLIC_PORTONE_CHANNEL_KEY` — PortOne billing integration

Cloud Functions use `GEMINI_API_KEY` (server-side, set via Firebase config).

## Architecture

**Next.js 16 + React 19 + TypeScript (strict) + TailwindCSS 4** single-page app simulating a phone-frame workout tracker. Uses Gemini 2.5 Flash (`@google/genai`) for AI workout plan generation, post-workout analysis, and AI coach messages.

### Core Data Flow

`src/app/app/page.tsx` is the sole orchestrator — it owns all app state and passes props/callbacks down to child components. There is no external state library. View routing is managed via a `ViewState` type (`login → condition_check → master_plan_preview → workout_session → workout_report → home`). Tab navigation uses `BottomTabs` with a `TabId` type.

**State Protection:** During workout flow (`condition_check`, `master_plan_preview`, `workout_session`), tab changes are ignored to prevent session data loss. On `workout_report` close, `completedRitualIds` removes "workout" to prevent stale report display on HOME.

### Three Codebases in One Repo

1. **Next.js frontend** (root `package.json`, `src/`) — the main app
2. **`functions/`** — Firebase Cloud Functions (Node 22, `firebase-functions` v6). Modularized into separate files. Function rewrites in `firebase.json` point to `us-central1`. This is the active codebase.
3. **`ohunjal/`** — Separate Cloud Functions codebase (Node 24, `firebase-functions` v7) with subscription/payment endpoints. Has its own manual CORS handling. **Not actively deployed** — not referenced in `firebase.json` rewrites.

Each has its own `package.json`, `tsconfig.json`, and `node_modules`. The root `tsconfig.json` excludes `functions` and `ohunjal`.

### Cloud Functions Module Structure

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

### Firebase Rewrites

Frontend calls Cloud Functions via `/api/*` paths, rewritten in `firebase.json`:
- `/api/generateWorkout`, `/api/analyzeWorkout` → AI functions (Gemini)
- `/api/planSession` → Rule-based plan generation (server-side)
- `/api/getCoachMessage` → AI coach 3-bubble feedback (Gemini)
- `/api/getSubscription`, `/api/subscribe`, `/api/cancelSubscription` → subscription functions
- `/api/admin*` → Admin functions

### Key Directories

- **`src/components/`** — All UI components. `FitScreen.tsx` handles exercise execution (timer + reps modes). `WorkoutSession.tsx` manages session flow with adaptive rep logic. `ShareCard.tsx` uses `html2canvas-pro` for workout screenshot sharing. `WorkoutReport.tsx` renders post-workout report with AI coach chat bubbles.
- **`src/constants/`** — `workout.ts` contains TypeScript interfaces, exercise pools for UI search (`LABELED_EXERCISE_POOLS`), and `getAlternativeExercises()`. **Algorithm code (`generateAdaptiveWorkout`) is NOT here — it's server-side in `functions/src/workoutEngine.ts` for security.** `theme.ts` has design tokens. `exerciseVideos.ts` maps exercise names to YouTube Shorts IDs.
- **`src/utils/`** — `gemini.ts` (AI integration via Cloud Functions), `workoutHistory.ts` (Firestore + localStorage persistence, includes `updateCoachMessages()`), `workoutMetrics.ts` (stats), `userProfile.ts` (profile loading), `exerciseName.ts` (locale-based name display).
- **`src/hooks/`** — `useSafeArea.ts` sets `--safe-area-bottom` CSS variable for iOS/Android PWA bottom spacing. `useTranslation.tsx` provides i18n with ko/en support.
- **`src/app/`** — Next.js App Router pages: main app (`app/page.tsx`), `landing/` (marketing page), `terms/`, `privacy/`, `sitemap.ts`.
- **`src/lib/firebase.ts`** — Firebase client SDK initialization.
- **`src/locales/`** — `ko.json` and `en.json` translation files.

### Security Architecture

Core business logic is server-side only to prevent reverse-engineering:

| What | Where | Client Bundle |
|---|---|---|
| Workout generation algorithm | `functions/src/workoutEngine.ts` | **0 lines** |
| Coach message generation | `functions/src/ai/coach.ts` (Gemini) | **0 lines** |
| Exercise pool data (for algorithm) | `functions/src/workoutEngine.ts` | **0 lines** |
| Exercise pool data (for UI search) | `src/constants/workout.ts` | Exercise names only |
| Type definitions | `src/constants/workout.ts` | Types only (~110 lines) |

### Workout Generation

Two server-side paths:
1. **Rule-based** via `/api/planSession` → `generateAdaptiveWorkout()` in `workoutEngine.ts` — instant, cost-free, used for new UI with sessionMode
2. **AI** via `/api/generateWorkout` → Gemini 2.5 Flash — used as legacy path

Both adapt based on `UserCondition` (body state + energy) and `WorkoutGoal`. Client calls `/api/planSession` first; no client-side fallback (security).

### Workout Report — AI Coach Chat System

Post-workout report uses a **3-bubble chat interface** powered by Gemini:

1. **Bubble 1:** Emotional empathy with specific exercise name mention
2. **Bubble 2:** Session detail feedback (failed sets, weight changes, rep patterns)
3. **Bubble 3:** Condition-linked tomorrow advice

**Flow:**
- Workout complete → `WorkoutReport` renders → thinking dots ("생각 중 ●●●")
- `fetchCoachMessages()` calls `/api/getCoachMessage` (Gemini 2.5 Flash)
- Gemini generates 3 messages in trainer-friend tone (해요체, 느낌표, ㅎㅎ)
- Messages appear as sequential typing animation
- Messages saved to `WorkoutHistory.coachMessages` (localStorage + Firestore)
- History view: loads saved messages instantly (no Gemini re-call)

**Fallback:** If Gemini fails (timeout 5s, API error), server-side rule-based fallback generates 3 messages using session log analysis (fail recovery, weight increase, all-easy detection).

**Prompt rules:** No duplicate exercise names across 3 bubbles. No emoji, no English words, no medical terms. Exercise names in Korean only.

### Intensity System

Three-tier intensity (`"high" | "moderate" | "low"`) based on ACSM guidelines flows through the app:
- `page.tsx` holds `recommendedIntensity` state, passes it to `MasterPlanPreview` (intensity picker UI)
- Server-side `generateAdaptiveWorkout()` accepts `intensityOverride` parameter that adjusts sets (high +1, low min 3), compound reps, isolation reps, and weight guides
- Gender-aware adjustments: female users get different rep ranges at the same %1RM
- Core/ab exercises always start at 20 reps minimum
- Low intensity maintains minimum 3 sets (not reduced to 2)

### Exercise Swap

Users can swap individual exercises in both `MasterPlanPreview` and `FitScreen` via a bottom-sheet UI with text search + muscle group filter tabs. `LABELED_EXERCISE_POOLS` (in `workout.ts`) provides categorized exercise lists for client-side search. `getAlternativeExercises()` returns same-group alternatives. Note: `FitScreen` has dual render paths (weight picker vs main exercise view) — the swap bottom sheet must be present in both paths.

### Exercise Name Display

`getExerciseName(name, locale)` in `src/utils/exerciseName.ts`:
- **KO mode:** Returns Korean name only (strips English parenthetical). e.g., "바벨 벤치 프레스"
- **EN mode:** Returns English name from parentheses. e.g., "Barbell Bench Press"

Font size in FitScreen dynamically adjusts based on Korean name length: ≤6 chars → 5xl, ≤9 → 4xl, ≤12 → 3xl, else 2xl.

### Adaptive Exercise Logic

In `WorkoutSession.tsx`, feedback from each set adjusts subsequent sets: "easy" → +2 reps, "too_easy" → +5 reps, "fail" → clamp to actual reps completed.

Bodyweight exercises (no weight) use expanded rep pool: [5, 8, 10, 15, 20, 30, 40, 50, 60, 80, 100].

### Authentication

Firebase Auth with Google sign-in (real auth, not mocked). The `onAuthStateChanged` listener in `page.tsx` drives login state. Cloud Functions verify tokens via `Authorization: Bearer <idToken>` headers.

## Firestore Schema

### Collection: `users/{uid}/workout_history`

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
  createdAt: Timestamp;          // Firestore server timestamp
}
```

## UI Conventions

- Phone frame container: 384×824px on desktop, full viewport on mobile (`PhoneFrame.tsx`)
- CTA button: 160×160px circle, emerald color palette
- Theme colors defined in both `src/constants/theme.ts` and CSS variables in `globals.css`
- All user-facing text supports **Korean and English** via `useTranslation()` hook
- Path alias: `@/*` maps to `src/*`
- `Cross-Origin-Opener-Policy: same-origin-allow-popups` header set in both `next.config.ts` and `firebase.json` (required for Google sign-in popup)

### Workout Report UI

- **AI Coach Card:** Chat-style with avatar + 3 sequential typing bubbles + result rich card
- **Thinking Animation:** "생각 중 ●●●" with bounce dots (CSS `animate-bounce`)
- **Hero Rich Card:** Dark emerald (`bg-[#1B4332]`) for PR, gray-50 for non-PR
- **EXP Card:** Always expanded with progress bar (`h-2`) + streak dots + next workout preview
- **Card radius:** Outer `rounded-3xl`, inner `rounded-2xl`
- **ShareCard:** Korean mode shows Korean-only exercise names (no English parenthetical)

## Important Patterns

- **i18n:** ALL UI text additions must include both ko.json and en.json translations simultaneously
- Subscription gating: free plan limited to 3 workouts (`FREE_PLAN_LIMIT` in `page.tsx`)
- `page.tsx` is a `"use client"` component — all app state lives there, no SSR for the main app
- `WorkoutReport` uses `sessionDate` prop to distinguish history view (share button only, saved coach messages) from current session (Gemini call, share + complete buttons)
- Bottom sheets in `FitScreen` use `rounded-[2rem]` with `bottom-2 left-2 right-2` floating style (no nav bar present, unlike `MasterPlanPreview`)
- **State change rule:** When modifying any React state, grep for ALL locations that read that state to prevent side effects

## Deployment Checklist

- **Hosting only (client changes):** `git push` → CI auto-deploys
- **Functions changes:** `firebase deploy --only functions` (manual)
- **Both:** Push first, then `firebase deploy --only functions`
- New Cloud Functions require both `firebase.json` rewrite AND functions deploy

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
