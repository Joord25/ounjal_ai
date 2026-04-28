import { onRequest } from "firebase-functions/v2/https";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";
import { FieldValue } from "firebase-admin/firestore";
import { verifyAuth, db } from "../helpers";

/**
 * POST /selfDeleteAccount
 * Body: { }
 * 본인 확인 후 계정 삭제 — 회원 탈퇴
 *
 * 법적 근거:
 * - PIPA §21 ② : 법정 보관 의무 기록은 다른 PII 와 분리 저장
 * - 전자상거래법 §6 : 결제·계약 기록 5년, 불만·분쟁 3년 보관
 * - 국세기본법 §85-3 : 세무 증빙 5년 보관
 *
 * 처리 순서:
 * 1. verifyAuth — 본인 확인
 * 2. 활성 구독자 가드 — status === "active" 면 400
 * 3. users/{uid}/workout_history/* 전체 삭제 (batch)
 * 4. users/{uid} doc 삭제
 * 5. Storage profile_photos/{uid} 삭제
 * 6. subscriptions/{uid} 상위 doc — PII(billingKey) 제거, withdrawn 마킹
 *    (payments 하위 컬렉션은 유지 — 법정 5년 보관)
 * 7. cancel_feedbacks / refund_requests 본인 문서 PII 익명화
 * 8. admin_logs 에 self_withdraw 감사 기록
 * 9. Firebase Auth deleteUser — 마지막 단계
 */
export const selfDeleteAccount = onRequest(
  { cors: true },
  async (req, res) => {
    if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

    let uid: string;
    try { uid = await verifyAuth(req.headers.authorization); } catch {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    try {
      // 2. 활성 구독자 가드
      const subRef = db.collection("subscriptions").doc(uid);
      const subDoc = await subRef.get();
      const subData = subDoc.exists ? subDoc.data() : null;
      if (subData?.status === "active") {
        res.status(400).json({
          error: "active_subscription",
          message: "활성 구독이 있습니다. 먼저 구독을 취소한 후 탈퇴할 수 있어요.",
        });
        return;
      }

      // 3. workout_history 서브컬렉션 전체 삭제 (batch 500개씩)
      const historyRef = db.collection("users").doc(uid).collection("workout_history");
      let deletedHistory = 0;
      while (true) {
        const snap = await historyRef.limit(500).get();
        if (snap.empty) break;
        const batch = db.batch();
        snap.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        deletedHistory += snap.size;
        if (snap.size < 500) break;
      }

      // 4. users/{uid} doc 삭제
      await db.collection("users").doc(uid).delete();

      // 5. Storage profile_photos/{uid} 삭제 (존재하지 않으면 무시)
      try {
        const bucket = getStorage().bucket();
        const file = bucket.file(`profile_photos/${uid}`);
        const [exists] = await file.exists();
        if (exists) await file.delete();
      } catch (err) {
        console.warn("selfDeleteAccount: storage cleanup failed (non-fatal)", err);
      }

      // 6. subscriptions/{uid} 상위 doc — PII 제거, withdrawn 마킹
      //    payments 하위는 유지 (법정 5년 보관 — 전자상거래법 §6)
      if (subDoc.exists) {
        await subRef.update({
          status: "withdrawn",
          withdrawnAt: new Date().toISOString(),
          deletedUser: true,
          billingKey: FieldValue.delete(),   // PII 제거
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      // 7a. cancel_feedbacks 본인 문서 익명화 (uid 끊기)
      try {
        const cancelFbSnap = await db.collection("cancel_feedbacks").where("uid", "==", uid).get();
        if (!cancelFbSnap.empty) {
          const batch = db.batch();
          cancelFbSnap.docs.forEach(doc => batch.update(doc.ref, {
            uid: "<deleted>",
            deletedUser: true,
          }));
          await batch.commit();
        }
      } catch (err) {
        console.warn("selfDeleteAccount: cancel_feedbacks anonymization failed", err);
      }

      // 7b. refund_requests 본인 문서 PII 익명화 (email 제거, uid 끊기)
      try {
        const refundSnap = await db.collection("refund_requests").where("uid", "==", uid).get();
        if (!refundSnap.empty) {
          const batch = db.batch();
          refundSnap.docs.forEach(doc => batch.update(doc.ref, {
            uid: "<deleted>",
            email: FieldValue.delete(),
            deletedUser: true,
          }));
          await batch.commit();
        }
      } catch (err) {
        console.warn("selfDeleteAccount: refund_requests anonymization failed", err);
      }

      // 8. admin_logs 감사 기록 (회의 2026-04-28: withdrawals 익명 통계 컬렉션 제거 — 사용처 0)
      await db.collection("admin_logs").add({
        action: "self_withdraw",
        adminUid: uid,     // 본인이 본인을 삭제한 self-action
        targetUid: uid,
        targetEmail: null, // 이미 Auth 에서 사라질 예정
        deletedHistory,
        timestamp: FieldValue.serverTimestamp(),
      });

      // 10. Firebase Auth 계정 삭제 — 마지막 단계
      await getAuth().deleteUser(uid);

      res.status(200).json({
        status: "deleted",
        deletedHistory,
      });
    } catch (error) {
      console.error("selfDeleteAccount error:", error);
      res.status(500).json({ error: "계정 삭제에 실패했습니다." });
    }
  },
);
