import { onRequest } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2/options";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { GoogleGenAI } from "@google/genai";

const app = initializeApp();
const db = getFirestore(app);

setGlobalOptions({ region: "us-central1" });

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
          `${s.date}: 볼륨 ${s.totalVolume.toLocaleString()}kg, 1RM ${s.bestE1RM ? Math.round(s.bestE1RM) + "kg" : "-"}, 부하 ${s.loadScore}`
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
          "headline": "한 줄 핵심 판정 (15자 이내, 예: '저강도 회복 세션 완료', '고강도 근력 세션 성공')",
          "weekProgress": "이번 주 강도 배분 달성 상황 한 줄 (예: '고2·중1·저1 완료 — 저강도 1회 남음')",
          "insight": "핵심 인사이트 한 줄 — 같은 강도의 이전 세션과 비교하거나, 주간 배분 맥락에서 오늘의 의미 (50자 이내)",
          "action": "다음 세션 구체적 액션 한 줄 (예: '다음 고강도에서 스쿼트 85kg 도전, 볼륨 4,000kg 목표')"
        },
        "nextSessionAdvice": "다음 세션: 고강도 추천\\n벤치 프레스: +2.5kg 증가 요망\\n숄더 프레스: 유지"
      }

      === BRIEFING RULES ===
      - headline, weekProgress, insight, action 각각 한 줄씩, 짧고 명확하게.
      - 장황한 설명 금지. 수치를 포함하되 문장은 짧게.
      - 초등학생도 이해할 수 있는 쉬운 말, 존댓말.
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
const SUBSCRIPTION_AMOUNT = 9900;

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

