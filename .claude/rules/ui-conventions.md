---
description: UI 컴포넌트 스타일링, 레이아웃, 리포트 UI, 공유카드 수정 시
globs: src/components/**/*.tsx
---

## UI Conventions

- Phone frame: 384x824px desktop, full viewport mobile (`PhoneFrame.tsx`)
- CTA button: 160x160px circle, emerald color palette
- Theme colors: `src/constants/theme.ts` + CSS variables in `globals.css`
- All text: Korean + English via `useTranslation()` hook
- Path alias: `@/*` → `src/*`
- `Cross-Origin-Opener-Policy: same-origin-allow-popups` in `next.config.ts` + `firebase.json` (Google sign-in)

## Workout Report UI

- AI Coach Card: avatar + 3 typing bubbles + rich card
- Thinking: "생각 중 ●●●" with `animate-bounce`
- Hero Rich Card: dark emerald (`bg-[#1B4332]`) for PR, gray-50 for non-PR
- EXP Card: progress bar (`h-2`) + streak dots
- Card radius: outer `rounded-3xl`, inner `rounded-2xl`
- ShareCard: Korean mode = Korean-only exercise names

## Bottom Sheet Patterns

- `FitScreen`: `rounded-[2rem]` with `bottom-2 left-2 right-2` floating (no nav bar)
- `MasterPlanPreview`: similar but with nav bar present

## Running Report

- Km splits: bar chart with fastest=emerald, slowest=amber
- Auto-pause badge: amber pulse "일시정지" when stopped >10s
- GPS status: searching/denied/tracking indicators
