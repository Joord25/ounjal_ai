"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { PhoneFrame } from "@/components/PhoneFrame";
import { BottomTabs, TabId } from "@/components/BottomTabs";
import { LoginScreen } from "@/components/LoginScreen";
import { MasterPlanPreview } from "@/components/MasterPlanPreview";
import { ConditionCheck } from "@/components/ConditionCheck";
import { WorkoutReport } from "@/components/WorkoutReport";
import { WorkoutSession } from "@/components/WorkoutSession";
import { ProofTab } from "@/components/ProofTab";
import { MyProfileTab } from "@/components/MyProfileTab";
import { generateAdaptiveWorkout, WorkoutSessionData, UserCondition, WorkoutGoal, ExerciseLog, WorkoutHistory } from "@/constants/workout";
import { generateAIWorkoutPlan } from "@/utils/gemini";
import { buildWorkoutMetrics, getIntensityRecommendation } from "@/utils/workoutMetrics";
import { saveWorkoutHistory, updateWorkoutAnalysis, loadWorkoutHistory } from "@/utils/workoutHistory";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { SubscriptionScreen } from "@/components/SubscriptionScreen";
import { loadUserProfile } from "@/utils/userProfile";
import { useSafeArea } from "@/hooks/useSafeArea";

type ViewState =
  | "login"
  | "home" 
  | "condition_check"
  | "master_plan_preview"
  | "workout_session"
  | "workout_report";

