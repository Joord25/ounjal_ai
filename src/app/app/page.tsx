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
import { saveWorkoutHistory, updateWorkoutAnalysis, loadWorkoutHistory } from "@/utils/workoutHistory";
import { auth, googleProvider } from "@/lib/firebase";
import { onAuthStateChanged, signOut, signInWithPopup, User } from "firebase/auth";
import { SubscriptionScreen } from "@/components/SubscriptionScreen";
import { PlanLoadingOverlay } from "@/components/PlanLoadingOverlay";
import { FitnessReading } from "@/components/FitnessReading";
import { HomeScreen } from "@/components/HomeScreen";
import { loadUserProfile } from "@/utils/userProfile";
import { useSafeArea } from "@/hooks/useSafeArea";

const lazyGenerateWorkout = async (...args: Parameters<typeof import("@/constants/workout").generateAdaptiveWorkout>) => {
  const { generateAdaptiveWorkout } = await import("@/constants/workout");
  return generateAdaptiveWorkout(...args);
};

type ViewState =
  | "login"
  | "prediction_report"
  | "home"
  | "condition_check"
  | "master_plan_preview"
  | "workout_session"
  | "workout_report";

export default function Home() {
  useSafeArea();
  const [activeTab, setActiveTab] = useState<TabId>("home");
  const [view, setView] = useState<ViewState>("login"); // Start with login
  const [autoEdit1RM, setAutoEdit1RM] = useState(false);

  // autoEdit1RM은 MyTab으로 이동 후 리셋
  useEffect(() => {
    if (autoEdit1RM && activeTab === "my") {
      const t = setTimeout(() => setAutoEdit1RM(false), 500);
      return () => clearTimeout(t);
    }
  }, [autoEdit1RM, activeTab]);
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

        // Load user profile from Firestore → localStorage, then go to home
        loadUserProfile().catch((e) => {
          console.error("Failed to load profile", e);
        }).finally(() => {
          setView("home");
        });

        // Load workout data
        const rDone = localStorage.getItem("alpha_completed_rituals");
        if (rDone) {
          const doneIds = JSON.parse(rDone);
          setCompletedRitualIds(doneIds);

          if (doneIds.includes("workout")) {
            // Load from Firestore (falls back to localStorage)
            loadWorkoutHistory().then((history) => {
              const todayStr = new Date().toDateString();
              const todayEntry = history.find((h) => new Date(h.date).toDateString() === todayStr);
              if (todayEntry) {
                setCurrentWorkoutSession(todayEntry.sessionData);
                setWorkoutLogs(todayEntry.logs);
              }
            }).catch((e) => {
              console.error("Failed to load today's history", e);
            });
          }
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
    setShowExitConfirm(false);
    guardPushedRef.current = false;
    exitingRef.current = true;
    // PWA standalone mode: close the app window
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches
      || (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (isStandalone) {
      window.close();
      // Fallback: if window.close() didn't work (iOS), go back
      setTimeout(() => window.history.go(-2), 100);
    } else {
      window.history.go(-2);
    }
  }, []);

  const handleExitCancel = useCallback(() => {
    setShowExitConfirm(false);
  }, []);

  const handleLogin = () => {
    // Firebase Auth handles state via onAuthStateChanged
    // This callback is called after successful signInWithPopup in LoginScreen
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
    setActiveTab(id);
    // 탭 변경 시 view 리셋 (운동 세션 중에는 유지)
    if (view !== "workout_session" && view !== "login") {
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
        const dayIndex = new Date().getDay();
        const scheduleIndex = dayIndex === 0 ? 6 : dayIndex - 1;
        const session = await lazyGenerateWorkout(scheduleIndex, condition, goal, sessionType, intensityLevel, sessionSel?.sessionMode, sessionSel?.targetMuscle, sessionSel?.runType);
        setCurrentWorkoutSession(session);
    } finally {
        // sessionMode path: onComplete callback handles isLoading
        if (!pendingSessionRef.current) {
          setIsLoading(false);
        }
    }
  };

  const getPlanCount = () => parseInt(localStorage.getItem("alpha_plan_count") || "0", 10);
  const incrementPlanCount = () => {
    const count = getPlanCount() + 1;
    localStorage.setItem("alpha_plan_count", count.toString());
  };

  const handleConditionComplete = async (condition: UserCondition, goal: WorkoutGoal, session?: SessionSelection) => {
    // 비로그인 게스트 체험 제한
    if (!isLoggedIn && getGuestTrialCount() >= GUEST_TRIAL_LIMIT) {
      setShowLoginModal(true);
      return;
    }
    // Check free usage limit
    if (subStatus === "free" && getPlanCount() >= FREE_PLAN_LIMIT) {
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
    incrementPlanCount();
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

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error("Logout failed:", e);
    }
    localStorage.removeItem("auth_logged_in");
    localStorage.removeItem("alpha_completed_rituals");
    localStorage.removeItem("alpha_workout_history");
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
            userName={user?.displayName?.split(" ")[0] || "회원"}
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
            userName={user?.displayName?.split(" ")[0] || undefined}
            isGuest={!isLoggedIn}
          />
        );

      case "master_plan_preview":
        return (
          <MasterPlanPreview
            sessionData={currentWorkoutSession!}
            onStart={(modifiedData) => { setCurrentWorkoutSession(modifiedData); setView("workout_session"); }}
            onBack={() => setView("condition_check")}
            onRegenerate={handleRegenerate}
            onIntensityChange={handleIntensityChange}
            currentIntensity={recommendedIntensity}
            recommendedIntensity={recommendedIntensity}
          />
        );

      case "workout_session":
        return (
          <WorkoutSession
            sessionData={currentWorkoutSession!}
            onComplete={(completedData, logs, timing) => {
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

              // 비로그인 체험 카운트 증가
              if (!isLoggedIn) incrementGuestTrial();
              setView("workout_report");
            }}
            onBack={() => setView("master_plan_preview")}
          />
        );

      case "workout_report":
        return (
          <WorkoutReport
            sessionData={currentWorkoutSession!}
            logs={workoutLogs}
            bodyWeightKg={currentCondition?.bodyWeightKg}
            gender={currentCondition?.gender}
            birthYear={currentCondition?.birthYear}
            savedDurationSec={workoutDurationSec}
            onClose={() => {
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
        return <LoginScreen onLogin={handleLogin} onTryFree={() => setView("home")} />;

      case "home":
      default:
        // My 탭
        if (activeTab === "my") {
          return <MyProfileTab user={user} onLogout={handleLogout} autoEdit1RM={autoEdit1RM} key={autoEdit1RM ? "edit1rm" : "normal"} />;
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
            userName={user?.displayName?.split(" ")[0] || undefined}
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
            userName={user?.displayName?.split(" ")[0] || "회원"}
            bodyPart={currentCondition?.bodyPart}
            goal={currentGoal}
            sessionMode={currentSession?.sessionMode}
            targetMuscle={currentSession?.targetMuscle}
            onComplete={() => {
              if (pendingSessionRef.current) {
                setCurrentWorkoutSession(pendingSessionRef.current);
                pendingSessionRef.current = null;
              }
              setIsLoading(false);
              setView("master_plan_preview");
            }}
          />
        )}

        {view !== "login" && view !== "workout_session" && (
          <div className="absolute bottom-0 left-0 right-0 z-40">
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
                <img src="/login-logo-kor2.png" alt="오운잘 AI" className="w-32 h-auto mb-2" />
                <p className="text-center text-gray-800 font-bold text-base">
                  로그인하고 계속하기
                </p>
                <p className="text-center text-gray-500 text-sm">
                  운동 기록 저장, 성장 분석 등<br />모든 기능을 이용할 수 있어요
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
                <span className="font-bold text-white text-sm">Google로 3초 가입</span>
              </button>
              <button
                onClick={() => setShowLoginModal(false)}
                className="w-full py-2.5 text-gray-400 text-sm font-medium hover:text-gray-600 transition-colors"
              >
                나중에
              </button>
            </div>
          </div>
        )}

        {/* Exit Confirmation Dialog */}
        {showExitConfirm && (
          <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl p-6 mx-8 shadow-xl max-w-[300px] w-full">
              <p className="text-center text-gray-800 font-bold text-base mb-1">
                앱을 나가시겠습니까?
              </p>
              <p className="text-center text-gray-500 text-sm mb-5">
                {view === "workout_session" ? "진행 중인 운동이 저장되지 않습니다." : "뒤로 가기를 누르셨습니다."}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleExitCancel}
                  className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-semibold text-sm active:scale-95 transition-transform"
                >
                  취소
                </button>
                <button
                  onClick={handleExitConfirm}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-semibold text-sm active:scale-95 transition-transform"
                >
                  나가기
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PhoneFrame>
  );
}
