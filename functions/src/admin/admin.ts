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

    const { email } = req.body;
    if (!email) { res.status(400).json({ error: "Missing email" }); return; }

    // 회의: months 범위 검증 (1 ~ 60개월 clamp, 음수/huge/NaN 차단)
    const rawMonths = Number(req.body.months);
    const months = Number.isFinite(rawMonths) ? Math.max(1, Math.min(60, Math.floor(rawMonths))) : 1;

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
 * POST /adminListPayments
 * Admin only: 결제 내역 목록 (회의 57 Tier 2 후속)
 * Firestore `subscriptions/{uid}/payments` 서브컬렉션 전체 collectionGroup 조회
 * 주의: PortOne 직접 취소분은 Firestore에 없을 수 있음 (future: PortOne API 동기화)
 */
export const adminListPayments = onRequest(
  { cors: true },
  async (req, res) => {
    if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
    try { await verifyAdmin(req.headers.authorization); } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unauthorized";
      res.status(msg.includes("Forbidden") ? 403 : 401).json({ error: msg });
      return;
    }

    try {
      const { limit = 100 } = req.body || {};

      // collectionGroup query — 모든 payments 서브컬렉션 통합
      const snap = await db.collectionGroup("payments").limit(500).get();

      type PaymentRow = {
        paymentId: string;
        uid: string;
        amount: number;
        plan: string;
        status: string;
        paidAt: string | null;
        periodStart: string | null;
        periodEnd: string | null;
      };

      const rowsRaw: PaymentRow[] = snap.docs.map(doc => {
        const data = doc.data();
        const uid = doc.ref.parent.parent?.id || "";
        return {
          paymentId: data.paymentId || doc.id,
          uid,
          amount: Number(data.amount || 0),
          plan: data.plan || "",
          status: data.status || "paid",
          paidAt: data.paidAt || null,
          periodStart: data.periodStart || null,
          periodEnd: data.periodEnd || null,
        };
      }).filter(r => r.paidAt);

      // 최신순 정렬 후 상위 N개 추출
      rowsRaw.sort((a, b) => new Date(b.paidAt!).getTime() - new Date(a.paidAt!).getTime());
      const topRows = rowsRaw.slice(0, limit);

      // 배치로 이메일 조회 (getUsers, 최대 100개씩)
      const uniqueUids = Array.from(new Set(topRows.map(r => r.uid).filter(Boolean)));
      const uidToEmail = new Map<string, string>();
      for (let i = 0; i < uniqueUids.length; i += 100) {
        const chunk = uniqueUids.slice(i, i + 100);
        try {
          const result = await getAuth().getUsers(chunk.map(uid => ({ uid })));
          result.users.forEach(u => uidToEmail.set(u.uid, u.email || ""));
        } catch { /* 일부 유저 삭제됐을 수 있음 */ }
      }

      const enriched = topRows.map(r => ({
        ...r,
        email: uidToEmail.get(r.uid) || "(unknown)",
      }));

      // 집계 요약
      const totalAmount = topRows.reduce((sum, r) => sum + r.amount, 0);

      res.status(200).json({
        payments: enriched,
        total: enriched.length,
        totalAmount,
      });
    } catch (error) {
      console.error("adminListPayments error:", error);
      res.status(500).json({ error: "결제 목록 조회 실패" });
    }
  }
);

/**
 * POST /adminCheckSelf
 * Admin only: 현재 로그인 유저가 어드민인지 확인 (프론트 게이트키퍼용)
 * 회의 57 Tier 3: ADMIN_UIDS 하드코딩 제거 — Firestore admins 기반 권한 확인
 */
