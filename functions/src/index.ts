import { onRequest } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2/options";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { GoogleGenAI } from "@google/genai";

const app = initializeApp();
const db = getFirestore(app);

setGlobalOptions({ region: "us-central1", minInstances: 1 });

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

    const { condition, goal, dayName, selectedSessionType } = req.body;

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

      const prompt = `
      You are an elite Strength & Conditioning Coach certified by ACSM, NASM, and NSCA.
      Create a highly professional 50-minute workout master plan for today (${dayName}).

      User Profile:
      - Goal: ${goal === "general_fitness" ? "GENERAL FITNESS (기초체력향상 - 맨몸/가벼운 도구 풀바디 서킷)" : (goal as string).replace("_", " ").toUpperCase()}
      - Condition: ${userConditionDesc}
      - Available Time: 50 minutes (Fixed)
      ${condition.gender ? `- Gender: ${condition.gender === "male" ? "남성 (Male)" : "여성 (Female)"}` : ""}
      ${condition.birthYear ? `- Age: ${new Date().getFullYear() - condition.birthYear}세` : ""}
      ${condition.bodyWeightKg ? `- Body Weight: ${condition.bodyWeightKg}kg` : ""}

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
      - Focus on compound movements: squat, push, pull, lunge, core in circuit style.
      - Rep range: 10-15 reps, 2-3 rounds per circuit.
      - Include low-impact alternatives for each exercise.
      - Keep rest periods short (15-30 sec between exercises, 60 sec between rounds).
      ` : `
      Determine the workout type based on the weekly schedule:
      - Mon: Push | Tue: Speed Run | Wed: Pull | Thu: Easy Run | Fri: Legs | Sat: LSD Run | Sun: Mobility
      `}

      Workout Structure (50 min total):
      1. Warm-up (5 min):
         - CRITICAL: Apply NASM/ACSM Corrective Exercise guidelines.
         - IF Condition is "Good": Focus on dynamic activation for high performance.
         - IF Condition is "Stiff/Heavy/Fatigue": Select specific drills to alleviate the specific issue mentioned in Condition.
         - Example: If "Upper Body Stiffness", include Thoracic Spine Openers.
         - Equipment: Bodyweight, Bands, or Light Kettlebell (e.g., Halo, Prying Goblet Squat).
      2. Main Workout (40 min):
         - Apply NSCA guidelines for sets/reps based on the Goal (${goal}).
         - If Session Type is "Strength" (Push/Pull/Legs/Full Body): 5-6 compound & isolation movements.
         - If Session Type is "Running" (Easy/Speed/LSD): Structured run (e.g., Fartlek, Tempo) + pre-run activation.
         - If Session Type is "Mobility": Full body flow, yoga, or deep tissue work.
         - If Goal is "General Fitness": Circuit-style with 4-5 exercises per round, bodyweight + light DB, short rest periods.
         - IMPORTANT: For Running Days, the Main Workout MUST be the Run itself (type: "cardio").
         - EQUIPMENT USAGE: Actively incorporate a variety of equipment including Barbell, Dumbbell, Kettlebell, and Cables/Machines.
         - Kettlebell Examples: KB Swings, Goblet Squats, KB Clean & Press, Turkish Get-up.
      3. Core (5 min): Functional core stability.
      4. Additional Cardio (Phase 04):
         - If Main Workout was Strength: Recommend 15-20 min Running.
         - If Main Workout was Running: Recommend Mobility or Cooldown.

      CRITICAL LANGUAGE & FORMAT RULES:
      1. RESPONSE MUST BE IN KOREAN (한국어).
      2. Exercise names MUST be in "한글 (English)" format (e.g., "벤치 프레스 (Bench Press)", "바벨 스쿼트 (Barbell Squat)", "흉추 가동성 드릴 (Thoracic Openers)").
      3. "title" MUST be exactly "마스터 플랜".
      4. "description" MUST follow this format:
         "${dayName}: [Workout Theme] - [Focus Area]"

      Format the response STRICTLY as a JSON object:
      {
        "title": "마스터 플랜",
        "description": "Wednesday: Hypertrophy Pull - Fatigue Focus",
        "exercises": [
          {
            "type": "warmup",
            "name": "흉추 가동성 드릴 (Thoracic Openers)",
            "count": "5분",
            "sets": 1,
            "reps": 1
          },
          {
            "type": "strength",
            "name": "바벨 로우 (Barbell Row)",
            "count": "3세트 / 12회",
            "sets": 3,
            "reps": 12,
            "weight": "적당한 무게"
          },
          {
            "type": "core",
            "name": "데드버그 (Deadbug)",
            "count": "5분",
            "sets": 1,
            "reps": 1
          },
          {
            "type": "cardio",
            "name": "추가 유산소: 인터벌 러닝",
            "count": "20분",
            "sets": 1,
            "reps": 1
          }
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

    const { sessionData, logs, bodyWeightKg, gender, birthYear, historyStats, metrics } = req.body;

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
        isStrength && historyStats && historyStats.sessionCount > 0 ? `최근 28일 평균 볼륨: ${Math.round(historyStats.avgVolume28d).toLocaleString()}kg (${historyStats.sessionCount}회 세션)` : null,
      ].filter(Boolean).join("\n      ") : "";

      const loadRatioContext = historyStats && historyStats.avgVolume28d > 0 && metrics
        ? `오늘 부하 비율(오늘볼륨/28일평균): ${(metrics.totalVolume / historyStats.avgVolume28d).toFixed(2)}`
        : "";

      const prompt = `
      You are an expert Strength & Conditioning Coach.
      Analyze the completed workout session.

      Workout Logs:
      ${logSummary}

      Session Metrics:
      ${metricsContext}
      ${isStrength ? loadRatioContext : ""}

      CRITICAL: Output in KOREAN (한국어).

      === WRITING STYLE ===
      MOST IMPORTANT: 초등학생도 이해할 수 있는 쉬운 말로 써야 합니다.
      - "체중 대비 1.18배" 같은 표현 금지. 대신 "내 몸무게보다 1.18배 무거운 걸 들어올렸어요" 처럼 풀어서 설명.
      - "타깃 적중률 96%" 같은 표현 금지. 대신 "목표한 횟수를 거의 다 채웠어요 (25개 중 24개 성공)" 처럼.
      - 친근하고 코칭하는 톤. 존댓말 사용.

      === BRIEFING (정확히 3문장) ===
      문장 1: 오늘 세션 한 줄 판정
      문장 2: 왜 그런지 쉬운 말로 설명
      문장 3: 다음에 뭘 하면 좋을지 구체적 조언 1개

      ${isStrength ? `
      판정 기준 (근력 세션):
      - 적중률 >85% AND 피로신호 >-15%: 잘 한 세션
      - 적중률 >85% BUT 피로신호 <-20%: 잘 했지만 후반에 지침
      - 적중률 <70%: 오늘 좀 무리한 세션
      - easy 피드백 >50%: 여유로운 세션 (더 무겁게 해도 됨)
      ${metrics?.bwRatio !== null ? `
      참고 - BW Ratio (${gender === "female" ? "여성" : "남성"}):
      ${gender === "female"
        ? "- <0.5x 초급, 0.5-0.8x 중급, >0.8x 상급"
        : "- <0.8x 초급, 0.8-1.2x 중급, >1.2x 상급"
      }` : ""}
      ${loadRatioContext ? `
      부하 비율 판정:
      - 0.8~1.3: 적당한 양 (good)
      - <0.8: 좀 적었음
      - >1.3: 좀 많았음` : ""}
      ` : `
      판정 기준 (${metrics?.sessionCategory === "cardio" ? "유산소" : "가동성/회복"} 세션):
      - 모든 항목 완료: 잘 한 세션
      - 일부 미완료: 체력에 맞게 조절 필요
      `}

      === NEXT SESSION ADVICE ===
      운동별로 "운동이름: 판정" 형식으로 한 줄씩.
      ${isStrength ? `
      판정은 다음 3가지 중 하나만 사용:
      - "유지" → 횟수가 점점 줄어들거나 적중률이 보통인 운동
      - "증가 요망" → 목표 횟수 잘 채우거나 너무 쉬웠던 운동 (구체적 무게 포함)
      - "감소 요망" → 실패가 많거나 피로가 심했던 운동 (구체적 무게 포함)
      ` : `
      판정은 다음 중 하나만 사용:
      - "유지" → 잘 수행한 운동
      - "+시간 증가 요망" → 시간이나 거리를 늘릴 수 있는 운동
      - "감소 요망" → 힘들었던 운동은 시간 줄이기
      `}

      OUTPUT FORMAT (strict JSON):
      {
        "briefing": "오늘 운동 아주 잘 하셨어요! ...",
        "nextSessionAdvice": "벤치 프레스: +2.5kg 증가 요망\\n숄더 프레스: 유지\\n플랭크: 유지"
      }

      IMPORTANT: briefing과 nextSessionAdvice만 반환하세요.
      ${!isStrength ? "무게, 볼륨, e1RM, 부하 비율 등 근력 관련 수치를 언급하지 마세요." : ""}
    `;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: { responseMimeType: "application/json" },
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

      await db.collection("subscriptions").doc(uid).set({
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

      res.status(200).json({
        status: data.status,
        expiresAt: data.expiresAt || null,
        lastPaymentAt: data.lastPaymentAt || null,
        amount: data.amount || null,
        createdAt: data.createdAt?.toDate?.().toISOString() || data.createdAt || null,
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

