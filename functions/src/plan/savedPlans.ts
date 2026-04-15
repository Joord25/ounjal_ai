import { onRequest } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { verifyAuth, db } from "../helpers";

const FREE_LIMIT = 1;
const PREMIUM_LIMIT = 5;

/** 구독 상태 조회 — billing/subscription.ts 와 동일 규칙: users/{uid}/billing/subscription.status === "active" */
async function isUserPremium(uid: string): Promise<boolean> {
  try {
    const sub = await db.collection("users").doc(uid).collection("billing").doc("subscription").get();
    return sub.exists && sub.data()?.status === "active";
  } catch {
    return false;
  }
}

interface SavedPlanPayload {
  id: string;
  name: string;
  sessionData: Record<string, unknown>;
  createdAt?: number;
  lastUsedAt?: number | null;
  useCount?: number;
}

/**
 * POST /savePlan
 * Body: SavedPlanPayload
 * 서버 검증: 인증 필수, 게스트 차단, 유/무료 한도 강제 (클라이언트 조작 불가).
 */
export const savePlan = onRequest(
  { cors: true },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    let uid: string;
    try { uid = await verifyAuth(req.headers.authorization); } catch {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const body = req.body as SavedPlanPayload | undefined;
    if (!body || typeof body.id !== "string" || typeof body.name !== "string" || !body.sessionData) {
      res.status(400).json({ error: "Invalid payload" });
      return;
    }
    if (body.name.length > 60) {
      res.status(400).json({ error: "Name too long" });
      return;
    }

    try {
      const col = db.collection("users").doc(uid).collection("saved_plans");
      const existing = await col.get();
      const hasSameId = existing.docs.some(d => d.id === body.id);
      const isPremium = await isUserPremium(uid);
      const limit = isPremium ? PREMIUM_LIMIT : FREE_LIMIT;

      if (!hasSameId && existing.size >= limit) {
        res.status(403).json({ error: "Limit exceeded", limit, current: existing.size });
        return;
      }

      await col.doc(body.id).set({
        name: body.name,
        sessionData: body.sessionData,
        createdAt: body.createdAt ?? Date.now(),
        lastUsedAt: body.lastUsedAt ?? null,
        useCount: body.useCount ?? 0,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      res.status(200).json({ ok: true });
    } catch (err) {
      console.error("savePlan error:", err);
      res.status(500).json({ error: "Failed to save plan" });
    }
  },
);

/** GET /listPlans — 로그인 유저의 저장 플랜 전체 조회 */
export const listSavedPlans = onRequest(
  { cors: true },
  async (req, res) => {
    if (req.method !== "POST" && req.method !== "GET") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    let uid: string;
    try { uid = await verifyAuth(req.headers.authorization); } catch {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    try {
      const snap = await db.collection("users").doc(uid).collection("saved_plans").get();
      const plans = snap.docs.map(d => ({ id: d.id, ...(d.data() as Record<string, unknown>) }));
      res.status(200).json({ plans });
    } catch (err) {
      console.error("listSavedPlans error:", err);
      res.status(500).json({ error: "Failed to list plans" });
    }
  },
);

/**
 * POST /deleteSavedPlan
 * Body: { id: string }
 */
export const deleteSavedPlan = onRequest(
  { cors: true },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    let uid: string;
    try { uid = await verifyAuth(req.headers.authorization); } catch {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const id = (req.body as { id?: string } | undefined)?.id;
    if (typeof id !== "string") {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    try {
      await db.collection("users").doc(uid).collection("saved_plans").doc(id).delete();
      res.status(200).json({ ok: true });
    } catch (err) {
      console.error("deleteSavedPlan error:", err);
      res.status(500).json({ error: "Failed to delete plan" });
    }
  },
);

/** POST /markSavedPlanUsed — useCount/lastUsedAt 증가 */
export const markSavedPlanUsed = onRequest(
  { cors: true },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    let uid: string;
    try { uid = await verifyAuth(req.headers.authorization); } catch {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const id = (req.body as { id?: string } | undefined)?.id;
    if (typeof id !== "string") {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    try {
      await db.collection("users").doc(uid).collection("saved_plans").doc(id).set({
        lastUsedAt: Date.now(),
        useCount: FieldValue.increment(1),
      }, { merge: true });
      res.status(200).json({ ok: true });
    } catch (err) {
      console.error("markSavedPlanUsed error:", err);
      res.status(500).json({ error: "Failed to update usage" });
    }
  },
);
