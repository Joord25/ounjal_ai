import { onRequest } from "firebase-functions/v2/https";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import { verifyAuth, db } from "../helpers";

const PORTONE_API_BASE = "https://api.portone.io";
const SUBSCRIPTION_AMOUNT = 6900;

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
      const subRef = db.collection("subscriptions").doc(uid);

      // 0. Atomic pre-check via transaction — prevent race conditions & duplicate charges
      const preCheck = await db.runTransaction(async (tx) => {
        const subDoc = await tx.get(subRef);
        if (subDoc.exists) {
          const subData = subDoc.data()!;
          if (subData.status === "active") {
            return { blocked: true, error: "이미 활성 구독이 있습니다." };
          }
          if (subData.status === "processing") {
            // Check if stuck (>5 min = stale, release it)
            const updatedAt = subData.updatedAt?.toDate?.();
            if (updatedAt && (Date.now() - updatedAt.getTime()) < 5 * 60 * 1000) {
              return { blocked: true, error: "결제가 이미 처리 중입니다. 잠시 후 다시 시도해주세요." };
            }
            // Stale processing state — allow retry
          }
        }
        // Mark as "processing" to block concurrent requests
        if (subDoc.exists) {
          tx.update(subRef, { status: "processing", updatedAt: FieldValue.serverTimestamp() });
        } else {
          tx.set(subRef, { uid, status: "processing", createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
        }
        return { blocked: false };
      });

      if (preCheck.blocked) {
        res.status(400).json({ error: preCheck.error });
        return;
      }

      // Check for pending refund request
      const pendingRefund = await db.collection("refund_requests")
        .where("uid", "==", uid)
        .where("status", "==", "pending")
        .limit(1)
        .get();
      if (!pendingRefund.empty) {
        await subRef.update({ status: "cancelled", updatedAt: FieldValue.serverTimestamp() });
        res.status(400).json({ error: "환불 요청이 처리 중입니다. 완료 후 다시 시도해주세요." });
        return;
      }

      // 0b. Verify billing key ownership (fail-closed: block on any error)
      try {
        const verifyRes = await fetch(`${PORTONE_API_BASE}/billing-keys/${billingKey}`, {
          headers: { "Authorization": `PortOne ${secret}` },
        });
        if (!verifyRes.ok) {
          await subRef.update({ status: "free", updatedAt: FieldValue.serverTimestamp() });
          res.status(400).json({ error: "빌링키 검증에 실패했습니다." });
          return;
        }
        const bkData = await verifyRes.json();
        if (bkData.customer?.id && bkData.customer.id !== uid) {
          await subRef.update({ status: "free", updatedAt: FieldValue.serverTimestamp() });
          res.status(403).json({ error: "빌링키 소유자가 일치하지 않습니다." });
          return;
        }
      } catch (verifyErr) {
        console.error("Billing key verification failed:", verifyErr);
        await subRef.update({ status: "free", updatedAt: FieldValue.serverTimestamp() });
        res.status(500).json({ error: "빌링키 검증 중 오류가 발생했습니다." });
        return;
      }

      const now_ = new Date();
      const dateStr = `${now_.getFullYear()}${String(now_.getMonth() + 1).padStart(2, "0")}${String(now_.getDate()).padStart(2, "0")}`;
      const rand = require("crypto").randomBytes(4).toString("hex");
      const paymentId = `OHUNJAL-${dateStr}-${rand}`;

      // 1. Process payment with billing key
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
        // Rollback processing status
        await subRef.update({ status: "free", updatedAt: FieldValue.serverTimestamp() });
        throw new Error("결제 처리에 실패했습니다.");
      }

      // 2. Save subscription to Firestore
      const now = new Date();
      const expiresAt = new Date(now);
      expiresAt.setMonth(expiresAt.getMonth() + 1);

      const profileDoc = await db.collection("users").doc(uid).get();
      const planCountAtPayment = profileDoc.exists ? (profileDoc.data()?.planCount || 0) : 0;

      await subRef.update({
        billingKey,
        status: "active",
        plan: "monthly",
        amount: SUBSCRIPTION_AMOUNT,
        lastPaymentId: paymentId,
        lastPaymentAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        planCountAtPayment,
        updatedAt: FieldValue.serverTimestamp(),
      });

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

/**
 * POST /submitRefundRequest
 * Body: { reason }
 * 결제 후 7일 이내 환불 요청 접수
 */
export const submitRefundRequest = onRequest(
  { cors: true },
  async (req, res) => {
    if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

    let uid: string;
    try { uid = await verifyAuth(req.headers.authorization); } catch { res.status(401).json({ error: "Unauthorized" }); return; }

    const { reason } = req.body;
    if (!reason) { res.status(400).json({ error: "Missing reason" }); return; }

    try {
      // 1. Check subscription exists
      const subDoc = await db.collection("subscriptions").doc(uid).get();
      if (!subDoc.exists) {
        res.status(400).json({ error: "구독 정보가 없습니다." });
        return;
      }

      const subData = subDoc.data()!;

      // 2. Validate payment within 7 days
      if (!subData.lastPaymentAt) {
        res.status(400).json({ error: "결제 내역이 없습니다." });
        return;
      }

      const lastPayment = new Date(subData.lastPaymentAt);
      const now = new Date();
      const diffDays = (now.getTime() - lastPayment.getTime()) / (1000 * 60 * 60 * 24);

      if (diffDays > 7) {
        res.status(400).json({ error: "결제 후 7일이 지나 환불 요청이 불가합니다." });
        return;
      }

      // 2b. Check if AI workout plan was generated after payment
      const planCountAtPayment = subData.planCountAtPayment ?? 0;
      const profileDoc = await db.collection("users").doc(uid).get();
      const currentPlanCount = profileDoc.exists ? (profileDoc.data()?.planCount || 0) : 0;

      if (currentPlanCount > planCountAtPayment) {
        res.status(400).json({ error: "AI 운동 플랜을 생성한 이력이 있어 환불이 불가합니다." });
        return;
      }

      // 3. Lookup email from Firebase Auth
      let email = "";
      try {
        const userRecord = await getAuth().getUser(uid);
        email = userRecord.email || "";
      } catch {
        // proceed without email
      }

      // 4. Save to refund_requests collection
      await db.collection("refund_requests").add({
        uid,
        email,
        reason,
        status: "pending",
        paymentId: subData.lastPaymentId || null,
        amount: subData.amount || null,
        requestedAt: FieldValue.serverTimestamp(),
      });

      // 5. Auto-cancel subscription (stop auto-renewal)
      if (subData.status === "active") {
        await db.collection("subscriptions").doc(uid).update({
          status: "cancelled",
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      res.status(200).json({ status: "pending", message: "환불 요청이 접수되었습니다." });
    } catch (error) {
      console.error("submitRefundRequest error:", error);
      res.status(500).json({ error: "환불 요청에 실패했습니다." });
    }
  }
);
