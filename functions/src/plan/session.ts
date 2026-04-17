import { onRequest } from "firebase-functions/v2/https";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import { verifyAuth, db } from "../helpers";
import { generateAdaptiveWorkout } from "../workoutEngine";
import * as crypto from "crypto";

const GUEST_TRIAL_LIMIT = 1;

// IP 해시 헬퍼 — planSession 과 공통 로직
function hashClientIp(req: { headers: Record<string, string | string[] | undefined>; socket?: { remoteAddress?: string } }): string {
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
    || req.socket?.remoteAddress || "unknown";
  return crypto.createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

/**
 * POST /getGuestTrialStatus
 * Auth: anonymous OK (이메일 없어도 Firebase ID token 필요)
 * Returns: { count, limit } — 현재 IP 기반 체험 소진 상태
 *
 * 이유: 클라이언트 localStorage 는 캐시/기기 의존이라 stale 가능.
 * 서버의 trial_ips/{ipHash} 가 SSOT. 홈 진입 시 이걸로 localStorage 를 동기화.
 */
export const getGuestTrialStatus = onRequest(
  { cors: true },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    // Auth 필수 — 익명 토큰이라도 있어야 함 (abuse 방지)
    try { await verifyAuth(req.headers.authorization); } catch {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    try {
      const ipHash = hashClientIp(req);
      const doc = await db.collection("trial_ips").doc(ipHash).get();
      const count = doc.exists ? Number(doc.data()?.count || 0) : 0;
      res.status(200).json({ count, limit: GUEST_TRIAL_LIMIT });
    } catch (error) {
      console.error("getGuestTrialStatus error:", error);
      res.status(500).json({ error: "Failed to read trial status" });
    }
  },
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

    let uid: string;
    try {
      uid = await verifyAuth(req.headers.authorization);
    } catch {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Server-side usage limits
    const FREE_PLAN_LIMIT = 2;
    try {
      const userRecord = await getAuth().getUser(uid);
      const isAnonymous = !userRecord.email;

      if (isAnonymous) {
        // Guest: IP-based trial limit (survives cache clear)
        const ipHash = hashClientIp(req);
        const trialRef = db.collection("trial_ips").doc(ipHash);
        const trialDoc = await trialRef.get();
        const currentCount = trialDoc.exists ? (trialDoc.data()?.count || 0) : 0;

        if (currentCount >= GUEST_TRIAL_LIMIT) {
          res.status(429).json({ error: "체험 횟수를 초과했습니다. 로그인 후 이용해주세요.", code: "TRIAL_LIMIT" });
          return;
        }

        (req as any)._trialRef = trialRef;
        (req as any)._trialCount = currentCount;
        (req as any)._isGuest = true;
      } else {
        // Logged-in free user: enforce plan limit server-side (CRITICAL: prevents paywall bypass)
        const subDoc = await db.collection("subscriptions").doc(uid).get();
        const subStatus = subDoc.exists ? subDoc.data()?.status : "free";

        if (subStatus !== "active") {
          const profileDoc = await db.collection("users").doc(uid).get();
          const planCount = profileDoc.exists ? (profileDoc.data()?.planCount || 0) : 0;

          if (planCount >= FREE_PLAN_LIMIT) {
            res.status(403).json({ error: "무료 플랜 생성 한도에 도달했습니다. 프리미엄 구독 후 이용해주세요.", code: "FREE_LIMIT" });
            return;
          }
        }
      }
    } catch {
      // Auth lookup failed — proceed anyway (don't block legitimate requests)
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
      // 회의 37: 러닝 세션은 시간 순서가 엄격 (워밍업→드릴→메인→쿨다운).
      // 셔플이 마무리 조깅 ↔ 인터벌 스프린트를 바꿔버려 부상 위험 + UX 버그.
      // 러닝 세션은 셔플 제외, 웨이트 세션만 적용 (보안 목적 유지).
      if (sessionMode !== "running") {
        const mainIndices: number[] = [];
        session.exercises.forEach((e, i) => { if ((e.phase || e.type) === "main") mainIndices.push(i); });
        if (mainIndices.length >= 3 && Math.random() > 0.5) {
          const a = mainIndices[mainIndices.length - 1];
          const b = mainIndices[mainIndices.length - 2];
          [session.exercises[a], session.exercises[b]] = [session.exercises[b], session.exercises[a]];
        }
      }

      // Increment guest trial count on success
      if ((req as any)._isGuest && (req as any)._trialRef) {
        const trialRef = (req as any)._trialRef;
        const currentCount = (req as any)._trialCount;
        if (currentCount === 0) {
          await trialRef.set({ count: 1, firstSeenAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
        } else {
          await trialRef.update({ count: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
        }
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

/**
 * POST /api/generateProgramSessions
 * 장기 프로그램 세션 일괄 생성 — 프리미엄 전용, 한도 체크 1번만.
 * Body: { sessions: Array<{ condition, goal, sessionMode, targetMuscle?, intensityOverride? }> }
 * Response: { sessions: WorkoutSessionData[] }
 */
export const generateProgramSessions = onRequest(
  { cors: true },
  async (req, res) => {
    if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
    let uid: string;
    try { uid = await verifyAuth(req.headers.authorization); } catch {
      res.status(401).json({ error: "Unauthorized" }); return;
    }

    // 프리미엄 체크 (1번만)
    try {
      const subDoc = await db.collection("subscriptions").doc(uid).get();
      const subStatus = subDoc.exists ? subDoc.data()?.status : "free";
      if (subStatus !== "active") {
        res.status(403).json({ error: "Premium required", code: "PREMIUM_REQUIRED" }); return;
      }
    } catch { /* proceed */ }

    const body = req.body as { sessions?: Array<{ condition: any; goal: string; sessionMode?: string; targetMuscle?: string; intensityOverride?: string }> };
    if (!body?.sessions || !Array.isArray(body.sessions) || body.sessions.length === 0) {
      res.status(400).json({ error: "sessions array required" }); return;
    }
    if (body.sessions.length > 100) {
      res.status(400).json({ error: "Too many sessions (max 100)" }); return;
    }

    try {
      // 입력 로깅: Gemini가 보낸 sessionParams 전체
      console.log("[PROGRAM_DEBUG] Input sessionParams:", JSON.stringify(body.sessions.map((s: any, i: number) => ({
        idx: i,
        sessionMode: s.sessionMode,
        targetMuscle: s.targetMuscle,
        goal: s.goal,
        availableTime: s.condition?.availableTime,
        intensityOverride: s.intensityOverride,
      }))));

      const results = [];
      // push/pull 교대: "pull"로 시작하면 엔진이 첫 세션을 "push(밀기)"로 생성
      let lastUpper: "push" | "pull" = "pull";
      for (let i = 0; i < body.sessions.length; i++) {
        const s = body.sessions[i];
        if (!s.condition || !s.goal) continue;

        // runType 자동 추론: sessionMode=running이면 필수
        let runType = (s as any).runType as string | undefined;
        if (s.sessionMode === "running" && !runType) {
          runType = s.intensityOverride === "high" ? "interval" : "easy";
        }

        const session = generateAdaptiveWorkout(
          i % 7,
          s.condition,
          s.goal as any,
          undefined,
          s.intensityOverride as any,
          s.sessionMode as any,
          s.targetMuscle as any,
          runType as any,
          lastUpper,
        );
        // balanced 모드면 push↔pull 교대 추적 (엔진이 생성한 결과 기준)
        if (!s.sessionMode || s.sessionMode === "balanced") {
          lastUpper = lastUpper === "push" ? "pull" : "push";
        }
        results.push(session);
      }

      // 출력 로깅: 룰엔진이 만든 세션 요약
      console.log("[PROGRAM_DEBUG] Output sessions:", JSON.stringify(results.map((s, i) => ({
        idx: i,
        title: s.title,
        description: s.description,
        exerciseCount: s.exercises.length,
        strengthCount: s.exercises.filter((e: any) => e.type === "strength").length,
        weights: s.exercises.filter((e: any) => e.type === "strength").map((e: any) => ({ name: e.name, weight: e.weight })),
      }))));

      res.status(200).json({ sessions: results });
    } catch (error) {
      console.error("generateProgramSessions error:", error);
      res.status(500).json({ error: "Failed to generate program sessions" });
    }
  }
);
