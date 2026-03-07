"use client";

import React, { useState, useEffect } from "react";
import { THEME } from "@/constants/theme";
import { ExerciseStep } from "@/constants/workout";

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
}

export const FitScreen: React.FC<FitScreenProps> = ({
  exercise,
  setInfo,
  exerciseIndex,
  totalExercises,
  onSetComplete,
  onBack,
  isResting,
  restTimer,
  onSkipRest,
  isLastExercise,
}) => {
  const isStrengthType = exercise.type === "strength" || exercise.type === "core";
  const hasWeight = isStrengthType && exercise.weight && exercise.weight !== "Bodyweight";

  // Load last used weight from localStorage
  const getStoredWeight = (): number => {
    if (typeof window === "undefined") return 40;
    const key = `alpha_weight_${exercise.name.replace(/[^a-zA-Z가-힣]/g, "_")}`;
    const stored = localStorage.getItem(key);
    if (stored) return parseFloat(stored);
    // Try to parse from exercise.weight string
    if (exercise.weight) {
      const parsed = parseFloat(exercise.weight);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return 40;
  };

  const [selectedWeight, setSelectedWeight] = useState<number>(getStoredWeight);
  const [weightConfirmed, setWeightConfirmed] = useState(!hasWeight);
  const [showWeightEdit, setShowWeightEdit] = useState(false);

  const [view, setView] = useState<"active" | "feedback">("active");
  const [failedReps, setFailedReps] = useState(setInfo.targetReps);
  const [easyExtraReps, setEasyExtraReps] = useState(2);
  const [isDoneAnimating, setIsDoneAnimating] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  // Weight presets based on current weight range
  const weightPresets = (() => {
    const base = selectedWeight || 40;
    if (base <= 15) return [5, 10, 15, 20, 25];
    if (base <= 30) return [10, 15, 20, 25, 30];
    if (base <= 50) return [20, 30, 40, 50, 60];
    if (base <= 80) return [40, 50, 60, 70, 80];
    return [60, 80, 100, 120, 140];
  })();

  const confirmWeight = () => {
    const key = `alpha_weight_${exercise.name.replace(/[^a-zA-Z가-힣]/g, "_")}`;
    localStorage.setItem(key, String(selectedWeight));
    setWeightConfirmed(true);
    setShowWeightEdit(false);
  };

  // Timer State for Cardio/Warmup
  const [isPlaying, setIsPlaying] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);

  const isTimerMode = exercise.type === 'cardio' || exercise.type === 'warmup';

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
            if (prev <= 0) {
                clearInterval(interval);
                setIsPlaying(false);
                return 0;
            }
            return prev - 1;
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
  useEffect(() => {
    if (isResting) {
      setView("active");
      setIsDoneAnimating(false);
    }
  }, [isResting]);

  useEffect(() => {
    setFailedReps(setInfo.targetReps);
  }, [setInfo.targetReps]);

  const handleDoneClick = () => {
    if (exercise.type !== "strength" && exercise.type !== "core") {
      setIsDoneAnimating(true);
      setTimeout(() => {
        onSetComplete(setInfo.targetReps, "target");
      }, 500);
      return;
    }
    setView("feedback");
  };

  const actualWeight = hasWeight ? selectedWeight : undefined;

  const submitFeedback = (feedback: FeedbackType, reps: number) => {
    setIsDoneAnimating(true);
    setTimeout(() => {
      onSetComplete(reps, feedback, actualWeight);
      setIsDoneAnimating(false);
    }, 500);
  };

  // Render Rest View (Full Screen)
  if (isResting) {
    return (
      <div className="flex flex-col h-full bg-[#1B4332] text-white animate-fade-in items-center justify-center relative">
        <h2 className="text-3xl font-bold mb-8">REST</h2>
        <div className="text-9xl font-black mb-12 tracking-tighter">
          {Math.floor(restTimer / 60)}:{(restTimer % 60).toString().padStart(2, "0")}
        </div>
        <button
          onClick={onSkipRest}
          className="px-8 py-4 bg-emerald-500 rounded-full text-lg font-bold tracking-widest hover:bg-emerald-400 transition-colors"
        >
          SKIP REST
        </button>
        <p className="absolute bottom-12 text-sm text-emerald-300/50">NEXT: SET {setInfo.current + 1}</p>
      </div>
    );
  }

  // Weight Picker View (First set of strength exercises)
  if (hasWeight && !weightConfirmed) {
    const parts = exercise.name.split('(');
    const mainTitle = parts[0].trim();
    const subTitle = parts.length > 1 ? parts[1].replace(')', '').trim() : "";

    return (
      <div className="flex flex-col h-full bg-white animate-fade-in relative">
        <div className="pt-16 pb-4 px-6 flex items-center justify-between relative shrink-0">
          <button onClick={onBack} className="p-2 -ml-2 z-50 relative">
            <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="absolute inset-x-16 top-0 bottom-0 flex flex-col items-center justify-center pt-16 pb-4 pointer-events-none z-0">
            <span className="text-[10px] font-bold text-gray-400 tracking-[0.2em]">
              EXERCISE {exerciseIndex} / {totalExercises}
            </span>
          </div>
          <div className="w-10" />
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-8">
          <div className="text-center">
            <h1 className="text-2xl font-black text-[#1B4332] tracking-tight mb-1">{mainTitle}</h1>
            {subTitle && <p className="text-sm text-gray-400 font-medium">{subTitle}</p>}
          </div>

          <div className="flex flex-col items-center gap-2">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">사용 무게</p>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSelectedWeight(Math.max(0, selectedWeight - 2.5))}
                className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-xl active:scale-95 transition-all hover:bg-gray-200"
              >
                -
              </button>
              <div className="flex items-baseline">
                <span className="text-6xl font-black text-[#1B4332] tabular-nums">{selectedWeight}</span>
                <span className="text-xl font-bold text-gray-400 ml-1">kg</span>
              </div>
              <button
                onClick={() => setSelectedWeight(selectedWeight + 2.5)}
                className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-xl active:scale-95 transition-all hover:bg-gray-200"
              >
                +
              </button>
            </div>
          </div>

          {/* Presets */}
          <div className="flex gap-2 flex-wrap justify-center">
            {weightPresets.map((w) => (
              <button
                key={w}
                onClick={() => setSelectedWeight(w)}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                  selectedWeight === w
                    ? "bg-[#1B4332] text-white shadow-lg"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {w}kg
              </button>
            ))}
          </div>

          <p className="text-[10px] text-gray-300 font-medium">이전 기록에서 자동 불러옴 · 2.5kg 단위 조절</p>
        </div>

        <div className="pb-12 flex flex-col items-center gap-3 shrink-0 px-6">
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
      <div className="pt-16 pb-8 px-6 flex items-center justify-between relative shrink-0">
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

        <div className="absolute inset-x-16 top-0 bottom-0 flex flex-col items-center justify-center pt-16 pb-8 pointer-events-none z-0">
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
              className="absolute right-6 z-50 text-xs font-black text-gray-400 tracking-widest hover:text-gray-600 transition-colors bg-gray-100 px-3 py-1.5 rounded-full"
            >
              SKIP
            </button>
        )}

        {!isTimerMode && <div className="w-10" />}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-6 overflow-y-auto">
        <div className="flex flex-col items-center gap-2">
          {(() => {
            const parts = exercise.name.split('(');
            const mainTitle = parts[0].trim();
            const subTitle = parts.length > 1 ? parts[1].replace(')', '').trim() : "";

            return (
              <>
                <h1
                  className="text-4xl md:text-5xl font-black leading-tight break-keep"
                  style={{ color: THEME.textMain }}
                >
                  {mainTitle}
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  {subTitle && (
                    <span className="text-lg md:text-xl text-gray-400 font-medium font-english tracking-tight">
                      {subTitle}
                    </span>
                  )}
                  <button
                    onClick={() => setShowGuide(true)}
                    className="w-6 h-6 rounded-full bg-emerald-50 text-[#2D6A4F] hover:bg-emerald-100 flex items-center justify-center shrink-0 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827m0 3h.01" />
                    </svg>
                  </button>
                </div>
              </>
            );
          })()}
        </div>

        <div className="flex flex-col items-center gap-2">
          {isTimerMode ? (
             <div className="flex flex-col items-center">
                <p className="text-7xl font-black tracking-tighter tabular-nums" style={{ color: THEME.textMain }}>
                  {formatTime(elapsedTime)}
                </p>
                <p className="text-xl font-bold text-[#2D6A4F] mt-2">
                    {isDistanceMode ? `${exercise.count}` : (
                        exercise.count.includes('회') || exercise.count.toLowerCase().includes('reps')
                        ? `Goal: ${exercise.count}`
                        : `Target Time: ${exercise.count}`
                    )}
                </p>
             </div>
          ) : (
            <>
              <p
                className="text-6xl font-black tracking-tighter"
                style={{ color: THEME.textMain }}
              >
                {setInfo.targetReps}
                <span className="text-2xl font-bold text-gray-400 ml-2">REPS</span>
              </p>

              {hasWeight ? (
                <button
                  onClick={() => setShowWeightEdit(true)}
                  className="flex items-center gap-2 mt-2 px-4 py-1.5 rounded-xl bg-emerald-50 border border-emerald-100 active:scale-95 transition-all"
                >
                  <span className="text-2xl font-black text-[#2D6A4F]">{selectedWeight}<span className="text-sm font-bold text-[#2D6A4F]/60 ml-0.5">kg</span></span>
                  <svg className="w-3.5 h-3.5 text-[#2D6A4F]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              ) : exercise.weight && (
                <p className="text-2xl font-bold text-[#2D6A4F] mt-2">
                  {setInfo.targetWeight}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Main CTA */}
      <div className="pb-12 flex flex-col items-center gap-4 shrink-0 mt-auto">
        {isTimerMode ? (
            <div className="flex items-center gap-6 h-40">
                {!isPlaying && elapsedTime === 0 ? (
                  <button
                    onClick={() => setIsPlaying(true)}
                    className="w-24 h-24 rounded-full flex items-center justify-center bg-[#2D6A4F] text-white shadow-xl active:scale-95 transition-all hover:bg-[#1B4332]"
                  >
                      <svg className="w-10 h-10 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                  </button>
                ) : (
                  <>
                      <button
                        onClick={() => setIsPlaying(!isPlaying)}
                        className={`w-20 h-20 rounded-full flex items-center justify-center text-white shadow-lg active:scale-95 transition-all ${isPlaying ? 'bg-amber-500 hover:bg-amber-400' : 'bg-[#2D6A4F] hover:bg-[#1B4332]'}`}
                      >
                        {isPlaying ? (
                          <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                        ) : (
                          <svg className="w-8 h-8 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                        )}
                      </button>

                      <button
                        onClick={handleDoneClick}
                        className="w-20 h-20 rounded-full flex items-center justify-center bg-[#1B4332] text-white shadow-lg active:scale-95 transition-all hover:bg-[#2D6A4F]"
                      >
                        <span className="font-bold text-sm tracking-wider">DONE</span>
                      </button>
                  </>
                )}
            </div>
        ) : (
            <button
              onClick={handleDoneClick}
              disabled={isDoneAnimating || view === "feedback"}
              className={`w-40 h-40 rounded-full flex items-center justify-center transition-all duration-300 active:scale-95 shadow-xl bg-[#2D6A4F] hover:bg-[#1B4332] ${
                isDoneAnimating ? "scale-105" : ""
              }`}
            >
              {isDoneAnimating ? (
                <svg
                  className="w-16 h-16 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              ) : (
                <span className="text-white text-xl font-bold tracking-widest uppercase">
                  Done
                </span>
              )}
            </button>
        )}

        {!isTimerMode && (
            <p className="text-[10px] uppercase tracking-widest opacity-30 font-bold">
              Click when finished
            </p>
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
                className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-xl active:scale-95"
              >
                -
              </button>
              <span className="text-5xl font-black text-[#1B4332] tabular-nums">{selectedWeight}<span className="text-lg text-gray-400 ml-1">kg</span></span>
              <button
                onClick={() => setSelectedWeight(selectedWeight + 2.5)}
                className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-xl active:scale-95"
              >
                +
              </button>
            </div>
            <div className="flex gap-2 flex-wrap justify-center mb-6">
              {weightPresets.map((w) => (
                <button
                  key={w}
                  onClick={() => setSelectedWeight(w)}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                    selectedWeight === w ? "bg-[#1B4332] text-white" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {w}kg
                </button>
              ))}
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

      {/* Feedback Popup Modal (Bottom Sheet Style) */}
      {view === "feedback" && (
        <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          {/* Close Area */}
          <div className="absolute inset-0" onClick={() => setView("active")} />

          <div className="bg-white w-full rounded-t-[2.5rem] p-8 pb-12 shadow-[0_-10px_40px_rgba(0,0,0,0.2)] animate-slide-up flex flex-col gap-6 relative z-10 max-w-md mx-auto">
             {/* Drag Handle Indicator */}
             <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mb-2" />

            <div className="text-center mb-2">
              <h2 className="text-2xl font-black tracking-tight" style={{ color: THEME.textMain }}>
                FEEDBACK
              </h2>
            </div>

            <div className="flex flex-col gap-3">
              {/* Option: EASY */}
              <div
                className="w-full p-5 rounded-2xl text-white shadow-lg overflow-hidden bg-[#1B4332]"
              >
                <div className="flex items-center justify-between">
                   <div className="flex flex-col items-start">
                    <span className="font-bold text-lg">{easyExtraReps}개 더 가능</span>
                    <span className="text-xs text-emerald-300 font-medium tracking-wide">WEIGHT UP ▲</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center bg-[#2D6A4F]/50 rounded-lg px-2">
                        <button
                            onClick={() => setEasyExtraReps(Math.max(1, easyExtraReps - 1))}
                            className="w-8 h-8 flex items-center justify-center text-emerald-200 font-bold hover:text-white"
                        >
                            -
                        </button>
                        <input
                            type="number"
                            value={easyExtraReps}
                            onChange={(e) => setEasyExtraReps(Math.max(1, Number(e.target.value)))}
                            className="w-12 text-center bg-transparent font-bold text-lg outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-white"
                        />
                        <button
                            onClick={() => setEasyExtraReps(easyExtraReps + 1)}
                            className="w-8 h-8 flex items-center justify-center text-emerald-200 font-bold hover:text-white"
                        >
                            +
                        </button>
                    </div>

                    <button
                        onClick={() => submitFeedback(easyExtraReps > 3 ? "too_easy" : "easy", setInfo.targetReps)}
                        className="bg-emerald-400 text-white w-10 h-10 rounded-xl flex items-center justify-center font-bold shadow-sm hover:bg-emerald-300 transition-all"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Option: TARGET */}
              <button
                onClick={() => submitFeedback("target", setInfo.targetReps)}
                className="w-full p-5 rounded-2xl bg-emerald-50 border-2 border-emerald-100 active:scale-[0.98] transition-all hover:bg-emerald-100"
              >
                <div className="flex items-center justify-between">
                  <div className="flex flex-col items-start">
                    <span className="font-bold text-lg text-[#1B4332]">딱 조아!</span>
                    <span className="text-xs font-bold tracking-wide text-[#2D6A4F]/70">KEEP GOING -</span>
                  </div>
                  <span className="text-2xl">👌</span>
                </div>
              </button>

              {/* Option: FAIL */}
              <div className="w-full p-5 rounded-2xl bg-red-50 border-2 border-red-100 active:scale-[0.98] transition-all hover:border-red-200 flex items-center justify-between">
                  <div className="flex flex-col items-start shrink-0">
                    <span className="font-bold text-lg text-red-500">실패 지점</span>
                    <span className="text-xs text-red-300 font-bold tracking-wide">FAIL REPS</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center bg-red-100/60 rounded-lg px-2">
                        <button
                            onClick={() => setFailedReps(Math.max(0, failedReps - 1))}
                            className="w-8 h-8 flex items-center justify-center text-red-400 font-bold hover:text-red-600"
                        >
                            -
                        </button>
                        <input
                            type="number"
                            value={failedReps}
                            onChange={(e) => setFailedReps(Number(e.target.value))}
                            className="w-12 text-center bg-transparent font-bold text-lg outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-red-600"
                        />
                        <button
                            onClick={() => setFailedReps(failedReps + 1)}
                            className="w-8 h-8 flex items-center justify-center text-red-400 font-bold hover:text-red-600"
                        >
                            +
                        </button>
                    </div>

                    <button
                        onClick={() => submitFeedback("fail", failedReps)}
                        className="bg-red-500 text-white w-10 h-10 rounded-xl flex items-center justify-center font-bold shadow-sm hover:bg-red-600 transition-all"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                    </button>
                  </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
};
