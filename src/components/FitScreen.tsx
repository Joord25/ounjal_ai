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
  onSetComplete: (reps: number, feedback: FeedbackType) => void;
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
  const [view, setView] = useState<"active" | "feedback">("active");
  const [failedReps, setFailedReps] = useState(setInfo.targetReps);
  const [easyExtraReps, setEasyExtraReps] = useState(2);
  const [isDoneAnimating, setIsDoneAnimating] = useState(false);
  
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
    // Check for distance keywords first
    if (countStr.toLowerCase().includes('km') || countStr.includes('m') && !countStr.includes('min')) {
        return 0; // Distance mode handles its own display
    }

    // Extract first number
    const match = countStr.match(/(\d+)/);
    const val = match ? parseInt(match[1]) : 0;

    // 1. Explicit Seconds
    if (countStr.toLowerCase().includes('sec') || countStr.includes('초')) {
        return val || 60;
    }
    
    // 2. Explicit Minutes
    if (countStr.toLowerCase().includes('min') || countStr.includes('분')) {
        return (val || 1) * 60;
    }

    // 3. Reps/Count based (Warmup/Drills) -> Default to 60s
    if (countStr.includes('회') || countStr.toLowerCase().includes('reps') || countStr.includes('개')) {
        return 60; // 1 minute default for rep-based drills
    }

    // 4. Default fallback (assume minutes if number exists, else 60s)
    return val ? val * 60 : 60;
  };

  // Reset timer on new exercise
  useEffect(() => {
    setIsPlaying(false);
    if (isTimerMode) {
        if (isDistanceMode) {
            setElapsedTime(0); // Start from 0 for distance
        } else {
            setElapsedTime(parseTargetTime(exercise.count)); // Start from target for time
        }
    } else {
        setElapsedTime(0);
    }
  }, [exerciseIndex]); // Removed isTimerMode, exercise.count, isDistanceMode to prevent re-triggering on mount/update loops

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
      setView("active"); // Reset to active for next set while resting
      setIsDoneAnimating(false);
    }
  }, [isResting]);

  useEffect(() => {
    setFailedReps(setInfo.targetReps);
  }, [setInfo.targetReps]);

  const handleDoneClick = () => {
    // For non-strength exercises, skip feedback
    if (exercise.type !== "strength" && exercise.type !== "core") {
      setIsDoneAnimating(true);
      setTimeout(() => {
        onSetComplete(setInfo.targetReps, "target");
      }, 500);
      return;
    }
    setView("feedback");
  };

  const submitFeedback = (feedback: FeedbackType, reps: number) => {
    setIsDoneAnimating(true);
    // Short delay for animation
    setTimeout(() => {
      onSetComplete(reps, feedback);
      setIsDoneAnimating(false);
      // View will be reset by parent changing props or isResting state
    }, 500);
  };

  // Render Rest View (Full Screen)
  if (isResting) {
    return (
      <div className="flex flex-col h-full bg-slate-900 text-white animate-fade-in items-center justify-center relative">
        <h2 className="text-3xl font-bold mb-8">REST</h2>
        <div className="text-9xl font-black mb-12 tracking-tighter">
          {Math.floor(restTimer / 60)}:{(restTimer % 60).toString().padStart(2, "0")}
        </div>
        <button
          onClick={onSkipRest}
          className="px-8 py-4 bg-emerald-600 rounded-full text-lg font-bold tracking-widest hover:bg-emerald-500 transition-colors"
        >
          SKIP REST
        </button>
        <p className="absolute bottom-12 text-sm text-gray-400">NEXT: SET {setInfo.current + 1}</p>
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
            // Split name into Korean (Main) and English (Sub)
            // Assumes format: "Korean Name (English Name)" or just "Korean Name"
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
                {subTitle && (
                  <span className="text-lg md:text-xl text-gray-400 font-medium font-english tracking-tight">
                    {subTitle}
                  </span>
                )}
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
                <p className="text-xl font-bold text-emerald-600 mt-2">
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
              
              {exercise.weight && (
                <p className="text-2xl font-bold text-emerald-600 mt-2">
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
                    className="w-24 h-24 rounded-full flex items-center justify-center bg-emerald-600 text-white shadow-xl active:scale-95 transition-all hover:bg-emerald-500"
                  >
                      <svg className="w-10 h-10 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                  </button>
                ) : (
                  <>
                      <button
                        onClick={() => setIsPlaying(!isPlaying)}
                        className={`w-20 h-20 rounded-full flex items-center justify-center text-white shadow-lg active:scale-95 transition-all ${isPlaying ? 'bg-amber-500 hover:bg-amber-400' : 'bg-emerald-600 hover:bg-emerald-500'}`}
                      >
                        {isPlaying ? (
                          <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                        ) : (
                          <svg className="w-8 h-8 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                        )}
                      </button>

                      <button
                        onClick={handleDoneClick}
                        className="w-20 h-20 rounded-full flex items-center justify-center bg-[#111827] text-white shadow-lg active:scale-95 transition-all hover:bg-gray-800"
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
              className={`w-40 h-40 rounded-full flex items-center justify-center transition-all duration-300 active:scale-95 shadow-xl ${
                isDoneAnimating ? "scale-105" : "hover:brightness-90"
              }`}
              style={{
                backgroundColor: isDoneAnimating ? THEME.done : THEME.accent,
              }}
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

       {/* Success Overlay (Only on very last exercise of session) */}
       {isDoneAnimating && isLastExercise && setInfo.current === setInfo.total && (
        <div className="absolute inset-0 bg-white/95 flex items-center justify-center z-50 animate-fade-in">
          <p className="text-2xl font-bold" style={{ color: THEME.textMain }}>
            오늘도 해냈다!
          </p>
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
              {/* Option: EASY (N More Possible) - Primary Action (Deep Emerald #065f46) */}
              <div
                className="w-full p-5 rounded-2xl text-white shadow-lg overflow-hidden"
                style={{ backgroundColor: "#065f46" }}
              >
                <div className="flex items-center justify-between">
                   <div className="flex flex-col items-start">
                    <span className="font-bold text-lg">{easyExtraReps}개 더 가능</span>
                    <span className="text-xs text-emerald-200 font-medium tracking-wide">WEIGHT UP ▲</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center bg-emerald-900/50 rounded-lg px-2">
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

              {/* Option: TARGET (Just Right) - Secondary Action (Light Green) */}
              <button
                onClick={() => submitFeedback("target", setInfo.targetReps)}
                className="w-full p-5 rounded-2xl bg-emerald-50 border-2 border-emerald-100 active:scale-[0.98] transition-all hover:bg-emerald-100"
              >
                <div className="flex items-center justify-between">
                  <div className="flex flex-col items-start">
                    <span className="font-bold text-lg" style={{ color: "#065f46" }}>딱 조아!</span>
                    <span className="text-xs font-bold tracking-wide opacity-70" style={{ color: "#065f46" }}>KEEP GOING -</span>
                  </div>
                  <span className="text-2xl">👌</span>
                </div>
              </button>

              {/* Option: FAIL - Tertiary Action (White) */}
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
