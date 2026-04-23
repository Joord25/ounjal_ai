import { onSchedule } from "firebase-functions/v2/scheduler";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../helpers";

/**
 * 만료된 구독 자동 비활성화 (일 1회, 03:00 KST).
 *
 * 배경: PortOne 경로는 renewal 트리거가 없어 expiresAt 지나도 status="active" 유지.
 *       Paddle 경로도 webhook 지연/유실 시 drift 가능.
 *       getSubscription 은 유저가 들러야만 expired 로 전환 → 복귀 안 하면 영구 "active" 오표시.
 *
 * 해결: subscriptions 컬렉션 스캔하여 expiresAt < now 이면서 status in [active, cancelled]
 *       인 문서를 batch update 로 "expired" 처리. 읽기+쓰기만이라 비용 낮음.
 *
 * 주의: Paddle 자동갱신은 webhook 으로 expiresAt 을 밀어주므로 이 함수 실행 직전에도
 *       이미 연장돼 있음 (race 없음). PortOne 자동갱신은 별도 과제.
 */
export const expireSubscriptions = onSchedule(
  {
    schedule: "0 3 * * *",
    timeZone: "Asia/Seoul",
  },
  async () => {
    const now = new Date();
    console.log(`[expireSubscriptions] start at ${now.toISOString()}`);

    // subscriptions 는 유저당 1 doc 이라 full scan 비용 낮음
    const snap = await db.collection("subscriptions").get();

    const toExpire: string[] = [];
    snap.forEach((doc) => {
      const data = doc.data();
      const status = data.status;
      const expiresAt = data.expiresAt;

      if (status !== "active" && status !== "cancelled") return;
      if (!expiresAt) return;

      const exp = new Date(expiresAt);
      if (isNaN(exp.getTime())) return;
      if (exp >= now) return;

      toExpire.push(doc.id);
    });

    if (toExpire.length === 0) {
      console.log("[expireSubscriptions] no expired subscriptions found");
      return;
    }

    // Firestore batch = 최대 500 write/op. 구독자 500명 넘으면 chunk 로 나눠야 하나
    // 현재 스케일에선 단일 batch 면 충분. 안전하게 500 단위 chunk 처리.
    let processed = 0;
    for (let i = 0; i < toExpire.length; i += 500) {
      const chunk = toExpire.slice(i, i + 500);
      const batch = db.batch();
      for (const uid of chunk) {
        batch.update(db.collection("subscriptions").doc(uid), {
          status: "expired",
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();
      processed += chunk.length;
    }

    console.log(`[expireSubscriptions] expired ${processed} subscriptions`);
  }
);
