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
        currency: string;       // 회의 2026-04-23: KRW/USD 구분 위해 명시 저장
        provider: string | null;
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
          // legacy 문서는 currency 필드 없음 → KRW 로 간주 (PortOne 만 있던 시절)
          currency: (data.currency || "KRW").toString().toUpperCase(),
          provider: data.provider || null,
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

      // 집계 요약 — 통화별 분리 (회의 2026-04-23: KRW+USD 혼합 합산 방지)
      const totalsByCurrency: Record<string, number> = {};
      for (const r of topRows) {
        totalsByCurrency[r.currency] = (totalsByCurrency[r.currency] || 0) + r.amount;
      }

      res.status(200).json({
        payments: enriched,
        total: enriched.length,
        // legacy 프론트 호환 — KRW 합만 보내는 totalAmount 유지하되, 정확한 값은
        // totalsByCurrency 를 보는 새 UI 에서만 참조할 것.
        totalAmount: totalsByCurrency.KRW || 0,
        totalsByCurrency,
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
      // 회의: expireSubscriptions 크론은 하루 1회 03:00 KST 에만 돌아 drift 발생 가능.
      // 대시보드 읽기 시점에 expiresAt < now 를 expired 로 간주해 실시간 정확도 확보.
      const subsSnap = await db.collection("subscriptions").get();
      let active = 0, cancelled = 0, expired = 0, expiringIn3Days = 0;
      const uidToSubStatus = new Map<string, string>();
      subsSnap.forEach(doc => {
        const d = doc.data();
        const rawStatus = d.status || "free";
        const expiresAt = d.expiresAt ? new Date(d.expiresAt) : null;
        const isExpired = expiresAt !== null && !isNaN(expiresAt.getTime()) && expiresAt < now;

        // lazy expire: active/cancelled 이지만 만료일 지났으면 expired 로 재분류
        const effectiveStatus =
          (rawStatus === "active" || rawStatus === "cancelled") && isExpired
            ? "expired"
            : rawStatus;

        uidToSubStatus.set(doc.id, effectiveStatus);

        if (effectiveStatus === "active") {
          active++;
          if (expiresAt && expiresAt <= threeDaysLater && expiresAt > now) expiringIn3Days++;
        } else if (effectiveStatus === "cancelled") { cancelled++; }
        else if (effectiveStatus === "expired") { expired++; }
      });

      // 1b) 체험/무료 풀 사용 분포 (회의: 소진 현황)
      // 비로그인 체험 — trial_ips 컬렉션 (GUEST_TRIAL_LIMIT=1 기준: 1회 쓰면 바로 소진)
      // 회의 63: trial_ips 를 "체험" 세그먼트의 SSOT 로 승격.
      //   이전엔 anonymous Auth 유저 수(= /app 진입한 모든 방문자)를 "체험" 으로 셌으나,
      //   이 집합은 봇·재방문 로그아웃 유저까지 포함되어 CVR 분모가 과대 → 업계 비교 불가.
      //   SSOT 를 "실제 플랜 생성을 시도한 IP" 로 고정해 funnel 정의를 명확화.
      const trialIpsSnap = await db.collection("trial_ips").get();
      let trialExhausted = 0;
      // trialIpRecords: 기간별 카운트용. firstSeenAt 없는 레거시 문서는 Date(0) 으로 찍어
      // total 합계엔 포함되지만 기간 필터엔 걸리지 않도록 한다.
      const trialIpRecords: Array<{ createdAt: Date }> = [];
      trialIpsSnap.forEach(doc => {
        const data = doc.data();
        const count = Number(data.count || 0);
        if (count < 1) return;
        trialExhausted++;
        const firstSeen = data.firstSeenAt?.toDate?.() as Date | undefined;
        trialIpRecords.push({ createdAt: firstSeen instanceof Date ? firstSeen : new Date(0) });
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

      // Segment: Google accounts (가입) — 회의 63: "체험" 은 이제 trialIpRecords 사용
      const googleUsers = allUsers.filter(u => !u.isAnonymous);

      // Time ranges는 위에서 이미 계산됨 (payments iteration 전에 선언)

      // 회의 2026-04-23: 커스텀 날짜 범위 지원 — req.body.customStart/customEnd (ISO date)
      // 유효하면 funnel 결과에 `custom: N` 추가. 잘못된 입력이면 무시 (안전 폴백).
      let customStart: Date | null = null;
      let customEnd: Date | null = null;
      const csIn = typeof req.body?.customStart === "string" ? req.body.customStart : null;
      const ceIn = typeof req.body?.customEnd === "string" ? req.body.customEnd : null;
      if (csIn) {
        const d = new Date(csIn);
        if (!isNaN(d.getTime())) customStart = d;
      }
      if (ceIn) {
        const d = new Date(ceIn);
        if (!isNaN(d.getTime())) {
          // end 는 inclusive 처리 — date 만 들어오면 그날 23:59:59 까지 포함
          if (ceIn.length <= 10) d.setUTCHours(23, 59, 59, 999);
          customEnd = d;
        }
      }

      const countByRange = <T extends { createdAt: Date }>(rows: T[]) => {
        const out: {
          today: number; yesterday: number; week: number; lastWeek: number;
          month: number; lastMonth: number; total: number; custom?: number;
        } = {
          today: rows.filter(u => u.createdAt >= todayStart).length,
          yesterday: rows.filter(u => u.createdAt >= yesterdayStart && u.createdAt < todayStart).length,
          week: rows.filter(u => u.createdAt >= weekStart).length,
          // 회의 57 Tier 2: 증감률 계산용 이전 기간
          lastWeek: rows.filter(u => u.createdAt >= lastWeekStart && u.createdAt < weekStart).length,
          month: rows.filter(u => u.createdAt >= monthStartDate).length,
          lastMonth: rows.filter(u => u.createdAt >= lastMonthStartDate && u.createdAt < monthStartDate).length,
          total: rows.length,
        };
        if (customStart || customEnd) {
          out.custom = rows.filter(u => {
            if (customStart && u.createdAt < customStart) return false;
            if (customEnd && u.createdAt > customEnd) return false;
            return true;
          }).length;
        }
        return out;
      };

      // 회의 63: 월별 추이 (최근 6개월) — 신규가입 · 신규결제유저 · 매출
      //   cohort 리텐션 본격 구현은 후속 과제. 지금은 단순 타임라인으로 추이 가시성만 확보.
      const monthlyTimeline: Array<{
        ym: string;            // YYYY-MM
        label: string;         // "MM월"
        signups: number;       // 해당 월 Auth 가입 (Google)
        newPaidUsers: number;  // 해당 월 첫 결제 유저
        revenue: number;       // 해당 월 매출
        churnedSubs: number;   // 해당 월 해지/만료된 subscription 수 (기록 기반 근사)
      }> = [];
      {
        const monthsBack = 6;
        const firstPaidByUid = new Map<string, Date>();
        paymentsSnap.forEach(doc => {
          const p = doc.data();
          if (!p.paidAt) return;
          if (p.status && p.status !== "paid") return;
          const uid = doc.ref.parent.parent?.id;
          if (!uid) return;
          const d = new Date(p.paidAt);
          const prev = firstPaidByUid.get(uid);
          if (!prev || d < prev) firstPaidByUid.set(uid, d);
        });
        // 월별 해지/만료 — subscriptions.updatedAt 기준 근사 (정확한 event ts 없음)
        const monthChurnCount = new Map<string, number>();
        subsSnap.forEach(doc => {
          const d = doc.data();
          if (d.status !== "cancelled" && d.status !== "expired") return;
          const upd = d.updatedAt?.toDate?.() as Date | undefined;
          if (!(upd instanceof Date)) return;
          const ym = `${upd.getFullYear()}-${String(upd.getMonth() + 1).padStart(2, "0")}`;
          monthChurnCount.set(ym, (monthChurnCount.get(ym) || 0) + 1);
        });

        for (let i = monthsBack - 1; i >= 0; i--) {
          const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const nextMonthDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
          const ym = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`;
          const label = `${monthDate.getMonth() + 1}월`;

          let signups = 0;
          googleUsers.forEach(u => {
            if (u.createdAt >= monthDate && u.createdAt < nextMonthDate) signups++;
          });

          let newPaidUsers = 0;
          firstPaidByUid.forEach(firstPaid => {
            if (firstPaid >= monthDate && firstPaid < nextMonthDate) newPaidUsers++;
          });

          let revenue = 0;
          paymentsSnap.forEach(doc => {
            const p = doc.data();
            if (!p.paidAt) return;
            if (p.status && p.status !== "paid") return;
            const pd = new Date(p.paidAt);
            if (pd >= monthDate && pd < nextMonthDate) revenue += Number(p.amount || 0);
          });

          monthlyTimeline.push({
            ym,
            label,
            signups,
            newPaidUsers,
            revenue,
            churnedSubs: monthChurnCount.get(ym) || 0,
          });
        }
      }

      // 회의 57 Tier 2: 매출 분해 데이터
      const avgPayment = monthlyPaymentCount > 0 ? Math.round(monthlyRevenue / monthlyPaymentCount) : 0;
      const revenueChangePercent = lastMonthRevenue > 0
        ? Math.round(((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
        : null;

      // 회의 63: CVR 분모를 trial_ips (실제 플랜 생성 시도 IP) 로 재정의
      //   이전 분모(anonymous Auth = /app 방문자 전체) 대비 더 좁고 엄격 → 업계 벤치마크 비교 가능
      const trialCount = trialIpRecords.length;
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

      // 회의 64-M2 Step B: 유저 행동 퍼널 집계
      // 5단계: 앱 진입 → 챗 시작 → 플랜 생성 → 운동 기록 → 운동 완주
      // 세그먼트 2종 (비로그인 anon / 로그인 가입자) 분리
      //
      // 버킷 기준:
      // - 로그인: Auth createdAt cohort (그 시점에 가입한 유저 중 현재 각 단계 도달 수)
      // - 비로그인 앱 진입: anon Auth createdAt
      // - 비로그인 챗/플랜: trial_ips.firstSeenAt (IP 단위 이벤트 시점)
      // - 비로그인 운동: anon uid의 workout_history 최초 작성 시점
      //
      // 비로그인 세그먼트는 anon Auth uid ↔ IP 해시 1:1 매칭 불가능해 서로 다른 타임축 사용.
      // 따라서 stage 간 strict subset 은 아님 (근사). 로그인 세그먼트는 uid 단일 키라 cohort 일관.
      const historySnap = await db.collectionGroup("workout_history").get();
      const uidFirstWorkout = new Map<string, Date>();
      const uidFirstCompletion = new Map<string, Date>();
      historySnap.forEach(doc => {
        const uid = doc.ref.parent.parent?.id;
        if (!uid) return;
        const d = doc.data();
        const tsFromField = d.createdAt?.toDate?.() as Date | undefined;
        const tsFromDate = typeof d.date === "string" ? new Date(d.date) : undefined;
        const dateMs = tsFromField instanceof Date ? tsFromField
          : tsFromDate instanceof Date && !isNaN(tsFromDate.getTime()) ? tsFromDate
          : new Date(0);
        const prev = uidFirstWorkout.get(uid);
        if (!prev || dateMs < prev) uidFirstWorkout.set(uid, dateMs);
        if (d.abandoned !== true) {
          const prevC = uidFirstCompletion.get(uid);
          if (!prevC || dateMs < prevC) uidFirstCompletion.set(uid, dateMs);
        }
      });

      // users doc 내 chatCount/planCount 맵 (로그인 세그먼트 chat/plan 스테이지용)
      const usersDataMap = new Map<string, { chatCount: number; planCount: number }>();
      usersSnap.forEach(doc => {
        const d = doc.data();
        usersDataMap.set(doc.id, {
          chatCount: Number(d.chatCount || 0),
          planCount: Number(d.planCount || 0),
        });
      });

      // 로그인(email) 세그먼트 — Auth cohort
      const emailAuthUsers = allAuthUsers.filter(u => !u.isAnonymous);
      const loggedInRows = emailAuthUsers.map(u => {
        const data = usersDataMap.get(u.uid);
        return {
          createdAt: u.createdAt,
          hasChat: (data?.chatCount || 0) >= 1,
          hasPlan: (data?.planCount || 0) >= 1,
          hasWorkout: uidFirstWorkout.has(u.uid),
          hasCompletion: uidFirstCompletion.has(u.uid),
        };
      });

      // 비로그인(anon) 세그먼트
      const anonAuthRows = allAuthUsers.filter(u => u.isAnonymous);
      const anonUidSet = new Set(anonAuthRows.map(u => u.uid));
      // trial_ips 기반 chat/plan (IP 시점)
      const trialIpChatRows: Array<{ createdAt: Date }> = [];
      const trialIpPlanRows: Array<{ createdAt: Date }> = [];
      trialIpsSnap.forEach(doc => {
        const data = doc.data();
        const firstSeen = data.firstSeenAt?.toDate?.() as Date | undefined;
        const createdAt = firstSeen instanceof Date ? firstSeen : new Date(0);
        if (Number(data.chatCount || 0) >= 1) trialIpChatRows.push({ createdAt });
        if (Number(data.count || 0) >= 1) trialIpPlanRows.push({ createdAt });
      });
      // workout_history 기반 anon 운동 기록/완주
      const anonWorkoutRows: Array<{ createdAt: Date }> = [];
      const anonCompletionRows: Array<{ createdAt: Date }> = [];
      uidFirstWorkout.forEach((date, uid) => {
        if (anonUidSet.has(uid)) anonWorkoutRows.push({ createdAt: date });
      });
      uidFirstCompletion.forEach((date, uid) => {
        if (anonUidSet.has(uid)) anonCompletionRows.push({ createdAt: date });
      });

      const funnel = {
        anon: {
          appEntered: countByRange(anonAuthRows),
          chatStarted: countByRange(trialIpChatRows),
          planCreated: countByRange(trialIpPlanRows),
          workoutStarted: countByRange(anonWorkoutRows),
          workoutCompleted: countByRange(anonCompletionRows),
        },
        loggedIn: {
          appEntered: countByRange(emailAuthUsers),
          chatStarted: countByRange(loggedInRows.filter(r => r.hasChat)),
          planCreated: countByRange(loggedInRows.filter(r => r.hasPlan)),
          workoutStarted: countByRange(loggedInRows.filter(r => r.hasWorkout)),
          workoutCompleted: countByRange(loggedInRows.filter(r => r.hasCompletion)),
        },
      };

      res.status(200).json({
        totalUsers: allUsers.length,
        active,
        free: googleUsers.length - active - cancelled - expired,
        cancelled,
        expired,
        expiringIn3Days,
        monthlyRevenue,
        funnel,
        customRange: customStart || customEnd ? {
          start: customStart ? customStart.toISOString() : null,
          end: customEnd ? customEnd.toISOString() : null,
        } : null,
        // 회의 57 Tier 2: 매출 분해
        monthlyPaymentCount,
        avgPayment,
        lastMonthRevenue,
        lastMonthPaymentCount,
        revenueChangePercent,
        // 회의 63: trial = trial_ips (실제 플랜 생성 시도 IP) SSOT.
        //   firstSeenAt 이 없는 레거시 문서는 lifetime total 집계에만 포함, 기간별에선 제외.
        trial: countByRange(trialIpRecords),
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
        // 회의 63: 월별 추이 (최근 6개월)
        monthlyTimeline,
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
  { cors: true, secrets: ["PORTONE_API_SECRET", "PADDLE_API_KEY"] },
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
        const provider = (subDoc.exists ? (subDoc.data()?.provider as string | undefined) : undefined) || "portone";

        // 3. Provider별 환불 API 호출 (Paddle / PortOne)
        if (provider === "paddle") {
          const paddleApiKey = process.env.PADDLE_API_KEY;
          if (!paddleApiKey) {
            console.error("[adminProcessRefund] PADDLE_API_KEY not configured");
            throw new Error("Paddle 환불 처리에 실패했습니다. (API 키 미설정)");
          }
          const isSandbox = paddleApiKey.startsWith("sdbx_") || paddleApiKey.startsWith("pdl_sdbx_");
          const paddleBase = isSandbox ? "https://sandbox-api.paddle.com" : "https://api.paddle.com";

          // 3a. Transaction 조회 → line_items[].id 추출 (Paddle adjustments는 item_id 필수)
          const txRes = await fetch(`${paddleBase}/transactions/${paymentId}`, {
            headers: { "Authorization": `Bearer ${paddleApiKey}` },
          });
          if (!txRes.ok) {
            const err = await txRes.json().catch(() => ({}));
            console.error("Paddle transaction fetch failed:", err);
            throw new Error("Paddle 거래 조회에 실패했습니다.");
          }
          const txData = await txRes.json();
          const lineItems = (txData?.data?.details?.line_items || []) as Array<{ id: string }>;
          if (lineItems.length === 0) {
            throw new Error("Paddle 거래의 항목 정보를 찾을 수 없습니다.");
          }

          // 3b. Adjustments API 호출 (전액 환불 — 정책상 부분 환불 없음)
          const refundRes = await fetch(`${paddleBase}/adjustments`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${paddleApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              action: "refund",
              transaction_id: paymentId,
              reason: "고객 환불 요청",
              items: lineItems.map((it) => ({ item_id: it.id, type: "full" })),
            }),
          });
          if (!refundRes.ok) {
            const err = await refundRes.json().catch(() => ({}));
            console.error("Paddle refund failed:", err);
            throw new Error("Paddle 환불 처리에 실패했습니다.");
          }
        } else {
          // PortOne (KO)
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
          provider,
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
