"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { FitScreen, FeedbackType } from "./FitScreen";
import type { RunningStats } from "@/constants/workout";
import { WorkoutSessionData, ExerciseStep, ExerciseLog, ExerciseTiming, LABELED_EXERCISE_POOLS } from "@/constants/workout";
import { trackEvent } from "@/utils/analytics";
import { getCachedWorkoutHistory } from "@/utils/workoutHistory";
import { useTranslation } from "@/hooks/useTranslation";
import { getExerciseName } from "@/utils/exerciseName";

const MUSCLE_GROUP_EN: Record<string, string> = {
  "웜업": "Warm-up", "가슴": "Chest", "어깨": "Shoulders", "삼두": "Triceps",
  "등": "Back", "후면 어깨": "Rear Delts", "이두": "Biceps", "하체": "Legs",
  "종아리": "Calves", "전신": "Full Body", "코어": "Core", "가동성": "Mobility",
};

interface WorkoutSessionProps {
  sessionData: WorkoutSessionData;
  onComplete: (
    completedSessionData: WorkoutSessionData,
    logs: Record<number, ExerciseLog[]>,
    timing: { totalDurationSec: number; exerciseTimings: ExerciseTiming[] },
    runningStats?: RunningStats,  // 회의 41: 러닝 세션 전용
  ) => void;
  onBack: () => void;
}

