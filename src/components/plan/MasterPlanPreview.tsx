"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useSetEditor } from "./useSetEditor";
import { THEME } from "@/constants/theme";
import { WorkoutSessionData, ExerciseStep, getAlternativeExercises, WorkoutGoal } from "@/constants/workout";
import { PlanShareCard } from "./PlanShareCard";
import { SavedPlan, autoNamePlan, getSavedPlans, newPlanId, savePlan, remoteSavePlan, FREE_LIMIT, PREMIUM_LIMIT } from "@/utils/savedPlans";
import { PlanHero } from "./PlanHero";
import { PlanTutorialOverlays } from "./PlanTutorialOverlays";
import { PlanBottomSheets } from "./PlanBottomSheets";
import { PlanLibraryPane } from "./PlanLibraryPane";
import { PlanSelectedPane } from "./PlanSelectedPane";
import { PlanSplitShell, FocusedPane } from "./PlanSplitShell";
import { trackEvent } from "@/utils/analytics";
import { useTranslation } from "@/hooks/useTranslation";
import { getExerciseName } from "@/utils/exerciseName";
import { updateActiveSession } from "@/utils/activeSessionPersistence";
import {
  isMusicEnabled,
  setMusicEnabled,
  isMusicIntroShown,
  markMusicIntroShown,
} from "@/utils/musicPreference";
import { CURATED_PLAYLISTS, isCuratedPlaylistAvailable } from "@/constants/curatedPlaylists";

interface MasterPlanPreviewProps {
  sessionData: WorkoutSessionData;
  onStart: (modifiedSessionData: WorkoutSessionData) => void;
  onBack: () => void;
  onRegenerate?: () => void;
  onIntensityChange?: (level: "high" | "moderate" | "low") => void;
  currentIntensity?: "high" | "moderate" | "low" | null;
  recommendedIntensity?: "high" | "moderate" | "low" | null;
  goal?: WorkoutGoal;
  isPremium?: boolean;
  isLoggedIn?: boolean;
  onGuestSaveAttempt?: () => void;
  /** saved plan에서 진입한 경우: 해당 플랜 ID. 저장 동작이 "업데이트"로 바뀜 */
  savedPlanId?: string;
  /** 회의 63-A: plan_preview_view / plan_preview_start funnel 분리용 source 태그 */
  source?: "chat" | "saved" | "program" | "resume";
  /** 회의 64-γ: 모바일 백그라운드 discard 복귀 시 편집 중이던 운동 배열 hydrate */
  restoredExercises?: ExerciseStep[] | null;
}

const MUSCLE_GROUP_EN: Record<string, string> = {
  "웜업": "Warm-up", "가슴": "Chest", "어깨": "Shoulders", "삼두": "Triceps",
  "등": "Back", "후면 어깨": "Rear Delts", "이두": "Biceps", "하체": "Legs",
  "종아리": "Calves", "전신": "Full Body", "코어": "Core", "가동성": "Mobility",
};
function tLabel(label: string, locale: string): string {
  return locale === "ko" ? label : (MUSCLE_GROUP_EN[label] || label);
}

// 세션 설명/타이틀 번역은 @/components/report/reportUtils 의 translateDesc 사용
// 무게 가이드 번역은 @/utils/exerciseName 의 translateWeightGuide 사용
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

/** 플랭크·사이드 플랭크·할로우 홀드 등 정적 홀드 운동 판정 (reps를 초 단위로 저장) */
function isHoldExercise(name: string, originalCount?: string): boolean {
  if (/플랭크|plank|할로우|hollow\s?hold|사이드\s?플랭크|side\s?plank/i.test(name)) return true;
  // 원본 count가 "초 유지" 패턴이면 홀드로 간주
  if (originalCount && /\d+\s*초\s*유지|\d+\s*sec\s*hold/i.test(originalCount)) return true;
  return false;
}