export const adminCheckSelf = onRequest(
  { cors: true },
  async (req, res) => {
    if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
    try {
      const uid = await verifyAdmin(req.headers.authorization);
      res.status(200).json({ isAdmin: true, uid });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unauthorized";
      res.status(msg.includes("Forbidden") ? 403 : 401).json({ isAdmin: false, error: msg });
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
      // 회의 57 Tier 2: 매출 분해 (결제 건수, 평균, 이전 달 매출)
      let monthlyPaymentCount = 0;
      let lastMonthRevenue = 0;
      let lastMonthPaymentCount = 0;
      const now = new Date();
      const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = monthStart; // exclusive

      subsSnap.forEach(doc => {
        const d = doc.data();
        if (d.status === "active") {
          active++;
          if (d.expiresAt) {
            const exp = new Date(d.expiresAt);
            if (exp <= threeDaysLater && exp > now) expiringIn3Days++;
          }
        } else if (d.status === "cancelled") { cancelled++; }
        else if (d.status === "expired") { expired++; }

        // 결제 집계 (상태 무관 — 결제 이력 기준)
        if (d.lastPaymentAt && d.amount > 0) {
          const paymentDate = new Date(d.lastPaymentAt);
          if (paymentDate >= monthStart) {
            monthlyRevenue += d.amount;
            monthlyPaymentCount++;
          } else if (paymentDate >= lastMonthStart && paymentDate < lastMonthEnd) {
            lastMonthRevenue += d.amount;
            lastMonthPaymentCount++;
          }
        }
      });

      // Collect all users from Firebase Auth
      const allUsers: Array<{ email: string; isAnonymous: boolean; createdAt: Date }> = [];
      let nextToken: string | undefined;
      do {
        const result = await getAuth().listUsers(1000, nextToken);
        for (const u of result.users) {
          allUsers.push({
            email: u.email || "",
            isAnonymous: !u.email,
            createdAt: u.metadata.creationTime ? new Date(u.metadata.creationTime) : new Date(0),
          });
        }
        nextToken = result.pageToken;
      } while (nextToken);

      // Segment: Google accounts vs anonymous (trial)
      const googleUsers = allUsers.filter(u => !u.isAnonymous);
      const trialUsers = allUsers.filter(u => u.isAnonymous);

      // Time ranges (KST = UTC+9)
      const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
      const kstYear = kstNow.getUTCFullYear();
      const kstMonth = kstNow.getUTCMonth();
      const kstDate = kstNow.getUTCDate();
      const kstDay = kstNow.getUTCDay(); // 0=일, 1=월, ..., 6=토
      const todayStart = new Date(Date.UTC(kstYear, kstMonth, kstDate) - 9 * 60 * 60 * 1000);
      const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
      // 월요일 시작 주 (한국 비즈니스 관례)
      const daysToMonday = (kstDay + 6) % 7;
      const weekStart = new Date(todayStart.getTime() - daysToMonday * 24 * 60 * 60 * 1000);
      const lastWeekStart = new Date(weekStart.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthStartDate = new Date(Date.UTC(kstYear, kstMonth, 1) - 9 * 60 * 60 * 1000);
      const lastMonthStartDate = new Date(Date.UTC(kstYear, kstMonth - 1, 1) - 9 * 60 * 60 * 1000);

      const countByRange = (users: typeof allUsers) => ({
        today: users.filter(u => u.createdAt >= todayStart).length,
        yesterday: users.filter(u => u.createdAt >= yesterdayStart && u.createdAt < todayStart).length,
        week: users.filter(u => u.createdAt >= weekStart).length,
        // 회의 57 Tier 2: 증감률 계산용 이전 기간
        lastWeek: users.filter(u => u.createdAt >= lastWeekStart && u.createdAt < weekStart).length,
        month: users.filter(u => u.createdAt >= monthStartDate).length,
        lastMonth: users.filter(u => u.createdAt >= lastMonthStartDate && u.createdAt < monthStartDate).length,
        total: users.length,
      });

      // 회의 57 Tier 2: 매출 분해 데이터
      const avgPayment = monthlyPaymentCount > 0 ? Math.round(monthlyRevenue / monthlyPaymentCount) : 0;
      const revenueChangePercent = lastMonthRevenue > 0
        ? Math.round(((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
        : null;

      res.status(200).json({
        totalUsers: allUsers.length,
        active,
        free: googleUsers.length - active - cancelled - expired,
        cancelled,
        expired,
        expiringIn3Days,
        monthlyRevenue,
        // 회의 57 Tier 2: 매출 분해
        monthlyPaymentCount,
        avgPayment,
        lastMonthRevenue,
        lastMonthPaymentCount,
        revenueChangePercent,
        trial: countByRange(trialUsers),
        registered: countByRange(googleUsers),
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

    // 회의: limit 상한 100, page 하한 1 (DoS 방지)
    const { status, q } = req.body;
    const rawLimit = Number(req.body.limit);
    const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(100, Math.floor(rawLimit))) : 20;
    const rawPage = Number(req.body.page);
    const page = Number.isFinite(rawPage) ? Math.max(1, Math.floor(rawPage)) : 1;

    try {
      // 1. Firebase Auth — Google 계정 유저만 수집 (익명/체험 유저 제외)
      const authUsers: Array<{ uid: string; email: string; displayName: string; createdAtMs: number }> = [];
      let nextPageToken: string | undefined;
      do {
        const result = await getAuth().listUsers(1000, nextPageToken);
        for (const u of result.users) {
          if (!u.email) continue; // 익명(체험) 유저 제외
          authUsers.push({
            uid: u.uid,
            email: u.email,
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

      // 회의 57 Tier 3: 다중 필드 검색 (email / displayName / uid substring)
      let searchFiltered = merged;
      if (q && typeof q === "string" && q.trim()) {
        const query = q.trim().toLowerCase();
        searchFiltered = merged.filter(u =>
          u.email.toLowerCase().includes(query) ||
          u.displayName.toLowerCase().includes(query) ||
          u.uid.toLowerCase().includes(query)
        );
      }

      // 4. 상태 필터 (회의 57: expiring_soon 특수 필터 — 3일 내 만료 예정)
      let filtered;
      if (!status || status === "all") {
        filtered = searchFiltered;
      } else if (status === "expiring_soon") {
        const nowMs = Date.now();
        const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
        filtered = searchFiltered.filter(u => {
          if (u.status !== "active" || !u.expiresAt) return false;
          const expMs = new Date(u.expiresAt).getTime();
          return expMs > nowMs && expMs <= nowMs + threeDaysMs;
        });
      } else {
        filtered = searchFiltered.filter(u => u.status === status);
      }

      // 5. 최근순 정렬 (expiring_soon은 만료일 가까운 순)
      if (status === "expiring_soon") {
        filtered.sort((a, b) => new Date(a.expiresAt || 0).getTime() - new Date(b.expiresAt || 0).getTime());
      } else {
        filtered.sort((a, b) => b.sortKey - a.sortKey);
      }

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

const PORTONE_API_BASE = "https://api.portone.io";

function getPortOneSecret(): string {
  const secret = process.env.PORTONE_API_SECRET;
  if (!secret) throw new Error("PORTONE_API_SECRET not configured");
  return secret;
}

/**
 * POST /adminRefundRequests
 * Admin only: 환불 요청 목록 조회
 */
export const adminRefundRequests = onRequest(
  { cors: true },
  async (req, res) => {
    if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
    try { await verifyAdmin(req.headers.authorization); } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unauthorized";
      res.status(msg.includes("Forbidden") ? 403 : 401).json({ error: msg });
      return;
    }

    try {
      const snapshot = await db.collection("refund_requests")
        .orderBy("requestedAt", "desc")
        .limit(50)
        .get();

      const requests = await Promise.all(snapshot.docs.map(async (doc) => {
        const data = doc.data();
        const uid = data.uid as string;

        // Look up planCount info for refund eligibility display
        let planCountAtPayment: number | null = null;
        let currentPlanCount = 0;
        try {
          const subDoc = await db.collection("subscriptions").doc(uid).get();
          if (subDoc.exists) {
            planCountAtPayment = subDoc.data()?.planCountAtPayment ?? null;
          }
          const profileDoc = await db.collection("users").doc(uid).get();
          if (profileDoc.exists) {
            currentPlanCount = profileDoc.data()?.planCount || 0;
          }
        } catch {
          // proceed with defaults
        }

        return {
          id: doc.id,
          uid,
          email: data.email || "",
          reason: data.reason || "",
          status: data.status || "pending",
          paymentId: data.paymentId || null,
          amount: data.amount || null,
          requestedAt: data.requestedAt?.toDate?.().toISOString() || null,
          planCountAtPayment,
          currentPlanCount,
          planUsed: planCountAtPayment !== null ? currentPlanCount > planCountAtPayment : false,
        };
      }));

      res.status(200).json({ requests });
    } catch (error) {
      console.error("adminRefundRequests error:", error);
      res.status(500).json({ error: "환불 요청 목록 조회 실패" });
    }
  }
);

/**
 * POST /adminProcessRefund
 * Body: { requestId, action: "approve" | "reject" }
 * Admin only: 환불 요청 승인/거절 처리
 */
export const adminProcessRefund = onRequest(
  { cors: true, secrets: ["PORTONE_API_SECRET"] },
  async (req, res) => {
    if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

    let adminUid: string;
    try { adminUid = await verifyAdmin(req.headers.authorization); } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unauthorized";
      res.status(msg.includes("Forbidden") ? 403 : 401).json({ error: msg });
      return;
    }

    const { requestId, action } = req.body;
    if (!requestId || !action) { res.status(400).json({ error: "Missing requestId or action" }); return; }
    if (action !== "approve" && action !== "reject") { res.status(400).json({ error: "Invalid action" }); return; }

    try {
      // 1. Get refund request
      const refundRef = db.collection("refund_requests").doc(requestId);
      const refundDoc = await refundRef.get();

      if (!refundDoc.exists) {
        res.status(404).json({ error: "환불 요청을 찾을 수 없습니다." });
        return;
      }

      const refundData = refundDoc.data()!;

      if (refundData.status !== "pending") {
        res.status(400).json({ error: "이미 처리된 환불 요청입니다." });
        return;
      }

      if (action === "approve") {
        const uid = refundData.uid as string;
        const paymentId = refundData.paymentId as string;

        if (!paymentId) {
          res.status(400).json({ error: "결제 ID가 없어 환불을 진행할 수 없습니다." });
          return;
        }

        // 2. Get subscription doc
        const subDoc = await db.collection("subscriptions").doc(uid).get();

        // 3. Call PortOne refund API
        const secret = getPortOneSecret();
        const cancelRes = await fetch(`${PORTONE_API_BASE}/payments/${paymentId}/cancel`, {
          method: "POST",
          headers: {
            "Authorization": `PortOne ${secret}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reason: "고객 환불 요청" }),
        });

        if (!cancelRes.ok) {
          const err = await cancelRes.json().catch(() => ({}));
          console.error("PortOne refund failed:", err);
          throw new Error("PortOne 환불 처리에 실패했습니다.");
        }

        // 4. Update refund request → approved
        await refundRef.update({
          status: "approved",
          processedAt: FieldValue.serverTimestamp(),
        });

        // 5. Update subscription → free
        if (subDoc.exists) {
          await db.collection("subscriptions").doc(uid).update({
            status: "free",
            billingKey: "",
            expiresAt: null,
            updatedAt: FieldValue.serverTimestamp(),
          });
        }

        // 6. Log
        await db.collection("admin_logs").add({
          action: "refund_approve",
          adminUid,
          targetUid: uid,
          targetEmail: refundData.email || "",
          requestId,
          paymentId,
          amount: refundData.amount || null,
          timestamp: FieldValue.serverTimestamp(),
        });

        res.status(200).json({ status: "approved", requestId });
      } else {
        // reject
        await refundRef.update({
          status: "rejected",
          processedAt: FieldValue.serverTimestamp(),
        });

        await db.collection("admin_logs").add({
          action: "refund_reject",
          adminUid,
          targetUid: refundData.uid || "",
          targetEmail: refundData.email || "",
          requestId,
          timestamp: FieldValue.serverTimestamp(),
        });

        res.status(200).json({ status: "rejected", requestId });
      }
    } catch (error) {
      console.error("adminProcessRefund error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "환불 처리에 실패했습니다." });
    }
  }
);
