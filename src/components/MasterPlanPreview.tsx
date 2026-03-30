"use client";

import React, { useState, useRef, useEffect } from "react";
import { THEME } from "@/constants/theme";
import { WorkoutSessionData, ExerciseStep, getAlternativeExercises, LABELED_EXERCISE_POOLS } from "@/constants/workout";
import { PlanShareCard } from "./PlanShareCard";

interface MasterPlanPreviewProps {
  sessionData: WorkoutSessionData;
  onStart: (modifiedSessionData: WorkoutSessionData) => void;
  onBack: () => void;
  onRegenerate?: () => void;
  onIntensityChange?: (level: "high" | "moderate" | "low") => void;
  currentIntensity?: "high" | "moderate" | "low" | null;
  recommendedIntensity?: "high" | "moderate" | "low" | null;
}

/** Rebuild count string from sets/reps to ensure consistency */
function rebuildCount(ex: ExerciseStep): string {
  // Timer-based exercises (warmup, cardio, mobility with time-based counts)
  if (ex.type === "warmup" || ex.type === "cardio" || ex.type === "mobility") {
    // If count already looks like a time string, keep it
    if (/분|초|min|sec/i.test(ex.count)) return ex.count;
  }
  // Strength/core with sets > 1
  if (ex.sets > 1) {
    const repsStr = typeof ex.reps === "number" ? `${ex.reps}회` : String(ex.reps);
    return `${ex.sets}세트 / ${repsStr}`;
  }
  return ex.count;
}

const PHASE_CONFIG = [
  { key: "warmup", label: "WARM-UP", num: "01", color: "bg-gray-700", badge: "bg-gray-700 text-white" },
  { key: "main", label: "MAIN", num: "02", color: "bg-[#1B4332]", badge: "bg-[#1B4332] text-white" },
  { key: "core", label: "CORE", num: "03", color: "bg-gray-600", badge: "bg-gray-600 text-white" },
  { key: "cardio", label: "CARDIO", num: "04", color: "bg-emerald-500", badge: "bg-emerald-500 text-white" },
] as const;

const INTENSITY_OPTIONS = [
  { level: "high" as const, label: "고강도", desc: "80%+ 1RM · 1-6회 · 고중량", color: "bg-red-500", border: "border-red-300", bg: "bg-red-50", text: "text-red-600" },
  { level: "moderate" as const, label: "중강도", desc: "60-79% 1RM · 7-12회 · 근비대", color: "bg-amber-500", border: "border-amber-300", bg: "bg-amber-50", text: "text-amber-700" },
  { level: "low" as const, label: "저강도", desc: "~60% 1RM · 13회+ · 근지구력", color: "bg-blue-500", border: "border-blue-300", bg: "bg-blue-50", text: "text-blue-600" },
] as const;