export const WorkoutSession: React.FC<WorkoutSessionProps> = ({
  sessionData,
  onComplete,
  onBack,
}) => {
  const { t, locale } = useTranslation();
  // Initialize exercises with a deep copy to allow mutations for adaptive logic
  const [exercises, setExercises] = useState<ExerciseStep[]>(() => 
    JSON.parse(JSON.stringify(sessionData.exercises))
  );
  
  const [currentExerciseIndex, setCurrentIndex] = useState(0);
  const [currentSet, setCurrentSet] = useState(1);
  const [isResting, setIsResting] = useState(false);
  const [restTimer, setRestTimer] = useState(60);
  const [logs, setLogs] = useState<Record<number, ExerciseLog[]>>({});
  // 회의 41: 러닝 인터벌 완주 시 FitScreen에서 산출되는 runningStats 저장
  const runningStatsRef = useRef<RunningStats | null>(null);
  // 회의 43 후속: 안정화된 콜백 — FitScreen useEffect가 매초 재실행되는 문제 방지
  const handleRunningStatsComputed = useCallback((stats: RunningStats) => {
    runningStatsRef.current = stats;
  }, []);
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [pendingExercise, setPendingExercise] = useState<string | null>(null);
  const [addSets, setAddSets] = useState(3);
  const [addReps, setAddReps] = useState(12);

  useEffect(() => { trackEvent("workout_start", { exercise_count: sessionData.exercises.length }); }, []);

  // Timing: session start + per-exercise tracking
  const sessionStartRef = useRef(Date.now());
  const exerciseStartRef = useRef(Date.now());
  const timingsRef = useRef<ExerciseTiming[]>([]);
  const [elapsedSec, setElapsedSec] = useState(0);

  const currentExercise = exercises[currentExerciseIndex];
  const totalExercises = exercises.length;

  // 지난 세션에서 같은 운동의 기록 조회 (회의 52: 유틸 경유)
  const lastSessionRecord = React.useMemo(() => {
    try {
      const history = getCachedWorkoutHistory();
      if (history.length === 0) return null;
      // 최근 기록부터 검색 (오늘 제외)
      const todayStr = new Date().toDateString();
      for (let i = history.length - 1; i >= 0; i--) {
        if (new Date(history[i].date).toDateString() === todayStr) continue;
        const session = history[i];
        const exIdx = session.sessionData.exercises.findIndex(
          (ex) => ex.name === currentExercise.name
        );
        if (exIdx >= 0 && session.logs[exIdx]?.length > 0) {
          const exLogs = session.logs[exIdx];
          const weights = exLogs.map(l => parseFloat(l.weightUsed || "0")).filter(w => w > 0);
          const reps = exLogs.map(l => l.repsCompleted);
          const hadEasy = exLogs.some(l => l.feedback === "easy" || l.feedback === "too_easy");
          const maxWeight = weights.length > 0 ? Math.max(...weights) : 0;
          return { weights, reps, maxWeight, hadEasy, date: session.date };
        }
      }
    } catch { /* ignore */ }
    return null;
  }, [currentExercise.name]);

  // Session elapsed time (ticks every second)
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - sessionStartRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Rest timer logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isResting && restTimer > 0) {
      interval = setInterval(() => {
        setRestTimer((prev) => prev - 1);
      }, 1000);
    } else if (isResting && restTimer === 0) {
      skipRest();
    }
    return () => clearInterval(interval);
  }, [isResting, restTimer]);

  const skipRest = () => {
    setIsResting(false);
    if (currentSet < currentExercise.sets) {
      setCurrentSet((prev) => prev + 1);
    }
    // else: 마지막 세트 후 호출된 경우 — handleSetComplete가 이미 다음 운동으로 이동 처리함
  };

  const handleSetComplete = (reps: number, feedback: FeedbackType, weightKg?: number) => {
    // Guard: ensure reps is always a number (AI data may leak strings)
    const safeReps = typeof reps === "number" ? reps : (parseInt(String(reps)) || 0);
    // 1. Log the set (use actual weight from picker if available)
    const newLog: ExerciseLog = {
      setNumber: currentSet,
      repsCompleted: safeReps,
      weightUsed: weightKg ? `${weightKg}` : currentExercise.weight,
      feedback: feedback,
    };

    const updatedLogs = {
      ...logs,
      [currentExerciseIndex]: [...(logs[currentExerciseIndex] || []), newLog],
    };
    setLogs(updatedLogs);

    // 2. Adaptive rep logic — 무게는 세션 내에서 변경하지 않고 렙 수만 조절
    //    무게 추천은 다음 세션 시작 시 별도로 제공
    if (currentSet < currentExercise.sets) {
      const updatedExercises = exercises.map((ex, i) =>
        i === currentExerciseIndex ? { ...ex } : ex
      );
      const exercise = updatedExercises[currentExerciseIndex];
      const currentReps = exercise.reps || 12;

      if (feedback === "too_easy") {
        exercise.reps = currentReps + 5;
      } else if (feedback === "easy") {
        exercise.reps = currentReps + 2;
      } else if (feedback === "fail") {
        exercise.reps = Math.max(1, reps);
      }
      // "target" (RIR 2-3): maintain (no change)

      setExercises(updatedExercises);

      // Rest duration: sex & age adjusted
      if (currentExercise.type === "warmup" || currentExercise.type === "mobility" || currentExercise.type === "cardio") {
        setCurrentSet((prev) => prev + 1);
      } else {
        setIsResting(true);
        const baseRest = feedback === "fail" ? 90
          : feedback === "target" ? 60
          : 45;
        const gender = (typeof window !== "undefined" ? localStorage.getItem("ohunjal_gender") : null) as "male" | "female" | null;
        const birthYearStr = typeof window !== "undefined" ? localStorage.getItem("ohunjal_birth_year") : null;
        const age = birthYearStr ? new Date().getFullYear() - parseInt(birthYearStr) : 30;
        const sexAdj = gender === "female" ? -10 : 0;
        const ageAdj = age >= 60 ? 30 : age >= 50 ? 15 : 0;
        setRestTimer(Math.max(30, baseRest + sexAdj + ageAdj));
      }
      
    } else {
      // Exercise Completed — record timing for this exercise
      const now = Date.now();
      timingsRef.current.push({
        exerciseIndex: currentExerciseIndex,
        startedAt: exerciseStartRef.current,
        endedAt: now,
        durationSec: Math.round((now - exerciseStartRef.current) / 1000),
      });

      // Check if there are more exercises
      if (currentExerciseIndex < totalExercises - 1) {
        exerciseStartRef.current = now; // next exercise starts now
        setCurrentIndex((prev) => prev + 1);
        setCurrentSet(1);
        setIsResting(false);
      } else {
        // All Exercises Completed — show add exercise prompt
        setShowAddExercise(true);
      }
    }
  };

  const handleBack = () => {
    if (isResting) {
      setIsResting(false);
      return;
    }
    
    if (currentSet > 1) {
      setCurrentSet((prev) => prev - 1);
      // Remove last log? Ideally yes, but for simplicity let's keep append-only or replace logic needed
      // For now, just going back in UI.
    } else if (currentExerciseIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      // We need to know how many sets the previous exercise had to go to the last set
      // But simplifying: Go to start of previous exercise
      setCurrentSet(1); 
    } else {
      onBack();
    }
  };

  const handleFinishWorkout = () => {
    const now = Date.now();
    const totalDurationSec = Math.round((now - sessionStartRef.current) / 1000);
    onComplete(
      { ...sessionData, exercises },
      logs,
      {
        totalDurationSec,
        exerciseTimings: timingsRef.current,
      },
      runningStatsRef.current ?? undefined,
    );
  };

  const handleSelectExercise = (exerciseName: string) => {
    setPendingExercise(exerciseName);
    setAddSets(3);
    setAddReps(12);
  };

  const handleConfirmAddExercise = () => {
    if (!pendingExercise) return;
    const newExercise: ExerciseStep = {
      type: "strength",
      name: pendingExercise,
      count: `${addSets}세트 / ${addReps}회`,
      sets: addSets,
      reps: addReps,
      weight: t("fit.moderateWeight"),
    };
    setExercises(prev => [...prev, newExercise]);
    setCurrentIndex(exercises.length);
    setCurrentSet(1);
    setIsResting(false);
    setShowAddExercise(false);
    setPendingExercise(null);
    setAddSearch("");
    exerciseStartRef.current = Date.now();
  };

  const handleAddSet = () => {
    const updated = [...exercises];
    updated[currentExerciseIndex] = { ...updated[currentExerciseIndex], sets: updated[currentExerciseIndex].sets + 1 };
    const ex = updated[currentExerciseIndex];
    const repsStr = typeof ex.reps === "number" ? `${ex.reps}회` : String(ex.reps);
    updated[currentExerciseIndex].count = `${ex.sets}세트 / ${repsStr}`;
    setExercises(updated);
  };

  const handleSwapExercise = (newExerciseName: string) => {
    const updated = [...exercises];
    updated[currentExerciseIndex] = { ...updated[currentExerciseIndex], name: newExerciseName };
    setExercises(updated);
  };

  const formatElapsed = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  if (showAddExercise) {
    const q = addSearch.replace(/\s/g, "").toLowerCase();
    const isSearching = q.length > 0;

    return (
      <div className="h-full flex flex-col bg-white animate-fade-in">
        <div className="pt-[max(2.5rem,env(safe-area-inset-top))] pb-4 px-6 shrink-0">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/10 w-fit mb-6">
            <svg className="w-3 h-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            <span className="text-[11px] font-bold text-gray-600 tabular-nums tracking-wide">
              {formatElapsed(elapsedSec)}
            </span>
          </div>
          <h1 className="text-3xl font-black text-[#1B4332] tracking-tight mb-1">{t("session.done")}</h1>
          <p className="text-sm text-gray-400 font-medium">{t("session.addMore")}</p>
        </div>

        {pendingExercise ? (
          /* Setup screen for selected exercise */
          <div className="flex-1 flex flex-col px-6">
            <div className="flex-1 flex flex-col items-center justify-center gap-6">
              <div className="text-center">
                <h2 className="text-2xl font-black text-[#1B4332]">{getExerciseName(pendingExercise, locale)}</h2>
              </div>

              {/* Sets */}
              <div className="flex flex-col items-center gap-2">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">{t("session.sets")}</p>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setAddSets(Math.max(1, addSets - 1))}
                    className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-lg active:scale-95"
                  >-</button>
                  <span className="text-4xl font-black text-[#1B4332] w-12 text-center">{addSets}</span>
                  <button
                    onClick={() => setAddSets(addSets + 1)}
                    className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-lg active:scale-95"
                  >+</button>
                </div>
              </div>

              {/* Reps */}
              <div className="flex flex-col items-center gap-2">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">{t("session.reps")}</p>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setAddReps(Math.max(1, addReps - 1))}
                    className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-lg active:scale-95"
                  >-</button>
                  <span className="text-4xl font-black text-[#1B4332] w-12 text-center">{addReps}</span>
                  <button
                    onClick={() => setAddReps(addReps + 1)}
                    className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-lg active:scale-95"
                  >+</button>
                </div>
              </div>
            </div>

            <div className="shrink-0 flex flex-col gap-2" style={{ paddingBottom: "calc(var(--safe-area-bottom, 0px) + 24px)" }}>
              <button
                onClick={handleConfirmAddExercise}
                className="w-full py-4 rounded-2xl bg-[#1B4332] text-white font-bold text-lg shadow-xl active:scale-[0.98] transition-all"
              >
                {t("session.startExercise")}
              </button>
              <button
                onClick={() => setPendingExercise(null)}
                className="w-full py-3 rounded-xl text-gray-400 font-bold text-sm active:scale-[0.98] transition-all"
              >
                {t("session.pickAnother")}
              </button>
            </div>
          </div>
        ) : (
          /* Exercise search list */
          <>
            <div className="shrink-0 px-6 pb-3">
              <input
                type="text"
                value={addSearch}
                onChange={(e) => setAddSearch(e.target.value)}
                placeholder={t("fit.searchExercise")}
                className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 text-[13px] text-[#1B4332] font-medium placeholder-gray-300 outline-none focus:border-[#2D6A4F] transition-colors"
              />
            </div>
            <div className="flex-1 overflow-y-auto px-6 pb-4">
              {isSearching ? (
                LABELED_EXERCISE_POOLS
                  .map((group) => {
                    const keywordMatch = group.keywords.some((kw: string) => kw.includes(q) || q.includes(kw));
                    const matched = group.exercises.filter((e: string) =>
                      keywordMatch || e.replace(/\s/g, "").toLowerCase().includes(q)
                    );
                    if (matched.length === 0) return null;
                    return (
                      <div key={group.label} className="mb-3">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] mb-1.5">{locale === "ko" ? group.label : (MUSCLE_GROUP_EN[group.label] || group.label)}</p>
                        {matched.map((ex: string) => (
                          <button
                            key={ex}
                            onClick={() => handleSelectExercise(ex)}
                            className="w-full text-left px-4 py-3 rounded-xl bg-white border border-gray-200 text-[13px] font-bold text-[#1B4332] active:scale-[0.98] transition-all mb-1.5"
                          >
                            {getExerciseName(ex, locale)}
                          </button>
                        ))}
                      </div>
                    );
                  })
                  .filter(Boolean)
              ) : (
                LABELED_EXERCISE_POOLS.map((group) => {
                  // 회의 21: EN 모드에서는 영문 키워드로 검색 자동입력 (한글 "웜업" 방지)
                  const primaryKeyword = locale === "ko"
                    ? group.keywords[0]
                    : (group.keywords.find((kw: string) => /^[a-z]/i.test(kw)) || group.keywords[0]);
                  return (
                    <div key={group.label} className="mb-3">
                      <button
                        onClick={() => setAddSearch(primaryKeyword)}
                        className="w-full text-left px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-[14px] font-bold text-[#1B4332] active:scale-[0.98] transition-all"
                      >
                        {locale === "ko" ? group.label : (MUSCLE_GROUP_EN[group.label] || group.label)}
                        <span className="text-[11px] text-gray-400 ml-2">{t("session.exerciseCount", { count: String(group.exercises.length) })}</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="shrink-0 px-6" style={{ paddingTop: "24px", paddingBottom: "calc(var(--safe-area-bottom, 0px) + 24px)" }}>
              <button
                onClick={handleFinishWorkout}
                className="w-full py-4 rounded-2xl bg-[#1B4332] text-white font-bold text-lg shadow-xl active:scale-[0.98] transition-all"
              >
                {t("session.finish")}
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="h-full relative">
      {/* Elapsed time indicator */}
      <div className="absolute top-[max(0.75rem,env(safe-area-inset-top))] left-4 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/30 backdrop-blur-sm">
        <svg className="w-3 h-3 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
        <span className="text-[11px] font-bold text-white/90 tabular-nums tracking-wide">
          {formatElapsed(elapsedSec)}
        </span>
      </div>

      <FitScreen
        key={`${currentExerciseIndex}-${currentExercise.name}`}
        exercise={currentExercise}
        setInfo={{
            current: currentSet,
            total: currentExercise.sets || 1,
            targetReps: (typeof currentExercise.reps === "number" ? currentExercise.reps : parseInt(String(currentExercise.reps)) || 12), // Guard: AI may return string
            targetWeight: currentExercise.weight || "Bodyweight"
        }}
        exerciseIndex={currentExerciseIndex + 1}
        totalExercises={totalExercises}
        onSetComplete={handleSetComplete}
        onBack={handleBack}
        isResting={isResting}
        restTimer={restTimer}
        onSkipRest={skipRest}
        isLastExercise={currentExerciseIndex === totalExercises - 1 && currentSet === (currentExercise.sets || 1)}
        onSwapExercise={currentExercise.type === "strength" || currentExercise.type === "core" ? handleSwapExercise : undefined}
        onAddSet={currentExercise.type === "strength" || currentExercise.type === "core" ? handleAddSet : undefined}
        nextExerciseName={currentExerciseIndex < totalExercises - 1 ? exercises[currentExerciseIndex + 1].name : undefined}
        lastSessionRecord={lastSessionRecord}
        onRunningStatsComputed={handleRunningStatsComputed}
      />
    </div>
  );
};
