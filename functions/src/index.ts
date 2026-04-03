import { onRequest } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2/options";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { GoogleGenAI } from "@google/genai";
// coachMessages는 더 이상 사용하지 않음 — Gemini API가 직접 생성
import { generateAdaptiveWorkout } from "./workoutEngine";

const app = initializeApp();
const db = getFirestore(app);

setGlobalOptions({ region: "us-central1" });

// Admin UID whitelist
const ADMIN_UIDS = ["jDkXqeAFCMgJj8cFbRZITpokS2H2"];

async function verifyAdmin(authHeader: string | undefined): Promise<string> {
  const uid = await verifyAuth(authHeader);
  if (!ADMIN_UIDS.includes(uid)) {
    throw new Error("Forbidden: not an admin");
  }
  return uid;
}

// Helper: verify Firebase ID token from Authorization header
async function verifyAuth(authHeader: string | undefined): Promise<string> {
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }
  const idToken = authHeader.split("Bearer ")[1];
  const decoded = await getAuth().verifyIdToken(idToken);
  return decoded.uid;
}

// Helper: get Gemini client
function getGemini(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");
  return new GoogleGenAI({ apiKey });
}

/**
 * POST /generateWorkout
 * Body: { condition, goal, dayName, selectedSessionType? }
 * Auth: Firebase ID Token required
 */
