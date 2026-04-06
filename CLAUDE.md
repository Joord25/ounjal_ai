# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
Detailed rules are in `.claude/rules/` (auto-loaded by glob pattern).

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

Deployed to Firebase Hosting (project: `ohunjal`). CI/CD via GitHub Actions auto-deploys on push to main.

### Required Environment Variables (`.env.local`)

All are `NEXT_PUBLIC_*` (client-side accessible):
- `NEXT_PUBLIC_FIREBASE_API_KEY`, `_AUTH_DOMAIN`, `_PROJECT_ID`, `_STORAGE_BUCKET`, `_MESSAGING_SENDER_ID`, `_APP_ID` — Firebase config
- `NEXT_PUBLIC_GEMINI_API_KEY` — Gemini AI (client-side calls)
- `NEXT_PUBLIC_PORTONE_STORE_ID`, `NEXT_PUBLIC_PORTONE_CHANNEL_KEY` — PortOne billing

Cloud Functions use `GEMINI_API_KEY` (server-side, set via Firebase config).

## Architecture

**Next.js 16 + React 19 + TypeScript (strict) + TailwindCSS 4** SPA simulating a phone-frame workout tracker. Uses Gemini 2.5 Flash for AI workout plans, analysis, and coach messages.

### Core Data Flow

`src/app/app/page.tsx` is the sole orchestrator — owns all app state, passes props/callbacks down. No external state library. View routing via `ViewState` type (`login → condition_check → master_plan_preview → workout_session → workout_report → home`). Tab navigation: `BottomTabs` with `TabId`.

### Three Codebases in One Repo

1. **Next.js frontend** (root `src/`) — the main app
2. **`functions/`** — Firebase Cloud Functions (Node 22, v6). Active codebase.
3. **`ohunjal/`** — Separate CF codebase (Node 24, v7). **Not actively deployed.**

### Key Directories

- **`src/components/`** — 6 domain directories:
  - **`layout/`** — PhoneFrame, BottomTabs, LanguageSelector, LoginScreen
  - **`plan/`** — ConditionCheck, MasterPlanPreview, PlanShareCard, PlanLoadingOverlay, Tutorial
  - **`workout/`** — WorkoutSession, FitScreen, AiCoachChat, GpsPermissionDialog
  - **`report/`** — WorkoutReport, RunningReportBody, ShareCard, ExpTierCard, RpgResultCard, ReportHelpModal
  - **`dashboard/`** — HomeScreen, ProofTab, WorkoutHistory, FitnessReading, FitnessTest, charts, modals
  - **`profile/`** — MyProfileTab, SubscriptionScreen
  - Root: SwipeToDelete, PullToRefresh
- **`src/constants/`** — workout.ts (types + exercise pools), theme.ts, exerciseVideos.ts
- **`src/utils/`** — gemini.ts, workoutHistory.ts, workoutMetrics.ts, userProfile.ts, exerciseName.ts, runningStats.ts, runningFormat.ts
- **`src/hooks/`** — useSafeArea.ts, useTranslation.tsx, useGpsTracker.ts, useAlarmSynthesizer.ts
- **`src/locales/`** — ko.json, en.json

### Authentication

Firebase Auth with Google sign-in. `onAuthStateChanged` in `page.tsx`. Cloud Functions verify `Authorization: Bearer <idToken>`.

## Important Patterns

- **i18n:** ALL UI text must include both ko.json and en.json simultaneously
- **No emoji:** Unicode emoji/pictographs banned. SVG icons instead. Korean text emoticons (ㅎㅎ ㅠㅠ) OK but max 1x per screen.
- **State change rule:** When modifying React state, grep for ALL locations that read it
- **Workout flow protection:** During `master_plan_preview`/`workout_session`, tab changes blocked
- **Cold start handling:** `lazyGenerateWorkout` retries once after 1.5s on first failure
- **Exercise videos:** All 255+ exercises mapped to YouTube Shorts IDs in `exerciseVideos.ts`
- **Running pace:** 10-second rolling average, GPS outlier rejection (>12m/s), auto-pause after 10s stop

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
