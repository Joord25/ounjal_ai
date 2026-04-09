import { onRequest } from "firebase-functions/v2/https";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import { verifyAuth, db } from "../helpers";
import { generateAdaptiveWorkout } from "../workoutEngine";

const GUEST_TRIAL_LIMIT = 3;

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
    const FREE_PLAN_LIMIT = 4;
    try {
      const userRecord = await getAuth().getUser(uid);
      const isAnonymous = !userRecord.email;

      if (isAnonymous) {
        // Guest: IP-based trial limit (survives cache clear)
        const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
          || req.socket?.remoteAddress || "unknown";
        const ipHash = require("crypto").createHash("sha256").update(ip).digest("hex").slice(0, 16);

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
