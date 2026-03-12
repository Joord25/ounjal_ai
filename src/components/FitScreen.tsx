"use client";

import React, { useState, useEffect, useRef } from "react";
import { THEME } from "@/constants/theme";
import { ExerciseStep, getAlternativeExercises } from "@/constants/workout";

export type FeedbackType = "fail" | "target" | "easy" | "too_easy";

interface FitScreenProps {
  exercise: ExerciseStep;
  setInfo: {
    current: number;
    total: number;
    targetReps: number;
    targetWeight: string;
  };
  exerciseIndex: number;
  totalExercises: number;
  onSetComplete: (reps: number, feedback: FeedbackType, weightKg?: number) => void;
  onBack: () => void;
  isResting: boolean;
  restTimer: number;
  onSkipRest: () => void;
  isLastExercise: boolean;
  onSwapExercise?: (newExerciseName: string) => void;
}

export const FitScreen: React.FC<FitScreenProps> = ({
  exercise,
  setInfo,
  exerciseIndex,
  totalExercises,
  onSetComplete,
  onBack,
  isResting,
  restTimer: _restTimer,
  onSkipRest,
  isLastExercise,
  onSwapExercise,
}) => {
  const [showSwapMenu, setShowSwapMenu] = useState(false);
  const alternatives = onSwapExercise ? getAlternativeExercises(exercise.name) : [];
  const isStrengthType = exercise.type === "strength" || exercise.type === "core";
  const isBodyweight = !exercise.weight || exercise.weight === "Bodyweight"
    || /맨몸|체중|bodyweight/i.test(exercise.weight)
    || /푸쉬업|푸시업|push[\s-]?up|pull[\s-]?up|풀업|턱걸이|딥스|dip|plank|플랭크|버피|burpee|크런치|crunch|레그레이즈|leg raise|마운틴\s?클라이머|mountain\s?climber|점프|jump/i.test(exercise.name);
  const hasWeight = isStrengthType && !isBodyweight;

  // Default weight by sex/age: male 20kg, female/senior(60+) 15kg
  const getDefaultWeight = (): number => {
    if (typeof window === "undefined") return 20;
    const gender = localStorage.getItem("alpha_gender");
    const birthYear = localStorage.getItem("alpha_birth_year");
    const age = birthYear ? new Date().getFullYear() - parseInt(birthYear) : 30;
    return (gender === "female" || age >= 60) ? 15 : 20;
  };

  // Load last used weight from localStorage
  const getStoredWeight = (): number => {
    if (typeof window === "undefined") return getDefaultWeight();
    const key = `alpha_weight_${exercise.name.replace(/[^a-zA-Z가-힣]/g, "_")}`;
    const stored = localStorage.getItem(key);
    if (stored) return parseFloat(stored);
    // Try to parse from exercise.weight string
    if (exercise.weight) {
      const parsed = parseFloat(exercise.weight);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return getDefaultWeight();
  };

  const [selectedWeight, setSelectedWeight] = useState<number>(getStoredWeight);
  const [weightConfirmed, setWeightConfirmed] = useState(!hasWeight);
  const [showWeightEdit, setShowWeightEdit] = useState(false);

  const [view, setView] = useState<"active" | "feedback">("active");
  const [failedReps, setFailedReps] = useState(Math.max(0, setInfo.targetReps - 1));
  const [easyExtraReps, setEasyExtraReps] = useState(2);
  const [isDoneAnimating, setIsDoneAnimating] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState(false);
  const [localRestSec, setLocalRestSec] = useState(0);
  const pendingFeedbackRef = useRef<{ feedback: FeedbackType; reps: number } | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [timerCompleted, setTimerCompleted] = useState(false);
  const [showRepsEdit, setShowRepsEdit] = useState(false);
  const [adjustedReps, setAdjustedReps] = useState(setInfo.targetReps);
  const [repsStopwatch, setRepsStopwatch] = useState(0);
  const [repsStopwatchRunning, setRepsStopwatchRunning] = useState(false);

  // Sync reps from parent (adaptive logic) — render-time sync pattern (React-recommended)
  const [prevTargetReps, setPrevTargetReps] = useState(setInfo.targetReps);
  if (setInfo.targetReps !== prevTargetReps) {
    setPrevTargetReps(setInfo.targetReps);
    setFailedReps(Math.max(0, setInfo.targetReps - 1));
    setAdjustedReps(setInfo.targetReps);
  }

  // Sync weight from parent (adaptive logic) — render-time sync pattern
  const [prevTargetWeight, setPrevTargetWeight] = useState(setInfo.targetWeight);
  if (setInfo.targetWeight !== prevTargetWeight) {
    setPrevTargetWeight(setInfo.targetWeight);
    if (hasWeight && setInfo.targetWeight) {
      const parsed = parseFloat(setInfo.targetWeight);
      if (!isNaN(parsed) && parsed > 0) {
        setSelectedWeight(parsed);
        const key = `alpha_weight_${exercise.name.replace(/[^a-zA-Z가-힣]/g, "_")}`;
        localStorage.setItem(key, String(parsed));
      }
    }
  }

  // Reset easyExtraReps when set changes
  const [prevSet, setPrevSet] = useState(setInfo.current);
  if (setInfo.current !== prevSet) {
    setPrevSet(setInfo.current);
    setEasyExtraReps(2);
    setView("active");
    setIsDoneAnimating(false);
  }

  const halfAlarmFired = useRef(false);

  // Alarm sound using Web Audio API
  const playAlarmSound = (pattern: "half" | "end" = "end") => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const beep = (freq: number, start: number, dur: number, vol = 0.3) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = "sine";
        gain.gain.setValueAtTime(vol, start);
        gain.gain.exponentialRampToValueAtTime(0.01, start + dur);
        osc.start(start);
        osc.stop(start + dur);
      };
      const t = ctx.currentTime;
      if (pattern === "half") {
        beep(660, t, 0.12, 0.2);
        beep(660, t + 0.18, 0.12, 0.2);
      } else {
        for (let r = 0; r < 3; r++) {
          const offset = r * 0.8;
          beep(880, t + offset, 0.15);
          beep(880, t + offset + 0.2, 0.15);
          beep(1320, t + offset + 0.4, 0.3);
        }
      }
    } catch (e) {}
  };

  // Weight presets: selected weight centered, 10 below + 10 above (0.5kg step)
  const weightPresets = (() => {
    const center = selectedWeight || getDefaultWeight();
    const step = 0.5;
    const presets: number[] = [];
    for (let i = -10; i <= 10; i++) {
      const v = center + i * step;
      if (v > 0) presets.push(parseFloat(v.toFixed(1)));
    }
    return presets;
  })();

  const confirmWeight = () => {
    const key = `alpha_weight_${exercise.name.replace(/[^a-zA-Z가-힣]/g, "_")}`;
    localStorage.setItem(key, String(selectedWeight));
    setWeightConfirmed(true);
    setShowWeightEdit(false);
    setRepsStopwatchRunning(true);
  };

  // Timer State for Cardio/Warmup
  const [isPlaying, setIsPlaying] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);

  const isTimerMode = exercise.type === 'cardio' || exercise.type === 'warmup' || exercise.type === 'mobility';

  // Determine if it's a distance-based measurement (LSD, km, etc.)
  const isDistanceMode = exercise.name.includes("LSD") || exercise.count.includes("km") || exercise.count.includes("Distance");

  // Timer Logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying && isTimerMode) {
      interval = setInterval(() => {
        setElapsedTime((prev) => {
            // If Distance Mode: Count UP
            if (isDistanceMode) {
                return prev + 1;
            }

            // Normal Timer Mode: Count DOWN
            const next = prev - 1;
            // 절반 알림
            const total = parseTargetTime(exercise.count);
            const half = Math.floor(total / 2);
            if (half > 0 && next === half && !halfAlarmFired.current) {
                halfAlarmFired.current = true;
                playAlarmSound("half");
            }
            if (next <= 0) {
                clearInterval(interval);
                setIsPlaying(false);
                setTimerCompleted(true);
                playAlarmSound("end");
                return 0;
            }
            return next;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, isTimerMode, isDistanceMode]);

  // Parse target time from exercise.count string
  const parseTargetTime = (countStr: string): number => {
    if (countStr.toLowerCase().includes('km') || countStr.includes('m') && !countStr.includes('min')) {
        return 0;
    }

    const match = countStr.match(/(\d+)/);
    const val = match ? parseInt(match[1]) : 0;

    if (countStr.toLowerCase().includes('sec') || countStr.includes('초')) {
        return val || 60;
    }

    if (countStr.toLowerCase().includes('min') || countStr.includes('분')) {
        return (val || 1) * 60;
    }

    if (countStr.includes('회') || countStr.toLowerCase().includes('reps') || countStr.includes('개')) {
        return 60;
    }

    return val ? val * 60 : 60;
  };

  // Reset timer on new exercise
  useEffect(() => {
    setIsPlaying(false);
    setTimerCompleted(false);
    halfAlarmFired.current = false;
    if (isTimerMode) {
        if (isDistanceMode) {
            setElapsedTime(0);
        } else {
            setElapsedTime(parseTargetTime(exercise.count));
        }
    } else {
        setElapsedTime(0);
    }
  }, [exerciseIndex]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Dynamic Font Size for Long Titles
  const isLongTitle = exercise.name.length > 20;
  const isVeryLongTitle = exercise.name.length > 40;
  const titleSizeClass = isVeryLongTitle
    ? "text-2xl"
    : isLongTitle
      ? "text-3xl"
      : "text-4xl md:text-5xl";

  // Reset view when exercise changes or set changes
  const prevIsResting = useRef(isResting);
  useEffect(() => {
    if (isResting) {
      setView("active");
      setIsDoneAnimating(false);
      setRepsStopwatchRunning(false);
      setRepsStopwatch(0);
    } else if (prevIsResting.current && !isResting && hasWeight && weightConfirmed) {
      // Rest just ended — auto-start stopwatch for next set
      setRepsStopwatch(0);
      setRepsStopwatchRunning(true);
    }
    prevIsResting.current = isResting;
  }, [isResting]);

  // (Reps and weight sync moved to render-time pattern above for reliability)

  // Stopwatch for reps mode
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (repsStopwatchRunning && !isTimerMode) {
      interval = setInterval(() => {
        setRepsStopwatch((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [repsStopwatchRunning, isTimerMode]);

  // Local rest timer (starts when feedback sheet opens)
  useEffect(() => {
    if (view !== "feedback" || localRestSec <= 0) return;
    const interval = setInterval(() => setLocalRestSec(prev => prev - 1), 1000);
    return () => clearInterval(interval);
  }, [view, localRestSec]);

  // Auto-advance when both feedback given AND local timer done
  useEffect(() => {
    if (feedbackGiven && localRestSec <= 0 && pendingFeedbackRef.current) {
      const { feedback, reps } = pendingFeedbackRef.current;
      pendingFeedbackRef.current = null;
      onSetComplete(reps, feedback, hasWeight ? selectedWeight : undefined);
      // Skip parent's rest since we already rested locally
      setTimeout(() => onSkipRest(), 50);
    }
  }, [feedbackGiven, localRestSec]);

  const handleDoneClick = () => {
    if (exercise.type !== "strength" && exercise.type !== "core") {
      setIsDoneAnimating(true);
      setRepsStopwatchRunning(false);
      setTimeout(() => {
        onSetComplete(adjustedReps, "target");
      }, 500);
      return;
    }
    setRepsStopwatchRunning(false);
    setView("feedback");
    setFeedbackGiven(false);
    setLocalRestSec(75); // default rest, will be active immediately
    pendingFeedbackRef.current = null;
  };

  const actualWeight = hasWeight ? selectedWeight : undefined;

  const submitFeedback = (feedback: FeedbackType, reps: number) => {
    setFeedbackGiven(true);
    // If timer already done, advance immediately
    if (localRestSec <= 0) {
      pendingFeedbackRef.current = null;
      onSetComplete(reps, feedback, actualWeight);
      setTimeout(() => onSkipRest(), 50);
    } else {
      pendingFeedbackRef.current = { feedback, reps };
    }
  };

  const handleSkipLocalRest = () => {
    setLocalRestSec(0);
    if (feedbackGiven && pendingFeedbackRef.current) {
      const { feedback, reps } = pendingFeedbackRef.current;
      pendingFeedbackRef.current = null;
      onSetComplete(reps, feedback, actualWeight);
      setTimeout(() => onSkipRest(), 50);
    }
  };

  // Weight Picker View (First set of strength exercises)
  if (hasWeight && !weightConfirmed) {
    const parts = exercise.name.split('(');
    const mainTitle = parts[0].trim();
    const subTitle = parts.length > 1 ? parts[1].replace(')', '').trim() : "";

    return (
      <div className="flex flex-col h-full bg-white animate-fade-in relative">
        <div className="pt-[max(2.5rem,env(safe-area-inset-top))] pb-4 px-6 flex items-center justify-between relative shrink-0">
          <button onClick={onBack} className="p-2 -ml-2 z-50 relative">
            <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="absolute inset-x-16 top-0 bottom-0 flex flex-col items-center justify-center pt-[max(2.5rem,env(safe-area-inset-top))] pb-4 pointer-events-none z-0">
            <span className="text-[10px] font-bold text-gray-400 tracking-[0.2em]">
              EXERCISE {exerciseIndex} / {totalExercises}
            </span>
          </div>
          <div className="w-10" />
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-8">
          <div className="text-center">
            <h1 className="text-4xl font-black text-[#1B4332] tracking-tight mb-2">{mainTitle}</h1>
            {subTitle && <p className="text-lg text-gray-400 font-medium">{subTitle}</p>}
          </div>

          <div className="flex flex-col items-center gap-2">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">사용 무게</p>
            <div className="flex items-center justify-center gap-4 w-full">
              <button
                onClick={() => setSelectedWeight(Math.max(0, selectedWeight - 2.5))}
                className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-xl active:scale-95 transition-all hover:bg-gray-200 shrink-0"
              >
                -
              </button>
              <div className="w-40 flex items-baseline justify-center">
                <span className="text-6xl font-black text-[#1B4332] tabular-nums">{selectedWeight}</span>
                <span className="text-xl font-bold text-gray-400 ml-1">kg</span>
              </div>
              <button
                onClick={() => setSelectedWeight(selectedWeight + 2.5)}
                className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-xl active:scale-95 transition-all hover:bg-gray-200 shrink-0"
              >
                +
              </button>
            </div>
          </div>

          {/* Presets — horizontal carousel, selected centered */}
          <div className="flex items-center justify-center gap-2 overflow-x-auto scrollbar-hide py-1 -mx-6 px-6">
            {weightPresets.map((w) => {
              const isSelected = selectedWeight === w;
              const centerIdx = weightPresets.indexOf(selectedWeight);
              const dist = centerIdx >= 0 ? Math.abs(weightPresets.indexOf(w) - centerIdx) : 0;
              const opacity = isSelected ? 1 : dist === 1 ? 0.7 : dist === 2 ? 0.45 : 0.3;
              const scale = isSelected ? "scale-110" : dist === 1 ? "scale-100" : "scale-90";
              return (
                <button
                  key={w}
                  onClick={() => setSelectedWeight(w)}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 active:scale-95 shrink-0 ${scale} ${
                    isSelected
                      ? "bg-[#1B4332] text-white shadow-lg"
                      : "bg-gray-100 text-gray-500"
                  }`}
                  style={{ opacity }}
                >
                  {w}kg
                </button>
              );
            })}
          </div>

          <p className="text-[10px] text-gray-300 font-medium">이전 기록에서 자동 불러옴 · 2.5kg 단위 조절</p>
        </div>

        <div className="flex flex-col items-center gap-3 shrink-0 px-6" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 3rem)" }}>
          {alternatives.length > 0 && !showSwapMenu && (
            <button
              onClick={() => setShowSwapMenu(true)}
              className="text-[12px] font-bold text-gray-400 underline underline-offset-2"
            >
              운동 변경
            </button>
          )}
          {showSwapMenu && (
            <div className="w-full bg-gray-50 rounded-2xl p-4 space-y-2 animate-fade-in">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em]">대체 운동 선택</p>
                <button onClick={() => setShowSwapMenu(false)} className="text-[10px] text-gray-400 font-bold">닫기</button>
              </div>
              {alternatives.map((alt) => {
                const altParts = alt.split('(');
                const altName = altParts[0].trim();
                return (
                  <button
                    key={alt}
                    onClick={() => {
                      onSwapExercise?.(alt);
                      setShowSwapMenu(false);
                    }}
                    className="w-full text-left px-4 py-3 rounded-xl bg-white border border-gray-200 text-[13px] font-bold text-[#1B4332] active:scale-[0.98] transition-all"
                  >
                    {altName}
                  </button>
                );
              })}
            </div>
          )}
          <button
            onClick={confirmWeight}
            className="w-full py-4 rounded-2xl bg-[#1B4332] text-white font-bold text-lg shadow-xl active:scale-[0.98] transition-all"
          >
            {selectedWeight}kg 으로 시작
          </button>
        </div>
      </div>
    );
  }

  // Main Active View
  return (
    <div className="flex flex-col h-full bg-white animate-fade-in relative">
      {/* Header with Back Button */}
      <div className="pt-[max(2.5rem,env(safe-area-inset-top))] pb-3 sm:pb-8 px-6 flex items-center justify-between relative shrink-0">
        <button
          onClick={onBack}
          className="p-2 -ml-2 z-50 relative"
          disabled={isDoneAnimating || view === "feedback"}
        >
          <svg
            className="w-6 h-6 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>

        <div className="absolute inset-x-16 top-0 bottom-0 flex flex-col items-center justify-center pt-[max(2.5rem,env(safe-area-inset-top))] pb-3 sm:pb-8 pointer-events-none z-0">
          <span
            className="text-lg tracking-widest uppercase font-black"
            style={{ color: THEME.textMain }}
          >
            SET {setInfo.current} / {setInfo.total}
          </span>
          <span className="text-[10px] font-bold text-gray-400 tracking-[0.2em] mt-1">
            EXERCISE {exerciseIndex} / {totalExercises}
          </span>
        </div>

        {/* Skip Button for Timer Mode */}
        {isTimerMode && (
            <button
              onClick={() => onSetComplete(0, "easy")}
              className="absolute right-6 z-10 text-xs font-black text-gray-400 tracking-widest hover:text-gray-600 transition-colors bg-gray-100 px-3 py-1.5 rounded-full"
            >
              SKIP
            </button>
        )}

        {!isTimerMode && <div className="w-10" />}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 text-center gap-3 sm:gap-6 overflow-y-auto">
        <div className="flex flex-col items-center gap-1 sm:gap-2">
          {(() => {
            const parts = exercise.name.split('(');
            const mainTitle = parts[0].trim();
            const subTitle = parts.length > 1 ? parts[1].replace(')', '').trim() : "";

            return (
              <>
                <h1
                  className={`${titleSizeClass} font-black leading-tight break-keep`}
                  style={{ color: THEME.textMain }}
                >
                  {mainTitle}
                </h1>
                {subTitle && (
                  <p className="text-base sm:text-lg text-gray-400 font-medium font-english tracking-tight mt-0.5">
                    {subTitle}
                  </p>
                )}
                <button
                  onClick={() => setShowGuide(true)}
                  className="mt-2.5 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-100 text-[#2D6A4F] active:scale-95 transition-all animate-[guideHint_2s_ease-in-out_1]"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
                  </svg>
                  <span className="text-[11px] font-bold tracking-wide">자세 가이드</span>
                </button>
              </>
            );
          })()}
        </div>

        <div className="flex flex-col items-center gap-2">
          {isTimerMode ? (
             <div className="flex flex-col items-center">
                {timerCompleted && !isDistanceMode ? (
                  <div className="flex flex-col items-center animate-fade-in mt-16">
                    <p className="text-5xl font-black text-[#2D6A4F]">완료</p>
                  </div>
                ) : (
                  <>
                    <p className="text-5xl sm:text-7xl font-black tracking-tighter tabular-nums" style={{ color: THEME.textMain }}>
                      {formatTime(elapsedTime)}
                    </p>
                    <p className="text-lg sm:text-xl font-bold text-[#2D6A4F] mt-2">
                        {isDistanceMode ? `${exercise.count}` : (
                            exercise.count.includes('회') || exercise.count.toLowerCase().includes('reps')
                            ? `Goal: ${exercise.count}`
                            : `Target Time: ${exercise.count}`
                        )}
                    </p>
                  </>
                )}
             </div>
          ) : (
            <>
              {/* Reps */}
              <button
                onClick={() => setShowRepsEdit(true)}
                className="flex items-baseline gap-1.5 active:opacity-60 transition-all"
              >
                <span className="text-5xl sm:text-6xl font-black" style={{ color: THEME.textMain }}>{adjustedReps}</span>
                <span className="text-lg sm:text-xl font-bold text-gray-400">REPS</span>
              </button>

              {/* Weight */}
              {hasWeight && (
                <button
                  onClick={() => setShowWeightEdit(true)}
                  className="flex items-baseline gap-1 active:opacity-60 transition-all mt-1"
                >
                  <span className="text-4xl font-black text-[#2D6A4F]">{selectedWeight}</span>
                  <span className="text-lg font-bold text-gray-400">kg</span>
                </button>
              )}
              {!hasWeight && exercise.weight && (
                <span className="text-3xl font-bold text-[#2D6A4F] mt-1">
                  {setInfo.targetWeight}
                </span>
              )}

              {/* Stopwatch */}
              <div className="flex flex-col items-center mt-4 sm:mt-8 h-20 sm:h-24">
                <span className="text-5xl sm:text-7xl font-black tabular-nums tracking-tighter" style={{ color: THEME.textMain }}>
                  {formatTime(repsStopwatch)}
                </span>
                <button
                  onClick={() => setRepsStopwatch(0)}
                  className={`mt-2 text-[10px] font-bold text-gray-300 uppercase tracking-widest hover:text-gray-500 transition-colors ${
                    repsStopwatch > 0 && !repsStopwatchRunning ? "visible" : "invisible"
                  }`}
                >
                  RESET
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Main CTA */}
      <div className="flex flex-col items-center gap-4 shrink-0 mt-auto" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.5rem)" }}>
        {isTimerMode ? (
            <div className="flex flex-col items-center gap-4 h-32 sm:h-40 justify-center">
                {timerCompleted ? (
                  /* Timer completed — show prominent DONE button with pulse */
                  <button
                    onClick={handleDoneClick}
                    className="w-24 h-24 sm:w-32 sm:h-32 rounded-full flex flex-col items-center justify-center bg-[#1B4332] text-white shadow-2xl active:scale-95 transition-all animate-pulse"
                  >
                    <svg className="w-8 h-8 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="font-bold text-base tracking-wider">DONE</span>
                  </button>
                ) : !isPlaying && elapsedTime > 0 ? (
                  /* Paused mid-timer — show resume + done */
                  <div className="flex items-center gap-6">
                      <button
                        onClick={() => setIsPlaying(true)}
                        className="w-20 h-20 rounded-full flex items-center justify-center bg-[#2D6A4F] text-white shadow-lg active:scale-95 transition-all hover:bg-[#1B4332]"
                      >
                        <svg className="w-8 h-8 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                      </button>
                      <button
                        onClick={handleDoneClick}
                        className="w-20 h-20 rounded-full flex items-center justify-center bg-[#1B4332] text-white shadow-lg active:scale-95 transition-all hover:bg-[#2D6A4F]"
                      >
                        <span className="font-bold text-sm tracking-wider">DONE</span>
                      </button>
                  </div>
                ) : !isPlaying && elapsedTime === 0 && !timerCompleted ? (
                  /* Initial state — show play button */
                  <button
                    onClick={() => setIsPlaying(true)}
                    className="w-24 h-24 rounded-full flex items-center justify-center bg-[#2D6A4F] text-white shadow-xl active:scale-95 transition-all hover:bg-[#1B4332]"
                  >
                      <svg className="w-10 h-10 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                  </button>
                ) : (
                  /* Playing — show pause + done */
                  <div className="flex items-center gap-6">
                      <button
                        onClick={() => setIsPlaying(false)}
                        className="w-20 h-20 rounded-full flex items-center justify-center bg-amber-500 text-white shadow-lg active:scale-95 transition-all hover:bg-amber-400"
                      >
                        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                      </button>
                      <button
                        onClick={handleDoneClick}
                        className="w-20 h-20 rounded-full flex items-center justify-center bg-[#1B4332] text-white shadow-lg active:scale-95 transition-all hover:bg-[#2D6A4F]"
                      >
                        <span className="font-bold text-sm tracking-wider">DONE</span>
                      </button>
                  </div>
                )}
            </div>
        ) : (
            <div className="flex items-center gap-5 sm:gap-8">
              {/* Play/Pause stopwatch button */}
              <button
                onClick={() => setRepsStopwatchRunning(!repsStopwatchRunning)}
                className={`w-20 h-20 sm:w-28 sm:h-28 rounded-full flex items-center justify-center shadow-xl active:scale-95 transition-all ${
                  repsStopwatchRunning ? "bg-amber-500 hover:bg-amber-400" : "bg-[#2D6A4F] hover:bg-[#1B4332]"
                }`}
              >
                {repsStopwatchRunning ? (
                  <svg className="w-8 h-8 sm:w-10 sm:h-10 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                ) : (
                  <svg className="w-8 h-8 sm:w-10 sm:h-10 ml-1 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                )}
              </button>

              {/* DONE button */}
              <button
                onClick={handleDoneClick}
                disabled={isDoneAnimating || view === "feedback"}
                className={`w-20 h-20 sm:w-28 sm:h-28 rounded-full flex items-center justify-center transition-all duration-300 active:scale-95 shadow-xl bg-[#2D6A4F] hover:bg-[#1B4332] ${
                  isDoneAnimating ? "scale-105" : ""
                }`}
              >
                {isDoneAnimating ? (
                  <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span className="text-white text-lg font-bold tracking-widest uppercase">
                    Done
                  </span>
                )}
              </button>
            </div>
        )}
      </div>

       {/* Success Overlay */}
       {isDoneAnimating && isLastExercise && setInfo.current === setInfo.total && (
        <div className="absolute inset-0 bg-white/95 flex items-center justify-center z-50 animate-fade-in">
          <p className="text-2xl font-bold" style={{ color: THEME.textMain }}>
            오늘도 해냈다!
          </p>
        </div>
      )}

      {/* Exercise Guide Bottom Sheet */}
      {showGuide && (
        <div className="absolute inset-0 z-40">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setShowGuide(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[2rem] p-6 pb-2 animate-slide-up shadow-2xl">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-6" />

            <div className="mb-5">
              {(() => {
                const parts = exercise.name.split('(');
                const korean = parts[0].trim();
                const english = parts.length > 1 ? parts[1].replace(')', '').trim() : "";
                return (
                  <>
                    <h3 className="text-xl font-black text-[#1B4332] tracking-tight">{korean}</h3>
                    {english && <p className="text-sm text-gray-400 mt-1">{english}</p>}
                  </>
                );
              })()}
            </div>

            <div className="grid grid-cols-3 gap-2 mb-6">
              <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Type</p>
                <p className="text-sm font-black text-gray-900 uppercase">{exercise.type}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Sets</p>
                <p className="text-sm font-black text-gray-900">{setInfo.total}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Reps</p>
                <p className="text-sm font-black text-gray-900">{setInfo.targetReps}</p>
              </div>
            </div>

            {exercise.weight && exercise.weight !== "Bodyweight" && (
              <div className="bg-emerald-50 rounded-xl p-3 mb-6 border border-emerald-100 text-center">
                <p className="text-[9px] font-black text-[#2D6A4F] uppercase tracking-widest mb-0.5">Weight</p>
                <p className="text-sm font-black text-[#1B4332]">{exercise.weight}</p>
              </div>
            )}

            <button
              onClick={() => {
                const parts = exercise.name.split('(');
                const searchTerm = parts.length > 1 ? parts[1].replace(')', '').trim() : parts[0].trim();
                window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(searchTerm + " exercise form guide")}`, "_blank");
              }}
              className="w-full p-4 rounded-2xl bg-[#1B4332] text-white flex items-center justify-center gap-3 active:scale-[0.98] transition-all shadow-lg hover:bg-[#2D6A4F]"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
              <span className="font-black text-sm tracking-wide">YouTube에서 자세 가이드 보기</span>
            </button>

            <button
              onClick={() => setShowGuide(false)}
              className="w-full p-3 mt-2 rounded-xl text-gray-400 font-bold text-sm active:scale-[0.98] transition-all"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* Weight Edit Bottom Sheet */}
      {showWeightEdit && (
        <div className="absolute inset-0 z-40">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setShowWeightEdit(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[2rem] p-6 pb-2 animate-slide-up shadow-2xl">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-6" />
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-center mb-4">무게 변경</p>
            <div className="flex items-center justify-center gap-4 mb-6">
              <button
                onClick={() => setSelectedWeight(Math.max(0, selectedWeight - 2.5))}
                className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-xl active:scale-95 shrink-0"
              >
                -
              </button>
              <div className="w-40 flex items-baseline justify-center">
                <span className="text-5xl font-black text-[#1B4332] tabular-nums">{selectedWeight}</span>
                <span className="text-lg text-gray-400 ml-1">kg</span>
              </div>
              <button
                onClick={() => setSelectedWeight(selectedWeight + 2.5)}
                className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-xl active:scale-95 shrink-0"
              >
                +
              </button>
            </div>
            <div className="flex items-center justify-center gap-2 overflow-x-auto scrollbar-hide py-1 -mx-6 px-6 mb-6">
              {weightPresets.map((w) => {
                const isSelected = selectedWeight === w;
                const centerIdx = weightPresets.indexOf(selectedWeight);
                const dist = centerIdx >= 0 ? Math.abs(weightPresets.indexOf(w) - centerIdx) : 0;
                const opacity = isSelected ? 1 : dist === 1 ? 0.7 : dist === 2 ? 0.45 : 0.3;
                const scale = isSelected ? "scale-110" : dist === 1 ? "scale-100" : "scale-90";
                return (
                  <button
                    key={w}
                    onClick={() => setSelectedWeight(w)}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 active:scale-95 shrink-0 ${scale} ${
                      isSelected ? "bg-[#1B4332] text-white" : "bg-gray-100 text-gray-500"
                    }`}
                    style={{ opacity }}
                  >
                    {w}kg
                  </button>
                );
              })}
            </div>
            <button
              onClick={confirmWeight}
              className="w-full py-3.5 rounded-2xl bg-[#1B4332] text-white font-bold text-base active:scale-[0.98] transition-all"
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* Reps Edit Bottom Sheet */}
      {showRepsEdit && (
        <div className="absolute inset-0 z-40">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setShowRepsEdit(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[2rem] p-6 pb-2 animate-slide-up shadow-2xl">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-6" />
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-center mb-4">반복 수 변경</p>
            <div className="flex items-center justify-center gap-4 mb-6">
              <button
                onClick={() => setAdjustedReps(Math.max(1, adjustedReps - 1))}
                className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-xl active:scale-95"
              >
                -
              </button>
              <span className="text-5xl font-black text-[#1B4332] tabular-nums">{adjustedReps}<span className="text-lg text-gray-400 ml-1">회</span></span>
              <button
                onClick={() => setAdjustedReps(adjustedReps + 1)}
                className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-xl active:scale-95"
              >
                +
              </button>
            </div>
            <div className="flex gap-2 flex-wrap justify-center mb-6">
              {[5, 8, 10, 12, 15, 20].map((r) => (
                <button
                  key={r}
                  onClick={() => setAdjustedReps(r)}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                    adjustedReps === r ? "bg-[#1B4332] text-white" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {r}회
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                setFailedReps(adjustedReps);
                setShowRepsEdit(false);
              }}
              className="w-full py-3.5 rounded-2xl bg-[#1B4332] text-white font-bold text-base active:scale-[0.98] transition-all"
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* Feedback + Rest Bottom Sheet */}
      {view === "feedback" && (
        <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          {!feedbackGiven && <div className="absolute inset-0" onClick={() => { setView("active"); setLocalRestSec(0); }} />}

          <div className="w-full rounded-t-[2.5rem] shadow-[0_-10px_40px_rgba(0,0,0,0.2)] animate-slide-up flex flex-col relative z-10 max-w-md mx-auto bg-white p-6 pb-8">
             <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mb-4" />

            {/* Rest Timer (always visible) */}
            <div className="flex items-center justify-between mb-5 bg-[#1B4332] rounded-2xl px-5 py-4">
              <div className="flex items-center gap-3">
                <p className="text-xs font-bold text-emerald-300/70 uppercase tracking-[0.15em]">REST</p>
                <div className="text-3xl font-black text-white tracking-tighter">
                  {Math.floor(localRestSec / 60)}:{(localRestSec % 60).toString().padStart(2, "0")}
                </div>
              </div>
              <button
                onClick={handleSkipLocalRest}
                className="px-4 py-2 bg-emerald-500 rounded-full text-xs font-bold text-white tracking-widest hover:bg-emerald-400 active:scale-95 transition-all"
              >
                {feedbackGiven ? "SKIP" : "SKIP REST"}
              </button>
            </div>

            {!feedbackGiven ? (
              /* === FEEDBACK OPTIONS === */
              <>
                <div className="text-center mb-3">
                  <h2 className="text-lg font-black tracking-tight" style={{ color: THEME.textMain }}>
                    FEEDBACK
                  </h2>
                </div>

                <div className="flex flex-col gap-2.5">
                  {/* Option: EASY */}
                  <div className="w-full p-4 rounded-2xl text-white shadow-lg overflow-hidden bg-[#1B4332]">
                    <div className="flex items-center justify-between">
                       <div className="flex flex-col items-start">
                        <span className="font-bold text-base">{easyExtraReps}개 더 가능</span>
                        <span className="text-[10px] text-emerald-300 font-medium tracking-wide">WEIGHT UP ▲</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center bg-[#2D6A4F]/50 rounded-lg px-1.5">
                            <button onClick={() => setEasyExtraReps(Math.max(1, easyExtraReps - 1))} className="w-7 h-7 flex items-center justify-center text-emerald-200 font-bold">-</button>
                            <input type="number" value={easyExtraReps} onChange={(e) => setEasyExtraReps(Math.max(1, Number(e.target.value)))} className="w-10 text-center bg-transparent font-bold text-base outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-white" />
                            <button onClick={() => setEasyExtraReps(easyExtraReps + 1)} className="w-7 h-7 flex items-center justify-center text-emerald-200 font-bold">+</button>
                        </div>
                        <button onClick={() => submitFeedback(easyExtraReps > 3 ? "too_easy" : "easy", adjustedReps + easyExtraReps)} className="bg-emerald-400 text-white w-9 h-9 rounded-xl flex items-center justify-center font-bold shadow-sm">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Option: TARGET */}
                  <button onClick={() => submitFeedback("target", adjustedReps)} className="w-full p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-100 active:scale-[0.98] transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col items-start">
                        <span className="font-bold text-base text-[#1B4332]">딱 조아!</span>
                        <span className="text-[10px] font-bold tracking-wide text-[#2D6A4F]/70">KEEP GOING -</span>
                      </div>
                      <span className="text-xl">👌</span>
                    </div>
                  </button>

                  {/* Option: FAIL */}
                  <div className="w-full p-4 rounded-2xl bg-red-50 border-2 border-red-100 flex items-center justify-between">
                      <div className="flex flex-col items-start shrink-0">
                        <span className="font-bold text-base text-red-500">실패 지점</span>
                        <span className="text-[10px] text-red-300 font-bold tracking-wide">FAIL REPS</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center bg-red-100/60 rounded-lg px-1.5">
                            <button onClick={() => setFailedReps(Math.max(0, failedReps - 1))} className="w-7 h-7 flex items-center justify-center text-red-400 font-bold">-</button>
                            <input type="number" value={failedReps} onChange={(e) => setFailedReps(Math.min(adjustedReps - 1, Math.max(0, Number(e.target.value))))} className="w-10 text-center bg-transparent font-bold text-base outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-red-600" />
                            <button onClick={() => setFailedReps(Math.min(adjustedReps - 1, failedReps + 1))} className="w-7 h-7 flex items-center justify-center text-red-400 font-bold">+</button>
                        </div>
                        <button onClick={() => submitFeedback("fail", failedReps)} className="bg-red-500 text-white w-9 h-9 rounded-xl flex items-center justify-center font-bold shadow-sm">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        </button>
                      </div>
                  </div>
                </div>
              </>
            ) : (
              /* === Feedback done, waiting for timer === */
              <div className="flex flex-col items-center py-4">
                <svg className="w-10 h-10 text-[#2D6A4F] mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                <p className="text-sm font-bold text-[#1B4332]">피드백 완료</p>
                <p className="text-xs text-gray-400 mt-1">타이머 종료 후 다음 세트로 이동해요</p>
                <button
                  onClick={() => { setFeedbackGiven(false); pendingFeedbackRef.current = null; }}
                  className="mt-3 px-4 py-2 rounded-full bg-gray-100 text-xs font-bold text-gray-500 active:scale-95 transition-all"
                >
                  다시 선택
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
