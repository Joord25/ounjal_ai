import { onRequest } from "firebase-functions/v2/https";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import { verifyAdmin, db } from "../helpers";

/**
 * POST /adminActivate
 * Body: { email, months?, days? }
 * Admin only: 이메일로 유저 찾아서 구독 활성화
 * - days 가 주어지면 일 단위 만료 (1 ~ 1825일 clamp)
 * - 없으면 months 사용 (1 ~ 60개월 clamp, 기본 1개월)
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

    // 회의: days 우선, 없으면 months 사용 (하위호환)
    // days: 1 ~ 1825일(5년) clamp, months: 1 ~ 60개월 clamp
    const rawDays = Number(req.body.days);
    const rawMonths = Number(req.body.months);
    const hasDays = Number.isFinite(rawDays) && rawDays > 0;
    const days = hasDays ? Math.max(1, Math.min(1825, Math.floor(rawDays))) : 0;
    const months = hasDays
      ? 0
      : (Number.isFinite(rawMonths) ? Math.max(1, Math.min(60, Math.floor(rawMonths))) : 1);

    try {
      // 이메일로 유저 UID 조회
      const userRecord = await getAuth().getUserByEmail(email);
      const uid = userRecord.uid;

      // 구독 활성화
      const now = new Date();
      const expiresAt = new Date(now);
      if (hasDays) {
        expiresAt.setDate(expiresAt.getDate() + days);
      } else {
        expiresAt.setMonth(expiresAt.getMonth() + months);
      }

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
        days,
        expiresAt: expiresAt.toISOString(),
        timestamp: FieldValue.serverTimestamp(),
      });

      res.status(200).json({
        status: "activated",
        email,
        uid,
        months,
        days,
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
      // 회의: 매출 집계 소스 단일화 — subscriptions.amount 대신 payments 서브컬렉션 사용
      // 이유: subscriptions 상위 문서의 amount는 수동 편집/관리자 활성화에 오염되기 쉬움.
      //       payments 서브컬렉션은 PortOne 실결제 시점에만 기록되어 source of truth로 적합.
      const now = new Date();
      const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = monthStart; // exclusive

      // 시간 범위 변수들 (KST 기준) — payments iteration 전에 먼저 계산 필요
      // (결제 행 집계가 Firebase Auth 섹션보다 앞에 있어서 TDZ 방지)
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

      // 1) subscriptions 상위 문서 → 구독 상태 카운트만 (매출은 분리)
      const subsSnap = await db.collection("subscriptions").get();
      let active = 0, cancelled = 0, expired = 0, expiringIn3Days = 0;
      const uidToSubStatus = new Map<string, string>();
      subsSnap.forEach(doc => {
        const d = doc.data();
        uidToSubStatus.set(doc.id, d.status || "free");
        if (d.status === "active") {
          active++;
          if (d.expiresAt) {
            const exp = new Date(d.expiresAt);
            if (exp <= threeDaysLater && exp > now) expiringIn3Days++;
          }
        } else if (d.status === "cancelled") { cancelled++; }
        else if (d.status === "expired") { expired++; }
      });

      // 1b) 체험/무료 풀 사용 분포 (회의: 소진 현황)
      // 비로그인 체험 — trial_ips 컬렉션 (GUEST_TRIAL_LIMIT=1 기준: 1회 쓰면 바로 소진)
      const trialIpsSnap = await db.collection("trial_ips").get();
      let trialExhausted = 0;
      trialIpsSnap.forEach(doc => {
        const count = Number(doc.data().count || 0);
        if (count >= 1) trialExhausted++;
      });
      const trialIpsTotal = trialExhausted;

      // 회의: freePlan 집계 SSOT를 Auth(Google 로그인)로 고정
      // 이유: Firestore users/* 에는 익명·삭제된 고아 문서가 섞여 있어
      //       기존 방식은 179명 처럼 실제 Google 계정(34명)보다 과대 집계됨.
      //       adminListUsers 의 paywall_hit 필터(이메일 있는 유저)와 카운트가 일치해야 함.
      const allAuthUsers: Array<{ uid: string; email: string; isAnonymous: boolean; createdAt: Date }> = [];
      {
        let nextToken: string | undefined;
        do {
          const result = await getAuth().listUsers(1000, nextToken);
          for (const u of result.users) {
            allAuthUsers.push({
              uid: u.uid,
              email: u.email || "",
              isAnonymous: !u.email,
              createdAt: u.metadata.creationTime ? new Date(u.metadata.creationTime) : new Date(0),
            });
          }
          nextToken = result.pageToken;
        } while (nextToken);
      }
      const googleUids = new Set(allAuthUsers.filter(u => !u.isAnonymous).map(u => u.uid));

      // 로그인 무료 유저 — users.planCount (Google 계정만, active 구독자 제외)
      // FREE_PLAN_LIMIT=2 기준: 2회 이상 = 소진 (페이월 hit)
      const usersSnap = await db.collection("users").get();
      let free0 = 0, free1 = 0, freeExhausted = 0;
      usersSnap.forEach(doc => {
        const uid = doc.id;
        // 익명/고아 문서 제외 — Auth 의 Google 계정만 카운트 (SSOT 정렬)
        if (!googleUids.has(uid)) return;
        const subStatus = uidToSubStatus.get(uid) || "free";
        // active 구독자 제외 — 이미 결제해서 소진 관점 무의미
        if (subStatus === "active") return;
        const planCount = Number(doc.data().planCount || 0);
        if (planCount >= 2) freeExhausted++;
        else if (planCount === 1) free1++;
        else free0++;
      });
      // 회의: users/* 에 문서가 없는 Google 계정은 "한 번도 플랜 생성 안 한" 상태 — free0 에 포함
      const usersDocUids = new Set<string>();
      usersSnap.forEach(doc => usersDocUids.add(doc.id));
      allAuthUsers.forEach(u => {
        if (u.isAnonymous) return;
        if (usersDocUids.has(u.uid)) return;
        if ((uidToSubStatus.get(u.uid) || "free") === "active") return;
        free0++;
      });
      const freeUsersTotal = free0 + free1 + freeExhausted;

      // 2) payments 서브컬렉션 → 실제 결제 기록 기반 매출 집계 (SSOT)
      let monthlyRevenue = 0;
      let monthlyPaymentCount = 0;
      let lastMonthRevenue = 0;
      let lastMonthPaymentCount = 0;
      // 회의: 결제 건수 체험/가입 테이블의 결제 행용 — 기간별 카운트
      let paidToday = 0, paidYesterday = 0;
      let paidWeek = 0, paidLastWeek = 0;
      let paidMonth = 0, paidLastMonth = 0;
      let paidTotal = 0;
      let totalRevenue = 0;
      const paidUserIds = new Set<string>(); // 유니크 결제 유저 (CVR 계산용)
      const paymentsSnap = await db.collectionGroup("payments").get();
      paymentsSnap.forEach(doc => {
        const p = doc.data();
        const amount = Number(p.amount || 0);
        if (!p.paidAt || amount <= 0) return;
        // status 필드가 있으면 "paid"만 카운트 (refunded/failed 제외)
        if (p.status && p.status !== "paid") return;
        const paymentDate = new Date(p.paidAt);

        // 전체 카운트 + 누적 매출 + 유니크 유저 (LTV/Churn/CVR 계산용)
        paidTotal++;
        totalRevenue += amount;
        const uid = doc.ref.parent.parent?.id;
        if (uid) paidUserIds.add(uid);

        // 이번달/전월 매출 + 건수
        if (paymentDate >= monthStart) {
          monthlyRevenue += amount;
          monthlyPaymentCount++;
          paidMonth++;
        } else if (paymentDate >= lastMonthStart && paymentDate < lastMonthEnd) {
          lastMonthRevenue += amount;
          lastMonthPaymentCount++;
          paidLastMonth++;
        }

        // 오늘/어제 카운트 (월 집계와 독립)
        if (paymentDate >= todayStart) {
          paidToday++;
        } else if (paymentDate >= yesterdayStart && paymentDate < todayStart) {
          paidYesterday++;
        }

        // 이번주/지난주 카운트 (월 집계와 독립)
        if (paymentDate >= weekStart) {
          paidWeek++;
        } else if (paymentDate >= lastWeekStart && paymentDate < weekStart) {
          paidLastWeek++;
        }
      });
      const paidUniqueUsers = paidUserIds.size;

      // Auth 유저 수집은 상단 freePlan 집계에서 이미 수행됨 (allAuthUsers 재사용)
      const allUsers = allAuthUsers;

      // Segment: Google accounts vs anonymous (trial)
      const googleUsers = allUsers.filter(u => !u.isAnonymous);
      const trialUsers = allUsers.filter(u => u.isAnonymous);

      // Time ranges는 위에서 이미 계산됨 (payments iteration 전에 선언)

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

      // 회의: 성장 지표 — CVR (전환율) / LTV (생애가치) / Churn (이탈률)
      const trialCount = trialUsers.length;
      const registeredCount = googleUsers.length;

      // CVR — 각 단계 전환율 (%)
      const cvrTrialToRegistered = trialCount > 0
        ? Math.round((registeredCount / trialCount) * 1000) / 10  // 소수점 1자리
        : null;
      const cvrRegisteredToPaid = registeredCount > 0
        ? Math.round((paidUniqueUsers / registeredCount) * 1000) / 10
        : null;
      const cvrTrialToPaid = trialCount > 0
        ? Math.round((paidUniqueUsers / trialCount) * 1000) / 10
        : null;

      // LTV — 생애가치 = (누적 매출 / 유니크 결제 유저) (보수적 집계, 환불 제외)
      // 이상적으로는 ARPU × 평균 구독 개월이지만 시계열 데이터 부재 → 누적 실매출 기반
      const ltv = paidUniqueUsers > 0 ? Math.round(totalRevenue / paidUniqueUsers) : 0;

      // Churn — 이탈률 = (해지 + 만료) / (전체 구독 이력)
      // 누적 기준 (시계열 없음). 월간 churn은 별도 집계 필요
      const totalSubscribersEver = active + cancelled + expired;
      const churnRate = totalSubscribersEver > 0
        ? Math.round(((cancelled + expired) / totalSubscribersEver) * 1000) / 10
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
        // 회의: 결제 행 (체험/가입 테이블 3번째 행) — 기간별 건수
        paid: {
          today: paidToday,
          yesterday: paidYesterday,
          week: paidWeek,
          lastWeek: paidLastWeek,
          month: paidMonth,
          lastMonth: paidLastMonth,
          total: paidTotal,
        },
        // 회의: 성장 지표 — CVR/LTV/Churn
        growth: {
          cvrTrialToRegistered,     // 체험 → 가입 %
          cvrRegisteredToPaid,      // 가입 → 결제 %
          cvrTrialToPaid,           // 체험 → 결제 %
          ltv,                      // 생애가치 (누적 매출 / 유니크 결제 유저)
          churnRate,                // 이탈률 % (누적 기준)
          paidUniqueUsers,          // 유니크 결제 유저 수
          totalRevenue,             // 누적 총 매출
        },
        // 회의: 체험/무료 풀 소진 현황
        usage: {
          guestTrial: {
            total: trialIpsTotal,
            exhausted: trialExhausted,  // >= 1회 사용 (GUEST_TRIAL_LIMIT=1이므로 1회면 소진)
          },
          freePlan: {
            total: freeUsersTotal,
            used0: free0,    // 등록만 하고 아직 안 씀
            used1: free1,
            exhausted: freeExhausted,  // >= 2회 사용 (소진 = 페이월 hit)
          },
        },
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

      // 2b. users.planCount Map 생성 (paywall_hit 필터용)
      const usersSnap = await db.collection("users").get();
      const planCountMap = new Map<string, number>();
      usersSnap.forEach(doc => planCountMap.set(doc.id, Number(doc.data().planCount || 0)));

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
          planCount: planCountMap.get(u.uid) || 0,
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

      // 4. 상태 필터 (회의 57: expiring_soon + paywall_hit 특수 필터)
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
      } else if (status === "paywall_hit") {
        // 회의: 무료 2회 소진 후 결제 안 한 유저 (페이월 hit)
        filtered = searchFiltered.filter(u => u.status !== "active" && u.planCount >= 2);
      } else {
        filtered = searchFiltered.filter(u => u.status === status);
      }

      // 5. 최근순 정렬 (특수 필터는 자체 정렬)
      if (status === "expiring_soon") {
        filtered.sort((a, b) => new Date(a.expiresAt || 0).getTime() - new Date(b.expiresAt || 0).getTime());
      } else if (status === "paywall_hit") {
        // 가장 많이 쓴 순 (hit 가장 최근일수록 위)
        filtered.sort((a, b) => b.planCount - a.planCount || b.sortKey - a.sortKey);
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
        planCount: u.planCount,
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
          days: data.days || 0,
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
