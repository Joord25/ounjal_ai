"use client";

import { useState, useEffect } from "react";
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
import { THEME } from "@/constants/theme";

type ViewState = 
  | "login"
  | "home" 
  | "condition_check"
  | "master_plan_preview"
  | "workout_session"
  | "workout_report";

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>("today");
  const [view, setView] = useState<ViewState>("login"); // Start with login
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(false); // AI Loading State
  
  // App State
  const [completedRitualIds, setCompletedRitualIds] = useState<string[]>([]);
  const [currentWorkoutSession, setCurrentWorkoutSession] = useState<WorkoutSessionData | null>(null);
  const [currentCondition, setCurrentCondition] = useState<UserCondition | null>(null);
  const [currentGoal, setCurrentGoal] = useState<WorkoutGoal | null>(null);
  const [workoutLogs, setWorkoutLogs] = useState<Record<number, ExerciseLog[]>>({});
  const [selectedSessionType, setSelectedSessionType] = useState<string | undefined>(undefined);

  // Load from LocalStorage on mount
  useEffect(() => {
    // Check login state
    const loggedIn = localStorage.getItem("alpha_is_logged_in");
    if (loggedIn) {
      setIsLoggedIn(true);
      
      // Load workout data
      const rDone = localStorage.getItem("alpha_completed_rituals");
      if (rDone) {
        const doneIds = JSON.parse(rDone);
        setCompletedRitualIds(doneIds);

        // If workout is done, try to load today's session/logs from history
        if (doneIds.includes("workout")) {
            try {
                const history = JSON.parse(localStorage.getItem("alpha_workout_history") || "[]");
                const todayStr = new Date().toDateString();
                const todayEntry = history.find((h: any) => new Date(h.date).toDateString() === todayStr);
                if (todayEntry) {
                    setCurrentWorkoutSession(todayEntry.sessionData);
                    setWorkoutLogs(todayEntry.logs);
                }
            } catch (e) {
                console.error("Failed to load today's history", e);
            }
        }
      }
      
      // If logged in, go to condition check directly (skip home dashboard as per request)
      // "Main logo and login screen -> then immediately AI Analysis screen"
      setView("condition_check");
    } else {
      setView("login");
    }
    
    setIsInitialized(true);
  }, []);

  const handleLogin = () => {
    // Mock login
    localStorage.setItem("alpha_is_logged_in", "true");
    setIsLoggedIn(true);
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
    if (id === "today") {
      if (!completedRitualIds.includes("workout")) {
        setView("condition_check");
      } else {
        setView("home");
      }
    }
  };

  const generatePlan = async (condition: UserCondition, goal: WorkoutGoal, sessionType?: string) => {
    setIsLoading(true);
    try {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayIndex = new Date().getDay();
        const dayName = days[dayIndex];

        // 1. Try Gemini AI with Day Name and optional Session Type
        const aiSession = await generateAIWorkoutPlan(condition, goal, dayName, sessionType);
        
        if (aiSession) {
             setCurrentWorkoutSession(aiSession);
        } else {
            // 2. Fallback to Algorithm if AI fails or returns null
            console.warn("AI generation failed, falling back to algorithm.");
            const scheduleIndex = dayIndex === 0 ? 6 : dayIndex - 1;
            const session = generateAdaptiveWorkout(scheduleIndex, condition, goal);
            setCurrentWorkoutSession(session);
        }
    } catch (e) {
        console.error("Error generating workout:", e);
        // Fallback
        const dayIndex = new Date().getDay();
        const scheduleIndex = dayIndex === 0 ? 6 : dayIndex - 1;
        const session = generateAdaptiveWorkout(scheduleIndex, condition, goal);
        setCurrentWorkoutSession(session);
    } finally {
        setIsLoading(false);
    }
  };

  const handleConditionComplete = async (condition: UserCondition, goal: WorkoutGoal) => {
    setCurrentCondition(condition);
    setCurrentGoal(goal);
    
    // Start AI Generation (Initial load follows schedule)
    await generatePlan(condition, goal);
    setView("master_plan_preview");
  };

  const handleRegenerate = async (type: string) => {
    if (!currentCondition || !currentGoal) return;
    setSelectedSessionType(type);
    await generatePlan(currentCondition, currentGoal, type);
  };

  const handleLogout = () => {
    localStorage.removeItem("alpha_is_logged_in");
    localStorage.removeItem("alpha_completed_rituals");
    localStorage.removeItem("alpha_workout_history");
    setIsLoggedIn(false);
    setView("login");
    setCompletedRitualIds([]);
    setCurrentWorkoutSession(null);
    setCurrentCondition(null);
    setCurrentGoal(null);
    setWorkoutLogs({});
    setActiveTab("today"); // Reset active tab to today
    
    // Force re-render if needed, but setView("login") should trigger it.
    // Ensure view state is updated correctly.
  };

  const renderContent = () => {
    if (!isInitialized) return null;

    if (activeTab === "proof") {
      return <ProofTab lockedRuleIds={[]} />;
    }

    if (activeTab === "my") {
      return <MyProfileTab onLogout={handleLogout} />;
    }

    switch (view) {
      case "login":
        return <LoginScreen onLogin={handleLogin} />;

      case "condition_check":
        return (
          <ConditionCheck
            onComplete={handleConditionComplete}
          />
        );

      case "master_plan_preview":
        return (
          <MasterPlanPreview
            sessionData={currentWorkoutSession!}
            onStart={() => setView("workout_session")}
            onBack={() => setView("condition_check")}
            onRegenerate={handleRegenerate}
            initialSessionType={selectedSessionType}
          />
        );

      case "workout_session":
        return (
          <WorkoutSession
            sessionData={currentWorkoutSession!}
            onComplete={(completedData, logs) => {
              setCurrentWorkoutSession(completedData);
              setWorkoutLogs(logs);
              completeRitual("workout");

              // Calculate stats for history
              const totalSets = Object.values(logs).reduce((acc, curr) => acc + curr.length, 0);
              const totalReps = Object.values(logs).flat().reduce((acc, curr) => acc + curr.repsCompleted, 0);
              const totalVolume = Object.values(logs).flat().reduce((acc, curr) => {
                if (!curr.weightUsed || curr.weightUsed === "Bodyweight") return acc;
                const weight = parseInt(curr.weightUsed);
                return !isNaN(weight) ? acc + (weight * curr.repsCompleted) : acc;
              }, 0);

              // Save to Workout History
              const historyEntry: WorkoutHistory = {
                id: Date.now().toString(),
                date: new Date().toISOString(),
                sessionData: completedData,
                logs: logs,
                stats: { totalVolume, totalSets, totalReps }
              };

              try {
                const existingHistory = JSON.parse(localStorage.getItem("alpha_workout_history") || "[]");
                localStorage.setItem("alpha_workout_history", JSON.stringify([...existingHistory, historyEntry]));
              } catch (e) {
                console.error("Failed to save workout history", e);
              }

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
            onClose={() => {
              setActiveTab("proof");
            }}
            onAnalysisComplete={(analysis) => {
                // Update the latest history entry with analysis data
                try {
                    const history = JSON.parse(localStorage.getItem("alpha_workout_history") || "[]");
                    if (history.length > 0) {
                        // Assuming the last entry is the current one
                        const lastEntry = history[history.length - 1];
                        lastEntry.analysis = analysis;
                        localStorage.setItem("alpha_workout_history", JSON.stringify(history));
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
             />
           );
        }
        
        return null;
    }
  };

  return (
    <PhoneFrame>
      <div className="h-full w-full relative overflow-hidden">
        <div className="h-full overflow-y-auto overflow-x-hidden scrollbar-hide pb-[calc(80px+env(safe-area-inset-bottom))]">
          {renderContent()}
        </div>
        
        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-white/90 z-50 flex flex-col items-center justify-center animate-fade-in backdrop-blur-sm">
             <div className="w-12 h-12 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin mb-4" />
             <p className="text-lg font-bold text-gray-800 animate-pulse">
               AI Analyzing Condition...
             </p>
             <p className="text-sm text-gray-500 mt-2">
               Generating your personalized master plan
             </p>
          </div>
        )}

        {isLoggedIn && view !== "login" && (
          <div className="absolute bottom-0 left-0 right-0 z-40">
            <BottomTabs active={activeTab} onChange={handleTabChange} />
          </div>
        )}
      </div>
    </PhoneFrame>
  );
}
