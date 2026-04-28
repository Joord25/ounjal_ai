"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { FitScreen, FeedbackType } from "./FitScreen";
import { BeginnerGuideOverlay, type BeginnerOverlayPhase } from "./BeginnerGuideOverlay";
import { getBeginnerMode, BEGINNER_MODE_EVENT } from "@/utils/beginnerMode";
import { isBeginnerSupportedExercise } from "@/constants/exerciseEquipment";
import type { RunningStats } from "@/constants/workout";
import { WorkoutSessionData, ExerciseStep, ExerciseLog, ExerciseTiming, LABELED_EXERCISE_POOLS } from "@/constants/workout";
import { trackEvent } from "@/utils/analytics";
import { getCachedWorkoutHistory } from "@/utils/workoutHistory";
import { useTranslation } from "@/hooks/useTranslation";
import { getExerciseName } from "@/utils/exerciseName";
import { updateActiveSession, type ActiveSessionProgress } from "@/utils/activeSessionPersistence";
// 회의 2026-04-27: 워크아웃 음악 기능 제거 — 외부 YouTube Music 등으로 대체. 거슬림 해소.
import { useScreenWakeLock } from "@/hooks/useScreenWakeLock";

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
  /** 회의 64-M3: 중도 종료 — 최소 1세트 이상 기록된 상태로 유저가 "운동 종료" 확정 시 호출.
   *  abandoned: true 플래그로 workout_history 에 저장된다. 0세트면 onBack 경로로 폴백. */
  onAbandon?: (
    completedSessionData: WorkoutSessionData,
    logs: Record<number, ExerciseLog[]>,
    timing: { totalDurationSec: number; exerciseTimings: ExerciseTiming[] },
    runningStats?: RunningStats,
  ) => void;
  /** 회의 63-A: workout_start funnel 분리용 source 태그 */
  source?: "chat" | "saved" | "program" | "resume";
  /** 회의 64-γ: 모바일 백그라운드 discard 복귀 시 진행 상태 hydrate */
  restoredProgress?: ActiveSessionProgress | null;
}

