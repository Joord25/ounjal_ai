/**
 * 체험 상태 중앙 유틸 (회의 53 - 체험 라이프사이클 안내 설계)
 *
 * 배경:
 * - 기존: GUEST_TRIAL_LIMIT / FREE_PLAN_LIMIT / getGuestTrialCount 등이
 *   page.tsx에 흩어져 있어 다른 컴포넌트에서 재사용 불가
 * - 해결: 체험 상태 조회를 단일 유틸로 통일
 *
 * 사용처:
 * - ChatHome: 진행 뱃지 표시 (상태 pill)
 * - WorkoutReport: 운동 후 남은 횟수 안내
 * - ConditionCheck / MasterPlanPreview: 현재 단계 표시 (선택)
 * - page.tsx: 기존 check 로직 점진 리팩토링 가능
 */

export const GUEST_TRIAL_LIMIT = 1;
export const FREE_PLAN_LIMIT = 2;

export type TrialStage = "guest" | "logged_in_free" | "exhausted" | "premium";

export interface TrialStatus {
  /** 게스트 단계에서 완료한 운동 수 (0~1) */
  guestCompleted: number;
  /** 로그인 후 무료 플랜에서 완료한 운동 수 (0~2) */
  loggedInCompleted: number;
  /** 현재 단계에서 남은 운동 수 */
  remaining: number;
  /** 현재 단계의 총 한도 */
  currentLimit: number;
  /** 현재 단계에서 완료한 운동 수 */
  currentCompleted: number;
  /** 현재 진행 단계 */
  stage: TrialStage;
  /** 다음 마일스톤까지 남은 운동 수 (예: 로그인 유도 or paywall) */
  nextMilestoneIn: number;
}

/**
 * 게스트 체험 완료 횟수 조회 (localStorage 경유).
 * SSR 안전.
 */
export function getGuestTrialCount(): number {
  if (typeof window === "undefined") return 0;
  try {
    return parseInt(localStorage.getItem("ohunjal_guest_trial_count") || "0", 10);
  } catch {
    return 0;
  }
}

/**
 * 현재 체험 상태 종합 조회.
 *
 * @param isLoggedIn 로그인 여부
 * @param isPremium 프리미엄 구독자 여부
 * @param planCount 로그인 유저의 plan_count (userProfile.getPlanCount() 결과)
 * @returns TrialStatus 객체
 */
export function getTrialStatus(
  isLoggedIn: boolean,
  isPremium: boolean,
  planCount: number,
): TrialStatus {
  const guestCompleted = Math.min(getGuestTrialCount(), GUEST_TRIAL_LIMIT);

  if (isPremium) {
    return {
      guestCompleted,
      loggedInCompleted: planCount,
      remaining: Number.POSITIVE_INFINITY,
      currentLimit: Number.POSITIVE_INFINITY,
      currentCompleted: planCount,
      stage: "premium",
      nextMilestoneIn: Number.POSITIVE_INFINITY,
    };
  }

  if (!isLoggedIn) {
    // 게스트 단계
    const remaining = Math.max(GUEST_TRIAL_LIMIT - guestCompleted, 0);
    return {
      guestCompleted,
      loggedInCompleted: 0,
      remaining,
      currentLimit: GUEST_TRIAL_LIMIT,
      currentCompleted: guestCompleted,
      stage: remaining === 0 ? "exhausted" : "guest",
      nextMilestoneIn: remaining, // 0이면 로그인 유도 타이밍
    };
  }

  // 로그인 + 무료 플랜 단계
  const loggedInCompleted = Math.min(planCount, FREE_PLAN_LIMIT);
  const remaining = Math.max(FREE_PLAN_LIMIT - loggedInCompleted, 0);
  return {
    guestCompleted,
    loggedInCompleted,
    remaining,
    currentLimit: FREE_PLAN_LIMIT,
    currentCompleted: loggedInCompleted,
    stage: remaining === 0 ? "exhausted" : "logged_in_free",
    nextMilestoneIn: remaining, // 0이면 paywall 타이밍
  };
}

/**
 * 특정 milestone 체험 횟수에 "도달한 순간"인지 판정
 * (예: 3회째 완료 직후, 7회째 완료 직후)
 *
 * @param completed 현재 완료 횟수
 * @param milestone 검사할 마일스톤 (예: 3, 7)
 * @returns 정확히 해당 milestone에 도달했으면 true
 */
export function isAtMilestone(completed: number, milestone: number): boolean {
  return completed === milestone;
}
