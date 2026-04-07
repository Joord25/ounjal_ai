/**
 * GA4 퍼널 트래킹 유틸리티
 * - 앱 기능에 영향 없음 (gtag 실패해도 무시)
 * - 퍼널 드롭오프 분석용 핵심 이벤트만 발화
 */

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

type FunnelEvent =
  | "onboarding_start"
  | "onboarding_profile"
  | "onboarding_goal"
  | "onboarding_complete"
  | "condition_check_start"
  | "condition_check_step"
  | "condition_check_complete"
  | "plan_preview_view"
  | "plan_preview_start"
  | "workout_start"
  | "workout_complete"
  | "workout_abandon"
  | "report_view"
  | "paywall_view"
  | "paywall_tap_subscribe"
  | "paywall_dismiss"
  | "subscription_complete";

export function trackEvent(event: FunnelEvent, params?: Record<string, string | number | boolean>) {
  try {
    window.gtag?.("event", event, params);
  } catch {
    // 트래킹 실패해도 앱 동작에 영향 없음
  }
}
