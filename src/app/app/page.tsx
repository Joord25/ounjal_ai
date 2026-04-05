"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { PhoneFrame } from "@/components/PhoneFrame";
import { BottomTabs, TabId } from "@/components/BottomTabs";
import { LoginScreen } from "@/components/LoginScreen";
import { MasterPlanPreview } from "@/components/MasterPlanPreview";
import { ConditionCheck, SessionSelection } from "@/components/ConditionCheck";
import { WorkoutReport } from "@/components/WorkoutReport";
import { WorkoutSession } from "@/components/WorkoutSession";
import { ProofTab } from "@/components/ProofTab";
import { MyProfileTab } from "@/components/MyProfileTab";
import type { WorkoutSessionData, UserCondition, WorkoutGoal, ExerciseLog, WorkoutHistory } from "@/constants/workout";
import { generateAIWorkoutPlan } from "@/utils/gemini";
import { buildWorkoutMetrics, getIntensityRecommendation } from "@/utils/workoutMetrics";
import { saveWorkoutHistory, updateWorkoutAnalysis } from "@/utils/workoutHistory";
import { auth, googleProvider } from "@/lib/firebase";
import { onAuthStateChanged, signOut, signInWithPopup, User } from "firebase/auth";
import { SubscriptionScreen } from "@/components/SubscriptionScreen";
import { PlanLoadingOverlay } from "@/components/PlanLoadingOverlay";
import { FitnessReading } from "@/components/FitnessReading";
import { HomeScreen } from "@/components/HomeScreen";
import { loadUserProfile, getPlanCount, incrementPlanCount, loadPlanCount } from "@/utils/userProfile";
import { syncExpFromFirestore, processWorkoutCompletion, getOrRebuildSeasonExp, type ExpLogEntry } from "@/utils/questSystem";
import { useSafeArea } from "@/hooks/useSafeArea";
import { trackEvent } from "@/utils/analytics";
import { I18nProvider, useTranslation } from "@/hooks/useTranslation";

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
  const { auth } = await import("@/lib/firebase");
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  const token = await user.getIdToken();

  // Push/Pull 교대 상태를 localStorage에서 읽어서 서버에 전달
  const lastUpperType = (typeof window !== "undefined" ? localStorage.getItem("alpha_last_upper_type") as "push" | "pull" : null) || undefined;

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
      console.warn(`planSession attempt ${attempt} failed (${res.status})`);
    } catch (e) {
      console.warn(`planSession attempt ${attempt} network error:`, e);
    }
    if (attempt < 3) await new Promise(r => setTimeout(r, 2000)); // 2초 대기 후 재시도
  }
  if (!res || !res.ok) {
    throw new Error("planSession failed after 3 attempts");
  }
  const session = await res.json();

  // 서버 응답 후 Push/Pull 교대 상태 저장
  if (typeof window !== "undefined" && sessionMode === "balanced") {
    const currentUpper = lastUpperType === "push" ? "pull" : "push";
    localStorage.setItem("alpha_last_upper_type", currentUpper);
  }

  return session;
};

type ViewState =
  | "login"
  | "prediction_report"
  | "home"
  | "condition_check"
  | "master_plan_preview"
  | "workout_session"
  | "workout_report";

// Sync detect ?lang= BEFORE render so I18nProvider reads correct locale
if (typeof window !== "undefined") {
  const params = new URLSearchParams(window.location.search);
  const lang = params.get("lang");
  if (lang && ["en", "ko", "ja", "zh"].includes(lang)) {
    localStorage.setItem("alpha_language", lang);
    window.history.replaceState({}, "", window.location.pathname);
  }
}

