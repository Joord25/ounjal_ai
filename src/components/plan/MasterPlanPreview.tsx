"use client";

import React, { useState, useRef, useEffect } from "react";
import { THEME } from "@/constants/theme";
import { WorkoutSessionData, ExerciseStep, getAlternativeExercises, LABELED_EXERCISE_POOLS, WorkoutGoal } from "@/constants/workout";
import { PlanShareCard } from "./PlanShareCard";
import { trackEvent } from "@/utils/analytics";
import { useTranslation } from "@/hooks/useTranslation";
import { getExerciseName, translateWeightGuide } from "@/utils/exerciseName";

interface MasterPlanPreviewProps {
  sessionData: WorkoutSessionData;
  onStart: (modifiedSessionData: WorkoutSessionData) => void;
  onBack: () => void;
  onRegenerate?: () => void;
  onIntensityChange?: (level: "high" | "moderate" | "low") => void;
  currentIntensity?: "high" | "moderate" | "low" | null;
  recommendedIntensity?: "high" | "moderate" | "low" | null;
  goal?: WorkoutGoal;
}

const MUSCLE_GROUP_EN: Record<string, string> = {
  "웜업": "Warm-up", "가슴": "Chest", "어깨": "Shoulders", "삼두": "Triceps",
  "등": "Back", "후면 어깨": "Rear Delts", "이두": "Biceps", "하체": "Legs",
  "종아리": "Calves", "전신": "Full Body", "코어": "Core", "가동성": "Mobility",
};
function tLabel(label: string, locale: string): string {
  return locale === "ko" ? label : (MUSCLE_GROUP_EN[label] || label);
}

/** Translate Korean description/title to English at render time.
 *  주의: 특정 패턴(상체(밀기)/상체(당기기))은 일반 단어보다 먼저 치환해야
 *  "상체" 단독 치환이 괄호 내용을 망가뜨리지 않음. (회의 21)
 */
function translateDescription(desc: string, locale: string): string {
  if (locale === "ko") return desc;
  return desc
    // 복합 패턴 먼저 (회의 21: "상체(당기기)" 실제 서버 포맷 반영)
    .replace(/상체\(밀기\)/g, "Upper (Push)")
    .replace(/상체\(당기기\)/g, "Upper (Pull)")
    .replace(/상체 \+ 밀기/g, "Upper + Push")
    .replace(/상체 \+ 당기기/g, "Upper + Pull")
    // 단일 부위
    .replace(/하체/g, "Lower")
    .replace(/상체/g, "Upper")
    .replace(/가슴/g, "Chest")
    .replace(/등/g, "Back")
    .replace(/어깨/g, "Shoulders")
    .replace(/팔/g, "Arms")
    .replace(/밀기/g, "Push")
    .replace(/당기기/g, "Pull")
    // 수량 단위
    .replace(/(\d+)종/g, "$1 exercises")
    .replace(/(\d+)세트/g, "$1 sets")
    // 세션/목표/컨디션 레이블
    .replace(/집중 운동/g, "Focus")
    .replace(/인터벌 러닝/g, "Interval Running")
    .replace(/이지 런/g, "Easy Run")
    .replace(/장거리 러닝/g, "Long Distance Run")
    .replace(/러너 코어/g, "Runner Core")
    .replace(/맨몸 \+ 덤벨 전신 서킷/g, "Bodyweight + Dumbbell Full-body Circuit")
    .replace(/근비대/g, "Hypertrophy")
    .replace(/근력 강화/g, "Strength")
    .replace(/체지방 감량/g, "Fat Loss")
    .replace(/전반적 체력 향상/g, "General Fitness")
    .replace(/살 빼기/g, "Fat Loss")
    .replace(/근육 키우기/g, "Muscle Gain")
    .replace(/힘 세지기/g, "Strength")
    .replace(/기초체력/g, "Fitness")
    .replace(/기초체력강화/g, "Fitness")
    .replace(/홈트레이닝/g, "Home Training")
    .replace(/러닝/g, "Running")
    .replace(/상체 뻣뻣함 개선/g, "Upper body stiffness relief")
    .replace(/하체 무거움 완화/g, "Lower body heaviness relief")
    .replace(/전반적 피로 회복/g, "Fatigue recovery")
    .replace(/최적 컨디션/g, "Optimal condition");
}