/** Rebuild count string from sets/reps to ensure consistency */
function rebuildCount(ex: ExerciseStep, t?: (key: string, vars?: Record<string, string>) => string, locale?: string): string {
  // 첫 set의 reps(시간값) 우선 사용, 없으면 count 추출 또는 ex.reps fallback
  const firstSetTime = (unitMatch: RegExpMatchArray | null): number | null => {
    const fromSets = ex.setDetails?.[0]?.reps;
    if (fromSets && fromSets > 0) return fromSets;
    if (unitMatch) return parseFloat(unitMatch[2] || unitMatch[1]);
    return ex.reps > 0 ? ex.reps : null;
  };
  // Timer-based exercises (warmup, cardio, mobility with time-based counts)
  if (ex.type === "warmup" || ex.type === "cardio" || ex.type === "mobility") {
    const m = ex.count.match(/(\d+(?:\.\d+)?)(?:-(\d+(?:\.\d+)?))?\s*(초|분|sec|min)/);
    const hasIntervalMarker = /×|x\s*\d+/i.test(ex.count);
    if (m && !hasIntervalMarker) {
      const unit = m[3];
      const time = firstSetTime(m) ?? parseFloat(m[2] || m[1]);
      const setsPrefix = ex.sets > 1 ? (locale && locale !== "ko" ? `${ex.sets} sets / ` : `${ex.sets}세트 / `) : "";
      const unitOut = locale && locale !== "ko"
        ? (unit === "초" ? "sec" : unit === "분" ? "min" : unit)
        : unit;
      return `${setsPrefix}${time}${unitOut}`;
    }
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
  // Static hold (plank etc.) — reps field holds seconds
  if (ex.type === "core" && isHoldExercise(ex.name, ex.count) && ex.sets >= 1) {
    const m = ex.count.match(/(\d+)(?:-(\d+))?\s*(초|sec)/);
    const sec = firstSetTime(m) ?? ex.reps;
    return locale && locale !== "ko"
      ? `${ex.sets} sets / ${sec} sec hold`
      : `${ex.sets}세트 / ${sec}초 유지`;
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
  goal,
  isPremium = false,
  isLoggedIn = false,
  onGuestSaveAttempt,
  savedPlanId,
  source = "chat",
  restoredExercises = null,
}) => {
  const { t, locale } = useTranslation();
  // Local mutable copy of exercises (for set count adjustments)
  // 회의 64-γ: 복원된 편집 상태(restoredExercises)가 있으면 그걸 우선
  const [localExercises, setLocalExercises] = useState<ExerciseStep[]>(() => {
    const base = restoredExercises ?? sessionData.exercises;
    return base.map(ex => ({ ...ex, count: rebuildCount(ex, t, locale) }));
  });
  // 회의 2026-04-26 음악 도입: CTA 위 토글. 큐레이션 1개라도 준비됐을 때만 노출.
  const musicAvailable = React.useMemo(() => CURATED_PLAYLISTS.some(isCuratedPlaylistAvailable), []);
  const [musicOn, setMusicOn] = useState<boolean>(() => isMusicEnabled());
  const [musicIntroVisible, setMusicIntroVisible] = useState(false);
  const handleToggleMusic = useCallback(() => {
    setMusicOn((prev) => {
      const next = !prev;
      setMusicEnabled(next);
      if (next && !isMusicIntroShown()) {
        setMusicIntroVisible(true);
        markMusicIntroShown();
        setTimeout(() => setMusicIntroVisible(false), 4000);
      }
      return next;
    });
  }, []);

  // 회의 63-A: source 포함 (chat / saved / program / resume)
  useEffect(() => { trackEvent("plan_preview_view", { exercise_count: sessionData.exercises.length, source }); }, []);

  // 회의 64-γ (2026-04-20): 편집 상태를 활성 세션 snapshot에 실시간 반영.
  // 카톡·인스타 앱 전환 후 복귀 시 편집한 운동 배열 그대로 유지.
  useEffect(() => {
    updateActiveSession({ previewExercises: localExercises });
  }, [localExercises]);

  // Sync when sessionData changes (e.g. after regenerate)
  useEffect(() => {
    setLocalExercises(sessionData.exercises.map(ex => ({ ...ex, count: rebuildCount(ex, t, locale) })));
    // 운동 배열 재생성 시 선택 상태 안전 초기화
    setSelectedIdx(null);
    setFocusedPane("library");
  }, [sessionData, t, locale]);

  const [isEditing, setIsEditing] = useState(false);
  /** 상세 편집 대상 운동 인덱스 (null이면 빈 상태) */
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  /** 8:2 ↔ 2:8 슬라이드 상태 */
  const [focusedPane, setFocusedPane] = useState<FocusedPane>("library");
  /** 하단 CTA 노출 여부 — 스크롤이 끝에 도달했을 때만 슬라이드업 */
  const [ctaVisible, setCtaVisible] = useState(false);
  const scrollEndRef = useRef<HTMLDivElement | null>(null);

  // CTA 항상 노출 (대표님 지시 — 라이브러리/상세 어디서든 시작 버튼 접근 가능)
  useEffect(() => { setCtaVisible(true); }, []);


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
    setSelectedIdx(null);
    setFocusedPane("library");
    setShowRunningSwap(false);
  };
  const [swapSearch, setSwapSearch] = useState("");
  const [swapFilter, setSwapFilter] = useState<string | null>(null); // null = 추천(같은부위), or muscle group label
  const [addToPhase, setAddToPhase] = useState<string | null>(null); // phase key for "add exercise" mode
  const [showShareCard, setShowShareCard] = useState(false);
  // 플랜 저장 바텀시트 상태
  const [showSaveSheet, setShowSaveSheet] = useState(false);
  const [saveNameDraft, setSaveNameDraft] = useState("");
  const [saveFeedback, setSaveFeedback] = useState<"idle" | "saved" | "limit">("idle");
  const openSaveSheet = () => {
    if (!isLoggedIn) {
      onGuestSaveAttempt?.();
      return;
    }
    const defaultName = autoNamePlan({ ...sessionData, exercises: localExercises }, locale);
    setSaveNameDraft(defaultName);
    setSaveFeedback("idle");
    setShowSaveSheet(true);
  };
  const confirmSavePlan = async () => {
    const limit = isPremium ? PREMIUM_LIMIT : FREE_LIMIT;
    const existing = getSavedPlans();
    const isUpdate = !!savedPlanId && existing.some(p => p.id === savedPlanId);
    if (!isUpdate && existing.length >= limit) {
      setSaveFeedback("limit");
      return;
    }
    const now = Date.now();
    const planToSave: SavedPlan = isUpdate
      ? {
          ...existing.find(p => p.id === savedPlanId)!,
          name: saveNameDraft.trim() || autoNamePlan({ ...sessionData, exercises: localExercises }, locale),
          sessionData: { ...sessionData, exercises: localExercises },
        }
      : {
          id: newPlanId(),
          name: saveNameDraft.trim() || autoNamePlan({ ...sessionData, exercises: localExercises }, locale),
          sessionData: { ...sessionData, exercises: localExercises },
          createdAt: now,
          lastUsedAt: null,
          useCount: 0,
        };
    // 서버 먼저 — 서버가 SSOT, 한도는 서버가 강제
    const remote = await remoteSavePlan(planToSave);
    if (!remote.ok && remote.reason === "limit") {
      setSaveFeedback("limit");
      return;
    }
    // 서버 성공(또는 오프라인 fallback) 시 로컬 캐시에도 반영
    savePlan(planToSave);
    setSaveFeedback("saved");
    void isUpdate;
    setTimeout(() => setShowSaveSheet(false), 800);
  };
  const handleOverwriteOldest = async () => {
    const existing = getSavedPlans();
    if (existing.length === 0) return;
    const oldest = [...existing].sort((a, b) => (a.lastUsedAt ?? a.createdAt) - (b.lastUsedAt ?? b.createdAt))[0];
    const now = Date.now();
    const replacement: SavedPlan = {
      ...oldest,
      name: saveNameDraft.trim() || autoNamePlan({ ...sessionData, exercises: localExercises }, locale),
      sessionData: { ...sessionData, exercises: localExercises },
      createdAt: now,
    };
    const remote = await remoteSavePlan(replacement);
    if (!remote.ok && remote.reason === "limit") {
      setSaveFeedback("limit");
      return;
    }
    savePlan(replacement);
    setSaveFeedback("saved");
    setTimeout(() => setShowSaveSheet(false), 800);
  };
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
    // 슬라이드 애니메이션(300ms) 완료 후 측정
    const timer = setTimeout(() => {
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

      // 가이드 팁은 LIBRARY full 모드에서만 (peek 시 firstGuideRef 미렌더)
      if (!showIntroTip && !showTip && showGuideTip && focusedPane === "library" && firstGuideRef.current) {
        const btnRect = firstGuideRef.current.getBoundingClientRect();
        setGuideBtnPos({
          top: btnRect.top - containerRect.top,
          left: btnRect.left - containerRect.left,
          width: btnRect.width,
          height: btnRect.height,
        });
      }
    }, 320);
    return () => clearTimeout(timer);
  }, [showIntroTip, showTip, showGuideTip, focusedPane]);

  const rebuildCountLocal = useCallback((ex: ExerciseStep) => rebuildCount(ex, t, locale), [t, locale]);
  const { adjustSets, updateSetDetail: handleUpdateSetDetail, addSet: handleAddSet, removeSet: handleRemoveSet } =
    useSetEditor(setLocalExercises, rebuildCountLocal);

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
    if (level !== currentIntensity) {
      trackEvent("intensity_change", { from: currentIntensity || "unknown", to: level });
    }
    if (onIntensityChange) onIntensityChange(level);
    setIsEditing(false);
  };

  const handleRegenerate = () => {
    trackEvent("plan_regenerate", { trigger: "manual" });
    if (onRegenerate) onRegenerate();
  };

  return (
    <div ref={containerRef} className="flex flex-col h-full bg-[#FAFBF9] animate-fade-in relative overflow-hidden">
      {/* Header Bar */}
      <div className="pt-5 pb-3 px-6 flex items-center justify-between shrink-0 bg-[#FAFBF9]">
        <button onClick={selectedIdx !== null ? () => setSelectedIdx(null) : onBack} className="p-2 -ml-2">
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-[11px] font-serif font-medium tracking-[0.25em] text-gray-400 uppercase">
          Master Plan
        </span>
        <div className="flex items-center gap-1 -mr-2">
          <button
            onClick={() => setShowShareCard(true)}
            className="p-2 text-gray-400 active:text-gray-600 transition-colors"
            aria-label={t("plan.share")}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
          </button>
          <button
            ref={settingsBtnRef}
            onClick={() => setIsEditing(true)}
            className="relative p-2 text-gray-400 active:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          </button>
        </div>
      </div>

      {/* 고정 히어로 (스크롤 영역 밖) */}
      <div className="shrink-0 px-6 bg-[#FAFBF9] border-b border-gray-200">
        <PlanHero
          description={sessionData.description}
          goal={goal}
          currentIntensity={currentIntensity}
          isRunningSession={isRunningSession}
          currentRunningVariant={currentRunningVariant}
          onRunningVariantSwap={handleRunningVariantSwap}
          showRunningSwap={showRunningSwap}
          setShowRunningSwap={setShowRunningSwap}
          descRef={descRef}
          runningSwapRef={runningSwapRef}
        />
      </div>

      {(() => {
        const selectedExercise = selectedIdx !== null ? localExercises[selectedIdx] ?? null : null;
        let canDelete = false;
        let canSwap = false;
        if (selectedExercise && selectedIdx !== null) {
          const exPhase = selectedExercise.phase || (selectedExercise.type === "warmup" ? "warmup" : selectedExercise.type === "core" || selectedExercise.type === "mobility" ? "core" : selectedExercise.type === "cardio" ? "cardio" : "main");
          const samePhaseCount = localExercises.filter(e => {
            const p = e.phase || (e.type === "warmup" ? "warmup" : e.type === "core" || e.type === "mobility" ? "core" : e.type === "cardio" ? "cardio" : "main");
            return p === exPhase;
          }).length;
          canDelete = !(exPhase === "main" && samePhaseCount <= 1);
          canSwap = getAlternativeExercises(selectedExercise.name).length > 0;
        }
        return (
          <PlanSplitShell
            focused={focusedPane}
            onFocusChange={setFocusedPane}
            library={
              <PlanLibraryPane
                mode={focusedPane === "library" ? "full" : "peek"}
                phases={phases}
                localExercises={localExercises}
                firstCardRef={firstGuideRef}
                scrollEndRef={scrollEndRef}
                locale={locale}
                t={t}
                onSelectExercise={(idx) => { setSelectedIdx(idx); setFocusedPane("selected"); }}
                onAdjustSets={adjustSets}
                onAddExercise={openAddSheet}
              />
            }
            selected={
              <PlanSelectedPane
                mode={focusedPane === "selected" ? "full" : "peek"}
                exercise={selectedExercise}
                globalIdx={selectedIdx}
                totalCount={localExercises.length}
                canDelete={canDelete}
                canSwap={canSwap}
                locale={locale}
                t={t}
                onUpdateSetDetail={handleUpdateSetDetail}
                onAddSet={handleAddSet}
                onRemoveSet={handleRemoveSet}
                onSwap={(idx) => { openSwapSheet(localExercises[idx], idx); }}
                onDelete={(idx) => {
                  handleDeleteExercise(idx);
                  setSelectedIdx(null);
                  setFocusedPane("library");
                }}
                onFormGuide={(ex) => {
                  const parts = getExerciseName(ex.name, locale).split('(');
                  const searchTerm = parts.length > 1 ? parts[1].replace(')', '').trim() : parts[0].trim();
                  window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(searchTerm + " exercise form guide")}`, "_blank");
                }}
                onUpdateCount={(idx, newCount) => {
                  setLocalExercises(prev => prev.map((e, i) => {
                    if (i !== idx) return e;
                    // 홀드 운동이면 reps(=초)도 동기화
                    const secMatch = newCount.match(/(\d+)\s*(?:초|sec)/);
                    const newReps = secMatch ? parseInt(secMatch[1], 10) : e.reps;
                    return { ...e, count: newCount, reps: newReps };
                  }));
                }}
              />
            }
          />
        );
      })()}

      {/* Bottom CTA — 스크롤 끝 도달 시 슬라이드업 */}
      <div
        className={`absolute bottom-0 left-0 right-0 px-5 pt-8 bg-gradient-to-t from-[#FAFBF9] via-[#FAFBF9]/95 to-transparent z-20 transition-transform duration-300 ease-out ${
          ctaVisible ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ paddingBottom: "calc(var(--safe-area-bottom, 0px) + 24px)" }}
      >
        {/* 회의 2026-04-26 음악 도입: CTA 위 토글. 큐레이션 1개라도 준비됐을 때만 노출 (마이너스 요소 회피). */}
        {musicAvailable && (
          <button
            type="button"
            onClick={handleToggleMusic}
            className={`w-full h-10 mb-2.5 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-all ${
              musicOn
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : "bg-white text-gray-600 border border-gray-200"
            }`}
            aria-pressed={musicOn}
          >
            <span className={musicOn ? "text-emerald-700" : "text-gray-400"}>♪</span>
            <span>{musicOn ? t("music.toggle_on") : t("music.toggle_off")}</span>
          </button>
        )}
        {musicIntroVisible && (
          <div className="absolute -top-16 left-3 right-3 px-3 py-2 rounded-xl bg-[#1B4332] text-white text-xs leading-snug shadow-lg">
            {t("music.intro_toast")}
          </div>
        )}
        <div className="flex items-center gap-2.5">
          <button
            onClick={openSaveSheet}
            className="h-14 px-5 rounded-2xl bg-white border-2 border-gray-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            <svg className="w-5 h-5 text-[#1B4332]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            <span className="text-[#1B4332] font-black text-sm whitespace-nowrap">{t("plan.save_to_my")}</span>
          </button>
          <button
            onClick={() => onStart({ ...sessionData, exercises: localExercises })}
            className="flex-1 h-14 rounded-2xl bg-[#1B4332] active:scale-[0.98] transition-all flex items-center justify-center gap-3 shadow-xl shadow-[#1B4332]/20 hover:bg-[#2D6A4F]"
          >
            <span className="text-white font-black text-base tracking-wide whitespace-nowrap">{t("plan.start")}</span>
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Bottom Sheets — 강도조정 / 종목추가 / 종목교체 */}
      <PlanBottomSheets
        isEditing={isEditing}
        setIsEditing={setIsEditing}
        currentIntensity={currentIntensity}
        recommendedIntensity={recommendedIntensity}
        onIntensitySelect={handleIntensitySelect}
        onRegenerate={onRegenerate ? handleRegenerate : undefined}
        onBack={onBack}
        addToPhase={addToPhase}
        setAddToPhase={setAddToPhase}
        onAddExercise={handleAddExercise}
        swapExercise={swapExercise}
        setSwapExercise={setSwapExercise}
        onSwapExercise={handleSwapExercise}
        swapSearch={swapSearch}
        setSwapSearch={setSwapSearch}
        swapFilter={swapFilter}
        setSwapFilter={setSwapFilter}
        localExercises={localExercises}
      />

      {/* Tutorial Overlays — 인트로 / 세팅 / 카드탭 */}
      <PlanTutorialOverlays
        showIntroTip={showIntroTip}
        descPos={descPos}
        onDismissIntro={dismissIntroTip}
        showTip={showTip}
        settingsBtnPos={settingsBtnPos}
        onDismissTip={dismissTip}
        showGuideTip={showGuideTip}
        guideBtnPos={guideBtnPos}
        onDismissGuideTip={dismissGuideTip}
      />

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

      {/* 플랜 저장 바텀시트 */}
      {showSaveSheet && (
        <div className="absolute inset-0 z-40 flex items-end" onClick={() => setShowSaveSheet(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-full bg-white rounded-t-3xl px-5 pt-5 pb-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            style={{ paddingBottom: "calc(var(--safe-area-bottom, 0px) + 24px)" }}
          >
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
            <h3 className="text-lg font-black text-[#1B4332] mb-1">{t("plan.save_sheet_title")}</h3>
            <p className="text-xs text-gray-500 mb-4">{t("plan.save_sheet_desc")}</p>
            <label className="block text-[11px] font-bold text-gray-500 mb-1.5">{t("plan.save_name_label")}</label>
            <input
              type="text"
              value={saveNameDraft}
              onChange={(e) => setSaveNameDraft(e.target.value)}
              maxLength={40}
              className="w-full h-11 px-3 rounded-xl border-2 border-gray-200 focus:border-[#2D6A4F] outline-none text-sm font-bold text-gray-900"
              placeholder={autoNamePlan({ ...sessionData, exercises: localExercises }, locale)}
            />
            {saveFeedback === "limit" && (
              <div className="mt-3 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200">
                <p className="text-xs font-bold text-amber-800">
                  {isPremium
                    ? t("plan.save_limit_premium", { n: String(PREMIUM_LIMIT) })
                    : t("plan.save_limit_free", { n: String(FREE_LIMIT) })}
                </p>
                <button
                  onClick={handleOverwriteOldest}
                  className="mt-2 text-xs font-black text-amber-900 underline"
                >
                  {t("plan.save_overwrite_oldest")}
                </button>
              </div>
            )}
            {saveFeedback === "saved" && (
              <p className="mt-3 text-xs font-bold text-emerald-700">{t("plan.save_success")}</p>
            )}
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setShowSaveSheet(false)}
                className="flex-1 h-12 rounded-xl border-2 border-gray-200 text-gray-700 font-black text-sm active:scale-[0.98] transition"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={confirmSavePlan}
                disabled={saveFeedback === "saved"}
                className="flex-[2] h-12 rounded-xl bg-[#1B4332] text-white font-black text-sm active:scale-[0.98] transition disabled:opacity-60"
              >
                {t("plan.save_confirm")}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