export default function Home() {
  useSafeArea();

  const locale = typeof window !== "undefined" ? (localStorage.getItem("alpha_language") || "ko") : "ko";
  const [activeTab, setActiveTab] = useState<TabId>("home");
  // 회의 30: 구독 취소 플로우 활성 시 탭바 숨김 (유저 집중 + 리텐션)
  const [cancelFlowActive, setCancelFlowActive] = useState(false);
  // 회의 34: 스크롤 내릴 때 탭바 숨김 (인스타 스타일)
  const [tabsVisible, setTabsVisible] = useState(true);
  const [view, setView] = useState<ViewState>("login"); // Start with login
  const [autoEdit1RM, setAutoEdit1RM] = useState(false);

  // autoEdit1RM은 MyTab으로 이동 후 리셋
  useEffect(() => {
    if (autoEdit1RM && activeTab === "my") {
      const t = setTimeout(() => setAutoEdit1RM(false), 500);
      return () => clearTimeout(t);
    }
  }, [autoEdit1RM, activeTab]);

  // 회의 34 v2: 스크롤 방향 감지 탭바 자동 숨김
  // 개선: 각 화면의 실제 스크롤 컨테이너를 찾아 직접 바인딩 (capture phase 불안정 문제 해결)
  // - HomeScreen, ProofTab, MyProfileTab 각자 다른 위치의 overflow-y-auto 사용
  // - MutationObserver로 뷰 전환 시에도 자동 재탐색
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
  const [isLoading, setIsLoading] = useState(false); // AI Loading State
  const pendingSessionRef = useRef<WorkoutSessionData | null>(null);
  const [user, setUser] = useState<User | null>(null);

  // App State
  const [completedRitualIds, setCompletedRitualIds] = useState<string[]>([]);
  const [currentWorkoutSession, setCurrentWorkoutSession] = useState<WorkoutSessionData | null>(null);
  const [currentCondition, setCurrentCondition] = useState<UserCondition | null>(null);
  const [currentGoal, setCurrentGoal] = useState<WorkoutGoal | null>(null);
  const [currentSession, setCurrentSession] = useState<SessionSelection | null>(null);
  const [workoutLogs, setWorkoutLogs] = useState<Record<number, ExerciseLog[]>>({});
  const [workoutDurationSec, setWorkoutDurationSec] = useState<number | undefined>(undefined);
  const [lastExpGained, setLastExpGained] = useState<ExpLogEntry[]>([]);
  const [lastPrevExp, setLastPrevExp] = useState<number>(0);
  const [recommendedIntensity, setRecommendedIntensity] = useState<"high" | "moderate" | "low" | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [subStatus, setSubStatus] = useState<"loading" | "free" | "active" | "cancelled">("loading");
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const FREE_PLAN_LIMIT = 4;
  const GUEST_TRIAL_LIMIT = 1; // 비로그인 체험 횟수
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [predictionReturnTab, setPredictionReturnTab] = useState<"home" | "proof" | "my">("home");

  // Firebase Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        setIsLoggedIn(true);
        localStorage.setItem("auth_logged_in", "1");

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

        // Load user profile + plan count + EXP from Firestore → localStorage, then go to home
        Promise.all([
          loadUserProfile().catch((e) => console.error("Failed to load profile", e)),
          loadPlanCount().catch((e) => console.error("Failed to load plan count", e)),
          syncExpFromFirestore().catch((e) => console.error("Failed to sync EXP", e)),
        ]).finally(() => {
          setView("home");
        });

        // Load workout data
        const rDone = localStorage.getItem("alpha_completed_rituals");
        if (rDone) {
          const doneIds = JSON.parse(rDone);
          setCompletedRitualIds(doneIds);

          // 오늘 운동 완료 상태면 세션 데이터를 복원하지 않음
          // 리포트는 PROOF 탭 히스토리에서만 접근 가능
        }
      } else {
        setIsLoggedIn(false);
        setSubStatus("free");
        // 비로그인도 home 뷰로 진입 (체험 가능)
        setView("home");
      }

      setIsInitialized(true);
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
    trackEvent("onboarding_start", { method: "google" });
    setShowLoginModal(false);
    setView("home");
  };

  const getGuestTrialCount = () => parseInt(localStorage.getItem("alpha_guest_trial_count") || "0", 10);
  const incrementGuestTrial = () => {
    const count = getGuestTrialCount() + 1;
    localStorage.setItem("alpha_guest_trial_count", count.toString());
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
    localStorage.setItem("alpha_completed_rituals", JSON.stringify(newCompleted));
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
        localStorage.setItem("alpha_completed_rituals", JSON.stringify(newCompleted));
      }
      setView("home");
    }
  };

  const generatePlan = async (condition: UserCondition, goal: WorkoutGoal, sessionType?: string, intensityCtx?: { recommended: "high" | "moderate" | "low"; weekSummary: { high: number; moderate: number; low: number }; target: { high: number; moderate: number; low: number }; reason: string } | null, intensityLevel?: "high" | "moderate" | "low" | null, sessionSel?: SessionSelection | null) => {
    setIsLoading(true);
    try {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayIndex = new Date().getDay();
        const scheduleIndex = dayIndex === 0 ? 6 : dayIndex - 1;

        // If sessionMode is set (new UI), generate instantly but wait for loading animation
        if (sessionSel?.sessionMode) {
            const session = await lazyGenerateWorkout(scheduleIndex, condition, goal, sessionType, intensityLevel, sessionSel.sessionMode, sessionSel.targetMuscle, sessionSel.runType);
            pendingSessionRef.current = session;
            // isLoading stays true — PlanLoadingOverlay.onComplete will clear it
            return;
        } else {
            // Legacy path: try Gemini AI first
            const dayName = days[dayIndex];
            const aiSession = await generateAIWorkoutPlan(condition, goal, dayName, sessionType, intensityCtx);
            if (aiSession) {
                setCurrentWorkoutSession(aiSession);
            } else {
                console.warn("AI generation failed, falling back to algorithm.");
                const session = await lazyGenerateWorkout(scheduleIndex, condition, goal, sessionType, intensityLevel);
                setCurrentWorkoutSession(session);
            }
        }
    } catch (e) {
        console.error("Error generating workout:", e);
        // 실패 시 로딩 종료 + 컨디션 체크로 복귀 (alert 없이)
        pendingSessionRef.current = null;
        setIsLoading(false);
        setView("condition_check");
    } finally {
        // sessionMode path: onComplete callback handles isLoading
        if (!pendingSessionRef.current) {
          setIsLoading(false);
        }
    }
  };

  // getPlanCount, incrementPlanCount는 @/utils/userProfile에서 import

  const handleConditionComplete = async (condition: UserCondition, goal: WorkoutGoal, session?: SessionSelection) => {
    // 비로그인 게스트 체험 제한
    if (!isLoggedIn && getGuestTrialCount() >= GUEST_TRIAL_LIMIT) {
      setShowLoginModal(true);
      return;
    }
    // Check free usage limit
    if (subStatus === "free" && getPlanCount() >= FREE_PLAN_LIMIT) {
      trackEvent("paywall_view", { session_number: getPlanCount() });
      setShowPaywall(true);
      return;
    }

    setCurrentCondition(condition);
    setCurrentGoal(goal);
    setCurrentSession(session || null);

    // Compute intensity recommendation from recent history
    let intensityCtx = null;
    let resolvedIntensity: "high" | "moderate" | "low" | null = null;
    try {
      const raw = localStorage.getItem("alpha_workout_history");
      if (raw) {
        const all: WorkoutHistory[] = JSON.parse(raw);
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

    await generatePlan(condition, goal, undefined, intensityCtx, resolvedIntensity, session);
    await incrementPlanCount();
    // sessionMode path: view transition handled by onComplete callback
    if (!session?.sessionMode) {
      setView("master_plan_preview");
    }
  };

  const handleIntensityChange = async (level: "high" | "moderate" | "low") => {
    setRecommendedIntensity(level);
    if (!currentCondition || !currentGoal) return;
    const dayIndex = new Date().getDay();
    const scheduleIndex = dayIndex === 0 ? 6 : dayIndex - 1;
    const session = await lazyGenerateWorkout(scheduleIndex, currentCondition, currentGoal, undefined, level, currentSession?.sessionMode, currentSession?.targetMuscle, currentSession?.runType);
    setCurrentWorkoutSession(session);
  };

  const handleRegenerate = async () => {
    if (!currentCondition || !currentGoal) return;
    const dayIndex = new Date().getDay();
    const scheduleIndex = dayIndex === 0 ? 6 : dayIndex - 1;
    const session = await lazyGenerateWorkout(scheduleIndex, currentCondition, currentGoal, undefined, recommendedIntensity, currentSession?.sessionMode, currentSession?.targetMuscle, currentSession?.runType);
    setCurrentWorkoutSession(session);
  };

  // 회의 31: 로그아웃 시 삭제할 localStorage 키 — 유저별 데이터만.
  // 유지: alpha_language(기기 언어), alpha_tip_*(튜토리얼 dismiss), alpha_guest_trial_count(비로그인 악용 방지)
  const LOGOUT_CLEAR_KEYS = [
    "auth_logged_in",
    "alpha_birth_year",
    "alpha_body_weight",
    "alpha_prev_weight",
    "alpha_gender",
    "alpha_weight_log",
    "alpha_workout_history",
    "alpha_fitness_profile",
    "alpha_fitness_reading_done",
    "alpha_fitness_test_history",
    "alpha_completed_rituals",
    "alpha_quest_progress",
    "alpha_season_exp",
    "alpha_plan_count",
    "alpha_last_upper_type",
  ];

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error("Logout failed:", e);
    }
    // 회의 31: 유저 데이터 완전 정리 (프라이버시) — 다른 유저가 같은 기기 로그인 시 데이터 잔여 방지
    LOGOUT_CLEAR_KEYS.forEach(k => localStorage.removeItem(k));
    setIsLoggedIn(false);
    setUser(null);
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
      <div className="flex flex-col items-center justify-center h-full bg-white">
        <div className="w-10 h-10 border-4 border-emerald-100 border-t-[#5C795E] rounded-full animate-spin mb-4" />
        <p className="text-sm text-gray-400 animate-pulse">잠시만요...</p>
      </div>
    );

    if (activeTab === "proof" && view === "home") {
      return <ProofTab lockedRuleIds={[]} onShowPrediction={() => { setPredictionReturnTab("proof"); setView("prediction_report"); }} />;
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
            workoutCount={(() => { try { return JSON.parse(localStorage.getItem("alpha_workout_history") || "[]").length; } catch { return 0; } })()}
            workoutHistory={(() => { try { return JSON.parse(localStorage.getItem("alpha_workout_history") || "[]"); } catch { return []; } })()}
            weightLog={(() => { try { return JSON.parse(localStorage.getItem("alpha_weight_log") || "[]"); } catch { return []; } })()}
            onEdit1RM={() => { setAutoEdit1RM(true); setActiveTab("my"); setView("home"); }}
          />
        );

      case "condition_check":
        return (
          <ConditionCheck
            onComplete={handleConditionComplete}
            onBack={() => { setView("home"); setActiveTab("home"); }}
            userName={getDisplayName(user, "")}
            isGuest={!isLoggedIn}
          />
        );

      case "master_plan_preview":
        if (!currentWorkoutSession) { setView("home"); return null; }
        return (
          <MasterPlanPreview
            sessionData={currentWorkoutSession}
            onStart={(modifiedData) => { trackEvent("plan_preview_start"); setCurrentWorkoutSession(modifiedData); setView("workout_session"); }}
            onBack={() => setView("condition_check")}
            onRegenerate={handleRegenerate}
            onIntensityChange={handleIntensityChange}
            currentIntensity={recommendedIntensity}
            recommendedIntensity={recommendedIntensity}
            goal={currentGoal || undefined}
          />
        );

      case "workout_session":
        if (!currentWorkoutSession) { setView("home"); return null; }
        return (
          <WorkoutSession
            sessionData={currentWorkoutSession}
            onComplete={(completedData, logs, timing) => {
              trackEvent("workout_complete", { session_number: getPlanCount(), duration_min: Math.round(timing.totalDurationSec / 60) });
              setCurrentWorkoutSession(completedData);
              setWorkoutLogs(logs);
              setWorkoutDurationSec(timing.totalDurationSec);
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
              };

              saveWorkoutHistory(historyEntry);

              // Process EXP once at completion (NOT in WorkoutReport render)
              const recentHist: WorkoutHistory[] = (() => { try { return JSON.parse(localStorage.getItem("alpha_workout_history") || "[]"); } catch { return []; } })();
              const prevSeasonState = getOrRebuildSeasonExp(recentHist, currentCondition?.birthYear, currentCondition?.gender);
              const expGained = processWorkoutCompletion(historyEntry, [...recentHist, historyEntry], currentCondition?.birthYear, currentCondition?.gender);
              setLastPrevExp(prevSeasonState.totalExp);
              setLastExpGained(expGained);

              // 비로그인 체험 카운트 증가
              if (!isLoggedIn) incrementGuestTrial();
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
            onClose={() => {
              // 운동 완료 상태 해제 → HOME 복귀 시 리포트 재표시 방지
              const newCompleted = completedRitualIds.filter(id => id !== "workout");
              setCompletedRitualIds(newCompleted);
              localStorage.setItem("alpha_completed_rituals", JSON.stringify(newCompleted));
              setCurrentWorkoutSession(null);
              setView("home");
              setActiveTab("proof");
            }}
            onAnalysisComplete={(analysis) => {
                // Update the latest history entry with analysis data
                try {
                    const history = JSON.parse(localStorage.getItem("alpha_workout_history") || "[]");
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

      case "login":
        return <LoginScreen onLogin={handleLogin} onTryFree={() => { trackEvent("onboarding_start", { method: "guest" }); setView("home"); }} />;

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
               bodyWeightKg={currentCondition?.bodyWeightKg || (() => { const w = parseFloat(localStorage.getItem("alpha_body_weight") || ""); return isNaN(w) ? undefined : w; })()}
               gender={currentCondition?.gender || (localStorage.getItem("alpha_gender") as "male" | "female") || undefined}
               birthYear={currentCondition?.birthYear || (() => { const y = parseInt(localStorage.getItem("alpha_birth_year") || ""); return isNaN(y) ? undefined : y; })()}
               savedDurationSec={workoutDurationSec}
               onClose={() => {
                 setView("home");
                 setActiveTab("proof");
               }}
               onRestart={() => {
                 // Remove 'workout' from completed list to restart flow
                 const newCompleted = completedRitualIds.filter(id => id !== "workout");
                 setCompletedRitualIds(newCompleted);
                 localStorage.setItem("alpha_completed_rituals", JSON.stringify(newCompleted));
                 setView("condition_check");
               }}
               initialAnalysis={currentWorkoutSession ?
                 // Try to find analysis from history if available
                 (() => {
                    try {
                        const history = JSON.parse(localStorage.getItem("alpha_workout_history") || "[]");
                        const todayStr = new Date().toDateString();
                        const todayEntry = history.find((h: any) => new Date(h.date).toDateString() === todayStr);
                        return todayEntry?.analysis || null;
                    } catch { return null; }
                 })()
                 : null
               }
             />
           );
        }

        // 홈 화면: 로그인/비로그인 모두 진입 가능
        return (
          <HomeScreen
            userName={getDisplayName(user, "")}
            onStartWorkout={() => {
              if (!isLoggedIn && getGuestTrialCount() >= GUEST_TRIAL_LIMIT) {
                setShowLoginModal(true);
                return;
              }
              setView("condition_check");
            }}
            onShowPrediction={() => {
              if (!isLoggedIn) { setShowLoginModal(true); return; }
              setPredictionReturnTab("home");
              setView("prediction_report");
            }}
          />
        );
    }
  };

  return (
    <I18nProvider>
    <PhoneFrame pullToRefresh={view === "home"}>
      <div className="h-full w-full relative overflow-hidden">
        <div className={`h-full overflow-y-auto overflow-x-hidden scrollbar-hide ${view === "login" ? "" : ""}`} style={view === "login" || view === "workout_session" ? undefined : { paddingBottom: "calc(80px + var(--safe-area-bottom, 0px))" }}>
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
              // 서버 응답 대기: pendingSession이 있을 때까지 폴링
              const checkReady = () => {
                if (pendingSessionRef.current) {
                  setCurrentWorkoutSession(pendingSessionRef.current);
                  pendingSessionRef.current = null;
                  setIsLoading(false);
                  setView("master_plan_preview");
                } else if (isLoading) {
                  // 아직 서버 응답 대기 중 — 500ms 후 재확인
                  setTimeout(checkReady, 500);
                } else {
                  // generatePlan이 실패로 끝남 — 로딩만 종료
                  setIsLoading(false);
                }
              };
              checkReady();
            }}
          />
        )}

        {view !== "login" && view !== "workout_session" && !cancelFlowActive && (
          <div
            className={`absolute bottom-0 left-0 right-0 z-40 transition-transform duration-300 ease-out ${
              tabsVisible ? "translate-y-0" : "translate-y-full"
            }`}
          >
            <BottomTabs active={activeTab} onChange={(id) => {
              if (!isLoggedIn && (id === "proof" || id === "my")) {
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
                <p className="text-center text-gray-800 font-bold text-base">
                  {locale === "ko" ? "로그인하고 계속하기" : "Sign in to continue"}
                </p>
                <p className="text-center text-gray-500 text-sm">
                  {locale === "ko" ? <>운동 기록 저장, 성장 분석 등<br />모든 기능을 이용할 수 있어요</> : <>Save workout records, growth analysis<br />and unlock all features</>}
                </p>
              </div>
              <button
                onClick={async () => {
                  try {
                    await signInWithPopup(auth, googleProvider);
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
                onClick={() => setShowLoginModal(false)}
                className="w-full py-2.5 text-gray-400 text-sm font-medium hover:text-gray-600 transition-colors"
              >
                {locale === "ko" ? "나중에" : "Later"}
              </button>
            </div>
          </div>
        )}

        {/* Exit Confirmation Dialog — 회의 32: i18n 지원 + PWA 나가기 버그 수정 */}
        {showExitConfirm && (
          <ExitConfirmDialog
            inWorkoutSession={view === "workout_session"}
            onCancel={handleExitCancel}
            onConfirm={handleExitConfirm}
          />
        )}
      </div>
    </PhoneFrame>
    </I18nProvider>
  );
}