export default function Home() {
  useSafeArea();
  const [activeTab, setActiveTab] = useState<TabId>("today");
  const [view, setView] = useState<ViewState>("login"); // Start with login
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(false); // AI Loading State
  const [user, setUser] = useState<User | null>(null);

  // App State
  const [completedRitualIds, setCompletedRitualIds] = useState<string[]>([]);
  const [currentWorkoutSession, setCurrentWorkoutSession] = useState<WorkoutSessionData | null>(null);
  const [currentCondition, setCurrentCondition] = useState<UserCondition | null>(null);
  const [currentGoal, setCurrentGoal] = useState<WorkoutGoal | null>(null);
  const [workoutLogs, setWorkoutLogs] = useState<Record<number, ExerciseLog[]>>({});
  const [workoutDurationSec, setWorkoutDurationSec] = useState<number | undefined>(undefined);
  const [recommendedIntensity, setRecommendedIntensity] = useState<"high" | "moderate" | "low" | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [subStatus, setSubStatus] = useState<"loading" | "free" | "active" | "cancelled">("loading");
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const FREE_PLAN_LIMIT = 3;

  // Firebase Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        setIsLoggedIn(true);

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

        // Load user profile from Firestore → localStorage
        loadUserProfile().catch((e) => console.error("Failed to load profile", e));

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

        setView("condition_check");
      } else {
        setIsLoggedIn(false);
        setSubStatus("free");
        setView("login");
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
    if (!isLoggedIn || view === "login") {
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
    setView("condition_check");
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
    // Reset view when going back to "today" tab
    if (id === "today") {
      if (view === "login") {
        // keep login view
      } else if (completedRitualIds.includes("workout")) {
        setView("home");
      } else if (view !== "master_plan_preview" && view !== "workout_session") {
        setView("condition_check");
      }
    }
  };

  const generatePlan = async (condition: UserCondition, goal: WorkoutGoal, sessionType?: string, intensityCtx?: { recommended: "high" | "moderate" | "low"; weekSummary: { high: number; moderate: number; low: number }; target: { high: number; moderate: number; low: number }; reason: string } | null, intensityLevel?: "high" | "moderate" | "low" | null) => {
    setIsLoading(true);
    try {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayIndex = new Date().getDay();
        const dayName = days[dayIndex];

        // 1. Try Gemini AI with Day Name and optional Session Type
        const aiSession = await generateAIWorkoutPlan(condition, goal, dayName, sessionType, intensityCtx);
        
        if (aiSession) {
             setCurrentWorkoutSession(aiSession);
        } else {
            // 2. Fallback to Algorithm if AI fails or returns null
            console.warn("AI generation failed, falling back to algorithm.");
            const scheduleIndex = dayIndex === 0 ? 6 : dayIndex - 1;
            const session = generateAdaptiveWorkout(scheduleIndex, condition, goal, sessionType, intensityLevel);
            setCurrentWorkoutSession(session);
        }
    } catch (e) {
        console.error("Error generating workout:", e);
        // Fallback
        const dayIndex = new Date().getDay();
        const scheduleIndex = dayIndex === 0 ? 6 : dayIndex - 1;
        const session = generateAdaptiveWorkout(scheduleIndex, condition, goal, sessionType, intensityLevel);
        setCurrentWorkoutSession(session);
    } finally {
        setIsLoading(false);
    }
  };

  const getPlanCount = () => parseInt(localStorage.getItem("alpha_plan_count") || "0", 10);
  const incrementPlanCount = () => {
    const count = getPlanCount() + 1;
    localStorage.setItem("alpha_plan_count", count.toString());
  };

  const handleConditionComplete = async (condition: UserCondition, goal: WorkoutGoal) => {
    // Check free usage limit
    if (subStatus === "free" && getPlanCount() >= FREE_PLAN_LIMIT) {
      setShowPaywall(true);
      return;
    }

    setCurrentCondition(condition);
    setCurrentGoal(goal);

    // Compute intensity recommendation from recent history
    let intensityCtx = null;
    try {
      const raw = localStorage.getItem("alpha_workout_history");
      if (raw) {
        const all: WorkoutHistory[] = JSON.parse(raw);
        const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
        const recent = all.filter(h => new Date(h.date).getTime() > cutoff);
        if (recent.length > 0) {
          const rec = getIntensityRecommendation(recent, condition.birthYear, condition.gender);
          intensityCtx = {
            recommended: rec.nextRecommended,
            weekSummary: rec.weekSummary,
            target: rec.target,
            reason: rec.reason,
          };
          setRecommendedIntensity(rec.nextRecommended);
        }
      }
    } catch { /* ignore */ }

    await generatePlan(condition, goal, undefined, intensityCtx, intensityCtx?.recommended || null);
    incrementPlanCount();
    setView("master_plan_preview");
  };

  const handleIntensityChange = (level: "high" | "moderate" | "low") => {
    setRecommendedIntensity(level);
    // Immediately regenerate plan with new intensity
    if (!currentCondition || !currentGoal) return;
    const dayIndex = new Date().getDay();
    const scheduleIndex = dayIndex === 0 ? 6 : dayIndex - 1;
    const session = generateAdaptiveWorkout(scheduleIndex, currentCondition, currentGoal, undefined, level);
    setCurrentWorkoutSession(session);
  };

  const handleRegenerate = () => {
    if (!currentCondition || !currentGoal) return;
    const dayIndex = new Date().getDay();
    const scheduleIndex = dayIndex === 0 ? 6 : dayIndex - 1;
    const session = generateAdaptiveWorkout(scheduleIndex, currentCondition, currentGoal, undefined, recommendedIntensity);
    setCurrentWorkoutSession(session);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error("Logout failed:", e);
    }
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
    setActiveTab("today");
  };

  const renderContent = () => {
    if (!isInitialized) return null;

    if (activeTab === "proof") {
      return <ProofTab lockedRuleIds={[]} />;
    }

    if (activeTab === "my") {
      return <MyProfileTab user={user} onLogout={handleLogout} />;
    }

    switch (view) {
      case "login":
        return <LoginScreen onLogin={handleLogin} />;

      case "condition_check":
        return (
          <ConditionCheck
            onComplete={handleConditionComplete}
            onBack={() => setShowExitConfirm(true)}
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

      case "home":
      default:
        // If workout is already done, show report or proof
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
        
        // If logged in but workout not done, redirect to condition check
        // This handles the case where user navigates to "Today" tab
        if (isLoggedIn) {
           return (
             <ConditionCheck
               onComplete={handleConditionComplete}
               onBack={() => setShowExitConfirm(true)}
             />
           );
        }
        
        return null;
    }
  };

  return (
    <PhoneFrame>
      <div className="h-full w-full relative overflow-hidden">
        <div className={`h-full overflow-y-auto overflow-x-hidden scrollbar-hide ${view === "login" ? "" : ""}`} style={view !== "login" ? { paddingBottom: "calc(80px + var(--safe-area-bottom, 0px))" } : undefined}>
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
          <div className="absolute inset-0 bg-white/90 z-50 flex flex-col items-center justify-center animate-fade-in backdrop-blur-sm">
             <div className="w-12 h-12 border-4 border-emerald-100 border-t-[#5C795E] rounded-full animate-spin mb-4" />
             <p className="text-lg font-bold text-gray-800 animate-pulse">
               오운잘 AI가 알려주신 정보들을 기반으로
             </p>
             <p className="text-sm text-gray-500 mt-2">
               맞춤 마스터 플랜을 생성하고 있습니다
             </p>
          </div>
        )}

        {isLoggedIn && view !== "login" && view !== "workout_session" && (
          <div className="absolute bottom-0 left-0 right-0 z-40">
            <BottomTabs active={activeTab} onChange={handleTabChange} />
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
