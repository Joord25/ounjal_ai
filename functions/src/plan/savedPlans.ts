import { onRequest } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { verifyAuth, db } from "../helpers";

const FREE_LIMIT = 1;
const PREMIUM_LIMIT = 5;

/** 구독 상태 조회 — billing/subscription.ts 와 동일 규칙: users/{uid}/billing/subscription.status === "active" */
async function isUserPremium(uid: string): Promise<boolean> {
  try {
    const sub = await db.collection("subscriptions").doc(uid).get();
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

/**
 * POST /saveProgram
 * Body: { sessions: SavedPlanPayload[] }
 * 장기 프로그램 세션 일괄 저장. programId로 그룹핑.
 */
export const saveProgram = onRequest(
  { cors: true },
  async (req, res) => {
    if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
    let uid: string;
    try { uid = await verifyAuth(req.headers.authorization); } catch {
      res.status(401).json({ error: "Unauthorized" }); return;
    }

    const body = req.body as { sessions?: SavedPlanPayload[] } | undefined;
    if (!body?.sessions || !Array.isArray(body.sessions) || body.sessions.length === 0) {
      res.status(400).json({ error: "Invalid payload: sessions array required" }); return;
    }
    if (body.sessions.length > 100) {
      res.status(400).json({ error: "Too many sessions (max 100)" }); return;
    }

    const isPremium = await isUserPremium(uid);
    if (!isPremium) {
      res.status(403).json({ error: "Premium required for programs" }); return;
    }

    try {
      const col = db.collection("users").doc(uid).collection("saved_plans");
      const batch = db.batch();
      for (const s of body.sessions) {
        if (!s.id || !s.sessionData) continue;
        const raw = s as unknown as Record<string, unknown>;
        batch.set(col.doc(s.id), {
          name: s.name ?? "",
          sessionData: s.sessionData,
          programId: raw.programId ?? null,
          sessionNumber: raw.sessionNumber ?? null,
          totalSessions: raw.totalSessions ?? null,
          programName: raw.programName ?? null,
          completedAt: null,
          createdAt: s.createdAt ?? Date.now(),
          lastUsedAt: null,
          useCount: 0,
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
      await batch.commit();
      res.status(200).json({ ok: true, count: body.sessions.length });
    } catch (err) {
      console.error("saveProgram error:", err);
      res.status(500).json({ error: "Failed to save program" });
    }
  },
);

/**
 * POST /deleteProgram
 * Body: { programId: string }
 * 프로그램 전체 세션 일괄 삭제.
 */
export const deleteProgram = onRequest(
  { cors: true },
  async (req, res) => {
    if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
    let uid: string;
    try { uid = await verifyAuth(req.headers.authorization); } catch {
      res.status(401).json({ error: "Unauthorized" }); return;
    }

    const programId = (req.body as { programId?: string } | undefined)?.programId;
    if (typeof programId !== "string") {
      res.status(400).json({ error: "Invalid programId" }); return;
    }

    try {
      const col = db.collection("users").doc(uid).collection("saved_plans");
      const snap = await col.where("programId", "==", programId).get();
      if (snap.empty) { res.status(404).json({ error: "Program not found" }); return; }
      const batch = db.batch();
      snap.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      res.status(200).json({ ok: true, deleted: snap.size });
    } catch (err) {
      console.error("deleteProgram error:", err);
      res.status(500).json({ error: "Failed to delete program" });
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