export const generateWorkout = onRequest(
  { cors: true, secrets: ["GEMINI_API_KEY"] },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    try {
      await verifyAuth(req.headers.authorization);
    } catch {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { condition, goal, dayName, selectedSessionType, intensityContext } = req.body;

    if (!condition || !goal || !dayName) {
      res.status(400).json({ error: "Missing required fields: condition, goal, dayName" });
      return;
    }

    try {
      const ai = getGemini();

      const conditionMap: Record<string, string> = {
        upper_stiff: "상체가 굳어있음 (Upper Body Stiffness - Neck/Shoulder/Back tightness)",
        lower_heavy: "하체가 무거움 (Lower Body Heaviness - Hip/Hamstring tightness)",
        full_fatigue: "전반적 피로감 (General Fatigue - Needs Recovery Focus)",
        good: "컨디션 좋음 (Good Condition - Ready for High Intensity)",
      };

      const userConditionDesc = conditionMap[condition.bodyPart] || condition.bodyPart;
      const age = condition.birthYear ? new Date().getFullYear() - condition.birthYear : null;

      // === INTENSITY GUIDELINES (ACSM 2009 + NSCA) ===
      const isFemaleUser = condition.gender === "female";
      // Women can handle ~2 more reps at same %1RM due to estrogen anti-fatigue effect (Hunter 2014)
      // Women recover faster → shorter rest periods acceptable (Hakkinen et al. 1990)
      const intensityGuides: Record<string, string> = {
        strength: `HIGH INTENSITY SESSION (고강도 · 최대근력)
         - Load: 80-100% of 1RM
         - Reps: ${isFemaleUser ? "1-8" : "1-6"} per set
         - Sets: 3-5 per exercise
         - Rest: ${isFemaleUser ? "90sec-3min" : "2-5 min"} between sets
         - Focus: Compound lifts (Squat, Bench, Deadlift, OHP) with heavy loads`,
        muscle_gain: `MODERATE INTENSITY SESSION (중강도 · 근비대)
         - Load: 60-79% of 1RM
         - Reps: ${isFemaleUser ? "8-15" : "7-12"} per set
         - Sets: 3-4 per exercise
         - Rest: ${isFemaleUser ? "45-75 sec" : "60-90 sec"} between sets
         - Focus: Compound + isolation movements, time under tension`,
        fat_loss: `LOW INTENSITY SESSION (저강도 · 근지구력/체지방 연소)
         - Load: 40-60% of 1RM
         - Reps: ${isFemaleUser ? "15-25" : "15-20+"} per set
         - Sets: 2-3 per exercise
         - Rest: ${isFemaleUser ? "20-45 sec" : "30-60 sec"} between sets
         - Focus: Circuit-style, high rep compound movements, minimize rest`,
        general_fitness: `MODERATE-LOW INTENSITY (중-저강도 · 기초체력)
         - Load: Bodyweight or light dumbbells
         - Reps: ${isFemaleUser ? "12-18" : "10-15"} per exercise
         - Sets: 2-3 rounds per circuit
         - Rest: ${isFemaleUser ? "10-25 sec" : "15-30 sec"} between exercises, 60 sec between rounds
         - Focus: Full-body compound movements in circuit format`,
      };

      // Map session types to default intensity levels for conflict resolution
      const sessionTypeIntensity: Record<string, string> = {
        Strength: "high",
        Running: "moderate",
        Mobility: "low",
      };

      // Build intensity recommendation context if available
      let intensityRecContext = "";
      if (intensityContext) {
        const levelLabel = intensityContext.recommended === "high" ? "고강도" : intensityContext.recommended === "moderate" ? "중강도" : "저강도";
        // Detect session type ↔ intensity conflict
        const sessionDefault = selectedSessionType ? sessionTypeIntensity[selectedSessionType] : null;
        const hasConflict = sessionDefault && sessionDefault !== intensityContext.recommended;
        intensityRecContext = `
      === WEEKLY INTENSITY BALANCE (이번 주 강도 배분) ===
      이번 주 완료: 고강도 ${intensityContext.weekSummary.high}회, 중강도 ${intensityContext.weekSummary.moderate}회, 저강도 ${intensityContext.weekSummary.low}회
      주간 목표: 고강도 ${intensityContext.target.high}회, 중강도 ${intensityContext.target.moderate}회, 저강도 ${intensityContext.target.low}회
      추천 강도: ${levelLabel}
      이유: ${intensityContext.reason}

      IMPORTANT: 위 추천 강도를 반영하여 세트/반복수/무게를 조절하세요.
      예: 고강도 추천이면 ${isFemaleUser ? "1-8회" : "1-6회"} 고중량, 중강도 추천이면 ${isFemaleUser ? "8-15회" : "7-12회"} 중간 무게, 저강도 추천이면 ${isFemaleUser ? "15-25회" : "13회+"} 가벼운 무게.
      단, 유저가 선택한 Goal(${goal})의 기본 특성은 유지하되, 추천 강도에 맞게 볼륨을 조절하세요.
      ${hasConflict ? `
      ⚠ SESSION TYPE vs INTENSITY CONFLICT:
      유저가 "${selectedSessionType}" 세션(기본: ${sessionDefault})을 선택했지만 주간 배분 기준 ${levelLabel} 추천입니다.
      → 세션 타입(${selectedSessionType})의 운동 구성은 유지하되, 세트/반복수/무게를 ${levelLabel} 수준으로 조절하세요.
      예: Strength 세션이지만 저강도 추천이면 → 복합 운동 구성 유지 + 경량 고반복(${isFemaleUser ? "15-25회" : "15회+"})으로 전환.` : ""}`;
      }

      // Age-specific adjustments
      let ageContext = "";
      if (age && age >= 50) {
        ageContext = `
      === AGE-SPECIFIC ADJUSTMENTS (${age}세) ===
      - 고강도 세션이라도 1RM의 90%를 넘지 않도록 (안전 우선)
      - 관절에 부담이 큰 동작은 대안으로 대체 (예: 바벨 스쿼트 → 고블릿 스쿼트)
      - 워밍업 시간을 충분히 (7-10분)
      - 급격한 무게 증가보다 점진적 과부하 강조`;
      } else if (age && age >= 40) {
        ageContext = `
      === AGE-SPECIFIC ADJUSTMENTS (${age}세) ===
      - 관절 친화적인 변형 동작 우선 고려
      - 워밍업 세트를 1-2세트 추가 권장`;
      }

      // Condition → intensity override
      let conditionOverride = "";
      if (condition.bodyPart === "full_fatigue") {
        conditionOverride = `
      === CONDITION OVERRIDE ===
      유저가 "전반적 피로감"을 보고했습니다. 강도 추천과 관계없이:
      - 고강도 운동은 피하고 중-저강도로 조절하세요
      - 가동성/회복 운동 비중을 높이세요
      - 무게를 평소보다 10-20% 낮추세요`;
      }

      const prompt = `
      You are an elite Strength & Conditioning Coach certified by ACSM, NASM, and NSCA.
      Create a highly professional 50-minute workout master plan for today (${dayName}).

      ===== #1 RULE (최우선 원칙) =====
      유저가 선택한 Goal과 강도를 반드시 최우선으로 반영하세요.
      - Goal이 "STRENGTH"이면 반드시 고중량·저반복(1-6회) 위주의 고강도 플랜을 생성하세요.
      - Goal이 "MUSCLE_GAIN"이면 반드시 중량·중반복(7-12회) 위주의 중강도 플랜을 생성하세요.
      - Goal이 "FAT_LOSS"이면 반드시 경량·고반복(13회+) 위주의 저강도 플랜을 생성하세요.
      - 히스토리 기반 추천, 컨디션, 주간 배분 등은 참고사항일 뿐, 유저의 Goal 선택을 절대 뒤집지 마세요.
      ${intensityContext ? `- 유저가 선택한 강도: ${intensityContext.recommended === "high" ? "고강도" : intensityContext.recommended === "moderate" ? "중강도" : "저강도"} — 이 강도에 맞는 세트/반복수/무게를 적용하세요.` : ""}
      ===============================

      User Profile:
      - Goal: ${goal === "general_fitness" ? "GENERAL FITNESS (기초체력향상 - 맨몸/가벼운 도구 풀바디 서킷)" : (goal as string).replace("_", " ").toUpperCase()}
      - Condition: ${userConditionDesc}
      - Available Time: 50 minutes (Fixed)
      ${condition.gender ? `- Gender: ${condition.gender === "male" ? "남성 (Male)" : "여성 (Female)"}` : ""}
      ${age ? `- Age: ${age}세` : ""}
      ${condition.bodyWeightKg ? `- Body Weight: ${condition.bodyWeightKg}kg` : ""}

      === INTENSITY GUIDELINES (ACSM 2009 Position Stand + NSCA Essentials) ===
      ${intensityGuides[goal] || intensityGuides["muscle_gain"]}
      ${intensityRecContext}
      ${ageContext}
      ${conditionOverride}

      ${condition.bodyWeightKg ? (() => {
        const bw = condition.bodyWeightKg;
        const isFemale = condition.gender === "female";
        // 여성은 상체 근력이 남성 대비 ~60%, 하체는 ~80% 수준 (NSCA 성별 보정)
        const upperMult = isFemale ? 0.6 : 1.0;
        const lowerMult = isFemale ? 0.8 : 1.0;
        return `
      === WEIGHT PRESCRIPTION (${isFemale ? "여성" : "남성"} · 체중 ${bw}kg) ===
      구체적 무게를 "weight" 필드에 넣으세요. "적당한 무게" 같은 모호한 표현 금지.

      상체 운동 (벤치프레스, 숄더프레스, 로우 등):
      - 고강도: 체중의 ${(0.8 * upperMult).toFixed(1)}-${(1.2 * upperMult).toFixed(1)}배 (${Math.round(bw * 0.8 * upperMult)}-${Math.round(bw * 1.2 * upperMult)}kg)
      - 중강도: 체중의 ${(0.5 * upperMult).toFixed(1)}-${(0.8 * upperMult).toFixed(1)}배 (${Math.round(bw * 0.5 * upperMult)}-${Math.round(bw * 0.8 * upperMult)}kg)
      - 저강도: 체중의 ${(0.3 * upperMult).toFixed(1)}-${(0.5 * upperMult).toFixed(1)}배 (${Math.round(bw * 0.3 * upperMult)}-${Math.round(bw * 0.5 * upperMult)}kg)

      하체 운동 (스쿼트, 데드리프트, 레그프레스 등):
      - 고강도: 체중의 ${(0.8 * lowerMult).toFixed(1)}-${(1.5 * lowerMult).toFixed(1)}배 (${Math.round(bw * 0.8 * lowerMult)}-${Math.round(bw * 1.5 * lowerMult)}kg)
      - 중강도: 체중의 ${(0.5 * lowerMult).toFixed(1)}-${(0.8 * lowerMult).toFixed(1)}배 (${Math.round(bw * 0.5 * lowerMult)}-${Math.round(bw * 0.8 * lowerMult)}kg)
      - 저강도: 체중의 ${(0.3 * lowerMult).toFixed(1)}-${(0.5 * lowerMult).toFixed(1)}배 (${Math.round(bw * 0.3 * lowerMult)}-${Math.round(bw * 0.5 * lowerMult)}kg)

      보조/고립 운동: 주요 운동의 50-70% 수준`;
      })() : ""}

      TODAY SESSION TYPE (FINAL DECISION): ${selectedSessionType || "Recommended based on schedule"}
      ${selectedSessionType ? `
      CRITICAL INSTRUCTION:
      The user explicitly selected "${selectedSessionType}".
      YOU MUST GENERATE A "${selectedSessionType}" WORKOUT regardless of the day of the week (${dayName}).
      DO NOT CHANGE THE WORKOUT TYPE based on the weekly schedule.
      ` : goal === "general_fitness" ? `
      GENERAL FITNESS SCHEDULE (기초체력향상):
      - Mon: Full Body Strength Circuit | Tue: HIIT Cardio | Wed: Lower + Core | Thu: Upper + Cardio | Fri: Full Body + Mobility | Sat-Sun: Rest/Light
      IMPORTANT: This goal uses bodyweight + light dumbbell circuit format.
      ` : `
      Determine the workout type based on the weekly schedule:
      - Mon: Push | Tue: Speed Run | Wed: Pull | Thu: Easy Run | Fri: Legs | Sat: LSD Run | Sun: Mobility
      `}

      Workout Structure (50 min total):
      1. Warm-up (5 min):
         - CRITICAL: Apply NASM/ACSM Corrective Exercise guidelines.
         - IF Condition is "Good": Focus on dynamic activation for high performance.
         - IF Condition is "Stiff/Heavy/Fatigue": Select specific drills to alleviate the specific issue mentioned in Condition.
         - Equipment: Bodyweight, Bands, or Light Kettlebell.
      2. Main Workout (40 min):
         - MUST FOLLOW the intensity guidelines above (sets, reps, rest, load).
         - If Session Type is "Strength" (Push/Pull/Legs/Full Body): 5-6 compound & isolation movements.
         - If Session Type is "Running" (Easy/Speed/LSD): Structured run + pre-run activation.
         - If Session Type is "Mobility": Full body flow, yoga, or deep tissue work.
         - EQUIPMENT USAGE: Incorporate Barbell, Dumbbell, Kettlebell, and Cables/Machines.
      3. Core (5 min): Pick 2-3 exercises. Prioritize dynamic core (Crunch, Bicycle Crunch, Russian Twist, Leg Raise, Ab Wheel, Deadbug, Flutter Kick). Max 1 static plank variation.
      4. Additional Cardio:
         - If Main Workout was Strength: Recommend 15-20 min Running.
         - If Main Workout was Running: Recommend Mobility or Cooldown.

      CRITICAL LANGUAGE & FORMAT RULES:
      1. RESPONSE MUST BE IN KOREAN (한국어).
      2. Exercise names MUST be in "한글 (English)" format (e.g., "벤치 프레스 (Bench Press)").
      3. "title" MUST be exactly "마스터 플랜".
      4. "description" MUST follow this format: "${dayName}: [Workout Theme] - [Focus Area]"

      Format the response STRICTLY as a JSON object:
      {
        "title": "마스터 플랜",
        "description": "${dayName}: Hypertrophy Pull - Fatigue Focus",
        "exercises": [
          { "type": "warmup", "name": "흉추 가동성 드릴 (Thoracic Openers)", "count": "5분", "sets": 1, "reps": 1 },
          { "type": "strength", "name": "바벨 로우 (Barbell Row)", "count": "4세트 / 8회", "sets": 4, "reps": 8, "weight": "50kg" },
          { "type": "core", "name": "데드버그 (Deadbug)", "count": "3세트 / 12회", "sets": 3, "reps": 12 },
          { "type": "cardio", "name": "추가 유산소: 인터벌 러닝", "count": "20분", "sets": 1, "reps": 1 }
        ]
      }
    `;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          thinkingConfig: { thinkingBudget: 0 },
        },
      });

      const text = response.text;
      if (!text) throw new Error("Gemini returned an empty response.");

      const cleanText = text.replace(/```json/gi, "").replace(/```/g, "").trim();
      const workoutPlan = JSON.parse(cleanText);

      res.status(200).json(workoutPlan);
    } catch (error) {
      console.error("generateWorkout error:", error);
      res.status(500).json({ error: "Failed to generate workout plan" });
    }
  }
);

/**
 * POST /analyzeWorkout
 * Body: { sessionData, logs, bodyWeightKg?, gender?, birthYear?, historyStats? }
 * Auth: Firebase ID Token required
 */
