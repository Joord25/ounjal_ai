---
description: AI 코치 채팅, Gemini 프롬프트, 코치 멘트 수정 시
globs: functions/src/ai/coach.ts, src/components/report/RpgResultCard.tsx, src/components/dashboard/HomeScreen.tsx
---

## Workout Report — AI Coach Chat System

Post-workout report uses a **3-bubble chat interface** powered by Gemini:

1. **Bubble 1:** Emotional empathy with specific exercise name mention
2. **Bubble 2:** Session detail feedback (failed sets, weight changes, rep patterns)
3. **Bubble 3:** Condition-linked tomorrow advice

**Flow:**
- Workout complete → `WorkoutReport` renders → thinking dots
- `fetchCoachMessages()` in `RpgResultCard.tsx` calls `/api/getCoachMessage` (Gemini 2.5 Flash)
- Messages appear as sequential typing animation
- Messages saved to `WorkoutHistory.coachMessages` (localStorage + Firestore)
- History view: loads saved messages instantly (no Gemini re-call)

**Fallback:** If Gemini fails (timeout 5s, API error), server-side rule-based fallback in `coachMessages.ts`.

**Prompt rules:**
- No duplicate exercise names across 3 bubbles
- No emoji (한글 이모티콘 ㅎㅎ ㅠㅠ OK, but max 1x ㅎㅎ per 3 bubbles)
- No English words, no medical terms, no "화이팅", no formal speech
- No negative feedback, no body/weight comments
- Exercise names in Korean only
- Korean trend references (food, culture) encouraged

**Prompt versioning:** `functions/src/ai/PROMPT_HISTORY.md` tracks all prompt versions (v1~v5).

## Home Screen Coach (2 bubbles, client-side)

`HomeScreen.tsx` generates 2 coach bubbles locally (no Gemini):
- Bubble 1: greeting/emotion (streak, time-of-day, comeback)
- Bubble 2: recommendation/action (body part suggestion, plan ready)
- ㅎㅎ density: max 1x per 2-bubble set (bubble1 ~19%, bubble2 ~10%)
- Day-seed based message selection (same day = same message)

## Growth Prediction Coach

`FitnessReading.tsx` + `predictionReading.ts` shows goal-specific predictions:
- Fat Loss: calorie-based weight prediction
- Muscle Gain: e1RM-based strength prediction
- Endurance: weekly minutes + fitness grade
- Health: consistency tracking
