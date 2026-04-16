"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { PhoneFrame } from "@/components/layout/PhoneFrame";
import { BottomTabs, TabId } from "@/components/layout/BottomTabs";
import { LoginScreen } from "@/components/layout/LoginScreen";
import { MasterPlanPreview } from "@/components/plan/MasterPlanPreview";
import type { SessionSelection } from "@/constants/workout";
import { WorkoutReport } from "@/components/report/WorkoutReport";
import { WorkoutSession } from "@/components/workout/WorkoutSession";
import { ProofTab } from "@/components/dashboard/ProofTab";
import { MyProfileTab } from "@/components/profile/MyProfileTab";
import type { WorkoutSessionData, UserCondition, WorkoutGoal, ExerciseLog, WorkoutHistory, RunningStats } from "@/constants/workout";
import { buildWorkoutMetrics, getIntensityRecommendation } from "@/utils/workoutMetrics";
import { saveWorkoutHistory, updateWorkoutAnalysis, updateReportTabs, getCachedWorkoutHistory } from "@/utils/workoutHistory";
import { auth, googleProvider } from "@/lib/firebase";
import { onAuthStateChanged, signOut, signInWithPopup, signInAnonymously, User } from "firebase/auth";
import { SubscriptionScreen } from "@/components/profile/SubscriptionScreen";
import { PlanLoadingOverlay } from "@/components/plan/PlanLoadingOverlay";
import { FitnessReading } from "@/components/dashboard/FitnessReading";
import { ChatHome } from "@/components/dashboard/ChatHome";
import { MyPlansScreen } from "@/components/dashboard/MyPlansScreen";
import { markPlanUsed, remoteMarkPlanUsed } from "@/utils/savedPlans";
import { Onboarding } from "@/components/layout/Onboarding";
import { NutritionTab } from "@/components/report/tabs/NutritionTab";
import { loadUserProfile, getPlanCount, incrementPlanCount, loadPlanCount } from "@/utils/userProfile";
import { syncExpFromFirestore, processWorkoutCompletion, getOrRebuildSeasonExp, type ExpLogEntry } from "@/utils/questSystem";
import { useSafeArea } from "@/hooks/useSafeArea";
import { trackEvent, setAnalyticsUserId } from "@/utils/analytics";
import { I18nProvider, useTranslation } from "@/hooks/useTranslation";
import { UnitsProvider } from "@/hooks/useUnits";

const getDisplayName = (user: import("firebase/auth").User | null, fallback = "회원") => {
  const raw = user?.displayName?.split(" ")[0] || fallback;
  return raw.slice(0, 10);
};

/** 회의 32: Exit Confirm 다이얼로그 — I18nProvider 내부에서 t() 사용 가능하도록 분리 */
function ExitConfirmDialog({
  inWorkoutSession,
  onCancel,
  onConfirm,
}: {
  inWorkoutSession: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl p-6 mx-8 shadow-xl max-w-[300px] w-full">
        <p className="text-center text-gray-800 font-bold text-base mb-1">
          {t("exit.confirm")}
        </p>
        <p className="text-center text-gray-500 text-sm mb-5">
          {inWorkoutSession ? t("exit.confirm.sessionWarn") : t("exit.confirm.backPressed")}
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-semibold text-sm active:scale-95 transition-transform"
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-semibold text-sm active:scale-95 transition-transform"
          >
            {t("exit.button")}
          </button>
        </div>
      </div>
    </div>
  );
}

const lazyGenerateWorkout = async (
  dayIndex: number,
  condition: import("@/constants/workout").UserCondition,
  goal: import("@/constants/workout").WorkoutGoal,
  selectedSessionType?: string,
  intensityOverride?: "high" | "moderate" | "low" | null,
  sessionMode?: import("@/constants/workout").SessionMode,
  targetMuscle?: import("@/constants/workout").TargetMuscle,
  runType?: import("@/constants/workout").RunType,
): Promise<import("@/constants/workout").WorkoutSessionData> => {
  // [DEV ONLY] mockPlan 모드: Cloud Functions 없이 UI 프리뷰 (?mockPlan=1 또는 localStorage 플래그)
  if (process.env.NODE_ENV === "development" && typeof window !== "undefined") {
    const url = new URL(window.location.href);
    const mockOn = url.searchParams.get("mockPlan") === "1" || localStorage.getItem("ohunjal_mock_plan") === "1";
    if (mockOn) {
      if (url.searchParams.get("mockPlan") === "1") localStorage.setItem("ohunjal_mock_plan", "1");
      console.warn("[dev] mockPlan 모드 — 샘플 세션 반환 중");
      await new Promise(r => setTimeout(r, 400)); // 로딩 연출
      return {
        title: "상체 근력 세션",
        description: "가슴·삼두·어깨 중심 컴파운드 + 아이솔레이션",
        intendedIntensity: intensityOverride ?? "moderate",
        exercises: [
          { type: "warmup", phase: "warmup", name: "폼롤러 흉추 스트레칭 (Foam Roller Thoracic Extension)", count: "2분", sets: 1, reps: 1 },
          { type: "warmup", phase: "warmup", name: "밴드 풀 어파트 (Band Pull-Apart)", count: "2 세트 / 15회", sets: 2, reps: 15 },
          { type: "strength", phase: "main", name: "바벨 벤치 프레스 (Barbell Bench Press)", count: "4 세트 / 8회", sets: 4, reps: 8, weight: "60kg" },
          { type: "strength", phase: "main", name: "인클라인 덤벨 프레스 (Incline Dumbbell Press)", count: "3 세트 / 10회", sets: 3, reps: 10, weight: "20kg x2" },
          { type: "strength", phase: "main", name: "사이드 레터럴 레이즈 (Side Lateral Raises)", count: "3 세트 / 15회", sets: 3, reps: 15, weight: "8kg x2" },
          { type: "strength", phase: "main", name: "트라이셉 로프 푸쉬다운 (Tricep Rope Pushdown)", count: "3 세트 / 12회", sets: 3, reps: 12, weight: "15kg" },
          { type: "core", phase: "core", name: "플랭크 (Plank)", count: "3 세트 / 60초", sets: 3, reps: 60 },
          { type: "cardio", phase: "cardio", name: "마무리 걷기 (Cool-down Walk)", count: "5분", sets: 1, reps: 1 },
        ],
      };
    }
  }

  const { auth } = await import("@/lib/firebase");
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  const token = await user.getIdToken();

  // Push/Pull 교대 상태를 localStorage에서 읽어서 서버에 전달
  const lastUpperType = (typeof window !== "undefined" ? localStorage.getItem("ohunjal_last_upper_type") as "push" | "pull" : null) || undefined;

  const body = JSON.stringify({
    dayIndex, condition, goal, selectedSessionType,
    intensityOverride, sessionMode, targetMuscle, runType, lastUpperType,
  });
  const headers = { "Content-Type": "application/json", "Authorization": `Bearer ${token}` };

  // 콜드스타트 대비: 최대 3회 재시도 (로딩 화면 뒤에서 조용히)
  let res: Response | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      res = await fetch("/api/planSession", { method: "POST", headers, body });
      if (res.ok) break;
      if (res.status === 429) break; // Trial limit — don't retry
      console.warn(`planSession attempt ${attempt} failed (${res.status})`);
    } catch (e) {
      console.warn(`planSession attempt ${attempt} network error:`, e);
    }
    if (attempt < 3) await new Promise(r => setTimeout(r, 2000)); // 2초 대기 후 재시도
  }
  if (!res || !res.ok) {
    if (res?.status === 429) {
      throw new Error("TRIAL_LIMIT");
    }
    throw new Error("planSession failed after 3 attempts");
  }
  const session = await res.json();

  // 서버 응답 후 Push/Pull 교대 상태 저장
  if (typeof window !== "undefined" && sessionMode === "balanced") {
    const currentUpper = lastUpperType === "push" ? "pull" : "push";
    localStorage.setItem("ohunjal_last_upper_type", currentUpper);
  }

  return session;
};