// 무게 가이드 번역은 @/utils/exerciseName 의 translateWeightGuide 사용 (회의 20)

// 회의 36: 4가지 러닝 인터벌 타입 템플릿 (유저가 MasterPlanPreview에서 직접 교체)
// 서버 workoutEngine.ts의 generateRunningWorkout과 동일 스펙 유지 필수
type RunningVariant = "walkrun" | "tempo" | "fartlek" | "sprint";
interface RunningVariantTemplate {
  id: RunningVariant;
  labelKey: string;
  descKey: string;
  mainPhase: ExerciseStep[];
}
const RUNNING_TEMPLATES: Record<RunningVariant, RunningVariantTemplate> = {
  walkrun: {
    id: "walkrun",
    labelKey: "plan.running.walkrun.label",
    descKey: "plan.running.walkrun.desc",
    mainPhase: [
      { type: "cardio", phase: "main", name: "준비 걷기 (Warm-up Walk)", count: "3분", sets: 1, reps: 1 },
      { type: "cardio", phase: "main", name: "워크-런 인터벌 (Walk-Run Intervals)", count: "120초 걷기 / 60초 달리기 × 8", sets: 1, reps: 1 },
      { type: "cardio", phase: "main", name: "마무리 걷기 (Cool-down Walk)", count: "3분", sets: 1, reps: 1 },
    ],
  },
  tempo: {
    id: "tempo",
    labelKey: "plan.running.tempo.label",
    descKey: "plan.running.tempo.desc",
    mainPhase: [
      { type: "cardio", phase: "main", name: "준비 조깅 (Warm-up Jog)", count: "5분", sets: 1, reps: 1 },
      { type: "cardio", phase: "main", name: "템포런 (Tempo Run)", count: "20분 템포", sets: 1, reps: 1 },
      { type: "cardio", phase: "main", name: "마무리 조깅 (Cool-down Jog)", count: "5분", sets: 1, reps: 1 },
    ],
  },
  fartlek: {
    id: "fartlek",
    labelKey: "plan.running.fartlek.label",
    descKey: "plan.running.fartlek.desc",
    mainPhase: [
      { type: "cardio", phase: "main", name: "준비 조깅 (Warm-up Jog)", count: "5분", sets: 1, reps: 1 },
      { type: "cardio", phase: "main", name: "변속주 (Fartlek Run)", count: "120초 전력 / 180초 보통 × 5", sets: 1, reps: 1 },
      { type: "cardio", phase: "main", name: "마무리 조깅 (Cool-down Jog)", count: "5분", sets: 1, reps: 1 },
    ],
  },
  sprint: {
    id: "sprint",
    labelKey: "plan.running.sprint.label",
    descKey: "plan.running.sprint.desc",
    mainPhase: [
      { type: "cardio", phase: "main", name: "준비 조깅 (Warm-up Jog)", count: "8분", sets: 1, reps: 1 },
      { type: "cardio", phase: "main", name: "A스킵 (A-Skip)", count: "2 × 30m", sets: 2, reps: 1 },
      { type: "cardio", phase: "main", name: "인터벌 스프린트 (Interval Sprints)", count: "30초 전력 / 120초 회복 × 6", sets: 1, reps: 1 },
      { type: "cardio", phase: "main", name: "마무리 조깅 (Cool-down Jog)", count: "5분", sets: 1, reps: 1 },
    ],
  },
};

/** 현재 러닝 메인 페이즈에서 어떤 variant인지 감지 */
function detectRunningVariant(exercises: ExerciseStep[]): RunningVariant | null {
  const mainNames = exercises
    .filter((e) => e.phase === "main")
    .map((e) => e.name.toLowerCase());
  const joined = mainNames.join(" ");
  if (joined.includes("walk-run") || joined.includes("워크-런")) return "walkrun";
  if (joined.includes("tempo") || joined.includes("템포런")) return "tempo";
  if (joined.includes("fartlek") || joined.includes("변속주")) return "fartlek";
  if (joined.includes("sprint") || joined.includes("스프린트")) return "sprint";
  return null;
}