export const analyzeWorkout = onRequest(
  { cors: true, secrets: ["GEMINI_API_KEY"] },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    try {
      await verifyAuth(req.headers.authorization);
    } catch {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { sessionData, logs, bodyWeightKg, gender, birthYear, historyStats, historyTrend, metrics, intensityContext } = req.body;

    if (!sessionData || !logs) {
      res.status(400).json({ error: "Missing required fields: sessionData, logs" });
      return;
    }

    try {
      const ai = getGemini();

      const logSummary = sessionData.exercises.map((ex: { type: string; name: string; count: string; sets: number; reps: number; weight?: string }, idx: number) => {
        const exLogs = logs[idx];
        if (!exLogs || exLogs.length === 0) {
          if (ex.type === "cardio" || ex.type === "mobility" || ex.type === "warmup") {
            return `Exercise: ${ex.name} [${ex.type}]\nPlanned: ${ex.count} (${ex.sets}세트)`;
          }
          return null;
        }
        if (ex.type === "strength" || ex.type === "core") {
          const logDetails = exLogs.map((l: { setNumber: number; repsCompleted: number; weightUsed?: string; feedback: string }) =>
            `Set ${l.setNumber}: ${l.repsCompleted} reps × ${l.weightUsed || "Bodyweight"} - ${l.feedback}`
          ).join(", ");
          return `Exercise: ${ex.name} [${ex.type}]\nTarget: ${ex.sets}×${ex.reps} (${ex.weight || "BW"})\nLogs: ${logDetails}`;
        } else {
          const completed = exLogs.filter((l: { feedback: string }) => l.feedback !== "fail").length;
          return `Exercise: ${ex.name} [${ex.type}]\nPlanned: ${ex.count} (${ex.sets}세트)\nCompleted: ${completed}/${exLogs.length} sets`;
        }
      }).filter(Boolean).join("\n\n");

      // metrics is computed client-side and passed in
      const age = birthYear ? new Date().getFullYear() - birthYear : null;
      const isStrength = metrics?.sessionCategory === "strength" || metrics?.sessionCategory === "mixed";

      const metricsContext = metrics ? [
        `세션 타입: ${metrics.sessionCategory === "cardio" ? "유산소" : metrics.sessionCategory === "mobility" ? "가동성/회복" : metrics.sessionCategory === "mixed" ? "혼합(근력+유산소)" : "근력"}`,
        isStrength ? `총 볼륨: ${metrics.totalVolume?.toLocaleString()}kg` : null,
        `총 세트/항목: ${metrics.totalSets}`,
        isStrength ? `총 렙수: ${metrics.totalReps}회` : null,
        metrics.totalDurationSec > 0 ? `총 운동 시간: ${Math.floor(metrics.totalDurationSec / 60)}분` : null,
        `완료율: ${metrics.successRate}% (${Math.round(metrics.totalSets * metrics.successRate / 100)}/${metrics.totalSets})`,
        isStrength && metrics.bestE1RM ? `최고 추정 1RM: ${Math.round(metrics.bestE1RM.value)}kg (${metrics.bestE1RM.exerciseName})` : null,
        isStrength && metrics.bwRatio !== null && bodyWeightKg ? `체중배수(BW Ratio): ${metrics.bwRatio.toFixed(2)}x (체중 ${bodyWeightKg}kg 기준)` : null,
        metrics.fatigueDrop !== null ? `후반 피로 신호: ${metrics.fatigueDrop > 0 ? '+' : ''}${metrics.fatigueDrop}% (후반부 reps 변화)` : null,
        isStrength && metrics.loadScore ? `세션 부하 점수: ${metrics.loadScore}` : null,
        gender ? `성별: ${gender === "male" ? "남성" : "여성"}` : null,
        age ? `나이: ${age}세` : null,
        isStrength && historyStats && historyStats.sessionCount > 0 ? `최근 90일 평균 볼륨: ${Math.round(historyStats.avgVolume28d).toLocaleString()}kg (${historyStats.sessionCount}회 세션)` : null,
      ].filter(Boolean).join("\n      ") : "";

      const loadRatioContext = historyStats && historyStats.avgVolume28d > 0 && metrics
        ? `오늘 부하 비율(오늘볼륨/90일평균): ${(metrics.totalVolume / historyStats.avgVolume28d).toFixed(2)}`
        : "";

      // Build intensity context for AI analysis
      let intensityAnalysisContext = "";
      if (intensityContext) {
        const levelLabels: Record<string, string> = { high: "고강도", moderate: "중강도", low: "저강도" };
        intensityAnalysisContext = `
      === 세션 강도 분류 (ACSM 기준) ===
      오늘 세션 강도: ${levelLabels[intensityContext.sessionIntensity?.level] || "미분류"}${intensityContext.sessionIntensity?.avgPercentile1RM ? ` (평균 ${intensityContext.sessionIntensity.avgPercentile1RM}% 1RM)` : ` (평균 ${intensityContext.sessionIntensity?.avgRepsPerSet || 0}회)`}
      이번 주 완료: 고강도 ${intensityContext.weekSummary?.high || 0}회, 중강도 ${intensityContext.weekSummary?.moderate || 0}회, 저강도 ${intensityContext.weekSummary?.low || 0}회
      주간 목표: 고 ${intensityContext.target?.high || 0} · 중 ${intensityContext.target?.moderate || 0} · 저 ${intensityContext.target?.low || 0}
      다음 추천: ${levelLabels[intensityContext.nextRecommended] || "미정"}`;
      }

      // Build history trend context for AI
      let trendContext = "";
      if (historyTrend && historyTrend.sessionCount >= 2) {
        const sessionsStr = historyTrend.sessions.map((s: { date: string; totalVolume: number; bestE1RM: number | null; loadScore: number; exerciseNames: string[] }) =>
          `${s.date}: 볼륨 ${s.totalVolume.toLocaleString()}kg, e1RM ${s.bestE1RM ? Math.round(s.bestE1RM) + "kg" : "-"}, 부하 ${s.loadScore}`
        ).join("\n      ");
        trendContext = `
      === 최근 ${historyTrend.sessionCount}세션 추이 (최대 10세션, 3개월 이내) ===
      ${sessionsStr}
      볼륨 변화: ${historyTrend.trends.volumeChange || "데이터 부족"}
      1RM 변화: ${historyTrend.trends.e1rmChange || "데이터 부족"}
      평균 부하 점수: ${historyTrend.trends.avgLoadScore}
      3개월 총 세션: ${historyTrend.trends.totalSessions90d}회`;
      }

      const prompt = `
      You are an expert Strength & Conditioning Coach.
      Analyze the completed workout session${historyTrend && historyTrend.sessionCount >= 2 ? " with trend data from recent sessions" : ""}.

      Workout Logs:
      ${logSummary}

      Session Metrics:
      ${metricsContext}
      ${isStrength ? loadRatioContext : ""}
      ${trendContext}
      ${intensityAnalysisContext}

      CRITICAL: Output in KOREAN (한국어).

      === WRITING STYLE ===
      MOST IMPORTANT: 초등학생도 이해할 수 있는 쉬운 말로 써야 합니다.
      - "체중 대비 1.18배" 같은 표현 금지. 대신 "내 몸무게보다 1.18배 무거운 걸 들어올렸어요" 처럼 풀어서 설명.
      - "타깃 적중률 96%" 같은 표현 금지. 대신 "목표한 횟수를 거의 다 채웠어요 (25개 중 24개 성공)" 처럼.
      - 친근하고 코칭하는 톤. 존댓말 사용.
      - 구체적 숫자(kg, 횟수, %)를 포함해서 말하세요.

      === INTENSITY CONTEXT (강도 판단 기준) ===
      ${intensityContext ? `
      오늘 세션 강도: ${intensityContext.sessionIntensity?.level === "high" ? "고강도" : intensityContext.sessionIntensity?.level === "moderate" ? "중강도" : "저강도"}
      이번 주 완료: 고강도 ${intensityContext.weekSummary?.high || 0}회, 중강도 ${intensityContext.weekSummary?.moderate || 0}회, 저강도 ${intensityContext.weekSummary?.low || 0}회
      주간 목표: 고 ${intensityContext.target?.high || 0} · 중 ${intensityContext.target?.moderate || 0} · 저 ${intensityContext.target?.low || 0}
      다음 추천: ${intensityContext.nextRecommended === "high" ? "고강도" : intensityContext.nextRecommended === "moderate" ? "중강도" : "저강도"}

      CRITICAL RULE:
      - 볼륨/1RM이 이전보다 낮더라도, 오늘 세션 강도가 의도적으로 낮은 것이라면 정상이며 긍정적으로 평가하세요.
      - 고강도 세션인데 볼륨이 낮으면 그때만 문제로 지적하세요.
      - "이전보다 줄었다"가 아니라 "주간 배분 계획에 맞게 진행되고 있는지"를 기준으로 판단하세요.
      - 같은 강도 수준의 세션끼리만 비교하세요 (고강도↔고강도, 저강도↔저강도).
      ` : "강도 컨텍스트 없음 — 일반 분석 수행."}

      ${isStrength ? `
      분석 기준 (근력 세션):
      - 저강도 세션은 볼륨이 낮아도 정상 — 회복, 근지구력, 테크닉 향상 관점으로 평가
      - 고강도 세션에서 볼륨 증가 중이면 성장기, 감소 중이면 디로드 필요 여부 판단
      - 1RM 추이: 상승이면 근력 발달 중, 정체면 프로그램 변경 제안
      - 부하 비율 >1.3이 연속이면 과훈련 주의
      ${metrics?.bwRatio !== null ? `
      참고 - BW Ratio (${gender === "female" ? "여성" : "남성"}):
      ${gender === "female"
        ? "- <0.5x 초급, 0.5-0.8x 중급, >0.8x 상급"
        : "- <0.8x 초급, 0.8-1.2x 중급, >1.2x 상급"
      }` : ""}
      ` : `
      분석 기준 (${metrics?.sessionCategory === "cardio" ? "유산소" : "가동성/회복"} 세션):
      - 모든 항목 완료: 잘 한 세션
      - 일부 미완료: 체력에 맞게 조절 필요
      `}

      === OUTPUT FORMAT (strict JSON) ===

      반드시 아래 구조로 반환하세요. briefing은 구조화된 객체입니다.

      {
        "briefing": {
          "headline": "친근한 칭찬 한 줄 (15자 이내, 예: '오늘도 멋지게 해냈어요!', '꾸준함이 빛나는 날!')",
          "weekProgress": "이번 주 운동 현황을 쉽게 (예: '이번 주 3번째 운동! 목표까지 2번 남았어요')",
          "insight": "운동 초보도 이해하는 쉬운 피드백 한 줄 — 전문용어(볼륨,1RM,부하) 절대 금지, 느낌과 성장 중심 (50자 이내)",
          "action": "다음에 할 일 쉽게 한 줄 (예: '다음엔 스쿼트 무게를 살짝 올려봐요!')"
        },
        "nextSessionAdvice": "다음 세션: 고강도 추천\\n벤치 프레스: +2.5kg 증가 요망\\n숄더 프레스: 유지"
      }

      === BRIEFING RULES ===
      - headline, weekProgress, insight, action 각각 한 줄씩, 짧고 따뜻하게.
      - 전문 용어 절대 금지 (볼륨, 1RM, 부하, %1RM, 부하비율 등 사용하지 마세요).
      - 초등학생이 읽어도 기분 좋아지는 말투. 존댓말 + 친근한 톤.
      - 숫자는 무게(kg), 횟수, 시간만 허용. 비율이나 지수 금지.
      ${historyTrend && historyTrend.sessionCount >= 2 ? `
      - insight에서 이전 세션과 비교할 때 반드시 같은 강도끼리 비교하세요.
      - 강도가 달라서 볼륨이 다른 건 당연한 거라 언급하지 마세요.
      ` : `
      - 첫 세션이거나 데이터 부족 시 insight는 오늘 세션 자체만 평가하세요.
      `}

      === NEXT SESSION ADVICE ===
      첫 줄: 다음 세션 전체 강도 추천
      ${intensityContext ? `"다음 세션: ${intensityContext.nextRecommended === "high" ? "고강도 (80%+ 1RM, 1-6회)" : intensityContext.nextRecommended === "moderate" ? "중강도 (60-79% 1RM, 7-12회)" : "저강도 (60% 미만 1RM, 13회+)"} 추천"` : '"다음 세션 강도는 이번 주 배분에 맞게 조절해보세요"'}
      이후 운동별로 "운동이름: 판정" 형식으로 한 줄씩.
      ${isStrength ? `
      판정 3가지 중 하나만:
      - "유지" → 적중률 보통
      - "증가 요망" → 쉬웠던 운동 (구체적 무게 포함)
      - "감소 요망" → 실패 많았던 운동 (구체적 무게 포함)
      ` : `
      판정 중 하나만:
      - "유지" → 잘 수행한 운동
      - "+시간 증가 요망" → 늘릴 수 있는 운동
      - "감소 요망" → 힘들었던 운동
      `}

      IMPORTANT: briefing(객체)과 nextSessionAdvice(문자열)만 반환하세요.
      ${!isStrength ? "무게, 볼륨, e1RM, 부하 비율 등 근력 관련 수치를 언급하지 마세요." : ""}
    `;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          thinkingConfig: { thinkingBudget: 0 },
        },
      });

      const text = response.text;
      if (!text) throw new Error("Gemini returned an empty response.");

      const cleanText = text.replace(/```json/gi, "").replace(/```/g, "").trim();
      const analysis = JSON.parse(cleanText);

      res.status(200).json(analysis);
    } catch (error) {
      console.error("analyzeWorkout error:", error);
      res.status(500).json({ error: "Failed to analyze workout" });
    }
  }
);