export const MasterPlanPreview: React.FC<MasterPlanPreviewProps> = ({
  sessionData,
  onStart,
  onBack,
  onRegenerate,
  onIntensityChange,
  currentIntensity,
  recommendedIntensity
}) => {
  // Local mutable copy of exercises (for set count adjustments)
  const [localExercises, setLocalExercises] = useState<ExerciseStep[]>(() =>
    sessionData.exercises.map(ex => ({ ...ex, count: rebuildCount(ex) }))
  );

  // Sync when sessionData changes (e.g. after regenerate)
  useEffect(() => {
    setLocalExercises(sessionData.exercises.map(ex => ({ ...ex, count: rebuildCount(ex) })));
  }, [sessionData]);

  const [isEditing, setIsEditing] = useState(false);
  const [expandedCard, setExpandedCard] = useState<number | null>(null);


  const [guideExercise, setGuideExercise] = useState<ExerciseStep | null>(null);
  const [swapExercise, setSwapExercise] = useState<{ exercise: ExerciseStep; index: number; sameGroup: string[] } | null>(null);
  const [swapSearch, setSwapSearch] = useState("");
  const [swapFilter, setSwapFilter] = useState<string | null>(null); // null = 추천(같은부위), or muscle group label
  const [addToPhase, setAddToPhase] = useState<string | null>(null); // phase key for "add exercise" mode
  const [showShareCard, setShowShareCard] = useState(false);
  const [showIntroTip, setShowIntroTip] = useState(() => {
    if (typeof window !== "undefined") {
      return !localStorage.getItem("alpha_tip_intro");
    }
    return true;
  });
  const [showTip, setShowTip] = useState(() => {
    if (typeof window !== "undefined") {
      return !localStorage.getItem("alpha_tip_change_program");
    }
    return true;
  });
  const [showGuideTip, setShowGuideTip] = useState(() => {
    if (typeof window !== "undefined") {
      return !localStorage.getItem("alpha_tip_guide_button");
    }
    return true;
  });

  const dismissIntroTip = () => {
    setShowIntroTip(false);
    localStorage.setItem("alpha_tip_intro", "1");
  };

  const dismissTip = () => {
    setShowTip(false);
    localStorage.setItem("alpha_tip_change_program", "1");
  };

  const dismissGuideTip = () => {
    setShowGuideTip(false);
    localStorage.setItem("alpha_tip_guide_button", "1");
  };

  const firstGuideRef = useRef<HTMLDivElement>(null);
  const settingsBtnRef = useRef<HTMLButtonElement>(null);
  const descRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [guideBtnPos, setGuideBtnPos] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [settingsBtnPos, setSettingsBtnPos] = useState<{ top: number; right: number } | null>(null);
  const [descPos, setDescPos] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();

    if (showIntroTip && descRef.current) {
      const r = descRef.current.getBoundingClientRect();
      setDescPos({
        top: r.top - containerRect.top,
        left: r.left - containerRect.left,
        width: r.width,
        height: r.height,
      });
    }

    if (!showIntroTip && showTip && settingsBtnRef.current) {
      const btnRect = settingsBtnRef.current.getBoundingClientRect();
      setSettingsBtnPos({
        top: btnRect.top - containerRect.top,
        right: containerRect.right - btnRect.right,
      });
    }

    if (!showIntroTip && !showTip && showGuideTip && firstGuideRef.current) {
      const btnRect = firstGuideRef.current.getBoundingClientRect();
      setGuideBtnPos({
        top: btnRect.top - containerRect.top,
        left: btnRect.left - containerRect.left,
        width: btnRect.width,
        height: btnRect.height,
      });
    }
  }, [showIntroTip, showTip, showGuideTip]);

  const adjustSets = (exerciseIndex: number, delta: number) => {
    setLocalExercises(prev => prev.map((ex, i) => {
      if (i !== exerciseIndex) return ex;
      const newSets = Math.max(1, Math.min(10, ex.sets + delta));
      if (newSets === ex.sets) return ex;
      const updated = { ...ex, sets: newSets };
      updated.count = rebuildCount(updated);
      return updated;
    }));
  };

  const handleMoveExercise = (globalIdx: number, direction: "up" | "down", phaseExercises: ExerciseStep[]) => {
    const ex = localExercises[globalIdx];
    const phaseIndex = phaseExercises.indexOf(ex);
    const targetPhaseIndex = direction === "up" ? phaseIndex - 1 : phaseIndex + 1;
    if (targetPhaseIndex < 0 || targetPhaseIndex >= phaseExercises.length) return;
    const targetGlobalIdx = localExercises.indexOf(phaseExercises[targetPhaseIndex]);
    if (targetGlobalIdx === -1) return;

    setLocalExercises(prev => {
      const next = [...prev];
      [next[globalIdx], next[targetGlobalIdx]] = [next[targetGlobalIdx], next[globalIdx]];
      return next;
    });
    // 펼친 카드 따라가기
    setExpandedCard(targetGlobalIdx);
  };

  const handleDeleteExercise = (globalIdx: number) => {
    setLocalExercises(prev => {
      // Prevent deleting the last MAIN phase exercise
      const ex = prev[globalIdx];
      const exPhase = ex.phase || (ex.type === "warmup" ? "warmup" : ex.type === "core" || ex.type === "mobility" ? "core" : ex.type === "cardio" ? "cardio" : "main");
      const samePhase = prev.filter((e, i) => {
        if (i === globalIdx) return false;
        const p = e.phase || (e.type === "warmup" ? "warmup" : e.type === "core" || e.type === "mobility" ? "core" : e.type === "cardio" ? "cardio" : "main");
        return p === exPhase;
      });
      if (exPhase === "main" && samePhase.length === 0) return prev;
      return prev.filter((_, i) => i !== globalIdx);
    });
    setExpandedCard(null);
  };

  const handleSwapExercise = (globalIdx: number, newName: string) => {
    setLocalExercises(prev => prev.map((ex, i) => {
      if (i !== globalIdx) return ex;
      return { ...ex, name: newName };
    }));
    setSwapExercise(null);
  };

  const openSwapSheet = (ex: ExerciseStep, globalIdx: number) => {
    const alts = getAlternativeExercises(ex.name);
    setSwapExercise({ exercise: ex, index: globalIdx, sameGroup: alts });
    setSwapSearch("");
    setSwapFilter(null);
    setAddToPhase(null);
  };

  const openAddSheet = (phaseKey: string) => {
    setAddToPhase(phaseKey);
    setSwapSearch("");
    setSwapFilter(null);
    setSwapExercise(null);
  };

  const handleAddExercise = (name: string) => {
    if (!addToPhase) return;
    const phaseMap: Record<string, { type: ExerciseStep["type"]; phase: ExerciseStep["phase"] }> = {
      warmup: { type: "warmup", phase: "warmup" },
      main: { type: "strength", phase: "main" },
      core: { type: "core", phase: "core" },
      cardio: { type: "cardio", phase: "cardio" },
    };
    const info = phaseMap[addToPhase] || { type: "strength", phase: "main" };
    const newEx: ExerciseStep = {
      type: info.type,
      phase: info.phase,
      name,
      count: info.type === "warmup" ? "1세트" : "3 x 12",
      sets: info.type === "warmup" ? 1 : 3,
      reps: info.type === "warmup" ? 1 : 12,
    };
    newEx.count = rebuildCount(newEx);

    // Insert after last exercise of the target phase
    setLocalExercises(prev => {
      const lastIdx = prev.reduce((acc, ex, i) => {
        const exPhase = ex.phase || (ex.type === "warmup" ? "warmup" : ex.type === "core" || ex.type === "mobility" ? "core" : ex.type === "cardio" ? "cardio" : "main");
        return exPhase === addToPhase ? i : acc;
      }, -1);
      const insertAt = lastIdx >= 0 ? lastIdx + 1 : prev.length;
      return [...prev.slice(0, insertAt), newEx, ...prev.slice(insertAt)];
    });
    setAddToPhase(null);
  };


  // Phase-based filtering (phase tag takes priority, fallback to type for backward compat)
  const warmups = localExercises.filter(e => e.phase === "warmup" || (!e.phase && e.type === "warmup"));
  const main = localExercises.filter(e => e.phase === "main" || (!e.phase && (e.type === "strength" || (e.type === "cardio" && !e.name.includes("추가") && !e.name.includes("Additional")))));
  const core = localExercises.filter(e => e.phase === "core" || (!e.phase && (e.type === "core" || e.type === "mobility")));
  const additionalCardio = localExercises.filter(e => e.phase === "cardio" || (!e.phase && e.type === "cardio" && (e.name.includes("추가") || e.name.includes("Additional"))));

  const phases = [
    { ...PHASE_CONFIG[0], exercises: warmups },
    { ...PHASE_CONFIG[1], exercises: main },
    { ...PHASE_CONFIG[2], exercises: core },
    { ...PHASE_CONFIG[3], exercises: additionalCardio },
  ].filter(p => p.exercises.length > 0);

  const handleIntensitySelect = (level: "high" | "moderate" | "low") => {
    if (onIntensityChange) onIntensityChange(level);
    setIsEditing(false);
  };

  return (
    <div ref={containerRef} className="flex flex-col h-full bg-[#FAFBF9] animate-fade-in relative overflow-hidden">
      {/* Header Bar */}
      <div className="pt-5 pb-3 px-6 flex items-center justify-between shrink-0 bg-[#FAFBF9]">
        <button onClick={onBack} className="p-2 -ml-2">
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-[11px] font-serif font-medium tracking-[0.25em] text-gray-400 uppercase">
          Master Plan
        </span>
        <button
          ref={settingsBtnRef}
          onClick={() => setIsEditing(true)}
          className="relative p-2 -mr-2 text-gray-400 active:text-gray-600 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-6 scrollbar-hide" style={{ paddingBottom: "calc(90px + var(--safe-area-bottom, 0px))" }}>
        {/* Hero Section */}
        <div className="pt-2 pb-5">
          {/* AI 코치 + 강도 */}
          <div ref={descRef} className="flex items-center gap-2 mb-3">
            <img src="/favicon_backup.png" alt="AI" className="w-5 h-5 rounded-full shrink-0" />
            <span className="text-[11px] font-bold text-gray-400">오운잘 AI 코치</span>
            {currentIntensity && (
              <span className={`text-[10px] font-black px-2 py-0.5 rounded ${
                currentIntensity === "high" ? "bg-red-100 text-red-600"
                  : currentIntensity === "moderate" ? "bg-amber-100 text-amber-700"
                  : "bg-blue-100 text-blue-600"
              }`}>
                {currentIntensity === "high" ? "고강도" : currentIntensity === "moderate" ? "중강도" : "저강도"}
              </span>
            )}
          </div>

          {/* Title */}
          <h1 className="text-2xl font-black text-[#1B4332] leading-tight tracking-tight mb-2">
            오늘의 운동 플랜
          </h1>
          <p className="text-sm text-gray-500 leading-relaxed line-clamp-2 mb-2">
            {sessionData.description}
          </p>
          {/* 경험 메시지 */}
          <p className="text-[13px] font-bold text-[#2D6A4F] leading-relaxed">
            {(() => {
              const desc = (sessionData.description || "").toLowerCase();
              if (/가슴|푸시|chest|push|벤치/.test(desc)) return "이 플랜을 마치면 거울 앞 어깨 라인이 달라져요";
              if (/등|풀|back|pull|로우|랫/.test(desc)) return "이 플랜을 마치면 자세가 펴지고 등이 단단해져요";
              if (/하체|레그|스쿼트|leg|squat|런지|데드/.test(desc)) return "이 플랜을 마치면 계단이 가뿐해질 거예요";
              if (/코어|복근|core|ab|플랭크/.test(desc)) return "이 플랜을 마치면 오래 앉아도 허리가 편해져요";
              if (/러닝|유산소|cardio|run|hiit|서킷/.test(desc)) return "이 플랜을 마치면 일상이 가벼워질 거예요";
              if (/모빌리티|회복|스트레칭/.test(desc)) return "이 플랜을 마치면 몸이 한결 풀릴 거예요";
              return "이 플랜을 마치면 오늘보다 더 강해진 내가 될 거예요";
            })()}
          </p>
        </div>

        {/* Exercise List */}
        <div className="flex flex-col gap-6">
          {phases.map((phase, phaseIdx) => (
            <div key={phase.key} className="animate-slide-in-bottom" style={{ animationDelay: `${phaseIdx * 0.08}s` }}>
              {/* Phase Header */}
              <div className="flex items-center gap-2.5 mb-3">
                <div className={`w-1.5 h-8 rounded-full ${phase.color}`} />
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-gray-400 tracking-widest">{phase.num}</span>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded ${phase.badge}`}>
                    {phase.label}
                  </span>
                </div>
              </div>

              {/* Exercise Cards */}
              <div className="flex flex-col gap-2 ml-4">
                {phase.exercises.map((ex, i) => {
                  const globalIdx = localExercises.indexOf(ex);
                  const canAdjustSets = (ex.type === "strength" || ex.type === "core") && ex.sets > 0;
                  const isExpanded = expandedCard === globalIdx;
                  const hasSwap = getAlternativeExercises(ex.name).length > 0;
                  return (
                  <div
                    key={globalIdx}
                    ref={phaseIdx === 0 && i === 0 ? firstGuideRef : undefined}
                    className={`rounded-2xl p-4 pt-3 bg-white border-2 relative transition-all ${
                      phase.key === "main"
                        ? "border-[#1B4332] shadow-[2px_2px_0px_0px_#1B4332] active:scale-[0.98]"
                        : phase.key === "warmup"
                        ? "border-gray-700 shadow-[2px_2px_0px_0px_#374151] active:scale-[0.98]"
                        : phase.key === "core"
                        ? "border-gray-600 shadow-[2px_2px_0px_0px_#4B5563] active:scale-[0.98]"
                        : phase.key === "cardio"
                        ? "border-emerald-500 shadow-[2px_2px_0px_0px_#10B981] active:scale-[0.98]"
                        : "border-gray-300 shadow-[2px_2px_0px_0px_#D1D5DB] active:scale-[0.98]"
                    }`}
                    onClick={() => setExpandedCard(isExpanded ? null : globalIdx)}
                  >
                    {/* Delete button — visible only when card is expanded */}
                    {isExpanded && (() => {
                      const exPhase = ex.phase || (ex.type === "warmup" ? "warmup" : ex.type === "core" || ex.type === "mobility" ? "core" : ex.type === "cardio" ? "cardio" : "main");
                      const isLastInPhase = exPhase === "main" && phase.exercises.length <= 1;
                      if (isLastInPhase) return null;
                      return (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteExercise(globalIdx); }}
                          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-gray-400 flex items-center justify-center text-white hover:bg-gray-500 transition-colors z-10 shadow-sm animate-fade-in"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      );
                    })()}
                    <div className="flex justify-between items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-bold block leading-snug text-gray-900">
                          {ex.name}
                        </span>
                        {ex.weight && ex.weight !== "Bodyweight" && (
                          <span className="text-xs text-[#2D6A4F] font-bold mt-1 block">{ex.weight}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 ml-2 shrink-0">
                        {canAdjustSets && (
                          <button
                            onClick={(e) => { e.stopPropagation(); adjustSets(globalIdx, -1); }}
                            disabled={ex.sets <= 1}
                            className="w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 active:scale-90 transition-all disabled:opacity-30"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" d="M5 12h14" />
                            </svg>
                          </button>
                        )}
                        <span className={`text-[10px] font-black uppercase tracking-wide px-2 py-1 rounded-lg min-w-[40px] text-center ${
                          phase.key === "main"
                            ? "bg-[#1B4332] text-white"
                            : phase.key === "warmup"
                            ? "bg-gray-700 text-white"
                            : phase.key === "core"
                            ? "bg-gray-600 text-white"
                            : phase.key === "cardio"
                            ? "bg-emerald-500 text-white"
                            : "bg-gray-200 text-gray-600"
                        }`}>
                          {ex.count}
                        </span>
                        {canAdjustSets && (
                          <button
                            onClick={(e) => { e.stopPropagation(); adjustSets(globalIdx, 1); }}
                            disabled={ex.sets >= 10}
                            className="w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 active:scale-90 transition-all disabled:opacity-30"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" d="M12 5v14M5 12h14" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Expanded Action Buttons */}
                    {isExpanded && (
                      <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const parts = ex.name.split('(');
                            const searchTerm = parts.length > 1 ? parts[1].replace(')', '').trim() : parts[0].trim();
                            window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(searchTerm + " exercise form guide")}`, "_blank");
                          }}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white border border-gray-100 shadow-sm active:scale-95 transition-all"
                        >
                          <svg className="w-4 h-4 text-red-600 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                          </svg>
                          <span className="text-xs font-bold text-gray-600">자세 가이드</span>
                        </button>
                        {hasSwap && (
                          <button
                            onClick={(e) => { e.stopPropagation(); openSwapSheet(ex, globalIdx); }}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gray-100 text-gray-600 active:scale-95 transition-all"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                            </svg>
                            <span className="text-xs font-bold">운동 교체</span>
                          </button>
                        )}
                        {phase.exercises.length > 1 && (
                          <div className="flex gap-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleMoveExercise(globalIdx, "up", phase.exercises); }}
                              disabled={i === 0}
                              className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center active:scale-90 transition-all disabled:opacity-30"
                            >
                              <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                              </svg>
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleMoveExercise(globalIdx, "down", phase.exercises); }}
                              disabled={i === phase.exercises.length - 1}
                              className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center active:scale-90 transition-all disabled:opacity-30"
                            >
                              <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  );
                })}

                {/* Add Exercise Button */}
                <button
                  onClick={() => openAddSheet(phase.key)}
                  className="w-full py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-500 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" d="M12 5v14M5 12h14" />
                  </svg>
                  <span className="text-[11px] font-bold">운동 추가</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="absolute bottom-0 left-0 right-0 px-5 pt-8 bg-gradient-to-t from-[#FAFBF9] via-[#FAFBF9] to-transparent z-20" style={{ paddingBottom: "calc(var(--safe-area-bottom, 0px) + 8px)" }}>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowShareCard(true)}
            className="h-14 px-5 rounded-2xl bg-white border-2 border-gray-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            <svg className="w-5 h-5 text-[#1B4332]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            <span className="text-[#1B4332] font-black text-sm">공유</span>
          </button>
          <button
            onClick={() => onStart({ ...sessionData, exercises: localExercises })}
            className="flex-1 h-14 rounded-2xl bg-[#1B4332] active:scale-[0.98] transition-all flex items-center justify-center gap-3 shadow-xl shadow-[#1B4332]/20 hover:bg-[#2D6A4F]"
          >
            <span className="text-white font-black text-base tracking-wide">운동 시작</span>
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Plan Adjustment Bottom Sheet */}
      {isEditing && (
        <div className="absolute inset-0 z-50">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setIsEditing(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[2rem] p-6 animate-slide-up shadow-2xl" style={{ paddingBottom: "calc(var(--safe-area-bottom, 0px) + 16px)" }}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-6" />

            <h3 className="text-lg font-black text-[#1B4332] tracking-tight mb-1">플랜 조정</h3>
            <p className="text-[11px] text-gray-400 font-medium mb-5">강도를 변경하면 같은 구성에서 세트·반복수·무게가 조절돼요</p>

            {/* Intensity Options */}
            <div className="space-y-2.5 mb-5">
              {INTENSITY_OPTIONS.map((opt) => {
                const isActive = currentIntensity === opt.level;
                const isRec = recommendedIntensity === opt.level;
                return (
                  <button
                    key={opt.level}
                    onClick={() => handleIntensitySelect(opt.level)}
                    className={`w-full p-4 rounded-2xl border-2 flex items-center gap-3 active:scale-[0.98] transition-all ${
                      isActive
                        ? `${opt.border} ${opt.bg} shadow-[2px_2px_0px_0px] shadow-current`
                        : isRec
                          ? `${opt.border} ${opt.bg}/30 hover:${opt.bg}`
                          : "border-gray-100 bg-white hover:border-gray-200"
                    }`}
                  >
                    <div className={`w-3 h-8 rounded-full ${opt.color} shrink-0`} />
                    <div className="text-left flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className={`font-black text-sm ${isActive ? opt.text : "text-gray-700"}`}>{opt.label}</p>
                        {isRec && !isActive && (
                          <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-emerald-100 text-[#2D6A4F]">추천</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{opt.desc}</p>
                    </div>
                    {isActive && (
                      <div className={`w-6 h-6 rounded-full ${opt.color} flex items-center justify-center shrink-0`}>
                        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Regenerate Button */}
            {onRegenerate && (
              <button
                onClick={() => { onRegenerate(); setIsEditing(false); }}
                className="w-full py-3.5 rounded-2xl border-2 border-gray-200 bg-white text-gray-700 font-bold text-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2 hover:bg-gray-50"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                </svg>
                다른 구성으로 다시 생성
              </button>
            )}

            {/* Back to Condition Check */}
            <button
              onClick={() => { onBack(); setIsEditing(false); }}
              className="w-full py-3.5 rounded-2xl border-2 border-gray-100 bg-gray-50 text-gray-400 font-bold text-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2 hover:bg-gray-100 mt-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
              </svg>
              처음부터 다시
            </button>
          </div>
        </div>
      )}

      {/* Exercise Swap Bottom Sheet */}
      {/* Add Exercise Bottom Sheet */}
      {addToPhase && (
        <div className="absolute inset-0 z-50">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setAddToPhase(null)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[2rem] p-6 animate-slide-up shadow-2xl" style={{ paddingBottom: "calc(var(--safe-area-bottom, 0px) + 16px)" }}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em]">운동 추가</p>
              <button onClick={() => setAddToPhase(null)} className="text-sm text-gray-400 font-bold">닫기</button>
            </div>

            <input
              type="text"
              value={swapSearch}
              onChange={(e) => setSwapSearch(e.target.value)}
              placeholder="운동 검색..."
              className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-[13px] text-[#1B4332] font-medium placeholder-gray-300 outline-none focus:border-[#2D6A4F] transition-colors mb-2"
            />

            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide mb-3 pb-0.5">
              {LABELED_EXERCISE_POOLS.map(p => (
                <button
                  key={p.label}
                  onClick={() => setSwapFilter(prev => prev === p.label ? null : p.label)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all ${
                    swapFilter === p.label ? "bg-[#1B4332] text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="h-[30vh] overflow-y-auto space-y-1.5">
              {(() => {
                const q = swapSearch.replace(/\s/g, "").toLowerCase();
                const isSearching = q.length > 0;
                const existingNames = new Set(localExercises.map(e => e.name));

                if (swapFilter !== null) {
                  const pool = LABELED_EXERCISE_POOLS.find(p => p.label === swapFilter);
                  if (!pool) return null;
                  const list = pool.exercises
                    .filter(e => !existingNames.has(e))
                    .filter(e => !isSearching || e.replace(/\s/g, "").toLowerCase().includes(q));
                  if (list.length === 0) return <p className="text-center text-sm text-gray-400 font-medium py-6">검색 결과가 없어요</p>;
                  return list.map((name: string) => (
                    <button
                      key={name}
                      onClick={() => handleAddExercise(name)}
                      className="w-full text-left px-4 py-3 rounded-xl bg-white border border-gray-200 text-[13px] font-bold text-gray-600 active:scale-[0.98] transition-all"
                    >
                      {name.split("(")[0].trim()}
                    </button>
                  ));
                }

                if (!isSearching) return <p className="text-center text-sm text-gray-400 font-medium py-6">부위 탭을 선택하거나 검색해 주세요</p>;

                return LABELED_EXERCISE_POOLS
                  .map((group) => {
                    const keywordMatch = group.keywords.some((kw: string) => kw.includes(q) || q.includes(kw));
                    const matched = group.exercises
                      .filter((e: string) => !existingNames.has(e))
                      .filter((e: string) => keywordMatch || e.replace(/\s/g, "").toLowerCase().includes(q));
                    if (matched.length === 0) return null;
                    return (
                      <div key={group.label}>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] mt-2 mb-1">{group.label}</p>
                        {matched.map((name: string) => (
                          <button
                            key={name}
                            onClick={() => handleAddExercise(name)}
                            className="w-full text-left px-4 py-3 rounded-xl bg-white border border-gray-200 text-[13px] font-bold text-gray-600 active:scale-[0.98] transition-all mb-1.5"
                          >
                            {name.split("(")[0].trim()}
                          </button>
                        ))}
                      </div>
                    );
                  })
                  .filter(Boolean);
              })()}
            </div>
          </div>
        </div>
      )}

      {swapExercise && (
        <div className="absolute inset-0 z-50">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setSwapExercise(null)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[2rem] p-6 animate-slide-up shadow-2xl" style={{ paddingBottom: "calc(var(--safe-area-bottom, 0px) + 16px)" }}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em]">대체 운동 선택</p>
              <button onClick={() => setSwapExercise(null)} className="text-sm text-gray-400 font-bold">닫기</button>
            </div>
            <p className="text-[10px] font-bold text-gray-500 mb-3">
              현재: <span className="text-[#1B4332]">{swapExercise.exercise.name.split("(")[0].trim()}</span>
            </p>

            {/* Search Input */}
            <input
              type="text"
              value={swapSearch}
              onChange={(e) => setSwapSearch(e.target.value)}
              placeholder="운동 검색..."
              className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-[13px] text-[#1B4332] font-medium placeholder-gray-300 outline-none focus:border-[#2D6A4F] transition-colors mb-2"
            />

            {/* Filter Tabs */}
            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide mb-3 pb-0.5">
              <button
                onClick={() => setSwapFilter(null)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all ${
                  swapFilter === null ? "bg-[#1B4332] text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                추천
              </button>
              {LABELED_EXERCISE_POOLS.map(p => (
                <button
                  key={p.label}
                  onClick={() => setSwapFilter(p.label)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all ${
                    swapFilter === p.label ? "bg-[#1B4332] text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Exercise List */}
            <div className="h-[30vh] overflow-y-auto space-y-1.5">
              {(() => {
                const q = swapSearch.replace(/\s/g, "").toLowerCase();
                const isSearching = q.length > 0;
                const currentName = swapExercise.exercise.name;
                const sameGroup = swapExercise.sameGroup;

                // Filter by selected muscle group tab
                if (swapFilter !== null) {
                  const pool = LABELED_EXERCISE_POOLS.find(p => p.label === swapFilter);
                  if (!pool) return null;
                  const list = pool.exercises
                    .filter(e => e !== currentName)
                    .filter(e => !isSearching || e.replace(/\s/g, "").toLowerCase().includes(q));
                  if (list.length === 0) return (
                    <p className="text-center text-sm text-gray-400 font-medium py-6">검색 결과가 없어요</p>
                  );
                  return list.map((alt: string) => (
                    <button
                      key={alt}
                      onClick={() => handleSwapExercise(swapExercise.index, alt)}
                      className={`w-full text-left px-4 py-3 rounded-xl bg-white border text-[13px] font-bold active:scale-[0.98] transition-all ${
                        sameGroup.includes(alt) ? "border-[#2D6A4F] text-[#1B4332]" : "border-gray-200 text-gray-600"
                      }`}
                    >
                      {alt.split("(")[0].trim()}
                    </button>
                  ));
                }

                // Default "추천" tab: same muscle group (no search) or grouped search
                if (!isSearching) {
                  if (sameGroup.length === 0) return <p className="text-center text-sm text-gray-400 font-medium py-6">부위 탭에서 선택해 주세요</p>;
                  return sameGroup.map((alt: string) => (
                    <button
                      key={alt}
                      onClick={() => handleSwapExercise(swapExercise.index, alt)}
                      className="w-full text-left px-4 py-3 rounded-xl bg-white border border-gray-200 text-[13px] font-bold text-[#1B4332] active:scale-[0.98] transition-all"
                    >
                      {alt.split("(")[0].trim()}
                    </button>
                  ));
                }

                // Search across all groups with group headers
                return LABELED_EXERCISE_POOLS
                  .map((group) => {
                    const keywordMatch = group.keywords.some((kw: string) => kw.includes(q) || q.includes(kw));
                    const matched = group.exercises
                      .filter((e: string) => e !== currentName)
                      .filter((e: string) => keywordMatch || e.replace(/\s/g, "").toLowerCase().includes(q));
                    if (matched.length === 0) return null;
                    return (
                      <div key={group.label}>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] mt-2 mb-1">{group.label}</p>
                        {matched.map((alt: string) => (
                          <button
                            key={alt}
                            onClick={() => handleSwapExercise(swapExercise.index, alt)}
                            className={`w-full text-left px-4 py-3 rounded-xl bg-white border text-[13px] font-bold active:scale-[0.98] transition-all mb-1.5 ${
                              sameGroup.includes(alt) ? "border-[#2D6A4F] text-[#1B4332]" : "border-gray-200 text-gray-600"
                            }`}
                          >
                            {alt.split("(")[0].trim()}
                          </button>
                        ))}
                      </div>
                    );
                  })
                  .filter(Boolean);
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Intro Tutorial Overlay — spotlight on description */}
      {showIntroTip && descPos && (
        <div className="absolute inset-0 z-[60] animate-fade-in" onClick={dismissIntroTip}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
          {/* Spotlight highlight on description area */}
          <div
            className="absolute rounded-xl border-2 border-white/70 bg-white/10"
            style={{ top: descPos.top - 6, left: descPos.left - 8, width: descPos.width + 16, height: descPos.height + 12 }}
          />
          {/* Tooltip below the description */}
          <div
            className="absolute px-4"
            style={{ top: descPos.top + descPos.height + 14, left: 0, right: 0 }}
          >
            <div className="bg-white rounded-2xl px-5 py-5 shadow-2xl mx-2 relative">
              <div className="absolute -top-2 left-8 w-4 h-4 bg-white rotate-45 rounded-sm" />
              <p className="text-[12.5px] text-gray-600 leading-relaxed">
                ACSM 국제 공인 스포츠의학 기관 및 건강운동관리사 가이드라인과 최근 5년 내 <span className="font-bold text-[#2D6A4F]">500건 이상</span>의 SCI급 연구 논문들을 기반으로, 컨디션 · 체력 · 휴식까지 고려한 요일별 맞춤 프로그램입니다.
              </p>
              <p className="text-[10px] text-gray-400 mt-3 font-medium">탭하여 닫기</p>
            </div>
          </div>
        </div>
      )}

      {/* Settings Tutorial Tooltip Overlay */}
      {!showIntroTip && showTip && settingsBtnPos && (
        <div className="absolute inset-0 z-[60] animate-fade-in" onClick={dismissTip}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
          <div className="absolute flex flex-col items-end" style={{ top: settingsBtnPos.top - 4, right: settingsBtnPos.right - 4 }}>
            {/* Spotlight ring on actual settings button */}
            <div className="w-10 h-10 rounded-full border-2 border-white/80 bg-white/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </div>
            {/* Tooltip bubble */}
            <div className="mt-3 mr-1 bg-white rounded-2xl px-5 py-4 shadow-2xl max-w-[240px] relative">
              <div className="absolute -top-2 right-4 w-4 h-4 bg-white rotate-45 rounded-sm" />
              <p className="text-sm font-bold text-[#1B4332] leading-relaxed">
                강도 변경이나 다시 생성을<br/>원하시면 여기서 조절할 수 있어요
              </p>
              <p className="text-[11px] text-gray-400 mt-2 font-medium">탭하여 닫기</p>
            </div>
          </div>
        </div>
      )}

      {/* Card Tap Tutorial Overlay */}
      {!showIntroTip && !showTip && showGuideTip && guideBtnPos && (
        <div className="absolute inset-0 z-[60] animate-fade-in" onClick={dismissGuideTip}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
          <div
            className="absolute rounded-2xl border-2 border-white/80 bg-white/10"
            style={{ top: guideBtnPos.top - 4, left: guideBtnPos.left - 4, width: guideBtnPos.width + 8, height: guideBtnPos.height + 8 }}
          />
          <div
            className="absolute px-4"
            style={{ top: guideBtnPos.top + guideBtnPos.height + 14, left: 0, right: 0 }}
          >
            <div className="bg-white rounded-2xl px-5 py-4 shadow-2xl mx-2 relative">
              <div className="absolute -top-2 left-8 w-4 h-4 bg-white rotate-45 rounded-sm" />
              <p className="text-sm font-bold text-[#1B4332] leading-relaxed">
                운동 카드를 탭하면<br/>자세 가이드와 운동 교체를 할 수 있어요
              </p>
              <p className="text-[11px] text-gray-400 mt-2 font-medium">탭하여 닫기</p>
            </div>
          </div>
        </div>
      )}

      {/* Exercise Guide Bottom Sheet */}
      {/* Plan Share Card */}
      {showShareCard && (
        <PlanShareCard
          exercises={localExercises}
          currentIntensity={currentIntensity}
          onClose={() => setShowShareCard(false)}
        />
      )}

      {guideExercise && (
        <div className="absolute inset-0 z-50">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setGuideExercise(null)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[2rem] p-6 animate-slide-up shadow-2xl" style={{ paddingBottom: "calc(var(--safe-area-bottom, 0px) + 16px)" }}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-6" />

            {/* Exercise Name */}
            <div className="mb-5">
              {(() => {
                const parts = guideExercise.name.split('(');
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

            {/* Exercise Info */}
            <div className="grid grid-cols-3 gap-2 mb-6">
              <div className="bg-gray-50 rounded-xl p-3 flex flex-col border border-gray-100">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest text-center">Type</p>
                <p className="text-base font-black text-gray-900 uppercase flex-1 flex items-center justify-center">{guideExercise.type}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 flex flex-col border border-gray-100">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest text-center">Sets</p>
                <p className="text-base font-black text-gray-900 flex-1 flex items-center justify-center">{guideExercise.sets}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 flex flex-col border border-gray-100">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest text-center">Volume</p>
                <p className="text-base font-black text-gray-900 flex-1 flex items-center justify-center text-center">{guideExercise.count}</p>
              </div>
            </div>

            {guideExercise.weight && guideExercise.weight !== "Bodyweight" && (
              <div className="bg-emerald-50 rounded-xl p-3 mb-6 border border-emerald-100 text-center">
                <p className="text-[9px] font-black text-[#2D6A4F] uppercase tracking-widest mb-0.5">Weight</p>
                <p className="text-sm font-black text-[#1B4332]">{guideExercise.weight}</p>
              </div>
            )}

            {/* YouTube Search Button */}
            <button
              onClick={() => {
                const parts = guideExercise.name.split('(');
                const searchTerm = parts.length > 1 ? parts[1].replace(')', '').trim() : parts[0].trim();
                window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(searchTerm + " exercise form guide")}`, "_blank");
              }}
              className="w-full p-4 rounded-2xl bg-white border border-gray-200 flex items-center justify-center gap-3 active:scale-[0.98] transition-all shadow-sm"
            >
              <svg className="w-5 h-5 text-red-600 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
              <span className="font-black text-sm text-gray-700 tracking-wide">YouTube에서 자세 가이드 보기</span>
            </button>

            <button
              onClick={() => setGuideExercise(null)}
              className="w-full p-3 mt-2 rounded-xl text-gray-400 font-bold text-sm active:scale-[0.98] transition-all"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
