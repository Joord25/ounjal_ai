import { onRequest } from "firebase-functions/v2/https";
import { BetaAnalyticsDataClient } from "@google-analytics/data";
import { verifyAdmin } from "../helpers";

// 회의 63-A: admin GA4 funnel 섹션 4종
//   ① 획득 funnel — chat_plan_generated → workout_start(source=chat) → workout_complete(source=chat)
//      Campbell 원칙: AI 제품 가치 지표는 신규 플랜의 첫 경험 전환
//   ② 리텐션 — workout_start / _complete (source=saved+program) — 저장 플랜 재실행 볼륨
//      Skok 원칙: 재실행은 리텐션 KPI, 획득 funnel 과 분리 필수
//   ③ 후킹 효과 — chat_home_initial_greeting_shown → cta_click (회의 62)
//   ④ 페이월 트리거 분포 — paywall_view.trigger 별 비중
//
// 인증: Application Default Credentials. Cloud Functions SA 에 GA4 Property 뷰어 권한 필요.
// 환경변수: GA_PROPERTY_ID (functions/.env)
//
// 맞춤 측정기준 필요 (GA4 관리 > 맞춤 정의):
//   - source  (범위: 이벤트, 매개변수: source)   ← 회의 63-A 신규
//   - trigger (범위: 이벤트, 매개변수: trigger)  ← 회의 63 기존
// 미등록 시 해당 쿼리만 실패 안내 표시, 나머지는 정상 동작.

const DEFAULT_WINDOW_DAYS = 7;
const MAX_WINDOW_DAYS = 90;
const SAMPLE_THRESHOLD = 100; // Tunguz 권고: 이벤트 수 < 100 이면 표본 부족 경고

let cachedClient: BetaAnalyticsDataClient | null = null;
function getClient(): BetaAnalyticsDataClient {
  if (!cachedClient) cachedClient = new BetaAnalyticsDataClient();
  return cachedClient;
}

type EventRow = { eventName: string; count: number };

// ───────────────────────────────────────────────────────────
// 쿼리 헬퍼
// ───────────────────────────────────────────────────────────

/** 지정 이벤트들의 count 를 eventName 단위로 반환 */
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

/**
 * 회의 63-A: eventName + customEvent:source 복합 그룹핑
 * source 맞춤 측정기준 미등록 시 INVALID_ARGUMENT → 호출부에서 처리.
 * 반환: { [eventName]: { [source]: count } }
 */
async function runEventCountBySource(
  propertyId: string,
  startDaysAgo: number,
  endDaysAgo: number,
  eventNames: string[],
): Promise<Record<string, Record<string, number>>> {
  const [response] = await getClient().runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: `${startDaysAgo}daysAgo`, endDate: `${endDaysAgo}daysAgo` }],
    dimensions: [{ name: "eventName" }, { name: "customEvent:source" }],
    metrics: [{ name: "eventCount" }],
    dimensionFilter: {
      filter: {
        fieldName: "eventName",
        inListFilter: { values: eventNames },
      },
    },
    limit: 500,
  });

  const out: Record<string, Record<string, number>> = {};
  for (const name of eventNames) out[name] = {};
  for (const r of response.rows || []) {
    const eventName = r.dimensionValues?.[0]?.value || "";
    const source = r.dimensionValues?.[1]?.value || "(not_set)";
    const count = Number(r.metricValues?.[0]?.value || 0);
    if (!out[eventName]) continue;
    out[eventName][source] = (out[eventName][source] || 0) + count;
  }
  return out;
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

