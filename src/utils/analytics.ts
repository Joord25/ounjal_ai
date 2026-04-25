/**
 * GA4 퍼널 트래킹 유틸리티
 * - 앱 기능에 영향 없음 (gtag 실패해도 무시)
 * - 퍼널 드롭오프 분석용 핵심 이벤트만 발화
 */

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

type FunnelEvent =
  | "login"
  | "nutrition_onboarding_start"
  | "nutrition_onboarding_profile"
  | "nutrition_onboarding_goal"
  | "nutrition_onboarding_complete"
  | "landing_cta_click"
  | "chat_submit"
  | "chat_plan_generated"
  | "chat_plan_failed"
  | "chat_program_generated"
  | "intensity_change"
  | "plan_regenerate"
  | "purchase"
  | "plan_preview_view"
  | "plan_preview_start"
  | "plan_preview_reject"
  | "workout_start"
  | "workout_complete"
  | "workout_abandon"
  | "report_view"
  | "paywall_view"
  | "paywall_tap_subscribe"
  | "paywall_dismiss"
  | "guest_to_login"
  | "guest_trial_exhausted"
  | "login_modal_view"
  | "chat_home_initial_greeting_shown"
  | "chat_home_initial_cta_click"
  | "chat_home_initial_followup_tap"
  | "running_program_sheet_open"
  | "running_program_select"
  | "running_program_gate_pass"
  | "running_program_gate_fail"
  | "running_program_created"
  | "running_program_create_failed"
  | "running_program_sheet_abandoned"
  | "intl_waitlist_join"
  | "workout_music_play"
  | "workout_music_pause"
  | "workout_music_next"
  | "workout_music_select";

export function trackEvent(event: FunnelEvent, params?: Record<string, string | number | boolean>) {
  try {
    // 회의 2026-04-23: gtag 로더가 늦게 로드되면 queue 된 이벤트가 드롭되는 케이스 발견.
    // dataLayer 직접 push 를 병행해 GTM 이 어떻게 감싸든 이벤트 레코드가 남도록 이중화.
    if (typeof window !== "undefined") {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event, ...(params || {}) });
    }
    window.gtag?.("event", event, params);

    if (process.env.NODE_ENV === "development") {
      // 개발 환경에서만 콘솔에 노출 — Network 탭 /g/collect 대조 쉽게
      // eslint-disable-next-line no-console
      console.debug("[trackEvent]", event, params ?? {});
    }
  } catch {
    // 트래킹 실패해도 앱 동작에 영향 없음
  }
}

/**
 * GA4 user_id 설정 — 로그인 시 Firebase uid를 GA4에 전달
 * BigQuery에서 GA 이벤트 ↔ Firestore 문서 조인 가능해짐
 * null 전달 시 user_id 해제 (로그아웃)
 */
export function setAnalyticsUserId(userId: string | null) {
  try {
    window.gtag?.("set", { user_id: userId });
  } catch {
    // 실패해도 앱 동작 영향 없음
  }
}
