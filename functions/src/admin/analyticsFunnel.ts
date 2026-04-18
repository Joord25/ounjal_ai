import { onRequest } from "firebase-functions/v2/https";
import { BetaAnalyticsDataClient } from "@google-analytics/data";
import { verifyAdmin } from "../helpers";

// 회의 63: admin 에 GA4 funnel 3종 카드 신설
//   ① 후킹 효과 — chat_home_initial_greeting_shown → cta_click (회의 62 효과 정량화)
//   ② 차별성 KPI — chat_plan_generated → workout_start → workout_complete (회의 57 GA 가이드 핵심)
//   ③ 페이월 트리거 분포 — paywall_view.trigger 별 비중 (트리거별 결제 전환 비교)
//
// 인증: Application Default Credentials 사용. Firebase Cloud Functions 기본 서비스 계정에
//       GA4 Property 의 "뷰어" 권한을 부여해야 함. 설정 안 되어 있으면 configured=false 반환.
//
// 환경 변수:
//   GA_PROPERTY_ID — GA4 속성 ID (숫자). 예: "123456789"
//                    Firebase: firebase functions:config:set ga.property_id="123456789"
//                    또는 .env.{env}: GA_PROPERTY_ID=123456789

const DEFAULT_WINDOW_DAYS = 7;
const MAX_WINDOW_DAYS = 90;

let cachedClient: BetaAnalyticsDataClient | null = null;
function getClient(): BetaAnalyticsDataClient {
  if (!cachedClient) cachedClient = new BetaAnalyticsDataClient();
  return cachedClient;
}

type EventRow = { eventName: string; count: number };

async function runEventCountReport(
  propertyId: string,
  startDaysAgo: number,
  endDaysAgo: number,
  eventNames: string[],
): Promise<EventRow[]> {
  const [response] = await getClient().runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: `${startDaysAgo}daysAgo`, endDate: `${endDaysAgo}daysAgo` }],
    dimensions: [{ name: "eventName" }],
    metrics: [{ name: "eventCount" }],
    dimensionFilter: {
      filter: {
        fieldName: "eventName",
        inListFilter: { values: eventNames },
      },
    },
    limit: 100,
  });

  const rows = response.rows || [];
  const map = new Map<string, number>();
  for (const name of eventNames) map.set(name, 0);
  for (const r of rows) {
    const name = r.dimensionValues?.[0]?.value || "";
    const count = Number(r.metricValues?.[0]?.value || 0);
    if (map.has(name)) map.set(name, count);
  }
  return eventNames.map(name => ({ eventName: name, count: map.get(name) || 0 }));
}

async function runPaywallTriggerBreakdown(
  propertyId: string,
  startDaysAgo: number,
  endDaysAgo: number,
): Promise<Array<{ trigger: string; count: number }>> {
  const [response] = await getClient().runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: `${startDaysAgo}daysAgo`, endDate: `${endDaysAgo}daysAgo` }],
    dimensions: [{ name: "customEvent:trigger" }],
    metrics: [{ name: "eventCount" }],
    dimensionFilter: {
      filter: {
        fieldName: "eventName",
        stringFilter: { matchType: "EXACT", value: "paywall_view" },
      },
    },
    orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
    limit: 20,
  });

  const rows = response.rows || [];
  return rows.map(r => ({
    trigger: r.dimensionValues?.[0]?.value || "(not_set)",
    count: Number(r.metricValues?.[0]?.value || 0),
  }));
}

export const adminAnalyticsFunnel = onRequest(
  { cors: true },
  async (req, res) => {
    if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
    try { await verifyAdmin(req.headers.authorization); } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unauthorized";
      res.status(msg.includes("Forbidden") ? 403 : 401).json({ error: msg });
      return;
    }

    const propertyId = process.env.GA_PROPERTY_ID || "";
    if (!propertyId) {
      // 설정 안 됨 — admin 이 UX 로 안내 표시
      res.status(200).json({
        configured: false,
        reason: "GA_PROPERTY_ID 환경변수가 설정되지 않았습니다.",
        setup: [
          "1) GA4 속성 ID 확인 (관리 > 속성 설정 > 속성 ID)",
          "2) firebase functions:config:set ga.property_id=\"<속성ID>\" 또는 .env 파일에 GA_PROPERTY_ID=<속성ID>",
          "3) Cloud Functions 기본 서비스 계정(<project>@appspot.gserviceaccount.com) 에 GA4 속성 '뷰어' 권한 부여",
          "4) firebase deploy --only functions",
        ],
      });
      return;
    }

    const rawDays = Number(req.body?.windowDays);
    const windowDays = Number.isFinite(rawDays) ? Math.max(1, Math.min(MAX_WINDOW_DAYS, Math.floor(rawDays))) : DEFAULT_WINDOW_DAYS;
    const startDaysAgo = windowDays;  // ex: 7
    const endDaysAgo = 0;             // 오늘까지

    try {
      const [hooking, differentiation, paywall] = await Promise.all([
        runEventCountReport(propertyId, startDaysAgo, endDaysAgo, [
          "chat_home_initial_greeting_shown",
          "chat_home_initial_cta_click",
          "chat_home_initial_followup_tap",
        ]),
        runEventCountReport(propertyId, startDaysAgo, endDaysAgo, [
          "chat_plan_generated",
          "plan_preview_view",
          "plan_preview_start",
          "workout_start",
          "workout_complete",
          "workout_abandon",
        ]),
        runPaywallTriggerBreakdown(propertyId, startDaysAgo, endDaysAgo),
      ]);

      // funnel 파생 지표
      const pickCount = (rows: EventRow[], name: string) => rows.find(r => r.eventName === name)?.count || 0;
      const greetingShown = pickCount(hooking, "chat_home_initial_greeting_shown");
      const ctaClick = pickCount(hooking, "chat_home_initial_cta_click");
      const followupTap = pickCount(hooking, "chat_home_initial_followup_tap");
      const planGenerated = pickCount(differentiation, "chat_plan_generated");
      const workoutStart = pickCount(differentiation, "workout_start");
      const workoutComplete = pickCount(differentiation, "workout_complete");
      const workoutAbandon = pickCount(differentiation, "workout_abandon");

      const pct = (num: number, den: number) =>
        den > 0 ? Math.round((num / den) * 1000) / 10 : null;

      res.status(200).json({
        configured: true,
        windowDays,
        hooking: {
          greetingShown,
          ctaClick,
          followupTap,
          ctaRate: pct(ctaClick, greetingShown),
          followupRate: pct(followupTap, greetingShown),
        },
        differentiation: {
          planGenerated,
          workoutStart,
          workoutComplete,
          workoutAbandon,
          planToStart: pct(workoutStart, planGenerated),
          startToComplete: pct(workoutComplete, workoutStart),
          planToComplete: pct(workoutComplete, planGenerated),
        },
        paywallTriggers: paywall,
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "unknown";
      console.error("adminAnalyticsFunnel error:", msg);
      // 권한 오류 흔한 케이스 — 원인 정리
      const permissionIssue = msg.includes("PERMISSION_DENIED") || msg.includes("does not have");
      res.status(200).json({
        configured: false,
        reason: permissionIssue
          ? "GA4 Data API 권한이 없습니다. Cloud Functions 서비스 계정에 GA4 속성 '뷰어' 권한을 부여하세요."
          : `GA 조회 실패: ${msg}`,
      });
    }
  }
);