// ───────────────────────────────────────────────────────────
// 메인 핸들러
// ───────────────────────────────────────────────────────────

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
      res.status(200).json({
        configured: false,
        reason: "GA_PROPERTY_ID 환경변수가 설정되지 않았습니다.",
        setup: [
          "1) GA4 속성 ID 확인 (관리 > 속성 설정 > 속성 ID)",
          "2) firebase functions:config:set ga.property_id=\"<속성ID>\" 또는 .env 파일에 GA_PROPERTY_ID=<속성ID>",
          "3) Cloud Functions 기본 서비스 계정(<project-number>-compute@developer.gserviceaccount.com) 에 GA4 속성 '뷰어' 권한 부여",
          "4) firebase deploy --only functions",
        ],
      });
      return;
    }

    const rawDays = Number(req.body?.windowDays);
    const windowDays = Number.isFinite(rawDays) ? Math.max(1, Math.min(MAX_WINDOW_DAYS, Math.floor(rawDays))) : DEFAULT_WINDOW_DAYS;
    const startDaysAgo = windowDays;
    const endDaysAgo = 0;

    try {
      // 4개 쿼리 독립 실행 — 하나 실패해도 나머지 표시
      const [hookingRes, aggregateRes, bySourceRes, paywallRes] = await Promise.allSettled([
        // ① 후킹 (회의 62)
        runEventCountReport(propertyId, startDaysAgo, endDaysAgo, [
          "chat_home_initial_greeting_shown",
          "chat_home_initial_cta_click",
          "chat_home_initial_followup_tap",
        ]),
        // ② 전체 집계 (source 구분 없이 총량) — backward compat + chat_plan_generated 분모
        runEventCountReport(propertyId, startDaysAgo, endDaysAgo, [
          "chat_plan_generated",
          "plan_preview_view",
          "plan_preview_start",
          "workout_start",
          "workout_complete",
          "workout_abandon",
        ]),
        // ③ source 기반 분리 (회의 63-A 신규) — 획득 vs 리텐션 계산용
        runEventCountBySource(propertyId, startDaysAgo, endDaysAgo, [
          "workout_start",
          "workout_complete",
          "workout_abandon",
          "plan_preview_start",
        ]),
        // ④ 페이월 트리거 분포
        runPaywallTriggerBreakdown(propertyId, startDaysAgo, endDaysAgo),
      ]);

      const unwrap = <T>(r: PromiseSettledResult<T>, fallback: T): T =>
        r.status === "fulfilled" ? r.value : fallback;
      const errMsg = (r: PromiseSettledResult<unknown>): string | null =>
        r.status === "rejected"
          ? (r.reason instanceof Error ? r.reason.message : String(r.reason))
          : null;

      const hooking = unwrap(hookingRes, [] as EventRow[]);
      const aggregate = unwrap(aggregateRes, [] as EventRow[]);
      const bySource = unwrap(bySourceRes, {} as Record<string, Record<string, number>>);
      const paywall = unwrap(paywallRes, [] as Array<{ trigger: string; count: number }>);

      const bySourceError = errMsg(bySourceRes);
      const paywallError = errMsg(paywallRes);
      if (bySourceError) console.warn("adminAnalyticsFunnel source-split query failed:", bySourceError);
      if (paywallError) console.warn("adminAnalyticsFunnel paywall query failed:", paywallError);

      const pickCount = (rows: EventRow[], name: string) => rows.find(r => r.eventName === name)?.count || 0;
      const pct = (num: number, den: number) =>
        den > 0 ? Math.round((num / den) * 1000) / 10 : null;
      const sourceSum = (event: string, sources: string[]): number =>
        sources.reduce((s, src) => s + (bySource[event]?.[src] || 0), 0);

      // ────────────── ① 후킹 ──────────────
      const greetingShown = pickCount(hooking, "chat_home_initial_greeting_shown");
      const ctaClick = pickCount(hooking, "chat_home_initial_cta_click");
      const followupTap = pickCount(hooking, "chat_home_initial_followup_tap");

      // ────────────── ② 전체 집계 (backward compat) ──────────────
      const planGenerated = pickCount(aggregate, "chat_plan_generated");
      const workoutStartAll = pickCount(aggregate, "workout_start");
      const workoutCompleteAll = pickCount(aggregate, "workout_complete");
      const workoutAbandonAll = pickCount(aggregate, "workout_abandon");

      // ────────────── ③ 획득 funnel (source=chat) ──────────────
      //   Campbell: AI 제품 가치 = 신규 플랜 완주율. 저장 재실행은 분리.
      const sourceSplitOk = !bySourceError;
      const chatStart = sourceSplitOk ? sourceSum("workout_start", ["chat"]) : 0;
      const chatComplete = sourceSplitOk ? sourceSum("workout_complete", ["chat"]) : 0;
      const chatAbandon = sourceSplitOk ? sourceSum("workout_abandon", ["chat"]) : 0;

      // ────────────── ④ 리텐션 (source=saved + program) ──────────────
      //   Skok: 재실행 볼륨은 리텐션 KPI. 완주율은 분리 계산.
      const retentionStart = sourceSplitOk ? sourceSum("workout_start", ["saved", "program"]) : 0;
      const retentionComplete = sourceSplitOk ? sourceSum("workout_complete", ["saved", "program"]) : 0;
      const resumeStart = sourceSplitOk ? sourceSum("workout_start", ["resume"]) : 0;

      // 표본 충분도 경고 (Tunguz)
      const sampleWarning = (n: number): boolean => n > 0 && n < SAMPLE_THRESHOLD;

      res.status(200).json({
        configured: true,
        windowDays,
        sampleThreshold: SAMPLE_THRESHOLD,
        // ── 후킹 ──
        hooking: {
          greetingShown,
          ctaClick,
          followupTap,
          ctaRate: pct(ctaClick, greetingShown),
          followupRate: pct(followupTap, greetingShown),
          lowSample: sampleWarning(greetingShown),
        },
        // ── 획득 funnel (신규 플랜 가치 측정) ──
        acquisition: {
          planGenerated,
          workoutStart: chatStart,
          workoutComplete: chatComplete,
          workoutAbandon: chatAbandon,
          planToStart: pct(chatStart, planGenerated),
          startToComplete: pct(chatComplete, chatStart),
          planToComplete: pct(chatComplete, planGenerated),
          lowSample: sampleWarning(planGenerated),
        },
        // ── 리텐션 (저장 플랜 재실행 볼륨) ──
        retention: {
          workoutStart: retentionStart,
          workoutComplete: retentionComplete,
          resumeStart,
          completionRate: pct(retentionComplete, retentionStart),
          reuseShare: pct(retentionStart, workoutStartAll),  // 전체 session 중 저장 재실행 비중
        },
        // ── 전체 집계 (backward compat + 비교용) ──
        aggregate: {
          planGenerated,
          workoutStart: workoutStartAll,
          workoutComplete: workoutCompleteAll,
          workoutAbandon: workoutAbandonAll,
          startToComplete: pct(workoutCompleteAll, workoutStartAll),
        },
        // source 분리 실패 시 UI 안내용
        sourceSplitError: bySourceError
          ? (bySourceError.includes("INVALID_ARGUMENT") || bySourceError.includes("does not have")
            ? "customEvent:source 맞춤 측정기준 미등록 — GA4 관리 > 맞춤 정의 > 맞춤 측정기준 만들기 (이름: source · 범위: 이벤트 · 매개변수: source). 등록 후 24~48시간 뒤 수치 표시."
            : bySourceError)
          : null,
        // ── 페이월 트리거 ──
        paywallTriggers: paywall,
        paywallError: paywallError
          ? (paywallError.includes("INVALID_ARGUMENT") || paywallError.includes("does not have")
            ? "customEvent:trigger 맞춤 측정기준 미등록 — GA4 관리 > 맞춤 정의 > 맞춤 측정기준 만들기 (범위: 이벤트, 매개변수: trigger)"
            : paywallError)
          : null,
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "unknown";
      console.error("adminAnalyticsFunnel error:", msg);
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