// ============================================
// Subscription / Billing Functions
// ============================================

const PORTONE_API_BASE = "https://api.portone.io";
const SUBSCRIPTION_AMOUNT = 6900;

function getPortOneSecret(): string {
  const secret = process.env.PORTONE_API_SECRET;
  if (!secret) throw new Error("PORTONE_API_SECRET not configured");
  return secret;
}

/**
 * POST /subscribe
 * Body: { billingKey }
 * Saves billing key, processes first payment, sets subscription active
 */
export const subscribe = onRequest(
  { cors: true, secrets: ["PORTONE_API_SECRET"] },
  async (req, res) => {
    if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

    let uid: string;
    try { uid = await verifyAuth(req.headers.authorization); } catch { res.status(401).json({ error: "Unauthorized" }); return; }

    const { billingKey } = req.body;
    if (!billingKey) { res.status(400).json({ error: "Missing billingKey" }); return; }

    try {
      const secret = getPortOneSecret();
      const paymentId = `sub_${uid}_${Date.now()}`;

      // 1. Process first payment with billing key
      const payRes = await fetch(`${PORTONE_API_BASE}/payments/${paymentId}/billing-key`, {
        method: "POST",
        headers: {
          "Authorization": `PortOne ${secret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          billingKey,
          orderName: "오운잘 AI 월간 구독",
          amount: { total: SUBSCRIPTION_AMOUNT },
          currency: "KRW",
        }),
      });

      if (!payRes.ok) {
        const err = await payRes.json().catch(() => ({}));
        console.error("PortOne payment failed:", err);
        throw new Error("결제 처리에 실패했습니다.");
      }

      // 2. Save subscription to Firestore
      const now = new Date();
      const expiresAt = new Date(now);
      expiresAt.setMonth(expiresAt.getMonth() + 1);

      const subRef = db.collection("subscriptions").doc(uid);
      const existingDoc = await subRef.get();

      if (existingDoc.exists) {
        // Re-subscribing: update existing doc, keep original createdAt
        await subRef.update({
          billingKey,
          status: "active",
          plan: "monthly",
          amount: SUBSCRIPTION_AMOUNT,
          lastPaymentId: paymentId,
          lastPaymentAt: now.toISOString(),
          expiresAt: expiresAt.toISOString(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      } else {
        await subRef.set({
          uid,
          billingKey,
          status: "active",
          plan: "monthly",
          amount: SUBSCRIPTION_AMOUNT,
          lastPaymentId: paymentId,
          lastPaymentAt: now.toISOString(),
          expiresAt: expiresAt.toISOString(),
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      // 3. Save payment record to history subcollection
      await subRef.collection("payments").doc(paymentId).set({
        paymentId,
        amount: SUBSCRIPTION_AMOUNT,
        plan: "monthly",
        status: "paid",
        paidAt: now.toISOString(),
        periodStart: now.toISOString(),
        periodEnd: expiresAt.toISOString(),
        createdAt: FieldValue.serverTimestamp(),
      });

      res.status(200).json({
        status: "active",
        expiresAt: expiresAt.toISOString(),
      });
    } catch (error) {
      console.error("subscribe error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "구독 처리에 실패했습니다." });
    }
  }
);

/**
 * POST /getSubscription
 * Returns current subscription status
 */
export const getSubscription = onRequest(
  { cors: true },
  async (req, res) => {
    if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

    let uid: string;
    try { uid = await verifyAuth(req.headers.authorization); } catch { res.status(401).json({ error: "Unauthorized" }); return; }

    try {
      const doc = await db.collection("subscriptions").doc(uid).get();

      if (!doc.exists) {
        res.status(200).json({ status: "free" });
        return;
      }

      const data = doc.data()!;

      // Check if expired
      if (data.status === "active" && data.expiresAt) {
        const expires = new Date(data.expiresAt);
        if (expires < new Date()) {
          await db.collection("subscriptions").doc(uid).update({
            status: "expired",
            updatedAt: FieldValue.serverTimestamp(),
          });
          res.status(200).json({ status: "expired", expiresAt: data.expiresAt });
          return;
        }
      }

      // Fetch payment history
      const subRef = db.collection("subscriptions").doc(uid);
      const paymentsSnap = await subRef
        .collection("payments")
        .orderBy("createdAt", "desc")
        .limit(50)
        .get();

      // Auto-migrate: if subscription exists but no payment records, create one from existing data
      if (paymentsSnap.empty && data.lastPaymentId && data.lastPaymentAt) {
        const createdAtDate = data.createdAt?.toDate?.() || new Date(data.lastPaymentAt);
        await subRef.collection("payments").doc(data.lastPaymentId).set({
          paymentId: data.lastPaymentId,
          amount: data.amount || 9900,
          plan: data.plan || "monthly",
          status: "paid",
          paidAt: data.lastPaymentAt,
          periodStart: createdAtDate.toISOString(),
          periodEnd: data.expiresAt || "",
          createdAt: FieldValue.serverTimestamp(),
        });
        // Re-fetch after migration
        const reFetch = await subRef.collection("payments").orderBy("createdAt", "desc").limit(50).get();
        const migratedPayments = reFetch.docs.map((pDoc) => {
          const p = pDoc.data();
          return { paymentId: p.paymentId, amount: p.amount, plan: p.plan, status: p.status, paidAt: p.paidAt, periodStart: p.periodStart, periodEnd: p.periodEnd };
        });
        res.status(200).json({
          status: data.status,
          expiresAt: data.expiresAt || null,
          amount: data.amount || null,
          payments: migratedPayments,
        });
        return;
      }

      const payments = paymentsSnap.docs.map((pDoc) => {
        const p = pDoc.data();
        return {
          paymentId: p.paymentId,
          amount: p.amount,
          plan: p.plan,
          status: p.status,
          paidAt: p.paidAt,
          periodStart: p.periodStart,
          periodEnd: p.periodEnd,
        };
      });

      res.status(200).json({
        status: data.status,
        expiresAt: data.expiresAt || null,
        lastPaymentAt: data.lastPaymentAt || null,
        amount: data.amount || null,
        createdAt: data.createdAt?.toDate?.().toISOString() || data.createdAt || null,
        payments,
      });
    } catch (error) {
      console.error("getSubscription error:", error);
      res.status(500).json({ error: "구독 상태 확인에 실패했습니다." });
    }
  }
);

/**
 * POST /cancelSubscription
 * Cancels auto-renewal. Subscription remains active until expiresAt.
 */
export const cancelSubscription = onRequest(
  { cors: true },
  async (req, res) => {
    if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

    let uid: string;
    try { uid = await verifyAuth(req.headers.authorization); } catch { res.status(401).json({ error: "Unauthorized" }); return; }

    try {
      const doc = await db.collection("subscriptions").doc(uid).get();

      if (!doc.exists || doc.data()?.status !== "active") {
        res.status(400).json({ error: "활성 구독이 없습니다." });
        return;
      }

      await db.collection("subscriptions").doc(uid).update({
        status: "cancelled",
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Save cancel feedback
      const { reason } = req.body || {};
      if (reason) {
        await db.collection("cancel_feedbacks").add({
          uid,
          reason,
          cancelledAt: FieldValue.serverTimestamp(),
        });
      }

      res.status(200).json({
        status: "cancelled",
        expiresAt: doc.data()?.expiresAt || null,
      });
    } catch (error) {
      console.error("cancelSubscription error:", error);
      res.status(500).json({ error: "구독 취소에 실패했습니다." });
    }
  }
);

/**
 * POST /adminActivate
 * Body: { email, months? }
 * Admin only: 이메일로 유저 찾아서 구독 활성화
 */
export const adminActivate = onRequest(
  { cors: true },
  async (req, res) => {
    if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

    let adminUid: string;
    try { adminUid = await verifyAdmin(req.headers.authorization); } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unauthorized";
      res.status(msg.includes("Forbidden") ? 403 : 401).json({ error: msg });
      return;
    }

    const { email, months = 1 } = req.body;
    if (!email) { res.status(400).json({ error: "Missing email" }); return; }

    try {
      // 이메일로 유저 UID 조회
      const userRecord = await getAuth().getUserByEmail(email);
      const uid = userRecord.uid;

      // 구독 활성화
      const now = new Date();
      const expiresAt = new Date(now);
      expiresAt.setMonth(expiresAt.getMonth() + months);

      const subRef = db.collection("subscriptions").doc(uid);
      const existingDoc = await subRef.get();

      if (existingDoc.exists) {
        await subRef.update({
          status: "active",
          plan: "monthly",
          amount: 0,
          billingKey: "manual_admin",
          lastPaymentAt: now.toISOString(),
          expiresAt: expiresAt.toISOString(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      } else {
        await subRef.set({
          uid,
          status: "active",
          plan: "monthly",
          amount: 0,
          billingKey: "manual_admin",
          lastPaymentAt: now.toISOString(),
          expiresAt: expiresAt.toISOString(),
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      // 관리자 로그 기록
      await db.collection("admin_logs").add({
        action: "activate",
        adminUid,
        targetEmail: email,
        targetUid: uid,
        months,
        expiresAt: expiresAt.toISOString(),
        timestamp: FieldValue.serverTimestamp(),
      });

      res.status(200).json({
        status: "activated",
        email,
        uid,
        months,
        expiresAt: expiresAt.toISOString(),
      });
    } catch (error: unknown) {
      console.error("adminActivate error:", error);
      const msg = error instanceof Error && error.message.includes("no user record")
        ? "해당 이메일의 유저를 찾을 수 없습니다."
        : "구독 활성화에 실패했습니다.";
      res.status(error instanceof Error && error.message.includes("no user record") ? 404 : 500).json({ error: msg });
    }
  }
);

/**
 * POST /adminCheckUser
 * Body: { email }
 * Admin only: 유저 구독 상태 조회
 */
export const adminCheckUser = onRequest(
  { cors: true },
  async (req, res) => {
    if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

    try { await verifyAdmin(req.headers.authorization); } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unauthorized";
      res.status(msg.includes("Forbidden") ? 403 : 401).json({ error: msg });
      return;
    }

    const { email } = req.body;
    if (!email) { res.status(400).json({ error: "Missing email" }); return; }

    try {
      const userRecord = await getAuth().getUserByEmail(email);
      const uid = userRecord.uid;
      const doc = await db.collection("subscriptions").doc(uid).get();

      if (!doc.exists) {
        res.status(200).json({ email, uid, status: "free", displayName: userRecord.displayName || null });
        return;
      }

      const data = doc.data()!;
      res.status(200).json({
        email,
        uid,
        displayName: userRecord.displayName || null,
        status: data.status,
        plan: data.plan || null,
        expiresAt: data.expiresAt || null,
        lastPaymentAt: data.lastPaymentAt || null,
        amount: data.amount || null,
        billingKey: data.billingKey === "manual_admin" ? "수동 활성화" : "카카오페이",
      });
    } catch (error: unknown) {
      console.error("adminCheckUser error:", error);
      const msg = error instanceof Error && error.message.includes("no user record")
        ? "해당 이메일의 유저를 찾을 수 없습니다."
        : "조회에 실패했습니다.";
      res.status(error instanceof Error && error.message.includes("no user record") ? 404 : 500).json({ error: msg });
    }
  }
);

/**
 * POST /adminDeactivate
 * Body: { email }
 * Admin only: 유저 구독 비활성화 (free로 전환)
 */
export const adminDeactivate = onRequest(
  { cors: true },
  async (req, res) => {
    if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

    let adminUid: string;
    try { adminUid = await verifyAdmin(req.headers.authorization); } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unauthorized";
      res.status(msg.includes("Forbidden") ? 403 : 401).json({ error: msg });
      return;
    }

    const { email } = req.body;
    if (!email) { res.status(400).json({ error: "Missing email" }); return; }

    try {
      const userRecord = await getAuth().getUserByEmail(email);
      const uid = userRecord.uid;

      const subRef = db.collection("subscriptions").doc(uid);
      const doc = await subRef.get();

      if (!doc.exists || doc.data()?.status === "free") {
        res.status(400).json({ error: "이미 무료 상태입니다." });
        return;
      }

      await subRef.update({
        status: "free",
        billingKey: "",
        expiresAt: null,
        updatedAt: FieldValue.serverTimestamp(),
      });

      await db.collection("admin_logs").add({
        action: "deactivate",
        adminUid,
        targetEmail: email,
        targetUid: uid,
        timestamp: FieldValue.serverTimestamp(),
      });

      res.status(200).json({ status: "deactivated", email, uid });
    } catch (error: unknown) {
      console.error("adminDeactivate error:", error);
      const msg = error instanceof Error && error.message.includes("no user record")
        ? "해당 이메일의 유저를 찾을 수 없습니다."
        : "비활성화에 실패했습니다.";
      res.status(error instanceof Error && error.message.includes("no user record") ? 404 : 500).json({ error: msg });
    }
  }
);

/**
 * POST /adminDashboard
 * Admin only: 통계 대시보드 (총유저, 구독자, 무료, 만료임박, 매출)
 */
export const adminDashboard = onRequest(
  { cors: true },
  async (req, res) => {
    if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
    try { await verifyAdmin(req.headers.authorization); } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unauthorized";
      res.status(msg.includes("Forbidden") ? 403 : 401).json({ error: msg });
      return;
    }

    try {
      const subsSnap = await db.collection("subscriptions").get();
      let active = 0, free = 0, cancelled = 0, expired = 0, expiringIn3Days = 0, monthlyRevenue = 0;
      const now = new Date();
      const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      subsSnap.forEach(doc => {
        const d = doc.data();
        if (d.status === "active") {
          active++;
          if (d.expiresAt) {
            const exp = new Date(d.expiresAt);
            if (exp <= threeDaysLater && exp > now) expiringIn3Days++;
          }
          if (d.lastPaymentAt && new Date(d.lastPaymentAt) >= monthStart && d.amount > 0) {
            monthlyRevenue += d.amount;
          }
        } else if (d.status === "cancelled") { cancelled++; }
        else if (d.status === "expired") { expired++; }
        else { free++; }
      });

      // Total registered users from Firebase Auth
      const listResult = await getAuth().listUsers(1);
      const totalUsers = listResult.users.length > 0 ? (await getAuth().listUsers(1000)).users.length : 0;

      res.status(200).json({
        totalUsers,
        active,
        free: totalUsers - active - cancelled - expired,
        cancelled,
        expired,
        expiringIn3Days,
        monthlyRevenue,
      });
    } catch (error) {
      console.error("adminDashboard error:", error);
      res.status(500).json({ error: "대시보드 조회 실패" });
    }
  }
);

/**
 * POST /adminListUsers
 * Body: { status?, page?, limit? }
 * Admin only: 구독자 목록 (필터 + 페이지네이션)
 */
export const adminListUsers = onRequest(
  { cors: true },
  async (req, res) => {
    if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
    try { await verifyAdmin(req.headers.authorization); } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unauthorized";
      res.status(msg.includes("Forbidden") ? 403 : 401).json({ error: msg });
      return;
    }

    const { status, page = 1, limit = 20 } = req.body;

    try {
      let query: FirebaseFirestore.Query = db.collection("subscriptions").orderBy("updatedAt", "desc");
      if (status && status !== "all") {
        query = query.where("status", "==", status);
      }

      const allDocs = await query.get();
      const total = allDocs.size;
      const startIdx = (page - 1) * limit;
      const pageDocs = allDocs.docs.slice(startIdx, startIdx + limit);

      const users = await Promise.all(pageDocs.map(async (doc) => {
        const d = doc.data();
        let email = "", displayName = "";
        try {
          const userRecord = await getAuth().getUser(doc.id);
          email = userRecord.email || "";
          displayName = userRecord.displayName || "";
        } catch { email = doc.id; }

        return {
          uid: doc.id,
          email,
          displayName,
          status: d.status || "free",
          expiresAt: d.expiresAt || null,
          lastPaymentAt: d.lastPaymentAt || null,
          amount: d.amount || 0,
          billingKey: d.billingKey === "manual_admin" ? "수동" : d.billingKey ? "카카오페이" : "-",
        };
      }));

      res.status(200).json({ users, total, page, limit, totalPages: Math.ceil(total / limit) });
    } catch (error) {
      console.error("adminListUsers error:", error);
      res.status(500).json({ error: "유저 목록 조회 실패" });
    }
  }
);

/**
 * POST /adminLogs
 * Admin only: 최근 활성화 이력 조회
 */
export const adminLogs = onRequest(
  { cors: true },
  async (req, res) => {
    if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

    try { await verifyAdmin(req.headers.authorization); } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unauthorized";
      res.status(msg.includes("Forbidden") ? 403 : 401).json({ error: msg });
      return;
    }

    try {
      const snapshot = await db.collection("admin_logs")
        .orderBy("timestamp", "desc")
        .limit(20)
        .get();

      const logs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          action: data.action,
          targetEmail: data.targetEmail,
          months: data.months,
          expiresAt: data.expiresAt,
          timestamp: data.timestamp?.toDate?.().toISOString() || null,
        };
      });

      res.status(200).json({ logs });
    } catch (error) {
      console.error("adminLogs error:", error);
      res.status(500).json({ error: "이력 조회에 실패했습니다." });
    }
  }
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Coach Message — 코치 전우애 멘트 (서버사이드)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const getCoachMessage = onRequest(
  { cors: true, secrets: ["GEMINI_API_KEY"] },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    try {
      await verifyAuth(req.headers.authorization);
    } catch {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const {
      heroType,
      exerciseName,
      vars,
      locale,
      sessionLogs,
      condition,
      sessionDesc,
      streak,
    } = req.body as {
      heroType: string;
      exerciseName?: string;
      vars?: Record<string, string>;
      locale: string;
      sessionLogs?: { exerciseName: string; sets: { setNumber: number; reps: number; weight?: string; feedback: string }[] }[];
      condition?: { bodyPart: string; energyLevel: number };
      sessionDesc?: string;
      streak?: number;
    };

    if (!heroType) {
      res.status(400).json({ error: "Missing heroType" });
      return;
    }

    const isKo = locale !== "en";

    // ── 세션 데이터 분석 (Gemini + 폴백 공용) ──
    const mainExName = exerciseName?.split("(")[0].trim() || "";
    const conditionLabel = condition
      ? (condition.bodyPart === "upper_stiff" ? (isKo ? "상체 뻣뻣" : "upper stiffness")
        : condition.bodyPart === "lower_heavy" ? (isKo ? "하체 무거움" : "lower heaviness")
        : condition.bodyPart === "full_fatigue" ? (isKo ? "전신 피로" : "full fatigue")
        : (isKo ? "좋음" : "good"))
      : "";

    // 로그에서 실패/성공/무게/렙수 패턴 감지
    const logAnalysis = (() => {
      const base = { failRecovery: null as null | { exercise: string; failSet: number; recoverySet: number | null }, allEasy: false, allTarget: false, mainExercise: mainExName, weightIncrease: null as null | { exercise: string; from: string; to: string }, bestReps: null as null | { exercise: string; reps: number; weight: string }, totalSets: 0, exerciseCount: 0 };
      if (!sessionLogs || sessionLogs.length === 0) return base;

      base.exerciseCount = sessionLogs.length;
      base.totalSets = sessionLogs.reduce((sum, ex) => sum + ex.sets.length, 0);

      // 실패 후 회복 감지
      for (const ex of sessionLogs) {
        const failIdx = ex.sets.findIndex(s => s.feedback === "fail");
        if (failIdx >= 0) {
          const recoveryIdx = ex.sets.findIndex((s, i) => i > failIdx && s.feedback !== "fail");
          base.failRecovery = { exercise: ex.exerciseName, failSet: failIdx + 1, recoverySet: recoveryIdx >= 0 ? recoveryIdx + 1 : null };
          break;
        }
      }

      // 무게 증가 감지 (같은 운동 내 세트 간)
      if (!base.failRecovery) {
        for (const ex of sessionLogs) {
          const weights = ex.sets.map(s => parseFloat(s.weight || "0")).filter(w => w > 0);
          if (weights.length >= 2 && weights[weights.length - 1] > weights[0]) {
            base.weightIncrease = { exercise: ex.exerciseName, from: String(weights[0]), to: String(weights[weights.length - 1]) };
            break;
          }
        }
      }

      // 최다 렙수 감지
      if (!base.failRecovery && !base.weightIncrease) {
        let bestReps = 0;
        let bestEx = "";
        let bestWeight = "";
        for (const ex of sessionLogs) {
          for (const s of ex.sets) {
            if (s.reps > bestReps) {
              bestReps = s.reps;
              bestEx = ex.exerciseName;
              bestWeight = s.weight || "";
            }
          }
        }
        if (bestReps > 0) base.bestReps = { exercise: bestEx, reps: bestReps, weight: bestWeight };
      }

      const allSets = sessionLogs.flatMap(ex => ex.sets);
      base.allEasy = allSets.length > 0 && allSets.every(s => s.feedback === "easy" || s.feedback === "too_easy");
      base.allTarget = allSets.length > 0 && allSets.every(s => s.feedback === "target");
      return base;
    })();

    // ── 룰베이스 폴백 생성 (Gemini 실패 시 사용) ──
    function buildFallbackMessages(): string[] {
      const name = logAnalysis.mainExercise || (isKo ? "운동" : "workout");
      const desc = sessionDesc || "";

      // 1번째 버블: 감정 공감 (heroType별 분기)
      let bubble1Options: string[];
      if (heroType === "weightPR" && vars?.weight) {
        bubble1Options = isKo ? [
          `오늘 ${name} ${vars.weight}kg 올릴 때 진짜 조마조마했는데, 해내는 거 보고 소름 돋았어요!`,
          `아 ${name} ${vars.weight}kg 성공하는 순간 저도 심장이 쿵 했어요! 같이 해서 뿌듯하네요!`,
          `${name} ${vars.weight}kg 도전할 때 긴장했는데, 올리는 거 보고 진짜 감동이었어요!`,
          `오늘 ${name} ${vars.prev || ""}kg에서 ${vars.weight}kg으로 올린 거 장난 아니에요! 같이 달려온 보람이 있네요!`,
        ] : [
          `Watching you go for ${vars.weight}kg on ${name} was nerve-wracking but you did it! Amazing!`,
          `My heart jumped when you hit ${vars.weight}kg on ${name}! So proud we did this together!`,
          `${name} at ${vars.weight}kg was intense but you nailed it! That was incredible!`,
        ];
      } else if (heroType === "repsPR" && vars?.current) {
        bubble1Options = isKo ? [
          `오늘 ${name} 마지막 몇 개 버틸 때 저도 같이 이 악물었어요! ${vars.current}회까지 가는 거 진짜 대단해요!`,
          `${name}에서 ${vars.prev || ""}회에서 ${vars.current}회까지 간 거 봤어요! 같은 무게에서 더 가는 건 진짜 근성이에요!`,
          `아 ${name} 렙수 올라가는 거 보면서 뿌듯했어요! ${vars.current}회 찍는 순간 소름이었어요!`,
        ] : [
          `Those last reps on ${name} were insane! Getting to ${vars.current} reps is seriously impressive!`,
          `Going from ${vars.prev || ""} to ${vars.current} reps on ${name}! That grit is amazing!`,
        ];
      } else if (heroType === "perfect") {
        bubble1Options = isKo ? [
          `오늘 한 세트도 안 무너지고 끝까지 갔네요! 옆에서 보면서 '진짜 되나?' 했는데 해냈잖아요!`,
          `오늘 ${name} 포함해서 전 세트 깔끔하게 끝낸 거 진짜 대단해요! 저도 감동이었어요!`,
          `처음부터 끝까지 흐트러짐이 없었어요! 같이 하면서 저도 집중했어요!`,
        ] : [
          `Not a single set broke down today! I kept thinking 'is this real?' and you did it!`,
          `Every set clean including ${name}! I was genuinely moved watching you!`,
        ];
      } else if (heroType === "running") {
        bubble1Options = isKo ? [
          `오늘 끝까지 달린 거 진짜 대단해요! 중간에 멈추고 싶었을 텐데 안 멈췄잖아요!`,
          `달리는 거 보면서 저도 같이 숨이 차더라고요! 끝까지 페이스 유지한 거 소름이에요!`,
          `오늘 러닝 진짜 잘했어요! 옆에서 보면서 '체력 확실히 올라왔다' 느꼈어요!`,
        ] : [
          `You kept running till the end! Must've wanted to stop but you didn't!`,
          `Watching you run I was getting out of breath too! Keeping that pace was incredible!`,
        ];
      } else if (heroType === "first") {
        bubble1Options = isKo ? [
          `첫 운동 같이 해서 진짜 기뻐요! 오늘 오기까지가 제일 힘들었을 텐데, 해냈잖아요!`,
          `와 드디어 시작했네요! 첫 발 같이 뗐다는 게 저도 설레요!`,
        ] : [
          `So happy we did your first workout together! Getting here was the hardest part and you did it!`,
          `You finally started! Taking the first step together feels amazing!`,
        ];
      } else {
        bubble1Options = isKo ? [
          `오늘 ${name} 하는 거 옆에서 보면서 진짜 조마조마했는데, 끝까지 해내는 거 보고 소름 돋았어요!`,
          `오늘 ${name} 진짜 잘했어요! 옆에서 보면서 저도 뿌듯했어요!`,
          `${name} 할 때 집중하는 거 다 봤어요! 진짜 대단해요!`,
          `오늘도 빠지지 않고 왔네요! 저도 기다리고 있었거든요ㅎㅎ`,
          `오늘 ${name} 포함해서 끝까지 해낸 거 다 봤어요! 같이 해서 좋았어요!`,
        ] : [
          `Watching you do ${name} today had me on edge but you pushed through! Amazing!`,
          `You crushed ${name} today! I was watching and felt so proud!`,
          `Your focus on ${name} was incredible! Really impressive!`,
          `You showed up again today! I was waiting for you!`,
        ];
      }

      // 2번째 버블: 세션 디테일 (우선순위: 실패회복 > 실패 > 무게증가 > easy > target > 렙수 > 기본)
      let bubble2: string;
      if (logAnalysis.failRecovery?.recoverySet) {
        bubble2 = isKo
          ? `아! 그리고 ${logAnalysis.failRecovery.exercise} ${logAnalysis.failRecovery.failSet}세트에서 한번 무너졌지만 ${logAnalysis.failRecovery.recoverySet}세트에서 다시 잡은 거 완전 굿! 그게 진짜 성장이에요!ㅎㅎ`
          : `And ${logAnalysis.failRecovery.exercise} - you dropped on set ${logAnalysis.failRecovery.failSet} but came back on set ${logAnalysis.failRecovery.recoverySet}! That recovery is real growth!`;
      } else if (logAnalysis.failRecovery) {
        bubble2 = isKo
          ? `아! 그리고 ${logAnalysis.failRecovery.exercise} ${logAnalysis.failRecovery.failSet}세트에서 힘들었을 텐데, 거기까지 도전한 것 자체가 대단해요! 다음엔 꼭 넘을 수 있을 거예요!`
          : `And ${logAnalysis.failRecovery.exercise} was tough at set ${logAnalysis.failRecovery.failSet}, but challenging yourself is what matters! You'll crush it next time!`;
      } else if (logAnalysis.weightIncrease) {
        bubble2 = isKo
          ? `아! 그리고 ${logAnalysis.weightIncrease.exercise}에서 ${logAnalysis.weightIncrease.from}kg에서 ${logAnalysis.weightIncrease.to}kg까지 올린 거 봤어요! 세트마다 무게 올리는 그 도전 정신이 진짜 멋있어요!`
          : `And I saw you go from ${logAnalysis.weightIncrease.from}kg to ${logAnalysis.weightIncrease.to}kg on ${logAnalysis.weightIncrease.exercise}! That progressive challenge is awesome!`;
      } else if (logAnalysis.allEasy) {
        bubble2 = isKo
          ? `그리고 오늘 전 세트 여유 있었죠?ㅎㅎ 몸이 적응한 거예요! 다음에 무게 올려봐도 될 것 같아요! 성장할 준비가 된 거예요!`
          : `And every set felt easy today right? Your body has adapted! Time to go heavier next time! You're ready to grow!`;
      } else if (logAnalysis.allTarget) {
        bubble2 = isKo
          ? `그리고 ${logAnalysis.totalSets}세트 전부 딱 맞는 강도로 깔끔하게 끝냈네요! 이 페이스가 제일 좋아요! 꾸준히 이렇게 가면 확실히 달라져요!`
          : `And all ${logAnalysis.totalSets} sets finished at the perfect intensity! This pace is ideal! Keep this up and you'll see real changes!`;
      } else if (logAnalysis.bestReps) {
        bubble2 = isKo
          ? `그리고 ${logAnalysis.bestReps.exercise}에서 ${logAnalysis.bestReps.weight ? logAnalysis.bestReps.weight + "kg으로 " : ""}${logAnalysis.bestReps.reps}회 한 거 진짜 대단해요! 그 끈기가 몸을 바꾸는 거예요!`
          : `And ${logAnalysis.bestReps.reps} reps ${logAnalysis.bestReps.weight ? "at " + logAnalysis.bestReps.weight + "kg " : ""}on ${logAnalysis.bestReps.exercise}! That persistence is what changes your body!`;
      } else {
        const totalInfo = logAnalysis.exerciseCount > 0
          ? (isKo ? `${logAnalysis.exerciseCount}가지 운동 ${logAnalysis.totalSets}세트를` : `${logAnalysis.exerciseCount} exercises and ${logAnalysis.totalSets} sets`)
          : "";
        bubble2 = isKo
          ? `그리고 오늘 ${totalInfo} 전체적으로 집중력 좋게 해냈어요! 세트마다 꾸준하게 하는 거 다 봤어요! 그게 진짜 실력이에요!`
          : `And you stayed focused through ${totalInfo} today! I saw you stay consistent every set! That's real skill!`;
      }

      // 3번째 버블: 컨디션 + 내일 조언
      const bubble3Options = isKo ? [
        `오늘 ${conditionLabel ? conditionLabel + "인 날이었는데 " : ""}${desc ? desc.split("·")[0].trim() + "으로 꽉 채워서 " : ""}내일 좀 뻐근할 수 있으니 가볍게 스트레칭 해주세요!`,
        `${conditionLabel ? conditionLabel + " 컨디션에서 " : ""}끝까지 잘 해냈으니 오늘은 푹 쉬고, 내일 가볍게 걸어주세요!`,
        `오늘 운동 자극 확실히 갔을 거예요! 충분히 쉬고 내일 가볍게 유산소 해주시면 딱이에요!`,
      ] : [
        `${conditionLabel ? "Even with " + conditionLabel + ", " : ""}you got a solid session in! Rest up and do some light stretching tomorrow!`,
        `Great work today! Get some good rest and a light walk tomorrow will help recovery!`,
        `Your muscles got a solid stimulus today! Rest well and some light cardio tomorrow would be perfect!`,
      ];

      const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
      return [pick(bubble1Options), bubble2, pick(bubble3Options)];
    }

    // ── Gemini 호출 (5초 타임아웃) ──
    try {
      const ai = getGemini();

      const logSummary = sessionLogs?.map(ex => {
        const sets = ex.sets.map(s =>
          `${s.setNumber}세트: ${s.reps}회${s.weight ? ` ${s.weight}kg` : ""} → ${s.feedback === "fail" ? "실패" : s.feedback === "easy" ? "쉬움" : s.feedback === "too_easy" ? "너무쉬움" : "적정"}`
        ).join(", ");
        return `${ex.exerciseName}: [${sets}]`;
      }).join("\n") || "로그 없음";

      const conditionText = condition
        ? `컨디션: ${conditionLabel} / 에너지 ${condition.energyLevel}/5`
        : "";

      const prompt = `당신은 "오운잘"이라는 운동 앱의 AI 코치입니다. 방금 운동을 끝낸 유저에게 친한 트레이너가 카톡하듯 피드백합니다.

## 톤 규칙
- 편한 존댓말 (해요체), 느낌표 자주 사용!
- 가끔 "ㅎㅎ", "완전 굿!", "진짜" 같은 구어체 OK
- 절대 금지: 이모지, 영어 단어, 의학/운동과학 용어, "화이팅"
- 운동명은 반드시 한글만 사용 (괄호 영문 제거)
- 각 메시지는 2~3문장, 60자 내외. 너무 짧지도 길지도 않게!

## 메시지 구조 (반드시 3개)
1번째: 오늘 운동에 대한 감정 공감. 운동명 구체적 언급. 조마조마/소름/뿌듯/걱정 등 감정 표현!
2번째: "아! 그리고~" 또는 "그리고~" 로 자연스럽게 연결. 세션 중 특이사항 구체적 언급 (몇 세트에서 실패/성공, 무게 변화, 렙수 변화 등)
3번째: 오늘 컨디션 + 운동 부위 연결해서 내일 조언. "내일 좀 뻐근할 수 있으니~", "가볍게 유산소~", "스트레칭~" 등 실제 트레이너 조언

## 좋은 예시
1번째: "케이블 페이스 풀 30kg 올릴 때 진짜 조마조마했는데, 올리는 거 보고 소름 돋았어요!"
2번째: "아! 그리고 3세트에서 실패했지만 4세트에서 다시 잡은 거 완전 굿! 그게 진짜 성장이에요!ㅎㅎ"
3번째: "오늘 어깨 꽉 채웠으니 내일 좀 뻐근할 수 있어요! 가볍게 스트레칭 해주세요!"

## 세션 데이터
- 히어로 타입: ${heroType}${exerciseName ? `\n- 주요 운동: ${mainExName}` : ""}${vars ? `\n- PR 데이터: ${JSON.stringify(vars)}` : ""}
- ${conditionText}
- 운동 요약: ${sessionDesc || "정보 없음"}${streak && streak >= 2 ? `\n- 연속 ${streak}일째` : ""}
- 세션 로그:
${logSummary}

${isKo ? "" : "IMPORTANT: Respond in English. Use casual-polite tone, exclamation marks, natural conversation flow."}

반드시 아래 JSON 형식으로만 응답하세요:
{"messages":["1번째 메시지","2번째 메시지","3번째 메시지"]}`;

      // 5초 타임아웃
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.9,
        },
      });

      clearTimeout(timeout);
      const text = response.text || "";
      let messages: string[];

      try {
        const parsed = JSON.parse(text);
        messages = parsed.messages;
        if (!Array.isArray(messages) || messages.length < 1) throw new Error("Invalid format");
      } catch {
        messages = buildFallbackMessages();
      }

      res.status(200).json({
        result: { messages },
        model: "gemini-2.5-flash",
      });
    } catch (error) {
      console.error("getCoachMessage error (fallback used):", error);
      res.status(200).json({
        result: { messages: buildFallbackMessages() },
        model: "fallback",
      });
    }
  }
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Plan Session — 운동 플랜 생성 (서버사이드 룰베이스)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const planSession = onRequest(
  { cors: true },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    try {
      await verifyAuth(req.headers.authorization);
    } catch {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const {
      dayIndex,
      condition,
      goal,
      selectedSessionType,
      intensityOverride,
      sessionMode,
      targetMuscle,
      runType,
      lastUpperType,
    } = req.body;

    if (condition === undefined || goal === undefined) {
      res.status(400).json({ error: "Missing condition or goal" });
      return;
    }

    try {
      const session = generateAdaptiveWorkout(
        dayIndex ?? new Date().getDay(),
        condition,
        goal,
        selectedSessionType,
        intensityOverride,
        sessionMode,
        targetMuscle,
        runType,
        lastUpperType,
      );

      // 응답 랜덤 변형: main phase 내 마지막 2개 운동 순서 미세 셔플 (보안: 패턴 감지 방지)
      const mainIndices: number[] = [];
      session.exercises.forEach((e, i) => { if ((e.phase || e.type) === "main") mainIndices.push(i); });
      if (mainIndices.length >= 3 && Math.random() > 0.5) {
        const a = mainIndices[mainIndices.length - 1];
        const b = mainIndices[mainIndices.length - 2];
        [session.exercises[a], session.exercises[b]] = [session.exercises[b], session.exercises[a]];
      }

      // AI 응답처럼 보이는 딜레이
      await new Promise(r => setTimeout(r, 100 + Math.random() * 200));

      res.status(200).json(session);
    } catch (error) {
      console.error("planSession error:", error);
      res.status(500).json({ error: "Failed to generate workout plan" });
    }
  }
);