/** Rebuild count string from sets/reps to ensure consistency */
function rebuildCount(ex: ExerciseStep, t?: (key: string, vars?: Record<string, string>) => string, locale?: string): string {
  // Timer-based exercises (warmup, cardio, mobility with time-based counts)
  if (ex.type === "warmup" || ex.type === "cardio" || ex.type === "mobility") {
    if (/분|초|min|sec/i.test(ex.count)) {
      if (locale && locale !== "ko") {
        return ex.count
          .replace(/(\d+)분/g, "$1 min")
          .replace(/(\d+)초/g, "$1 sec")
          .replace(/유지/g, "hold")
          .replace(/운동/g, "work")
          .replace(/휴식/g, "rest")
          .replace(/이상/g, "+");
      }
      return ex.count;
    }
  }
  // Strength/core with sets >= 1
  if (ex.sets >= 1) {
    const repsStr = typeof ex.reps === "number" ? String(ex.reps) : String(ex.reps);
    if (t) return t("plan.sets_reps", { sets: String(ex.sets), reps: repsStr });
    return `${ex.sets}세트 / ${repsStr}회`;
  }
  // Fallback: translate Korean units in count string
  if (locale && locale !== "ko") {
    return ex.count
      .replace(/(\d+)세트/g, "$1 sets")
      .replace(/(\d+)회/g, "$1 reps")
      .replace(/(\d+)분/g, "$1 min")
      .replace(/(\d+)초/g, "$1 sec")
      .replace(/유지/g, "hold")
      .replace(/이상/g, "+");
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
  { level: "high" as const, labelKey: "plan.intensity.high", descKey: "plan.intensity.high_desc", color: "bg-red-500", border: "border-red-300", bg: "bg-red-50", text: "text-red-600" },
  { level: "moderate" as const, labelKey: "plan.intensity.moderate", descKey: "plan.intensity.moderate_desc", color: "bg-amber-500", border: "border-amber-300", bg: "bg-amber-50", text: "text-amber-700" },
  { level: "low" as const, labelKey: "plan.intensity.low", descKey: "plan.intensity.low_desc", color: "bg-blue-500", border: "border-blue-300", bg: "bg-blue-50", text: "text-blue-600" },
] as const;

export const MasterPlanPreview: React.FC<MasterPlanPreviewProps> = ({
  sessionData,
  onStart,
  onBack,
  onRegenerate,
  onIntensityChange,
  currentIntensity,
  recommendedIntensity,
  goal
}) => {
  const { t, locale } = useTranslation();
  // Local mutable copy of exercises (for set count adjustments)
  const [localExercises, setLocalExercises] = useState<ExerciseStep[]>(() =>
    sessionData.exercises.map(ex => ({ ...ex, count: rebuildCount(ex, t, locale) }))
  );

  useEffect(() => { trackEvent("plan_preview_view", { exercise_count: sessionData.exercises.length }); }, []);

  // Sync when sessionData changes (e.g. after regenerate)
  useEffect(() => {
    setLocalExercises(sessionData.exercises.map(ex => ({ ...ex, count: rebuildCount(ex, t, locale) })));
  }, [sessionData, t]);

  const [isEditing, setIsEditing] = useState(false);
  const [expandedCard, setExpandedCard] = useState<number | null>(null);


  const [guideExercise, setGuideExercise] = useState<ExerciseStep | null>(null);
  const [swapExercise, setSwapExercise] = useState<{ exercise: ExerciseStep; index: number; sameGroup: string[] } | null>(null);
  // 회의 36: 러닝 타입 교체 바텀시트
  const [showRunningSwap, setShowRunningSwap] = useState(false);
  const runningSwapRef = useRef<HTMLDivElement | null>(null);

  // 회의 41 후속: 드롭다운 바깥 클릭 시 닫기
  useEffect(() => {
    if (!showRunningSwap) return;
    const handler = (e: Event) => {
      if (runningSwapRef.current && !runningSwapRef.current.contains(e.target as Node)) {
        setShowRunningSwap(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [showRunningSwap]);
  const currentRunningVariant = detectRunningVariant(localExercises);
  const isRunningSession = currentRunningVariant !== null;

  // 러닝 타입 교체: 메인 페이즈 운동만 교체, warmup/core/cardio(cooldown)는 유지
  const handleRunningVariantSwap = (newVariant: RunningVariant) => {
    const template = RUNNING_TEMPLATES[newVariant];
    const nonMain = localExercises.filter((e) => e.phase !== "main");
    const newMain = template.mainPhase.map((ex) => ({ ...ex, count: rebuildCount(ex, t, locale) }));
    // warmup → main → core/cardio 순서 재구성
    const warmups = nonMain.filter((e) => e.phase === "warmup");
    const rest = nonMain.filter((e) => e.phase !== "warmup");
    setLocalExercises([...warmups, ...newMain, ...rest]);
    setShowRunningSwap(false);
  };
  const [swapSearch, setSwapSearch] = useState("");
  const [swapFilter, setSwapFilter] = useState<string | null>(null); // null = 추천(같은부위), or muscle group label
  const [addToPhase, setAddToPhase] = useState<string | null>(null); // phase key for "add exercise" mode
  const [showShareCard, setShowShareCard] = useState(false);
  const [showIntroTip, setShowIntroTip] = useState(() => {
    if (typeof window !== "undefined") {
      return !localStorage.getItem("ohunjal_tip_intro");
    }
    return true;
  });
  const [showTip, setShowTip] = useState(() => {
    if (typeof window !== "undefined") {
      return !localStorage.getItem("ohunjal_tip_change_program");
    }
    return true;
  });
  const [showGuideTip, setShowGuideTip] = useState(() => {
    if (typeof window !== "undefined") {
      return !localStorage.getItem("ohunjal_tip_guide_button");
    }
    return true;
  });

  const dismissIntroTip = () => {
    setShowIntroTip(false);
    localStorage.setItem("ohunjal_tip_intro", "1");
  };

  const dismissTip = () => {
    setShowTip(false);
    localStorage.setItem("ohunjal_tip_change_program", "1");
  };

  const dismissGuideTip = () => {
    setShowGuideTip(false);
    localStorage.setItem("ohunjal_tip_guide_button", "1");
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
      updated.count = rebuildCount(updated, t, locale);
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
      count: info.type === "warmup" ? t("plan.set_single") : "3 x 12",
      sets: info.type === "warmup" ? 1 : 3,
      reps: info.type === "warmup" ? 1 : 12,
    };
    newEx.count = rebuildCount(newEx, t, locale);

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
            <span className="text-[11px] font-bold text-gray-400">{t("plan.ai_coach")}</span>
            {currentIntensity && (
              <span className={`text-[10px] font-black px-2 py-0.5 rounded ${
                currentIntensity === "high" ? "bg-red-100 text-red-600"
                  : currentIntensity === "moderate" ? "bg-amber-100 text-amber-700"
                  : "bg-blue-100 text-blue-600"
              }`}>
                {t(`plan.intensity.${currentIntensity}`)}
              </span>
            )}
          </div>

          {/* 회의 36 v2: 제목 + 러닝 타입 교체 버튼 (제목 옆 빈공간 활용) */}
          <div className="flex items-start justify-between gap-3 mb-2">
            <h1 className="text-2xl font-black text-[#1B4332] leading-tight tracking-tight flex-1 min-w-0">
              {t("plan.title")}
            </h1>
            {isRunningSession && currentRunningVariant && (
              <div ref={runningSwapRef} className="relative shrink-0 mt-1">
                <button
                  onClick={() => setShowRunningSwap(v => !v)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-bold text-[#2D6A4F] active:scale-95 transition-all"
                >
                  <span>{t(`plan.running.${currentRunningVariant}.label`)}</span>
                  <svg className={`w-3 h-3 opacity-60 transition-transform ${showRunningSwap ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {/* 회의 41 후속: 인라인 드롭다운 (버튼 바로 아래 펼침) */}
                {showRunningSwap && (
                  <div className="absolute right-0 top-full mt-1.5 w-64 bg-white rounded-2xl border border-gray-200 shadow-xl p-2 z-50 animate-fade-in">
                    {(["walkrun", "tempo", "fartlek", "sprint"] as const).map((variant) => {
                      const isCurrent = variant === currentRunningVariant;
                      return (
                        <button
                          key={variant}
                          onClick={() => handleRunningVariantSwap(variant)}
                          className={`w-full text-left px-3 py-2.5 rounded-xl transition-all active:scale-[0.98] ${
                            isCurrent ? "bg-emerald-50" : "hover:bg-gray-50"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-0.5">
                            <span className={`text-[12px] font-black ${isCurrent ? "text-[#2D6A4F]" : "text-[#1B4332]"}`}>
                              {t(`plan.running.${variant}.label`)}
                            </span>
                            {isCurrent && (
                              <svg className="w-3.5 h-3.5 text-[#2D6A4F]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <p className="text-[10px] text-gray-500 leading-snug">
                            {t(`plan.running.${variant}.desc`)}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
          <p className="text-sm text-gray-500 leading-relaxed line-clamp-2 mb-2">
            {translateDescription(sessionData.description, locale)}
          </p>
          {/* 회의 41 M-H: 러닝 타입 가이드 한 줄 (러닝 코치 권고) */}
          {isRunningSession && currentRunningVariant && (
            <p className="text-[13px] font-semibold text-[#1B4332]/80 leading-relaxed mb-2">
              {t(`running.guide.${currentRunningVariant}`)}
            </p>
          )}
          {/* 경험 메시지 — 목표 × 부위 매트릭스 (i18n) */}
          <p className="text-[13px] font-bold text-[#2D6A4F] leading-relaxed">
            {(() => {
              const desc = (sessionData.description || "").toLowerCase();
              const g = goal || "general_fitness";

              let part = "default";
              if (/가슴|푸시|chest|push|벤치/.test(desc)) part = "chest";
              else if (/등|풀|back|pull|로우|랫/.test(desc)) part = "back";
              else if (/하체|레그|스쿼트|leg|squat|런지|데드/.test(desc)) part = "lower";
              else if (/코어|복근|core|ab|플랭크/.test(desc)) part = "core";
              else if (/러닝|유산소|cardio|run|hiit|서킷/.test(desc)) part = "cardio";
              else if (/모빌리티|회복|스트레칭/.test(desc)) part = "mobility";

              return t(`exp.${g}.${part}`) !== `exp.${g}.${part}` ? t(`exp.${g}.${part}`) : t(`exp.general_fitness.${part}`);
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
                          {getExerciseName(ex.name, locale)}
                        </span>
                        {ex.weight && ex.weight !== "Bodyweight" && ex.weight !== "맨몸" && (
                          <span className="text-xs text-[#2D6A4F] font-bold mt-1 block">{translateWeightGuide(ex.weight, locale)}</span>
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
                            const parts = getExerciseName(ex.name, locale).split('(');
                            const searchTerm = parts.length > 1 ? parts[1].replace(')', '').trim() : parts[0].trim();
                            window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(searchTerm + " exercise form guide")}`, "_blank");
                          }}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white border border-gray-100 shadow-sm active:scale-95 transition-all"
                        >
                          <svg className="w-4 h-4 text-red-600 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                          </svg>
                          <span className="text-xs font-bold text-gray-600">{t("plan.form_guide")}</span>
                        </button>
                        {hasSwap && (
                          <button
                            onClick={(e) => { e.stopPropagation(); openSwapSheet(ex, globalIdx); }}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gray-100 text-gray-600 active:scale-95 transition-all"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                            </svg>
                            <span className="text-xs font-bold">{t("plan.swap")}</span>
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
                  <span className="text-[11px] font-bold">{t("plan.add_exercise")}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="absolute bottom-0 left-0 right-0 px-5 pt-8 pb-0 bg-gradient-to-t from-[#FAFBF9] via-[#FAFBF9] to-transparent z-20">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowShareCard(true)}
            className="h-14 px-5 rounded-2xl bg-white border-2 border-gray-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            <svg className="w-5 h-5 text-[#1B4332]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            <span className="text-[#1B4332] font-black text-sm">{t("plan.share")}</span>
          </button>
          <button
            onClick={() => onStart({ ...sessionData, exercises: localExercises })}
            className="flex-1 h-14 rounded-2xl bg-[#1B4332] active:scale-[0.98] transition-all flex items-center justify-center gap-3 shadow-xl shadow-[#1B4332]/20 hover:bg-[#2D6A4F]"
          >
            <span className="text-white font-black text-base tracking-wide">{t("plan.start")}</span>
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

            <h3 className="text-lg font-black text-[#1B4332] tracking-tight mb-1">{t("plan.adjust")}</h3>
            <p className="text-[11px] text-gray-400 font-medium mb-5">{t("plan.adjust_desc")}</p>

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
                        <p className={`font-black text-sm ${isActive ? opt.text : "text-gray-700"}`}>{t(opt.labelKey)}</p>
                        {isRec && !isActive && (
                          <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-emerald-100 text-[#2D6A4F]">{t("plan.recommended")}</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{t(opt.descKey)}</p>
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
                {t("plan.regenerate")}
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
              {t("plan.restart")}
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
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em]">{t("plan.add_exercise")}</p>
              <button onClick={() => setAddToPhase(null)} className="text-sm text-gray-400 font-bold">{t("plan.close")}</button>
            </div>

            <input
              type="text"
              value={swapSearch}
              onChange={(e) => setSwapSearch(e.target.value)}
              placeholder={t("plan.search")}
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
                  {tLabel(p.label, locale)}
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
                  if (list.length === 0) return <p className="text-center text-sm text-gray-400 font-medium py-6">{t("plan.no_results")}</p>;
                  return list.map((name: string) => (
                    <button
                      key={name}
                      onClick={() => handleAddExercise(name)}
                      className="w-full text-left px-4 py-3 rounded-xl bg-white border border-gray-200 text-[13px] font-bold text-gray-600 active:scale-[0.98] transition-all"
                    >
                      {getExerciseName(name, locale)}
                    </button>
                  ));
                }

                if (!isSearching) return <p className="text-center text-sm text-gray-400 font-medium py-6">{t("plan.select_tab")}</p>;

                return LABELED_EXERCISE_POOLS
                  .map((group) => {
                    const keywordMatch = group.keywords.some((kw: string) => kw.includes(q) || q.includes(kw));
                    const matched = group.exercises
                      .filter((e: string) => !existingNames.has(e))
                      .filter((e: string) => keywordMatch || e.replace(/\s/g, "").toLowerCase().includes(q));
                    if (matched.length === 0) return null;
                    return (
                      <div key={group.label}>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] mt-2 mb-1">{tLabel(group.label, locale)}</p>
                        {matched.map((name: string) => (
                          <button
                            key={name}
                            onClick={() => handleAddExercise(name)}
                            className="w-full text-left px-4 py-3 rounded-xl bg-white border border-gray-200 text-[13px] font-bold text-gray-600 active:scale-[0.98] transition-all mb-1.5"
                          >
                            {getExerciseName(name, locale)}
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
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em]">{t("plan.swap_title")}</p>
              <button onClick={() => setSwapExercise(null)} className="text-sm text-gray-400 font-bold">{t("plan.close")}</button>
            </div>
            <p className="text-[10px] font-bold text-gray-500 mb-3">
              {t("plan.current")} <span className="text-[#1B4332]">{getExerciseName(swapExercise.exercise.name, locale)}</span>
            </p>

            {/* Search Input */}
            <input
              type="text"
              value={swapSearch}
              onChange={(e) => setSwapSearch(e.target.value)}
              placeholder={t("plan.search")}
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
                {t("plan.recommended")}
              </button>
              {LABELED_EXERCISE_POOLS.map(p => (
                <button
                  key={p.label}
                  onClick={() => setSwapFilter(p.label)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all ${
                    swapFilter === p.label ? "bg-[#1B4332] text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  {tLabel(p.label, locale)}
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
                    <p className="text-center text-sm text-gray-400 font-medium py-6">{t("plan.no_results")}</p>
                  );
                  return list.map((alt: string) => (
                    <button
                      key={alt}
                      onClick={() => handleSwapExercise(swapExercise.index, alt)}
                      className={`w-full text-left px-4 py-3 rounded-xl bg-white border text-[13px] font-bold active:scale-[0.98] transition-all ${
                        sameGroup.includes(alt) ? "border-[#2D6A4F] text-[#1B4332]" : "border-gray-200 text-gray-600"
                      }`}
                    >
                      {getExerciseName(alt, locale)}
                    </button>
                  ));
                }

                // Default "추천" tab: same muscle group (no search) or grouped search
                if (!isSearching) {
                  if (sameGroup.length === 0) return <p className="text-center text-sm text-gray-400 font-medium py-6">{t("plan.select_from_tab")}</p>;
                  return sameGroup.map((alt: string) => (
                    <button
                      key={alt}
                      onClick={() => handleSwapExercise(swapExercise.index, alt)}
                      className="w-full text-left px-4 py-3 rounded-xl bg-white border border-gray-200 text-[13px] font-bold text-[#1B4332] active:scale-[0.98] transition-all"
                    >
                      {getExerciseName(alt, locale)}
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
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] mt-2 mb-1">{tLabel(group.label, locale)}</p>
                        {matched.map((alt: string) => (
                          <button
                            key={alt}
                            onClick={() => handleSwapExercise(swapExercise.index, alt)}
                            className={`w-full text-left px-4 py-3 rounded-xl bg-white border text-[13px] font-bold active:scale-[0.98] transition-all mb-1.5 ${
                              sameGroup.includes(alt) ? "border-[#2D6A4F] text-[#1B4332]" : "border-gray-200 text-gray-600"
                            }`}
                          >
                            {getExerciseName(alt, locale)}
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
                {t("plan.tip_intro")}
              </p>
              <p className="text-[10px] text-gray-400 mt-3 font-medium">{t("plan.tip_dismiss")}</p>
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
                {t("plan.tip_settings")}
              </p>
              <p className="text-[11px] text-gray-400 mt-2 font-medium">{t("plan.tip_dismiss")}</p>
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
                {t("plan.tip_card")}
              </p>
              <p className="text-[11px] text-gray-400 mt-2 font-medium">{t("plan.tip_dismiss")}</p>
            </div>
          </div>
        </div>
      )}

      {/* 회의 41 후속: 러닝 타입 교체는 제목 옆 버튼의 인라인 드롭다운으로 처리 (위 렌더 참고) */}

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
                const parts = getExerciseName(guideExercise.name, locale).split('(');
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

            {guideExercise.weight && guideExercise.weight !== "Bodyweight" && guideExercise.weight !== "맨몸" && (
              <div className="bg-emerald-50 rounded-xl p-3 mb-6 border border-emerald-100 text-center">
                <p className="text-[9px] font-black text-[#2D6A4F] uppercase tracking-widest mb-0.5">Weight</p>
                <p className="text-sm font-black text-[#1B4332]">{translateWeightGuide(guideExercise.weight, locale)}</p>
              </div>
            )}

            {/* YouTube Search Button */}
            <button
              onClick={() => {
                const parts = getExerciseName(guideExercise.name, locale).split('(');
                const searchTerm = parts.length > 1 ? parts[1].replace(')', '').trim() : parts[0].trim();
                window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(searchTerm + " exercise form guide")}`, "_blank");
              }}
              className="w-full p-4 rounded-2xl bg-white border border-gray-200 flex items-center justify-center gap-3 active:scale-[0.98] transition-all shadow-sm"
            >
              <svg className="w-5 h-5 text-red-600 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
              <span className="font-black text-sm text-gray-700 tracking-wide">{t("plan.youtube_guide")}</span>
            </button>

            <button
              onClick={() => setGuideExercise(null)}
              className="w-full p-3 mt-2 rounded-xl text-gray-400 font-bold text-sm active:scale-[0.98] transition-all"
            >
              {t("plan.close")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
