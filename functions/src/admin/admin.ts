import { onRequest } from "firebase-functions/v2/https";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import { verifyAdmin, db } from "../helpers";

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
      let active = 0, cancelled = 0, expired = 0, expiringIn3Days = 0, monthlyRevenue = 0;
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
      // 1. Firebase Auth 전체 유저 수집 (미구독자 포함)
      const authUsers: Array<{ uid: string; email: string; displayName: string; createdAtMs: number }> = [];
      let nextPageToken: string | undefined;
      do {
        const result = await getAuth().listUsers(1000, nextPageToken);
        for (const u of result.users) {
          authUsers.push({
            uid: u.uid,
            email: u.email || "",
            displayName: u.displayName || "",
            createdAtMs: u.metadata.creationTime ? new Date(u.metadata.creationTime).getTime() : 0,
          });
        }
        nextPageToken = result.pageToken;
      } while (nextPageToken);

      // 2. 전체 구독 데이터 Map 생성
      const subsSnap = await db.collection("subscriptions").get();
      const subsMap = new Map<string, FirebaseFirestore.DocumentData>();
      subsSnap.forEach(doc => subsMap.set(doc.id, doc.data()));

      // 3. Auth 유저 기준으로 머지 — 구독 문서 없으면 free
      const merged = authUsers.map(u => {
        const sub = subsMap.get(u.uid);
        const updatedAtMs = sub?.updatedAt?.toMillis?.() ?? 0;
        return {
          uid: u.uid,
          email: u.email,
          displayName: u.displayName,
          status: (sub?.status as string) || "free",
          expiresAt: sub?.expiresAt || null,
          lastPaymentAt: sub?.lastPaymentAt || null,
          amount: sub?.amount || 0,
          billingKey: sub?.billingKey === "manual_admin" ? "수동" : sub?.billingKey ? "카카오페이" : "-",
          sortKey: updatedAtMs || u.createdAtMs,
        };
      });

      // 4. 상태 필터
      const filtered = status && status !== "all"
        ? merged.filter(u => u.status === status)
        : merged;

      // 5. 최근순 정렬
      filtered.sort((a, b) => b.sortKey - a.sortKey);

      // 6. 페이지네이션
      const total = filtered.length;
      const startIdx = (page - 1) * limit;
      const pageUsers = filtered.slice(startIdx, startIdx + limit).map(u => ({
        uid: u.uid,
        email: u.email,
        displayName: u.displayName,
        status: u.status,
        expiresAt: u.expiresAt,
        lastPaymentAt: u.lastPaymentAt,
        amount: u.amount,
        billingKey: u.billingKey,
      }));

      res.status(200).json({ users: pageUsers, total, page, limit, totalPages: Math.ceil(total / limit) });
    } catch (error) {
      console.error("adminListUsers error:", error);
      res.status(500).json({ error: "유저 목록 조회 실패" });
    }
  }
);

/**
 * POST /adminCancelFeedbacks
 * Admin only: 취소 피드백 목록 조회
 */
export const adminCancelFeedbacks = onRequest(
  { cors: true },
  async (req, res) => {
    if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
    try { await verifyAdmin(req.headers.authorization); } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unauthorized";
      res.status(msg.includes("Forbidden") ? 403 : 401).json({ error: msg });
      return;
    }

    try {
      const snapshot = await db.collection("cancel_feedbacks")
        .orderBy("cancelledAt", "desc")
        .limit(50)
        .get();

      // UID → email 매핑
      const uids = [...new Set(snapshot.docs.map(d => d.data().uid as string))];
      const emailMap = new Map<string, string>();
      for (const uid of uids) {
        try {
          const user = await getAuth().getUser(uid);
          emailMap.set(uid, user.email || uid);
        } catch {
          emailMap.set(uid, uid);
        }
      }

      const feedbacks = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          email: emailMap.get(data.uid) || data.uid,
          reason: data.reason || "",
          cancelledAt: data.cancelledAt?.toDate?.().toISOString() || null,
        };
      });

      res.status(200).json({ feedbacks });
    } catch (error) {
      console.error("adminCancelFeedbacks error:", error);
      res.status(500).json({ error: "취소 피드백 조회 실패" });
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