type ViewState =
  | "login"
  | "prediction_report"
  | "home"
  | "home_chat"
  | "my_plans"
  | "master_plan_preview"
  | "workout_session"
  | "workout_report";

/**
 * 회의 57 (2026-04-15): 채팅형 홈 feature flag.
 * Phase 3 전환 — 기본값 ON. `?chat_home=0` 쿼리로 한시 opt-out (localStorage 저장).
 * NEXT_PUBLIC_ENABLE_CHAT_HOME=0 환경변수로 빌드 시점 강제 OFF도 지원.
 */
// Sync detect ?lang= BEFORE render so I18nProvider reads correct locale
if (typeof window !== "undefined") {
  const params = new URLSearchParams(window.location.search);
  const lang = params.get("lang");
  if (lang && ["en", "ko"].includes(lang)) {
    localStorage.setItem("ohunjal_language", lang);
    window.history.replaceState({}, "", window.location.pathname);
  }
}

// 마이그레이션은 컴포넌트 내부 useEffect에서 실행

export default function Home() {
  useSafeArea();

  useEffect(() => {
    if (localStorage.getItem("ohunjal_migrated")) return;
    const MIGRATE_KEYS = [
      "birth_year", "body_weight", "completed_rituals", "fitness_profile",
      "fitness_reading_done", "fitness_test_history", "gender", "guest_trial_count",
      "language", "last_upper_type", "plan_count", "prev_weight", "quest_progress",
      "season_exp", "settings_sound", "settings_vibration", "tip_change_program",
      "tip_condition", "tip_guide_button", "tip_intro", "weight_log", "workout_history",
    ];
    for (const key of MIGRATE_KEYS) {
      const old = localStorage.getItem(`alpha_${key}`);
      if (old !== null && localStorage.getItem(`ohunjal_${key}`) === null) {
        localStorage.setItem(`ohunjal_${key}`, old);
      }
    }
    const allKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) allKeys.push(k);
    }
    for (const k of allKeys) {
      if (k.startsWith("alpha_weight_")) {
        const newKey = k.replace("alpha_", "ohunjal_");
        if (localStorage.getItem(newKey) === null) {
          localStorage.setItem(newKey, localStorage.getItem(k)!);
        }
      }
    }
    localStorage.setItem("ohunjal_migrated", "1");
  }, []);

  const locale = typeof window !== "undefined" ? (localStorage.getItem("ohunjal_language") || "ko") : "ko";
  const [activeTab, setActiveTab] = useState<TabId>("home");
  // 구독 취소 플로우 활성 시 탭바 숨김 (유저 집중 + 리텐션)
  const [cancelFlowActive, setCancelFlowActive] = useState(false);
  // 스크롤 내릴 때 탭바 숨김 (인스타 스타일)
  const [tabsVisible, setTabsVisible] = useState(true);
  const [view, setView] = useState<ViewState>("login"); // Start with login
  // 영양 탭 온보딩 완료 시 리마운트 트리거
  const [nutritionProfileVersion, setNutritionProfileVersion] = useState(0);

  // HomeScreen 폐기 (회의: fix-forward). "home"은 레거시 alias — home_chat으로 자동 치환.
  useEffect(() => {
    // [DEV] goto=plan 잠금 시 home 자동치환 건너뛰기
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("goto") === "plan") return;
    if (view === "home") setView("home_chat");
  }, [view]);

  // [DEV ONLY] ?goto=plan 으로 MasterPlanPreview 강제 잠금 (UI 프리뷰용)
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("goto") !== "plan") return;
    setCurrentWorkoutSession({
      title: "상체 근력 세션",
      description: "가슴·삼두·어깨 중심 컴파운드 + 아이솔레이션",
      intendedIntensity: "moderate",
      exercises: [
        { type: "warmup", phase: "warmup", name: "폼롤러 흉추 가동성 (Foam Roller Thoracic Mobility)", count: "2분", sets: 1, reps: 2 },
        { type: "warmup", phase: "warmup", name: "밴드 풀 어파트 (Band Pull-Aparts)", count: "2 세트 / 15회", sets: 2, reps: 15 },
        { type: "strength", phase: "main", name: "바벨 벤치 프레스 (Barbell Bench Press)", count: "4 세트 / 8회", sets: 4, reps: 8, weight: "60kg" },
        { type: "strength", phase: "main", name: "바벨 로우 (Barbell Row)", count: "4 세트 / 8회", sets: 4, reps: 8, weight: "50kg" },
        { type: "strength", phase: "main", name: "바벨 백 스쿼트 (Barbell Back Squat)", count: "4 세트 / 8회", sets: 4, reps: 8, weight: "70kg" },
        { type: "strength", phase: "main", name: "루마니안 데드리프트 (Romanian Deadlift)", count: "3 세트 / 10회", sets: 3, reps: 10, weight: "60kg" },
        { type: "strength", phase: "main", name: "바벨 컬 (Barbell Curl)", count: "3 세트 / 12회", sets: 3, reps: 12, weight: "20kg" },
        { type: "core", phase: "core", name: "플랭크 (Plank)", count: "3 세트 / 60초", sets: 3, reps: 60 },
      ],
    });
    setView("master_plan_preview");
  }, []);

  // [DEV ONLY] ?goto=plan 활성화 시 view가 다른 곳으로 튀면 강제로 돌려놓음
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("goto") !== "plan") return;
    if (view !== "master_plan_preview") setView("master_plan_preview");
  }, [view]);
  const [autoEdit1RM, setAutoEdit1RM] = useState(false);

  // autoEdit1RM은 MyTab으로 이동 후 리셋
  useEffect(() => {
    if (autoEdit1RM && activeTab === "my") {
      const t = setTimeout(() => setAutoEdit1RM(false), 500);
      return () => clearTimeout(t);
    }
  }, [autoEdit1RM, activeTab]);

  useEffect(() => {
    const HIDE_THRESHOLD = 30;
    const DELTA_THRESHOLD = 8;
    const lastYByEl = new WeakMap<Element, number>();
    const boundEls = new Set<Element>();

    const handleScroll = (e: Event) => {
      const el = e.currentTarget as Element;
      if (!el) return;
      const currentY = (el as HTMLElement).scrollTop;
      const lastY = lastYByEl.get(el) ?? 0;

      if (currentY < HIDE_THRESHOLD) {
        setTabsVisible(true);
      } else if (currentY > lastY + DELTA_THRESHOLD) {
        setTabsVisible(false);
      } else if (currentY < lastY - DELTA_THRESHOLD) {
        setTabsVisible(true);
      }
      lastYByEl.set(el, currentY);
    };

    const bindScrollableDescendants = () => {
      // overflow-y-auto 또는 overflow-y-scroll 인 모든 요소 찾기
      const candidates = document.querySelectorAll<HTMLElement>(
        "[data-scroll-container], .overflow-y-auto"
      );
      candidates.forEach((el) => {
        if (boundEls.has(el)) return;
        // 실제로 스크롤 가능한지 검증 (scrollHeight > clientHeight)
        if (el.scrollHeight <= el.clientHeight) return;
        el.addEventListener("scroll", handleScroll, { passive: true });
        boundEls.add(el);
      });
    };

    // 초기 바인딩 + 지연 재바인딩 (초기 렌더 후 추가로 나타나는 컨테이너 대비)
    bindScrollableDescendants();
    const t1 = setTimeout(bindScrollableDescendants, 100);
    const t2 = setTimeout(bindScrollableDescendants, 500);
    const t3 = setTimeout(bindScrollableDescendants, 1500);

    // DOM 변화 감지 — 뷰 전환/탭 변경 시 새 스크롤 컨테이너 자동 발견
    const observer = new MutationObserver(() => {
      bindScrollableDescendants();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
      observer.disconnect();
      boundEls.forEach((el) => el.removeEventListener("scroll", handleScroll));
      boundEls.clear();
    };
  }, []);

  // 뷰 전환 시 탭바 항상 노출 리셋 (새 화면에서 숨겨진 상태로 시작 방지)
  useEffect(() => {
    setTabsVisible(true);
  }, [activeTab, view]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  // 게스트 체험 서버 동기화 카운터 (ChatHome key bump 용)
  const [guestTrialSyncVersion, setGuestTrialSyncVersion] = useState(0);
  const [isLoading, setIsLoading] = useState(false); // AI Loading State
  const pendingSessionRef = useRef<WorkoutSessionData | null>(null);
  const [user, setUser] = useState<User | null>(null);

  // App State
  const [completedRitualIds, setCompletedRitualIds] = useState<string[]>([]);
  const [currentWorkoutSession, setCurrentWorkoutSession] = useState<WorkoutSessionData | null>(null);
  const [activeSavedPlanId, setActiveSavedPlanId] = useState<string | null>(null);
  const [currentCondition, setCurrentCondition] = useState<UserCondition | null>(null);
  const [currentGoal, setCurrentGoal] = useState<WorkoutGoal | null>(null);
  const [currentSession, setCurrentSession] = useState<SessionSelection | null>(null);
  const [workoutLogs, setWorkoutLogs] = useState<Record<number, ExerciseLog[]>>({});
  const [workoutDurationSec, setWorkoutDurationSec] = useState<number | undefined>(undefined);
  const [currentRunningStats, setCurrentRunningStats] = useState<RunningStats | null>(null);
  const [lastExpGained, setLastExpGained] = useState<ExpLogEntry[]>([]);
  const [lastPrevExp, setLastPrevExp] = useState<number>(0);
  const [recommendedIntensity, setRecommendedIntensity] = useState<"high" | "moderate" | "low" | null>(null);
  // Auto-open paywall if returning from KakaoPay redirect with billing key
  const [showPaywall, setShowPaywall] = useState(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return !!(params.get("billing_key") || params.get("billingKey"));
    }
    return false;
  });
  const [subStatus, setSubStatus] = useState<"loading" | "free" | "active" | "cancelled" | "expired">("loading");
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const FREE_PLAN_LIMIT = 4;
  const GUEST_TRIAL_LIMIT = 3; // 비로그인 체험 횟수 (전문가 합의: 3회면 앱 가치 체감)
  const [showLoginModal, setShowLoginModal] = useState(false);
  // 회의 53: 모달을 띄운 이유 — trial_exhausted = 무료 체험 3회 완료, generic = 그 외
  const [loginModalReason, setLoginModalReason] = useState<"trial_exhausted" | "generic">("generic");
  const [predictionReturnTab, setPredictionReturnTab] = useState<"home" | "proof" | "my">("home");

  // Firebase Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser && firebaseUser.isAnonymous) {
        // 익명 유저: API 토큰은 있지만 "로그인"은 아님
        setIsLoggedIn(false);
        setSubStatus("free");
        setView("home_chat");
        setIsInitialized(true);
        // 게스트 체험 카운트 서버 동기화 — IP 기반 SSOT
        // 이유: 캐시 지우거나 다른 기기로 접속해도 trial_ips 는 유지됨.
        //       localStorage 만 보면 "0/3" 으로 뜨는 버그 방지.
        firebaseUser.getIdToken().then(token => {
          return fetch("/api/getGuestTrialStatus", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          });
        }).then(res => res.ok ? res.json() : null).then(data => {
          if (data && typeof data.count === "number") {
            const local = parseInt(localStorage.getItem("ohunjal_guest_trial_count") || "0", 10);
            const synced = Math.max(local, data.count);
            localStorage.setItem("ohunjal_guest_trial_count", String(synced));
            setGuestTrialSyncVersion(v => v + 1); // ChatHome remount → 배지 재계산
          }
        }).catch(() => { /* 네트워크 실패 시 localStorage 로 폴백 */ });
        return;
      }

      if (firebaseUser) {
        setIsLoggedIn(true);
        localStorage.setItem("auth_logged_in", "1");
        // GA4 user_id 매핑 — BigQuery에서 GA 이벤트 ↔ Firestore 조인 (회의 52)
        setAnalyticsUserId(firebaseUser.uid);

        // Check subscription status (bypass in dev)
        if (process.env.NODE_ENV === "development") {
          setSubStatus("active");
        } else {
          firebaseUser.getIdToken().then(token => {
            fetch("/api/getSubscription", {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            })
              .then(res => res.ok ? res.json() : { status: "free" })
              .then(data => setSubStatus(data.status || "free"))
              .catch(() => setSubStatus("free"));
          }).catch(() => setSubStatus("free"));
        }

        // Load user profile + plan count + EXP from Firestore → localStorage, then route
        Promise.all([
          loadUserProfile().catch((e) => console.error("Failed to load profile", e)),
          loadPlanCount().catch((e) => console.error("Failed to load plan count", e)),
          syncExpFromFirestore().catch((e) => console.error("Failed to sync EXP", e)),
        ]).finally(() => {
          // 기존 유저(프로필 있음) → 온보딩 자동 스킵
          const hasProfile = !!(localStorage.getItem("ohunjal_gender") && localStorage.getItem("ohunjal_birth_year"));
          if (hasProfile) localStorage.setItem("ohunjal_onboarding_done", "1");
          // HomeScreen 폐기 후 모든 유저 채팅홈으로 직행
          setView("home_chat");
          setIsInitialized(true);
        });

        // Load workout data
        const rDone = localStorage.getItem("ohunjal_completed_rituals");
        if (rDone) {
          try { setCompletedRitualIds(JSON.parse(rDone)); } catch { /* corrupted */ }

          // 오늘 운동 완료 상태면 세션 데이터를 복원하지 않음
          // 리포트는 PROOF 탭 히스토리에서만 접근 가능
        }
      } else {
        // 유저 없음 → 익명 로그인 시도 (API 토큰 확보용)
        signInAnonymously(auth).catch(() => {
          // 익명 로그인 실패해도 앱은 진행 (API 호출만 못 함)
          setIsLoggedIn(false);
          setSubStatus("free");
          setView("home");
          setIsInitialized(true);
        });
        // onAuthStateChanged가 다시 호출되어 anonymous 분기로 처리됨
        return;
      }
      // setIsInitialized는 Promise.all.finally 안에서 setView 후 호출
    });

    return () => unsubscribe();
  }, []);

  // Back button interception — prevent accidental app exit on mobile
  const viewRef = useRef(view);
  viewRef.current = view;
  const isLoggedInRef = useRef(isLoggedIn);
  isLoggedInRef.current = isLoggedIn;

  const guardPushedRef = useRef(false);
  const exitingRef = useRef(false);

  useEffect(() => {
    if (view === "login") {
      guardPushedRef.current = false;
      return;
    }

    // Push a single dummy state so there's something to "go back" to
    if (!guardPushedRef.current) {
      window.history.pushState({ alphaGuard: true }, "");
      guardPushedRef.current = true;
    }

    const handlePopState = () => {
      // If the user confirmed exit, don't re-push — let the browser navigate away
      if (exitingRef.current) return;
      if (isLoggedInRef.current && viewRef.current !== "login") {
        setShowExitConfirm(true);
        // Re-push so back button can be caught again
        window.history.pushState({ alphaGuard: true }, "");
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [isLoggedIn, view === "login"]); // eslint-disable-line react-hooks/exhaustive-deps

  // Also warn on tab/browser close during workout session
  useEffect(() => {
    if (view !== "workout_session") return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [view]);

  const handleExitConfirm = useCallback(() => {

    exitingRef.current = true;
    guardPushedRef.current = false;
    setShowExitConfirm(false);

    window.history.back();      
    setTimeout(() => {
      window.history.back();    
    }, 50);
  }, []);

  const handleExitCancel = useCallback(() => {
    setShowExitConfirm(false);
  }, []);

  const handleLogin = () => {
    // Firebase Auth handles state via onAuthStateChanged
    // This callback is called after successful signInWithPopup in LoginScreen
    trackEvent("login", { method: "google" });
    setShowLoginModal(false);
    setView("home");
  };

  const getGuestTrialCount = () => parseInt(localStorage.getItem("ohunjal_guest_trial_count") || "0", 10);
  const incrementGuestTrial = () => {
    const count = getGuestTrialCount() + 1;
    localStorage.setItem("ohunjal_guest_trial_count", count.toString());
  };

  // Save to LocalStorage
  const completeRitual = (ritualId: string) => {
    let newCompleted;
    if (completedRitualIds.includes(ritualId)) {
      newCompleted = completedRitualIds.filter(id => id !== ritualId);
    } else {
      newCompleted = [...completedRitualIds, ritualId];
    }
    setCompletedRitualIds(newCompleted);
    localStorage.setItem("ohunjal_completed_rituals", JSON.stringify(newCompleted));
  };

  const handleTabChange = (id: TabId) => {
    const workoutFlow = ["master_plan_preview", "workout_session"];
    // 운동 플로우 중에는 탭 변경 무시
    if (workoutFlow.includes(view)) return;
    setActiveTab(id);
    // 리포트/기타에서 탭 변경 시 리셋
    if (view !== "login") {
      setCurrentWorkoutSession(null);
      // 운동 완료 상태 해제 (리포트 재표시 방지)
      if (completedRitualIds.includes("workout")) {
        const newCompleted = completedRitualIds.filter(rid => rid !== "workout");
        setCompletedRitualIds(newCompleted);
        localStorage.setItem("ohunjal_completed_rituals", JSON.stringify(newCompleted));
      }
      setView("home");
    }
  };

  const generatePlan = async (condition: UserCondition, goal: WorkoutGoal, sessionType?: string, _intensityCtx?: { recommended: "high" | "moderate" | "low"; weekSummary: { high: number; moderate: number; low: number }; target: { high: number; moderate: number; low: number }; reason: string } | null, intensityLevel?: "high" | "moderate" | "low" | null, sessionSel?: SessionSelection | null, opts?: { skipLoadingAnim?: boolean }) => {
    const skipLoadingAnim = !!opts?.skipLoadingAnim;
    setIsLoading(!skipLoadingAnim);
    try {
        const dayIndex = new Date().getDay();
        const scheduleIndex = dayIndex === 0 ? 6 : dayIndex - 1;

        // If sessionMode is set (new UI), generate instantly but wait for loading animation
        if (sessionSel?.sessionMode) {
            const session = await lazyGenerateWorkout(scheduleIndex, condition, goal, sessionType, intensityLevel, sessionSel.sessionMode, sessionSel.targetMuscle, sessionSel.runType);
            // ChatHome 확인 경로: 오버레이 건너뛰고 즉시 마스터플랜 진입 (대표 지시)
            if (skipLoadingAnim) {
                setCurrentWorkoutSession(session);
                setView("master_plan_preview");
                return;
            }
            pendingSessionRef.current = session;
            // isLoading stays true — PlanLoadingOverlay.onComplete will clear it
            return;
        } else {
            // 룰엔진 직접 생성 (Gemini 레거시 경로 제거)
            const session = await lazyGenerateWorkout(scheduleIndex, condition, goal, sessionType, intensityLevel);
            setCurrentWorkoutSession(session);
        }
    } catch (e) {
        console.error("Error generating workout:", e);
        // 실패 시 로딩 종료 (회의 53 Bug #1 수정)
        pendingSessionRef.current = null;
        setIsLoading(false);

        // TRIAL_LIMIT은 handleConditionComplete catch가 로그인 모달 띄우도록 re-throw
        // 이 re-throw가 없으면 서버 429 응답 시 유저가 아무 알림도 못 보고 홈으로 튕김
        if (e instanceof Error && e.message === "TRIAL_LIMIT") {
          throw e;
        }

        // 그 외 에러 (네트워크 장애, 서버 500 등)는 조용히 채팅홈 복귀
        setView("home_chat");
    } finally {
        // sessionMode path: onComplete callback handles isLoading
        if (!pendingSessionRef.current) {
          setIsLoading(false);
        }
    }
  };

  // getPlanCount, incrementPlanCount는 @/utils/userProfile에서 import

  const handleConditionComplete = async (condition: UserCondition, goal: WorkoutGoal, session?: SessionSelection, opts?: { skipLoadingAnim?: boolean }) => {
    // 비로그인 게스트 체험 제한 — 홈으로 돌려보내고 로그인 모달 표시
    if (!isLoggedIn && getGuestTrialCount() >= GUEST_TRIAL_LIMIT) {
      trackEvent("guest_trial_exhausted", { limit: GUEST_TRIAL_LIMIT });
      trackEvent("login_modal_view", { trigger: "trial_limit" });
      setView("home");
      setLoginModalReason("trial_exhausted");
      setShowLoginModal(true);
      return;
    }
    // Check free usage limit (로그인 유저만 — 게스트는 GUEST_TRIAL_LIMIT으로 제한)
    if (isLoggedIn && (subStatus === "free" || subStatus === "expired") && getPlanCount() >= FREE_PLAN_LIMIT) {
      trackEvent("paywall_view", { session_number: getPlanCount() });
      setShowPaywall(true);
      return;
    }

    setCurrentCondition(condition);
    setCurrentGoal(goal);
    setCurrentSession(session || null);

    // Compute intensity recommendation from recent history (회의 52: 유틸 경유)
    let intensityCtx = null;
    let resolvedIntensity: "high" | "moderate" | "low" | null = null;
    try {
      const all = getCachedWorkoutHistory();
      if (all.length > 0) {
        const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
        const recent = all.filter(h => new Date(h.date).getTime() > cutoff);
        if (recent.length > 0) {
          const rec = getIntensityRecommendation(recent, condition.birthYear, condition.gender);
          resolvedIntensity = rec.nextRecommended;

          // Goal-based intensity floor: prevent nonsensical combos
          // strength goal should never get low intensity, fat_loss should never get high
          const goalIntensityFloor: Record<string, "high" | "moderate" | "low"> = {
            strength: "high",
            muscle_gain: "moderate",
            fat_loss: "low",
            general_fitness: "low",
          };
          const floor = goalIntensityFloor[goal] || "low";
          const intensityRank = { high: 3, moderate: 2, low: 1 };
          if (intensityRank[resolvedIntensity] < intensityRank[floor]) {
            resolvedIntensity = floor;
          }

          intensityCtx = {
            recommended: resolvedIntensity,
            weekSummary: rec.weekSummary,
            target: rec.target,
            reason: rec.reason,
          };
          setRecommendedIntensity(resolvedIntensity);
        }
      }
    } catch { /* ignore */ }

    try {
      await generatePlan(condition, goal, undefined, intensityCtx, resolvedIntensity, session, opts);
    } catch (err) {
      if (err instanceof Error && err.message === "TRIAL_LIMIT") {
        trackEvent("guest_trial_exhausted", { limit: GUEST_TRIAL_LIMIT });
        trackEvent("login_modal_view", { trigger: "server_trial_limit" });
        setView("home");
        setLoginModalReason("trial_exhausted");
        setShowLoginModal(true);
        return;
      }
      throw err;
    }
    // 게스트 체험 카운트: 플랜 생성 시점에 증가 (서버 IP 카운트와 동기화)
    if (!isLoggedIn) incrementGuestTrial();
    // planCount는 운동 시작(onStart) 시점에 증가 — 생성만 하고 취소해도 횟수 차감 안 됨
    // sessionMode path: view transition handled by onComplete callback
    if (!session?.sessionMode) {
      setView("master_plan_preview");
    }
  };

  // 레이스 컨디션 방지: 마지막 요청만 반영
  const generateRequestId = useRef(0);

  const handleIntensityChange = async (level: "high" | "moderate" | "low") => {
    setRecommendedIntensity(level);
    if (!currentCondition || !currentGoal) return;
    const dayIndex = new Date().getDay();
    const scheduleIndex = dayIndex === 0 ? 6 : dayIndex - 1;
    const reqId = ++generateRequestId.current;
    try {
      const session = await lazyGenerateWorkout(scheduleIndex, currentCondition, currentGoal, undefined, level, currentSession?.sessionMode, currentSession?.targetMuscle, currentSession?.runType);
      if (reqId === generateRequestId.current) setCurrentWorkoutSession(session);
    } catch { /* lazyGenerateWorkout 내부에서 에러 처리 */ }
  };

  const handleRegenerate = async () => {
    if (!currentCondition || !currentGoal) return;
    const dayIndex = new Date().getDay();
    const scheduleIndex = dayIndex === 0 ? 6 : dayIndex - 1;
    const reqId = ++generateRequestId.current;
    try {
      const session = await lazyGenerateWorkout(scheduleIndex, currentCondition, currentGoal, undefined, recommendedIntensity, currentSession?.sessionMode, currentSession?.targetMuscle, currentSession?.runType);
      if (reqId === generateRequestId.current) setCurrentWorkoutSession(session);
    } catch { /* lazyGenerateWorkout 내부에서 에러 처리 */ }
  };

  // 로그아웃 시 삭제할 localStorage 키 — 유저별 데이터만.
  // 유지: ohunjal_language(기기 언어), ohunjal_tip_*(튜토리얼 dismiss), ohunjal_guest_trial_count(비로그인 악용 방지)
  const LOGOUT_CLEAR_KEYS = [
    "auth_logged_in",
    "ohunjal_birth_year",
    "ohunjal_body_weight",
    "ohunjal_prev_weight",
    "ohunjal_gender",
    "ohunjal_weight_log",
    "ohunjal_workout_history",
    "ohunjal_fitness_profile",
    "ohunjal_fitness_reading_done",
    "ohunjal_fitness_test_history",
    "ohunjal_completed_rituals",
    "ohunjal_quest_progress",
    "ohunjal_season_exp",
    "ohunjal_plan_count",
    "ohunjal_last_upper_type",
    "ohunjal_onboarding_done",
  ];

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error("Logout failed:", e);
    }
    // 회의 31: 유저 데이터 완전 정리 (프라이버시) — 다른 유저가 같은 기기 로그인 시 데이터 잔여 방지
    LOGOUT_CLEAR_KEYS.forEach(k => localStorage.removeItem(k));
    // per-exercise weight 키 동적 삭제
    const allKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("ohunjal_weight_")) allKeys.push(k);
    }
    allKeys.forEach(k => localStorage.removeItem(k));
    setIsLoggedIn(false);
    setUser(null);
    setAnalyticsUserId(null); // GA4 user_id 해제 (회의 52)
    setView("login");
    setCompletedRitualIds([]);
    setCurrentWorkoutSession(null);
    setCurrentCondition(null);
    setCurrentGoal(null);
    setWorkoutLogs({});
    setActiveTab("home");
  };

  const renderContent = () => {
    if (!isInitialized) return (
      <div className="relative flex flex-col items-center justify-center h-full bg-white overflow-hidden">
        <div className="w-10 h-10 border-4 border-emerald-100 border-t-[#5C795E] rounded-full animate-spin mb-4" />
        <p className="text-sm text-gray-400 animate-pulse">{locale === "ko" ? "잠시만요..." : "Loading..."}</p>
        {/* 하단 초록 물결 */}
        <div className="absolute bottom-0 left-0 right-0 overflow-hidden" style={{ height: "100vh" }}>
          {/* 물결 1 — 가장 연한, 느리게 */}
          <svg viewBox="0 0 1440 320" className="absolute bottom-0 w-[200%]" preserveAspectRatio="none" style={{ height: "100%", animation: "waveSlide 8s ease-in-out infinite alternate" }}>
            <path fill="#2D6A4F" fillOpacity="0.12" d="M0,280L80,276C160,272,320,268,480,266C640,264,800,264,960,266C1120,268,1280,272,1360,276L1440,280L1440,320L0,320Z" />
          </svg>
          {/* 물결 2 — 중간, 중간 속도 */}
          <svg viewBox="0 0 1440 320" className="absolute bottom-0 w-[200%]" preserveAspectRatio="none" style={{ height: "97%", animation: "waveSlide 6s ease-in-out infinite alternate-reverse" }}>
            <path fill="#2D6A4F" fillOpacity="0.25" d="M0,284L80,280C160,276,320,272,480,270C640,268,800,268,960,270C1120,272,1280,276,1360,280L1440,284L1440,320L0,320Z" />
          </svg>
          {/* 물결 3 — 가장 진한, 빠르게 */}
          <svg viewBox="0 0 1440 320" className="absolute bottom-0 w-[200%]" preserveAspectRatio="none" style={{ height: "94%", animation: "waveSlide 4s ease-in-out infinite alternate" }}>
            <path fill="#2D6A4F" fillOpacity="0.4" d="M0,288L80,286C160,284,320,278,480,276C640,274,800,274,960,276C1120,278,1280,284,1360,286L1440,288L1440,320L0,320Z" />
          </svg>
        </div>
      </div>
    );

    if (activeTab === "proof" && (view === "home" || view === "home_chat")) {
      return <ProofTab lockedRuleIds={[]} onShowPrediction={() => { setPredictionReturnTab("proof"); setView("prediction_report"); }} />;
    }

    // 회의 57 후속: 영양 탭 — 첫 진입 시 프로필 없으면 Onboarding 게이트.
    // 필수 3개(gender + bodyWeight + goal) 있으면 바로 NutritionTab.
    if (activeTab === "nutrition" && (view === "home" || view === "home_chat")) {
      // 프리미엄 게이트 — 비프리미엄 유저는 업그레이드 CTA 노출
      if (subStatus !== "active") {
        return (
          <div className="h-full overflow-y-auto px-6 pt-10" style={{ paddingBottom: "calc(80px + var(--safe-area-bottom, 0px))" }}>
            <div className="bg-gradient-to-br from-[#F0FDF4] to-white border border-[#2D6A4F]/30 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-6 h-6 text-[#2D6A4F]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h2 className="text-lg font-black text-[#1B4332]">
                  {(typeof window !== "undefined" && localStorage.getItem("ohunjal_language") === "en") ? "Nutrition Coach · Premium" : "영양 코치 · 프리미엄"}
                </h2>
              </div>
              <p className="text-[13px] text-[#1B4332] leading-relaxed mb-4">
                {(typeof window !== "undefined" && localStorage.getItem("ohunjal_language") === "en")
                  ? "Personalized daily calories, macros, meal plans, and unlimited nutrition chat. For premium members only."
                  : "맞춤 칼로리·탄단지·식단 플랜 + 무제한 영양 코치 채팅. 프리미엄 전용 기능이에요."}
              </p>
              <ul className="space-y-2 mb-5">
                {((typeof window !== "undefined" && localStorage.getItem("ohunjal_language") === "en")
                  ? ["Daily calorie + macro targets", "Auto-generated 4-meal plan", "Unlimited nutrition chat", "Real-time swap suggestions"]
                  : ["일일 칼로리 · 단백질·탄수·지방 목표", "자동 4끼 식단 플랜", "무제한 영양 코치 채팅", "실시간 대체 메뉴 추천"]
                ).map((b) => (
                  <li key={b} className="flex items-start gap-2 text-[12.5px] text-[#1B4332]">
                    <svg className="w-4 h-4 text-[#2D6A4F] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => {
                  trackEvent("paywall_view", { session_number: getPlanCount(), trigger: "nutrition_tab", surface: "modal" });
                  setShowPaywall(true);
                }}
                className="w-full py-3 rounded-xl bg-[#1B4332] text-white text-[13px] font-bold active:scale-[0.97] transition-all hover:bg-[#2D6A4F]"
              >
                {(typeof window !== "undefined" && localStorage.getItem("ohunjal_language") === "en") ? "Unlock Premium · 6,900 KRW/mo" : "프리미엄 시작 · 월 6,900원"}
              </button>
            </div>
          </div>
        );
      }

      const fp = (() => {
        try { return JSON.parse(localStorage.getItem("ohunjal_fitness_profile") || "{}"); }
        catch { return {}; }
      })();
      const hasEssentials = !!(fp.gender && fp.bodyWeight && fp.goal);
      if (!hasEssentials) {
        return (
          <Onboarding
            userName={getDisplayName(user, "")}
            onComplete={() => { setNutritionProfileVersion(v => v + 1); }}
          />
        );
      }
      // 당일 영양 가이드 캐시 읽기 (날짜 변경 시 자동 리셋)
      const cachedNutritionGuide = (() => {
        try {
          const cached = localStorage.getItem("ohunjal_nutrition_cache");
          if (!cached) return null;
          const { data, date, locale: cachedLocale } = JSON.parse(cached);
          const currentLocale = localStorage.getItem("ohunjal_language") || "ko";
          if (date === new Date().toDateString() && cachedLocale === currentLocale) return data;
        } catch { /* ignore */ }
        return null;
      })();
      return (
        <div
          key={`nutrition-${nutritionProfileVersion}`}
          className="h-full overflow-y-auto overflow-x-hidden px-4 bg-[#FAFBF9]"
          style={{ paddingBottom: "calc(80px + var(--safe-area-bottom, 0px))" }}
        >
          <NutritionTab
            bodyWeightKg={fp.bodyWeight || 70}
            heightCm={fp.height || 170}
            age={fp.birthYear ? new Date().getFullYear() - fp.birthYear : 30}
            gender={(fp.gender || "male") as "male" | "female"}
            goal={fp.goal || "health"}
            weeklyFrequency={fp.weeklyFrequency || 3}
            todaySession={{ type: "general", durationMin: 0, estimatedCalories: 0 }}
            isPremium={subStatus === "active"}
            readOnly={false}
            cachedGuide={cachedNutritionGuide}
            onGuideLoaded={(g) => {
              try {
                const lang = localStorage.getItem("ohunjal_language") || "ko";
                localStorage.setItem("ohunjal_nutrition_cache", JSON.stringify({
                  data: g,
                  date: new Date().toDateString(),
                  locale: lang,
                }));
              } catch { /* ignore */ }
            }}
          />
        </div>
      );
    }

    switch (view) {
      case "prediction_report":
        return (
          <FitnessReading
            userName={getDisplayName(user)}
            onComplete={() => {}}
            onPremium={() => setShowPaywall(true)}
            isPremium={subStatus === "active"}
            resultOnly
            onBack={() => { setActiveTab(predictionReturnTab); setView("home"); }}
            workoutCount={getCachedWorkoutHistory().length}
            workoutHistory={getCachedWorkoutHistory()}
            weightLog={(() => { try { return JSON.parse(localStorage.getItem("ohunjal_weight_log") || "[]"); } catch { return []; } })()}
            onEdit1RM={() => { setAutoEdit1RM(true); setActiveTab("my"); setView("home"); }}
          />
        );

      case "master_plan_preview":
        if (!currentWorkoutSession) { setView("home"); return null; }
        return (
          <MasterPlanPreview
            sessionData={currentWorkoutSession}
            onStart={(modifiedData) => {
              trackEvent("plan_preview_start");
              incrementPlanCount();
              // 저장 플랜 실행도 게스트 트라이얼 소진시킴 (평가자 P0 지적)
              if (activeSavedPlanId) {
                if (!isLoggedIn) incrementGuestTrial();
                markPlanUsed(activeSavedPlanId);
                void remoteMarkPlanUsed(activeSavedPlanId);
              }
              setCurrentWorkoutSession(modifiedData);
              setView("workout_session");
            }}
            onBack={() => {
              trackEvent("plan_preview_reject", { exercise_count: currentWorkoutSession?.exercises.length ?? 0 });
              if (activeSavedPlanId) { setActiveSavedPlanId(null); setView("my_plans"); }
              else setView("home_chat");
            }}
            onRegenerate={handleRegenerate}
            onIntensityChange={handleIntensityChange}
            currentIntensity={recommendedIntensity}
            recommendedIntensity={recommendedIntensity}
            goal={currentGoal || undefined}
            isPremium={subStatus === "active"}
            isLoggedIn={isLoggedIn}
            onGuestSaveAttempt={() => {
              trackEvent("login_modal_view", { trigger: "guest_save_attempt" });
              setLoginModalReason("generic");
              setShowLoginModal(true);
            }}
            savedPlanId={activeSavedPlanId ?? undefined}
          />
        );

      case "workout_session":
        if (!currentWorkoutSession) { setView("home"); return null; }
        return (
          <WorkoutSession
            sessionData={currentWorkoutSession}
            onComplete={(completedData, logs, timing, runningStats) => {
              trackEvent("workout_complete", { session_number: getPlanCount(), duration_min: Math.round(timing.totalDurationSec / 60) });
              setCurrentWorkoutSession(completedData);
              setWorkoutLogs(logs);
              setWorkoutDurationSec(timing.totalDurationSec);
              setCurrentRunningStats(runningStats ?? null);
              completeRitual("workout");

              // Calculate stats for history (pass actual elapsed time)
              const wMetrics = buildWorkoutMetrics(completedData.exercises, logs, currentCondition?.bodyWeightKg, timing.totalDurationSec);

              // Save to Workout History
              const historyEntry: WorkoutHistory = {
                id: Date.now().toString(),
                date: new Date().toISOString(),
                sessionData: completedData,
                logs: logs,
                stats: {
                  totalVolume: wMetrics.totalVolume,
                  totalSets: wMetrics.totalSets,
                  totalReps: wMetrics.totalReps,
                  totalDurationSec: wMetrics.totalDurationSec,
                  bestE1RM: wMetrics.bestE1RM?.value,
                  bwRatio: wMetrics.bwRatio ?? undefined,
                  successRate: wMetrics.successRate,
                  loadScore: wMetrics.loadScore,
                },
                exerciseTimings: timing.exerciseTimings,
                ...(runningStats ? { runningStats } : {}),
              };

              saveWorkoutHistory(historyEntry);

              // Process EXP once at completion (NOT in WorkoutReport render) — 회의 52: 유틸 경유
              const recentHist: WorkoutHistory[] = getCachedWorkoutHistory();
              const prevSeasonState = getOrRebuildSeasonExp(recentHist, currentCondition?.birthYear, currentCondition?.gender);
              const expGained = processWorkoutCompletion(historyEntry, [...recentHist, historyEntry], currentCondition?.birthYear, currentCondition?.gender);
              setLastPrevExp(prevSeasonState.totalExp);
              setLastExpGained(expGained);

              // 게스트 체험 카운트는 플랜 생성 시점에 이미 증가됨 (handleConditionComplete)
              setView("workout_report");
            }}
            onBack={() => { trackEvent("workout_abandon"); setView("master_plan_preview"); }}
          />
        );

      case "workout_report":
        if (!currentWorkoutSession) { setView("home"); return null; }
        return (
          <WorkoutReport
            sessionData={currentWorkoutSession}
            logs={workoutLogs}
            bodyWeightKg={currentCondition?.bodyWeightKg}
            gender={currentCondition?.gender}
            birthYear={currentCondition?.birthYear}
            savedDurationSec={workoutDurationSec}
            precomputedExpGained={lastExpGained}
            precomputedPrevExp={lastPrevExp}
            runningStats={currentRunningStats ?? undefined}
            isPremium={subStatus === "active"}
            onReportTabsSaved={(tabs) => {
              try {
                const history = getCachedWorkoutHistory();
                const lastEntry = history[history.length - 1];
                if (lastEntry?.id) {
                  updateReportTabs(lastEntry.id, tabs);
                }
              } catch {}
            }}
            onClose={() => {
              // 운동 완료 상태 해제 → HOME 복귀 시 리포트 재표시 방지
              const newCompleted = completedRitualIds.filter(id => id !== "workout");
              setCompletedRitualIds(newCompleted);
              localStorage.setItem("ohunjal_completed_rituals", JSON.stringify(newCompleted));
              setCurrentWorkoutSession(null);
              setView("home");
              setActiveTab("proof");
            }}
            onAnalysisComplete={(analysis) => {
                // Update the latest history entry with analysis data (회의 52: 유틸 경유)
                try {
                    const history = getCachedWorkoutHistory();
                    if (history.length > 0) {
                        const lastEntry = history[history.length - 1];
                        updateWorkoutAnalysis(lastEntry.id, analysis);
                    }
                } catch (e) {
                    console.error("Failed to save analysis to history", e);
                }
            }}
          />
        );

      case "my_plans":
        return (
          <MyPlansScreen
            onBack={() => setView("home_chat")}
            onSelectPlan={(plan) => {
              // 저장 플랜 실행도 트라이얼/페이월 게이트 통과 (평가자 P0 지적)
              if (!isLoggedIn && getGuestTrialCount() >= GUEST_TRIAL_LIMIT) {
                trackEvent("guest_trial_exhausted", { limit: GUEST_TRIAL_LIMIT });
                trackEvent("login_modal_view", { trigger: "saved_plan_trial_limit" });
                setLoginModalReason("trial_exhausted");
                setShowLoginModal(true);
                return;
              }
              if (isLoggedIn && (subStatus === "free" || subStatus === "expired") && getPlanCount() >= FREE_PLAN_LIMIT) {
                trackEvent("paywall_view", { session_number: getPlanCount() });
                setShowPaywall(true);
                return;
              }
              setCurrentWorkoutSession(plan.sessionData);
              setActiveSavedPlanId(plan.id);
              setView("master_plan_preview");
            }}
          />
        );

      case "home_chat": {
        // 회의 57: 채팅형 홈. 유저 자연어 → parseIntent → handleConditionComplete 재사용.
        if (activeTab === "my") {
          return <MyProfileTab user={user} onLogout={handleLogout} autoEdit1RM={autoEdit1RM} onCancelFlowChange={setCancelFlowActive} key={autoEdit1RM ? "edit1rm" : "normal"} />;
        }
        const bodyWeightKg = (() => { const w = parseFloat(localStorage.getItem("ohunjal_body_weight") || ""); return isNaN(w) ? undefined : w; })();
        const birthYear = (() => { const y = parseInt(localStorage.getItem("ohunjal_birth_year") || ""); return isNaN(y) ? undefined : y; })();
        const genderVal = (localStorage.getItem("ohunjal_gender") as "male" | "female" | null) || undefined;
        // fitness_profile에서 목표/1RM/주간빈도/키까지 꺼내서 Gemini 컨텍스트 강화
        const fp = (() => {
          try { return JSON.parse(localStorage.getItem("ohunjal_fitness_profile") || "{}"); }
          catch { return {}; }
        })() as {
          goal?: "fat_loss" | "muscle_gain" | "endurance" | "health";
          weeklyFrequency?: number;
          height?: number;
          bench1RM?: number;
          squat1RM?: number;
          deadlift1RM?: number;
        };
        return (
          <ChatHome
            key={`${guestTrialSyncVersion}`}
            userName={getDisplayName(user, "")}
            isGuest={!isLoggedIn}
            isLoggedIn={isLoggedIn}
            isPremium={subStatus === "active"}
            onOpenMyPlans={() => setView("my_plans")}
            savedPlansCount={typeof window !== "undefined" ? JSON.parse(localStorage.getItem("ohunjal_saved_plans") || "[]").length : 0}
            userProfile={{
              gender: genderVal,
              birthYear,
              bodyWeightKg,
              heightCm: typeof fp.height === "number" ? fp.height : undefined,
              goal: fp.goal,
              weeklyFrequency: typeof fp.weeklyFrequency === "number" ? fp.weeklyFrequency : undefined,
              bench1RM: typeof fp.bench1RM === "number" ? fp.bench1RM : undefined,
              squat1RM: typeof fp.squat1RM === "number" ? fp.squat1RM : undefined,
              deadlift1RM: typeof fp.deadlift1RM === "number" ? fp.deadlift1RM : undefined,
            }}
            onSubmit={handleConditionComplete}
            canSubmit={() => {
              // 게스트 체험 소진 → 즉시 로그인 모달
              if (!isLoggedIn && getGuestTrialCount() >= GUEST_TRIAL_LIMIT) {
                trackEvent("guest_trial_exhausted", { limit: GUEST_TRIAL_LIMIT });
                trackEvent("login_modal_view", { trigger: "chat_submit_trial_limit" });
                setLoginModalReason("trial_exhausted");
                setShowLoginModal(true);
                return false;
              }
              // 로그인 무료 소진 → paywall
              if (isLoggedIn && (subStatus === "free" || subStatus === "expired") && getPlanCount() >= FREE_PLAN_LIMIT) {
                trackEvent("paywall_view", { session_number: getPlanCount(), trigger: "chat_submit_paywall", surface: "modal" });
                setShowPaywall(true);
                return false;
              }
              return true;
            }}
            getBlockReason={() => {
              if (!isLoggedIn && getGuestTrialCount() >= GUEST_TRIAL_LIMIT) return "guest_exhausted";
              if (isLoggedIn && (subStatus === "free" || subStatus === "expired") && getPlanCount() >= FREE_PLAN_LIMIT) return "free_limit";
              return null;
            }}
            onRequestLogin={() => {
              setLoginModalReason("trial_exhausted");
              setShowLoginModal(true);
            }}
            onRequestPaywall={() => {
              trackEvent("paywall_view", { session_number: getPlanCount(), trigger: "chat_inline_retap", surface: "modal" });
              setShowPaywall(true);
            }}
            lastPlanSummary={currentWorkoutSession ? {
              title: currentWorkoutSession.description?.split("·")[0].trim() || currentWorkoutSession.title || "",
              exerciseCount: currentWorkoutSession.exercises.length,
            } : null}
            onResumeLastPlan={() => {
              if (currentWorkoutSession) setView("master_plan_preview");
            }}
          />
        );
      }

      case "login":
        return <LoginScreen onLogin={handleLogin} onTryFree={() => { trackEvent("login", { method: "guest" }); setView("home"); }} />;

      case "home":
      default:
        // My 탭
        if (activeTab === "my") {
          return <MyProfileTab user={user} onLogout={handleLogout} autoEdit1RM={autoEdit1RM} onCancelFlowChange={setCancelFlowActive} key={autoEdit1RM ? "edit1rm" : "normal"} />;
        }

        // If workout is already done, show report or proof (홈탭에서만)
        if (completedRitualIds.includes("workout")) {
           return (
             <WorkoutReport
               sessionData={currentWorkoutSession || { title: "Daily Workout", description: "Completed", exercises: [] }}
               logs={workoutLogs}
               bodyWeightKg={currentCondition?.bodyWeightKg || (() => { const w = parseFloat(localStorage.getItem("ohunjal_body_weight") || ""); return isNaN(w) ? undefined : w; })()}
               gender={currentCondition?.gender || (localStorage.getItem("ohunjal_gender") as "male" | "female") || undefined}
               birthYear={currentCondition?.birthYear || (() => { const y = parseInt(localStorage.getItem("ohunjal_birth_year") || ""); return isNaN(y) ? undefined : y; })()}
               savedDurationSec={workoutDurationSec}
               onClose={() => {
                 setView("home");
                 setActiveTab("proof");
               }}
               onRestart={() => {
                 // Remove 'workout' from completed list to restart flow
                 const newCompleted = completedRitualIds.filter(id => id !== "workout");
                 setCompletedRitualIds(newCompleted);
                 localStorage.setItem("ohunjal_completed_rituals", JSON.stringify(newCompleted));
                 // 회의: 바로 직전 운동 완료로 planCount 소진된 케이스 대비 — 홈 CTA와 동일 가드
                 if (!isLoggedIn && getGuestTrialCount() >= GUEST_TRIAL_LIMIT) {
                   trackEvent("guest_trial_exhausted", { limit: GUEST_TRIAL_LIMIT });
                   trackEvent("login_modal_view", { trigger: "trial_limit_restart" });
                   setView("home");
                   setLoginModalReason("trial_exhausted");
                   setShowLoginModal(true);
                   return;
                 }
                 if (isLoggedIn && (subStatus === "free" || subStatus === "expired") && getPlanCount() >= FREE_PLAN_LIMIT) {
                   trackEvent("paywall_view", { session_number: getPlanCount(), trigger: "workout_restart" });
                   setView("home");
                   setShowPaywall(true);
                   return;
                 }
                 setView("home_chat");
               }}
               initialAnalysis={currentWorkoutSession ?
                 // Try to find analysis from history if available (회의 52: 유틸 경유)
                 (() => {
                    try {
                        const history = getCachedWorkoutHistory();
                        const todayStr = new Date().toDateString();
                        const todayEntry = history.find(h => new Date(h.date).toDateString() === todayStr);
                        return todayEntry?.analysis || null;
                    } catch { return null; }
                 })()
                 : null
               }
             />
           );
        }

        // HomeScreen 폐기 — useEffect가 home → home_chat 자동 리다이렉트. 1 프레임 null 반환.
        return null;
    }
  };

  return (
    <I18nProvider>
    <UnitsProvider>
    <PhoneFrame pullToRefresh={view === "home" || view === "home_chat"}>
      <div className="h-full w-full relative overflow-hidden">
        <div className={`h-full overflow-y-auto overflow-x-hidden scrollbar-hide ${view === "login" ? "" : ""}`} style={view === "login" || view === "workout_session" || view === "master_plan_preview" ? undefined : { paddingBottom: "calc(80px + var(--safe-area-bottom, 0px))" }}>
          {renderContent()}
        </div>
        
        {/* Paywall Overlay */}
        {showPaywall && user && (
          <div className="absolute inset-0 z-50 bg-white">
            <SubscriptionScreen
              user={user}
              onClose={() => {
                trackEvent("paywall_dismiss");
                setShowPaywall(false);
                // Re-check subscription status
                user.getIdToken().then(token => {
                  fetch("/api/getSubscription", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                  })
                    .then(res => res.ok ? res.json() : { status: "free" })
                    .then(data => setSubStatus(data.status || "free"))
                    .catch(() => setSubStatus("free"));
                }).catch(() => setSubStatus("free"));
              }}
            />
          </div>
        )}

        {/* Loading Overlay */}
        {isLoading && (
          <PlanLoadingOverlay
            userName={getDisplayName(user)}
            bodyPart={currentCondition?.bodyPart}
            goal={currentGoal}
            sessionMode={currentSession?.sessionMode}
            targetMuscle={currentSession?.targetMuscle}
            onComplete={() => {
              // 서버 응답 대기: pendingSession이 있을 때까지 폴링 (최대 20회=10초)
              let pollCount = 0;
              const checkReady = () => {
                if (pendingSessionRef.current) {
                  setCurrentWorkoutSession(pendingSessionRef.current);
                  pendingSessionRef.current = null;
                  setIsLoading(false);
                  setView("master_plan_preview");
                } else if (pollCount < 20) {
                  pollCount++;
                  setTimeout(checkReady, 500);
                } else {
                  // 타임아웃 — 로딩 종료, 컨디션 체크로 복귀
                  setIsLoading(false);
                  setView("home_chat");
                }
              };
              checkReady();
            }}
          />
        )}

        {view !== "login" && view !== "workout_session" && view !== "master_plan_preview" && !cancelFlowActive && (
          <div
            className={`absolute bottom-0 left-0 right-0 z-40 transition-transform duration-300 ease-out ${
              tabsVisible ? "translate-y-0" : "translate-y-full"
            }`}
          >
            <BottomTabs active={activeTab} onChange={(id) => {
              if (!isLoggedIn && (id === "proof" || id === "my" || id === "nutrition")) {
                setLoginModalReason("generic");
                setShowLoginModal(true);
                return;
              }
              handleTabChange(id);
            }} />
          </div>
        )}

        {/* Login Modal — 비로그인 게이트 */}
        {showLoginModal && (
          <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl p-6 mx-6 shadow-xl max-w-[320px] w-full">
              <div className="flex flex-col items-center gap-1 mb-5">
                <img src={locale === "ko" ? "/login-logo-kor2.png" : "/login-logo-Eng.png"} alt="Ohunjal AI" className="w-32 h-auto mb-2" />
                {loginModalReason === "trial_exhausted" ? (
                  <>
                    <p className="text-center text-gray-800 font-bold text-base">
                      {locale === "ko" ? "무료체험 3회를 모두 사용하셨습니다!" : "You've used all 3 free trials!"}
                    </p>
                    <p className="text-center text-gray-500 text-sm">
                      {locale === "ko" ? <>로그인하고 계속 이용해 주세요</> : <>Sign in to continue</>}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-center text-gray-800 font-bold text-base">
                      {locale === "ko" ? "로그인하고 계속하기" : "Sign in to continue"}
                    </p>
                    <p className="text-center text-gray-500 text-sm">
                      {locale === "ko" ? <>운동 기록 저장, 성장 분석 등<br />모든 기능을 이용할 수 있어요</> : <>Save workout records, growth analysis<br />and unlock all features</>}
                    </p>
                  </>
                )}
              </div>
              <button
                onClick={async () => {
                  try {
                    await signInWithPopup(auth, googleProvider);
                    trackEvent("guest_to_login", { trial_count: getGuestTrialCount() });
                    handleLogin();
                  } catch (err: any) {
                    if (err.code !== "auth/popup-closed-by-user") {
                      console.error("Login failed:", err);
                    }
                  }
                }}
                className="w-full py-3.5 rounded-xl bg-[#1B4332] flex items-center justify-center gap-2.5 shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all mb-3"
              >
                <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
                  <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-3.5 h-3.5" />
                </div>
                <span className="font-bold text-white text-sm">{locale === "ko" ? "Google로 3초 가입" : "Sign in with Google"}</span>
              </button>
              <button
                onClick={() => { setShowLoginModal(false); if (!isLoggedIn) setView("login"); }}
                className="w-full py-2.5 text-gray-400 text-sm font-medium hover:text-gray-600 transition-colors"
              >
                {locale === "ko" ? "나중에" : "Later"}
              </button>
            </div>
          </div>
        )}

        {/* Exit Confirmation Dialog PWA 나가기 버그 수정 */}
        {showExitConfirm && (
          <ExitConfirmDialog
            inWorkoutSession={view === "workout_session"}
            onCancel={handleExitCancel}
            onConfirm={handleExitConfirm}
          />
        )}
      </div>
    </PhoneFrame>
    </UnitsProvider>
    </I18nProvider>
  );
}