export const WorkoutSession: React.FC<WorkoutSessionProps> = ({
  sessionData,
  onComplete,
  onBack,
  onAbandon,
  source = "chat",
  restoredProgress = null,
}) => {
  const { t, locale } = useTranslation();
  // Initialize exercises with a deep copy to allow mutations for adaptive logic
  // 회의 64-γ: 복원된 snapshot이 있으면 그 exercises(adaptive 변형분 포함)로 hydrate
  const [exercises, setExercises] = useState<ExerciseStep[]>(() =>
    restoredProgress?.exercises
      ? JSON.parse(JSON.stringify(restoredProgress.exercises))
      : JSON.parse(JSON.stringify(sessionData.exercises))
  );

  const [currentExerciseIndex, setCurrentIndex] = useState(restoredProgress?.currentExerciseIndex ?? 0);
  const [currentSet, setCurrentSet] = useState(restoredProgress?.currentSet ?? 1);
  const [isResting, setIsResting] = useState(false);
  const [restTimer, setRestTimer] = useState(60);
  const [logs, setLogs] = useState<Record<number, ExerciseLog[]>>(restoredProgress?.logs ?? {});
  // 회의 2026-04-27: 음악 기능 제거. 화면 꺼짐 방지는 그대로 — 휴식 60s/90s 사이 OS auto-lock 방지.
  useScreenWakeLock(true);
  // 회의 41: 러닝 인터벌 완주 시 FitScreen에서 산출되는 runningStats 저장
  const runningStatsRef = useRef<RunningStats | null>(restoredProgress?.runningStats ?? null);
  // 회의 43 후속: 안정화된 콜백 — FitScreen useEffect가 매초 재실행되는 문제 방지
  // 회의 64-γ: ref 변화는 useEffect 트리거 안 하므로 러닝 완주 시점에 즉시 persistence 플러시
  const handleRunningStatsComputed = useCallback((stats: RunningStats) => {
    runningStatsRef.current = stats;
    updateActiveSession({
      progress: { ...progressSnapshotRef.current, runningStats: stats },
    });
  }, []);
  const [showAddExercise, setShowAddExercise] = useState(restoredProgress?.showAddExercise ?? false);
  const [beginnerEnabled, setBeginnerEnabled] = useState(() => getBeginnerMode() === true);
  // 회의 ζ Q4: dismissedOverlays state 제거 (매번 노출 — "도움 필요 선택자에게 친절").
  // 대신 currentSequenceStep 으로 한 운동 안에서 phase 시퀀스 진행 (warmup_intro → tutorial_video_warmup 등).
  // currentExerciseIndex 변경 시 reset → 다음 운동에서 새 sequence 시작.
  const [overlaySequenceStep, setOverlaySequenceStep] = useState(0);
  useEffect(() => {
    const handler = (e: Event) => {
      setBeginnerEnabled((e as CustomEvent<{ enabled: boolean }>).detail.enabled);
    };
    window.addEventListener(BEGINNER_MODE_EVENT, handler);
    return () => window.removeEventListener(BEGINNER_MODE_EVENT, handler);
  }, []);
  const [addSearch, setAddSearch] = useState("");
  const [pendingExercise, setPendingExercise] = useState<string | null>(null);
  const [addSets, setAddSets] = useState(3);
  const [addReps, setAddReps] = useState(12);

  // 회의 63-A: source 포함 (chat/saved/program/resume) — 획득 funnel vs 리텐션 분리
  useEffect(() => { trackEvent("workout_start", { exercise_count: sessionData.exercises.length, source }); }, []);

  // Timing: session start + per-exercise tracking
  // 회의 64-γ: 복원 시 저장된 epoch를 그대로 복원해 타이머가 "끊긴 것처럼 보이지 않게" 이어짐
  const sessionStartRef = useRef(restoredProgress?.sessionStartEpoch ?? Date.now());
  const exerciseStartRef = useRef(restoredProgress?.exerciseStartEpoch ?? Date.now());
  const timingsRef = useRef<ExerciseTiming[]>(restoredProgress?.timings ? [...restoredProgress.timings] : []);
  const [elapsedSec, setElapsedSec] = useState(
    restoredProgress?.sessionStartEpoch
      ? Math.max(0, Math.floor((Date.now() - restoredProgress.sessionStartEpoch) / 1000))
      : 0
  );

  const currentExercise = exercises[currentExerciseIndex];
  const totalExercises = exercises.length;

  // 회의 ζ Phase 1.5: overlay phase sequence — 운동 진입 시 순차 노출.
  // - warmup 운동: warmup_intro → tutorial_video_warmup → 일반 FitScreen
  // - 바벨 벤치 프레스 (Barbell Bench Press) 정확 매칭: main_equipment → tutorial_video_main → 일반 FitScreen
  // - 기타 운동: overlay 0 (일반 흐름)
  const beginnerOverlaySequence: BeginnerOverlayPhase[] = !beginnerEnabled
    ? []
    : currentExercise.type === "warmup"
      ? ["warmup_intro", "tutorial_video_warmup"]
      : isBeginnerSupportedExercise(currentExercise.name)
        ? ["equipment_find", "equipment_use", "tutorial_video_main", "chat_weight"]
        : [];
  const beginnerOverlayPhase: BeginnerOverlayPhase | null =
    beginnerOverlaySequence[overlaySequenceStep] ?? null;
  const showBeginnerOverlay = beginnerOverlayPhase !== null;
  // 운동 변경 시 sequence reset (Q4: 매번 노출). currentExerciseIndex 의존
  useEffect(() => {
    setOverlaySequenceStep(0);
  }, [currentExerciseIndex]);
  const advanceBeginnerOverlay = () => {
    setOverlaySequenceStep((prev) => prev + 1);
  };
  /** chat_weight 무게 선택 — localStorage 저장 후 sequence advance. FitScreen mount 시 getStoredWeight 가 새 값 읽음 */
  const handleChatWeightSelect = (weight: number) => {
    if (typeof window !== "undefined") {
      const key = `ohunjal_weight_${currentExercise.name.replace(/[^a-zA-Z가-힣]/g, "_")}`;
      localStorage.setItem(key, String(weight));
    }
    advanceBeginnerOverlay();
  };
  /** chat_weight 마지막 사용 무게 — localStorage 만 (FitScreen 의 getStoredWeight 와 동일 SSOT). 없으면 null = 첫 사용 */
  const lastWeightForChat: number | null = (() => {
    if (typeof window === "undefined") return null;
    const key = `ohunjal_weight_${currentExercise.name.replace(/[^a-zA-Z가-힣]/g, "_")}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      const n = parseFloat(stored);
      if (!isNaN(n) && n > 0) return n;
    }
    return null;
  })();

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

  // 회의 64-γ (2026-04-20): 운동 진행 상태를 localStorage에 실시간 백업.
  // 카톡·인스타 앱 전환 후 브라우저가 페이지를 discard해도 복원 가능.
  // 매 state 변화마다 저장 + pagehide/visibilitychange hidden 시 강제 플러시.
  const progressSnapshotRef = useRef<ActiveSessionProgress>({
    exercises,
    currentExerciseIndex,
    currentSet,
    logs,
    timings: timingsRef.current,
    sessionStartEpoch: sessionStartRef.current,
    exerciseStartEpoch: exerciseStartRef.current,
    runningStats: runningStatsRef.current,
    showAddExercise,
  });
  useEffect(() => {
    const snap: ActiveSessionProgress = {
      exercises,
      currentExerciseIndex,
      currentSet,
      logs,
      timings: timingsRef.current,
      sessionStartEpoch: sessionStartRef.current,
      exerciseStartEpoch: exerciseStartRef.current,
      runningStats: runningStatsRef.current,
      showAddExercise,
    };
    progressSnapshotRef.current = snap;
    updateActiveSession({ progress: snap });
  }, [exercises, currentExerciseIndex, currentSet, logs, showAddExercise]);

  useEffect(() => {
    const flush = () => updateActiveSession({ progress: progressSnapshotRef.current });
    const onVis = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVis);
    };
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
    //    회의 (2026-04-12): FitScreen이 계산한 reps를 그대로 사용
    //    - easy/too_easy: adjustedReps + easyExtraReps (사용자가 선택한 "+N" 반영)
    //    - fail: failedReps (사용자가 실제로 실패한 지점)
    //    - target: 유지 (변경 없음)
    if (currentSet < currentExercise.sets) {
      const updatedExercises = exercises.map((ex, i) =>
        i === currentExerciseIndex ? { ...ex } : ex
      );
      const exercise = updatedExercises[currentExerciseIndex];

      if (feedback === "too_easy" || feedback === "easy" || feedback === "fail") {
        const newReps = Math.max(1, safeReps);
        exercise.reps = newReps; // setDetails 없는 경우 fallback + 다음 세트 reps 소스
        // setDetails 가 있으면 다음 세트(0-indexed = currentSet) 만 패치. 이후 세트는 플랜 의도 유지.
        if (exercise.setDetails && exercise.setDetails.length > 0) {
          const nextIdx = currentSet;
          if (nextIdx < exercise.setDetails.length) {
            const patched = [...exercise.setDetails];
            patched[nextIdx] = { ...patched[nextIdx], reps: newReps };
            exercise.setDetails = patched;
          }
        }
      }
      // "target": 유지 (no change)

      setExercises(updatedExercises);

      // Rest duration: sex & age adjusted
      if (currentExercise.type === "warmup" || currentExercise.type === "mobility" || currentExercise.type === "cardio") {
        setCurrentSet((prev) => prev + 1);
      } else {
        setIsResting(true);
        // 초보자 모드 + 벤치 프레스 변형 (컴파운드) — ACSM Guidelines 11th: 컴파운드 90-120s, fail 시 150-180s
        const isBeginnerCompound = beginnerEnabled && isBeginnerSupportedExercise(currentExercise.name);
        const baseRest = isBeginnerCompound
          ? (feedback === "fail" ? 150 : 90)
          : (feedback === "fail" ? 90
              : feedback === "target" ? 60
              : 45);
        const gender = (typeof window !== "undefined" ? localStorage.getItem("ohunjal_gender") : null) as "male" | "female" | null;
        const birthYearStr = typeof window !== "undefined" ? localStorage.getItem("ohunjal_birth_year") : null;
        const age = birthYearStr ? new Date().getFullYear() - parseInt(birthYearStr) : 30;
        const sexAdj = gender === "female" ? -10 : 0;
        const ageAdj = age >= 60 ? 30 : age >= 50 ? 15 : 0;
        const minRest = isBeginnerCompound ? 60 : 30;
        setRestTimer(Math.max(minRest, baseRest + sexAdj + ageAdj));
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
      // 마지막 로그 제거 (중복 방지)
      const exLogs = logs[currentExerciseIndex] || [];
      if (exLogs.length > 0) {
        setLogs({ ...logs, [currentExerciseIndex]: exLogs.slice(0, -1) });
      }
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

  // 회의 64-M3: 중도 종료 확정 핸들러 — 1세트 이상 기록 시 abandoned 플래그로 저장, 0세트면 onBack 폴백.
  const [showAbandonModal, setShowAbandonModal] = useState(false);
  const totalSetsLogged = useMemo(
    () => Object.values(logs).reduce((sum, arr) => sum + (arr?.length || 0), 0),
    [logs]
  );
  const remainingExerciseCount = Math.max(0, totalExercises - currentExerciseIndex - 1);

  const handleConfirmAbandon = () => {
    setShowAbandonModal(false);
    if (totalSetsLogged === 0 || !onAbandon) {
      onBack();
      return;
    }
    const now = Date.now();
    const totalDurationSec = Math.round((now - sessionStartRef.current) / 1000);
    onAbandon(
      { ...sessionData, exercises },
      logs,
      { totalDurationSec, exerciseTimings: timingsRef.current },
      runningStatsRef.current ?? undefined,
    );
  };

  // EN 인용 3인 랜덤 회전 (날짜 시드 고정 — 같은 날 같은 인용)
  const abandonQuoteId = useMemo(() => {
    const picks = ["ali", "goggins", "kipchoge"] as const;
    return picks[new Date().getDate() % picks.length];
  }, []);

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

  /** 회의 2026-04-24: FitScreen 우측 상단 스킵 아이콘 — 현재 운동을 건너뛰고 다음 운동으로.
   *  세트 기록 없이 진행. 마지막 운동을 스킵하면 add-exercise 화면으로 진입해 마침 or 운동 추가 선택 가능. */
  const handleSkipExercise = () => {
    const now = Date.now();
    timingsRef.current.push({
      exerciseIndex: currentExerciseIndex,
      startedAt: exerciseStartRef.current,
      endedAt: now,
      durationSec: Math.round((now - exerciseStartRef.current) / 1000),
    });
    if (currentExerciseIndex < totalExercises - 1) {
      exerciseStartRef.current = now;
      setCurrentIndex((prev) => prev + 1);
      setCurrentSet(1);
      setIsResting(false);
    } else {
      setShowAddExercise(true);
    }
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

      {/* 초보자 모드: overlay sequence 진행 중에는 FitScreen 미마운트 (chat_weight 선택 무게가 getStoredWeight 첫 호출 시 반영되도록).
          일반 모드는 sequence []이라 항상 즉시 마운트 (회귀 X) */}
      {!showBeginnerOverlay && <FitScreen
        key={`${currentExerciseIndex}-${currentExercise.name}`}
        exercise={currentExercise}
        setInfo={(() => {
          // setDetails[currentSet-1] 우선 소비 (MasterPlanPreview 에서 세트별 편집한 값). 없으면 단일 ex.reps/ex.weight fallback.
          const detail = currentExercise.setDetails?.[currentSet - 1];
          const rawReps = detail?.reps ?? currentExercise.reps;
          const targetReps = typeof rawReps === "number" ? rawReps : parseInt(String(rawReps)) || 12;
          const targetWeight = detail?.weight ?? currentExercise.weight ?? "Bodyweight";
          return {
            current: currentSet,
            total: currentExercise.sets || 1,
            targetReps,
            targetWeight,
          };
        })()}
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
        onEndClick={onAbandon ? () => setShowAbandonModal(true) : undefined}
        onSkipExercise={handleSkipExercise}
      />}
      {/* 회의 2026-04-27: WorkoutMusicPlayer 제거 — 외부 YouTube Music 등으로 대체 */}

      {/* 초보자 모드 overlay sequence — 운동 진입 시 순차 노출.
          warmup: warmup_intro → tutorial_video_warmup
          벤치: equipment_find → equipment_use → tutorial_video_main → chat_weight
          Q4: 매번 노출. 한 phase만 dismiss → 다음 phase 자동 진행. chat_weight 선택 = 무게 저장 + advance */}
      {showBeginnerOverlay && beginnerOverlayPhase && (
        <BeginnerGuideOverlay
          phase={beginnerOverlayPhase}
          exerciseName={currentExercise.name}
          onContinue={advanceBeginnerOverlay}
          onSkip={advanceBeginnerOverlay}
          onChatWeightSelect={handleChatWeightSelect}
          lastWeightKg={lastWeightForChat}
        />
      )}

      {/* 회의 64-M3: 중도 종료 확인 팝업 */}
      {showAbandonModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in px-6">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-black text-[#1B4332] mb-4 text-center">
              {t("fit.abandon.title")}
            </h3>

            {/* 인용 블록 */}
            <div className="bg-[#F0F4F1] rounded-2xl p-4 mb-4">
              <p className="text-[15px] font-bold text-[#1B4332] whitespace-pre-line text-center leading-relaxed">
                {locale === "ko"
                  ? t("fit.abandon.quote", { remaining: String(remainingExerciseCount) })
                  : t(`fit.abandon.quote.${abandonQuoteId}`)}
              </p>
              <p className="text-xs text-gray-500 text-center mt-2">
                {locale === "ko"
                  ? t("fit.abandon.quoteAuthor")
                  : t(`fit.abandon.quote.${abandonQuoteId}Author`)}
              </p>
            </div>

            {/* 진행 + 경고 */}
            <p className="text-sm text-gray-700 text-center mb-1">
              {t("fit.abandon.progress", {
                done: String(totalSetsLogged),
                remaining: String(remainingExerciseCount),
              })}
            </p>
            <p className="text-xs text-gray-400 text-center mb-5">
              {t("fit.abandon.warning")}
            </p>

            {/* 2버튼 */}
            <div className="flex gap-2">
              <button
                onClick={() => setShowAbandonModal(false)}
                className="flex-1 py-3 rounded-xl bg-[#1B4332] text-white font-bold text-sm active:scale-[0.98] transition-all"
              >
                {t("fit.abandon.continue")}
              </button>
              <button
                onClick={handleConfirmAbandon}
                className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-500 font-bold text-sm active:scale-[0.98] transition-all"
              >
                {t("fit.abandon.endNow")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
