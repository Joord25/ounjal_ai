"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { THEME } from "@/constants/theme";
import { ExerciseStep, getAlternativeExercises, LABELED_EXERCISE_POOLS, RunningStats, RunningType } from "@/constants/workout";
import { AiCoachChat } from "./AiCoachChat";
import { getVideoEmbedUrl, getYoutubeSearchUrl } from "@/constants/exerciseVideos";
import { useTranslation } from "@/hooks/useTranslation";
import { getExerciseName, translateWeightGuide } from "@/utils/exerciseName";
import { useGpsTracker } from "@/hooks/useGpsTracker";
import { useAlarmSynthesizer } from "@/hooks/useAlarmSynthesizer";
import { formatPace, formatRunDistanceKm, detectRunExerciseMode, detectExerciseRunningType, getRunningTypeShareLabel } from "@/utils/runningFormat";
import { GpsPermissionDialog } from "./GpsPermissionDialog";
import { computeRunningStats } from "@/utils/runningStats";

const MUSCLE_GROUP_EN: Record<string, string> = {
  "웜업": "Warm-up", "가슴": "Chest", "어깨": "Shoulders", "삼두": "Triceps",
  "등": "Back", "후면 어깨": "Rear Delts", "이두": "Biceps", "하체": "Legs",
  "종아리": "Calves", "전신": "Full Body", "코어": "Core", "가동성": "Mobility",
};
function tLabel(label: string, locale: string): string {
  return locale === "ko" ? label : (MUSCLE_GROUP_EN[label] || label);
}

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
  onAddSet?: () => void;
  nextExerciseName?: string;
  lastSessionRecord?: {
    weights: number[];
    reps: number[];
    maxWeight: number;
    hadEasy: boolean;
    date: string;
  } | null;
  // 회의 41: 러닝 인터벌 완주 시 runningStats 산출 콜백
  onRunningStatsComputed?: (stats: RunningStats) => void;
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
  onAddSet,
  nextExerciseName,
  lastSessionRecord,
  onRunningStatsComputed,
}) => {
  const { t, locale } = useTranslation();
  const [showSwapMenu, setShowSwapMenu] = useState(false);
  const [swapSearch, setSwapSearch] = useState("");
  const [swapFilter, setSwapFilter] = useState<string | null>(null);
  const [showVideoGuide, setShowVideoGuide] = useState(false);
  const alternatives = onSwapExercise ? getAlternativeExercises(exercise.name) : [];


  const closeSwap = () => { setShowSwapMenu(false); setSwapSearch(""); setSwapFilter(null); };
  const isStrengthType = exercise.type === "strength" || exercise.type === "core";
  const isBodyweight = !exercise.weight || exercise.weight === "Bodyweight"
    || /맨몸|체중|bodyweight/i.test(exercise.weight)
    || (/푸쉬업|푸시업|push[\s-]?up|pull[\s-]?up|풀업|친업|chin[\s-]?up|턱걸이|딥스|dip|plank|플랭크|버피|burpee|크런치|crunch|레그레이즈|leg raise|마운틴\s?클라이머|mountain\s?climber|점프|jump/i.test(exercise.name) && !/중량|weighted|웨이티드/i.test(exercise.name));
  const hasWeight = isStrengthType && !isBodyweight;

  // 장비 타입 감지 (운동 이름 키워드 기반)
  const getEquipmentType = (name: string): "barbell" | "smith" | "dumbbell" | "kettlebell" | "cable_machine" => {
    if (/덤벨|dumbbell/i.test(name)) return "dumbbell";
    if (/케틀벨|kettlebell/i.test(name)) return "kettlebell";
    if (/스미스|smith/i.test(name)) return "smith";
    if (/케이블|cable|머신|machine|풀다운|pulldown|레그\s?프레스|leg\s?press|레그\s?익스텐션|leg\s?ext|레그\s?컬|leg\s?curl|펙덱|pec\s?deck|체스트\s?프레스|시티드/i.test(name)) return "cable_machine";
    if (/바벨|barbell/i.test(name)) return "barbell";
    return "barbell";
  };

  // 장비 x 성별/연령별 기본 무게 (전문가 6인 합의)
  const getDefaultWeight = (): number => {
    if (typeof window === "undefined") return 20;
    const gender = localStorage.getItem("ohunjal_gender");
    const birthYear = localStorage.getItem("ohunjal_birth_year");
    const age = birthYear ? new Date().getFullYear() - parseInt(birthYear) : 30;
    const isFemaleOrSenior = gender === "female" || age >= 60;
    const equipment = getEquipmentType(exercise.name);
    const defaults: Record<string, [number, number]> = {
      barbell:       [20, 15],
      smith:         [15, 10],
      dumbbell:      [10, 5],
      kettlebell:    [12, 8],
      cable_machine: [15, 10],
    };
    const [male, female] = defaults[equipment];
    return isFemaleOrSenior ? female : male;
  };

  // Load last used weight from localStorage
  const getStoredWeight = (): number => {
    if (typeof window === "undefined") return getDefaultWeight();
    const key = `ohunjal_weight_${exercise.name.replace(/[^a-zA-Z가-힣]/g, "_")}`;
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
  const [showAiTip, setShowAiTip] = useState(!!lastSessionRecord && (lastSessionRecord.maxWeight ?? 0) > 0);

  const [view, setView] = useState<"active" | "feedback">("active");
  const [failedReps, setFailedReps] = useState(Math.max(0, setInfo.targetReps - 1));
  const [easyExtraReps, setEasyExtraReps] = useState(4);
  const [isDoneAnimating, setIsDoneAnimating] = useState(false);
  // 회의: 피드백은 선택만 저장하고 "휴식 종료" 버튼 클릭 시 실제 제출 (Flow B)
  const [selectedFeedback, setSelectedFeedback] = useState<{ type: FeedbackType; reps: number } | null>(null);
  const [localRestSec, setLocalRestSec] = useState(0);
  const [timerCompleted, setTimerCompleted] = useState(false);
  const [showRepsEdit, setShowRepsEdit] = useState(false);
  const [adjustedReps, setAdjustedReps] = useState(setInfo.targetReps);
  const [repsStopwatch, setRepsStopwatch] = useState(0);
  const [repsStopwatchRunning, setRepsStopwatchRunning] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

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
        const key = `ohunjal_weight_${exercise.name.replace(/[^a-zA-Z가-힣]/g, "_")}`;
        localStorage.setItem(key, String(parsed));
      }
    }
  }

  // Reset easyExtraReps when set changes
  // 회의: 세트 전환 깜빡임/페이드 효과 제거 — 피드백 시트가 모든 전환을 커버하므로 버그처럼 보임
  const prevSetRef = useRef(setInfo.current);
  useEffect(() => {
    if (setInfo.current !== prevSetRef.current) {
      prevSetRef.current = setInfo.current;
      setEasyExtraReps(2);
      setView("active");
      setIsDoneAnimating(false);
    }
  }, [setInfo.current]);

  const halfAlarmFired = useRef(false);
  const playAlarmSound = useAlarmSynthesizer();

  // Weight presets: 4 nearest 10kg steps centered around current weight (excluding current)
  const weightPresets = (() => {
    const center = selectedWeight || getDefaultWeight();
    const base = Math.round(center / 10) * 10;
    const presets: number[] = [];
    for (let i = -2; i <= 2; i++) {
      const v = base + i * 10;
      if (v > 0 && v !== selectedWeight) presets.push(v);
    }
    return presets.slice(0, 4);
  })();

  // Long-press support for +/- buttons
  const longPressRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const longPressTriggered = useRef(false);
  const longPressDirection = useRef<"up" | "down">("up");
  const startLongPress = (direction: "up" | "down") => {
    longPressTriggered.current = false;
    longPressDirection.current = direction;
    const step = direction === "up" ? 0.5 : -0.5;
    longPressRef.current = setInterval(() => {
      longPressTriggered.current = true;
      setSelectedWeight(prev => {
        const next = parseFloat((prev + step).toFixed(1));
        return Math.max(0.5, next);
      });
    }, 120);
  };
  const stopLongPress = () => {
    if (longPressRef.current) {
      clearInterval(longPressRef.current);
      longPressRef.current = null;
    }
    // short tap: interval이 한 번도 안 돌았으면 한 번만 적용
    if (!longPressTriggered.current) {
      const step = longPressDirection.current === "up" ? 0.5 : -0.5;
      setSelectedWeight(prev => {
        const next = parseFloat((prev + step).toFixed(1));
        return Math.max(0.5, next);
      });
    }
    longPressTriggered.current = false;
  };
  const cancelLongPress = () => {
    if (longPressRef.current) {
      clearInterval(longPressRef.current);
      longPressRef.current = null;
    }
    longPressTriggered.current = false;
  };

  const confirmWeight = () => {
    const key = `ohunjal_weight_${exercise.name.replace(/[^a-zA-Z가-힣]/g, "_")}`;
    localStorage.setItem(key, String(selectedWeight));
    setWeightConfirmed(true);
    setShowWeightEdit(false);
    setRepsStopwatchRunning(true);
    playAlarmSound("start");
  };

  // Timer State for Cardio/Warmup
  const [isPlaying, setIsPlaying] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);

  const isTimerMode = exercise.type === 'cardio' || exercise.type === 'warmup' || exercise.type === 'mobility';

  // Determine if it's a distance-based measurement (LSD, km, etc.)
  const isDistanceMode = exercise.name.includes("LSD") || exercise.count.includes("km") || exercise.count.includes("Distance");

  // 회의 36: 인터벌 모드 3타입 지원
  // - sprint: "N초 전력 / M초 회복 × R" (빨강/초록, sprint부터)
  // - walkrun: "N초 걷기 / M초 달리기 × R" (파랑/주황, walk부터)
  // - fartlek: "N초 전력 / M초 보통 × R" (빨강/초록, sprint부터)
  type IntervalType = "sprint" | "walkrun" | "fartlek";
  interface IntervalConfig {
    phase1Sec: number; // 첫 페이즈 시간
    phase2Sec: number; // 둘째 페이즈 시간
    rounds: number;
    type: IntervalType;
    phase1Key: string; // i18n key
    phase2Key: string;
  }
  // 회의 36 v3: useMemo로 intervalConfig 안정화 — exercise.count 변경 시에만 재계산
  // (이전: 매 렌더마다 새 객체 생성 → useEffect 의존성 변화 → timer teardown/rebuild 반복 → 타이머 느려짐)
  const intervalConfig: IntervalConfig | null = useMemo(() => {
    const walkRun = exercise.count.match(/(\d+)초\s*걷기\s*\/?\s*(\d+)초\s*달리기\s*[×x]\s*(\d+)/i);
    if (walkRun) {
      return {
        phase1Sec: parseInt(walkRun[1]),
        phase2Sec: parseInt(walkRun[2]),
        rounds: parseInt(walkRun[3]),
        type: "walkrun" as IntervalType,
        phase1Key: "fit.interval.walk",
        phase2Key: "fit.interval.run",
      };
    }
    const fartlek = exercise.count.match(/(\d+)초\s*전력\s*\/?\s*(\d+)초\s*보통\s*[×x]\s*(\d+)/i);
    if (fartlek) {
      return {
        phase1Sec: parseInt(fartlek[1]),
        phase2Sec: parseInt(fartlek[2]),
        rounds: parseInt(fartlek[3]),
        type: "fartlek" as IntervalType,
        phase1Key: "fit.interval.burst",
        phase2Key: "fit.interval.base",
      };
    }
    const sprint = exercise.count.match(/(\d+)초\s*전력\s*\/?\s*(\d+)초\s*회복\s*[×x]\s*(\d+)/i);
    if (sprint) {
      return {
        phase1Sec: parseInt(sprint[1]),
        phase2Sec: parseInt(sprint[2]),
        rounds: parseInt(sprint[3]),
        type: "sprint" as IntervalType,
        phase1Key: "fit.interval.sprint",
        phase2Key: "fit.interval.recovery",
      };
    }
    return null;
  }, [exercise.count]);
  const isIntervalMode = intervalConfig !== null;

  // 회의 43: 연속 러닝(템포/이지/LSD) 감지 — 인터벌은 아니지만 GPS + 3분할 UI 필요
  const runExerciseMode = useMemo(() => detectRunExerciseMode(exercise), [exercise]);
  const isContinuousRun = runExerciseMode === "continuous";
  const isRunningExercise = isIntervalMode || isContinuousRun;
  // 연속 러닝의 세부 타입 (runningStats.runningType 결정용)
  const continuousRunType = useMemo(() => detectExerciseRunningType(exercise), [exercise]);

  // 회의 41: GPS 권한 팝업 & 실내 모드 (M-G에서 외부 토글 도입 예정, 현재 기본 실외)
  const [permissionDialogOpen, setPermissionDialogOpen] = useState(false);
  const [gpsPermissionAsked, setGpsPermissionAsked] = useState(false);
  const [isIndoor] = useState(false);
  // 회의 43 후속: 러닝 조기 종료 확인 모달
  const [runCompleteConfirmOpen, setRunCompleteConfirmOpen] = useState(false);

  // 러닝 운동 첫 진입 시 권한 미결정이면 팝업 표시 (세션 1회)
  // 회의 43: 인터벌/연속 러닝 모두 포함
  useEffect(() => {
    if (!isRunningExercise) return;
    if (gpsPermissionAsked) return;
    if (isIndoor) return;
    const asked = typeof window !== "undefined" && window.localStorage?.getItem("ohunjal_gps_asked");
    if (asked === "1") {
      setGpsPermissionAsked(true);
      return;
    }
    setPermissionDialogOpen(true);
  }, [isRunningExercise, gpsPermissionAsked, isIndoor]);

  const handleGpsAllow = () => {
    try { window.localStorage?.setItem("ohunjal_gps_asked", "1"); } catch {}
    setGpsPermissionAsked(true);
    setPermissionDialogOpen(false);
  };
  const handleGpsLater = () => {
    try { window.localStorage?.setItem("ohunjal_gps_asked", "1"); } catch {}
    setGpsPermissionAsked(true);
    setPermissionDialogOpen(false);
  };

  // 회의 43 후속: 러닝 완료 버튼 클릭 래퍼 — 자연 완료 전이면 확인 모달, 이미 완료된 상태면 바로 진행
  const handleRunningCompleteClick = () => {
    if (timerCompleted) {
      handleDoneClick();
      return;
    }
    setRunCompleteConfirmOpen(true);
  };

  // 회의 41/43: GPS 추적 훅 — 모든 러닝 운동(인터벌 + 연속) 실행 중 활성
  // gpsPermissionAsked=false일 때는 enabled=false로 대기 (권한 다이얼로그 해제 전까지 watchPosition 호출 방지)
  const gpsTrackerEnabled = isRunningExercise && !isIndoor && gpsPermissionAsked;
  const {
    status: gpsStatus,
    distance: gpsDistance,
    currentPace: gpsPace,
    markPhase: gpsMarkPhase,
    getSnapshot: gpsGetSnapshot,
    gpsAvailable: gpsIsAvailable,
    isAutoPaused: gpsAutoPaused,
  } = useGpsTracker({
    enabled: gpsTrackerEnabled,
    isIndoor,
  });

  // 회의 36: 타입별 색상 매핑 (회의 36 v3: useMemo 안정화)
  const intervalColors = useMemo(() => {
    if (!intervalConfig) return null;
    if (intervalConfig.type === "walkrun") {
      return {
        phase1Bg: "bg-blue-100", phase1Text: "text-blue-600",
        phase2Bg: "bg-orange-100", phase2Text: "text-orange-600",
        phase1Timer: "text-blue-500", phase2Timer: "text-orange-600",
      };
    }
    return {
      phase1Bg: "bg-red-100", phase1Text: "text-red-600",
      phase2Bg: "bg-emerald-100", phase2Text: "text-emerald-700",
      phase1Timer: "text-red-500", phase2Timer: "text-emerald-600",
    };
  }, [intervalConfig]);

  // Interval timer state
  const [intervalRound, setIntervalRound] = useState(1);
  const [intervalPhase, setIntervalPhase] = useState<"sprint" | "recovery">("sprint");
  const [intervalTime, setIntervalTime] = useState(intervalConfig?.phase1Sec ?? 0);

  // 회의 38: 인터벌 타이머 Wall-clock 기반 (Date.now() 타임스탬프)
  // 이전 버전(v2): timeRef -= 1 틱 감산 → setInterval 드리프트 + 백그라운드 스로틀 + 렌더 타이밍으로 느려짐/빨라짐 발생
  // 신버전(v3): 각 틱마다 (Date.now() - phaseStartMs)로 경과시간 재계산 → 드리프트 불가능, 백그라운드 복귀 시 자동 보정
  const phaseRef = useRef<"sprint" | "recovery">("sprint");
  const roundRef = useRef(1);
  const phaseStartMsRef = useRef<number>(0);
  const pausedAtMsRef = useRef<number>(0);
  const midpointFiredRef = useRef(false);
  const lastTickSecondRef = useRef<number>(-1);
  // 회의 41: 인터벌 세션 전체 경과시간 (3분할 스탯 Time 표시용)
  const sessionStartMsRef = useRef<number>(0);
  const [intervalElapsedSec, setIntervalElapsedSec] = useState(0);

  // exercise 변경 / config 변경 시 전체 리셋
  useEffect(() => {
    phaseRef.current = "sprint";
    roundRef.current = 1;
    phaseStartMsRef.current = 0;
    pausedAtMsRef.current = 0;
    midpointFiredRef.current = false;
    lastTickSecondRef.current = -1;
    sessionStartMsRef.current = 0;
    setIntervalPhase("sprint");
    setIntervalRound(1);
    setIntervalTime(intervalConfig?.phase1Sec ?? 0);
    setIntervalElapsedSec(0);
  }, [intervalConfig?.phase1Sec, intervalConfig?.phase2Sec, intervalConfig?.rounds]);

  useEffect(() => {
    if (!isPlaying || !isIntervalMode || !intervalConfig) return;
    const cfg = intervalConfig;
    const now = Date.now();

    // 최초 시작 또는 pause 후 재개
    if (phaseStartMsRef.current === 0) {
      phaseStartMsRef.current = now;
      sessionStartMsRef.current = now;
    } else if (pausedAtMsRef.current > 0) {
      // 일시정지 지속 시간만큼 phaseStart + sessionStart 앞으로 shift (경과시간 유지)
      const pauseDelta = now - pausedAtMsRef.current;
      phaseStartMsRef.current += pauseDelta;
      sessionStartMsRef.current += pauseDelta;
      pausedAtMsRef.current = 0;
    }

    const iv = setInterval(() => {
      const nowTick = Date.now();
      const phaseTotal = phaseRef.current === "sprint" ? cfg.phase1Sec : cfg.phase2Sec;
      const elapsedSec = (nowTick - phaseStartMsRef.current) / 1000;
      const remainingFloat = phaseTotal - elapsedSec;
      const remainingInt = Math.max(0, Math.ceil(remainingFloat));

      // UI 동기화
      setIntervalTime(remainingInt);
      // 회의 41: 세션 전체 경과시간 갱신 (3분할 Time 표시용)
      if (sessionStartMsRef.current > 0) {
        setIntervalElapsedSec(Math.max(0, Math.floor((nowTick - sessionStartMsRef.current) / 1000)));
      }

      // 페이즈 전환
      if (remainingFloat <= 0) {
        midpointFiredRef.current = false;
        lastTickSecondRef.current = -1;

        if (phaseRef.current === "sprint") {
          phaseRef.current = "recovery";
          phaseStartMsRef.current = nowTick;
          playAlarmSound("rest_end");
          if (navigator.vibrate && localStorage.getItem("ohunjal_settings_vibration") !== "false") navigator.vibrate([200, 100, 200]);
          setIntervalPhase("recovery");
          setIntervalTime(cfg.phase2Sec);
          // 회의 41: GPS 페이즈 전환 마크 (리포트 인터벌 분해용)
          gpsMarkPhase("recovery", roundRef.current);
        } else {
          if (roundRef.current >= cfg.rounds) {
            setIsPlaying(false);
            setTimerCompleted(true);
            playAlarmSound("end");
            if (navigator.vibrate && localStorage.getItem("ohunjal_settings_vibration") !== "false") navigator.vibrate([300, 100, 300, 100, 300]);
            // 회의 41: 인터벌 러닝 완주 시 runningStats 산출 + 콜백
            if (onRunningStatsComputed) {
              const snap = gpsGetSnapshot();
              const runningType: RunningType =
                cfg.type === "walkrun" ? "walkrun"
                : cfg.type === "fartlek" ? "fartlek"
                : "sprint";
              const stats = computeRunningStats({
                runningType,
                isIndoor,
                gpsAvailable: gpsIsAvailable,
                points: snap.points,
                phaseMarks: snap.phaseMarks,
                sessionStartMs: snap.sessionStartMs || nowTick,
                sessionEndMs: nowTick,
                completedRounds: cfg.rounds,
                totalRounds: cfg.rounds,
              });
              onRunningStatsComputed(stats);
            }
            return;
          }
          roundRef.current += 1;
          phaseRef.current = "sprint";
          phaseStartMsRef.current = nowTick;
          playAlarmSound("start");
          if (navigator.vibrate && localStorage.getItem("ohunjal_settings_vibration") !== "false") navigator.vibrate(100);
          setIntervalRound(roundRef.current);
          setIntervalPhase("sprint");
          setIntervalTime(cfg.phase1Sec);
          // 회의 41: GPS 페이즈 전환 마크
          gpsMarkPhase("sprint", roundRef.current);
        }
        return;
      }

      // 중간 지점 알림 (페이즈당 1회)
      const midpoint = Math.floor(phaseTotal / 2);
      if (!midpointFiredRef.current && midpoint > 0 && remainingInt <= midpoint) {
        midpointFiredRef.current = true;
        playAlarmSound("half");
        if (navigator.vibrate && localStorage.getItem("ohunjal_settings_vibration") !== "false") navigator.vibrate(150);
      }

      // 카운트다운 tick (3, 2, 1초) — 같은 초에 중복 발사 방지
      if (remainingInt > 0 && remainingInt <= 3 && remainingInt !== lastTickSecondRef.current) {
        lastTickSecondRef.current = remainingInt;
        playAlarmSound("tick");
      }
    }, 250);

    return () => {
      clearInterval(iv);
      // cleanup이 isPlaying=false로 트리거된 경우 pause 시점 기록
      if (!pausedAtMsRef.current) {
        pausedAtMsRef.current = Date.now();
      }
    };
  }, [isPlaying, isIntervalMode, intervalConfig, gpsMarkPhase, gpsGetSnapshot, gpsIsAvailable, isIndoor, onRunningStatsComputed]);

  // 회의 43: 연속 러닝(템포/이지/LSD) wall-clock 경과시간 — 카운트업 + GPS 동기화
  useEffect(() => {
    if (!isPlaying || !isContinuousRun) return;
    const now = Date.now();
    if (sessionStartMsRef.current === 0) {
      sessionStartMsRef.current = now;
    } else if (pausedAtMsRef.current > 0) {
      const pauseDelta = now - pausedAtMsRef.current;
      sessionStartMsRef.current += pauseDelta;
      pausedAtMsRef.current = 0;
    }
    const iv = setInterval(() => {
      const nowTick = Date.now();
      if (sessionStartMsRef.current > 0) {
        setIntervalElapsedSec(Math.max(0, Math.floor((nowTick - sessionStartMsRef.current) / 1000)));
      }
    }, 250);
    return () => {
      clearInterval(iv);
      if (!pausedAtMsRef.current) {
        pausedAtMsRef.current = Date.now();
      }
    };
  }, [isPlaying, isContinuousRun]);

  // Normal Timer Logic — 회의 43: 연속 러닝은 별도 wall-clock 사용하므로 제외
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying && isTimerMode && !isIntervalMode && !isContinuousRun) {
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
            // 카운트다운 틱 (5, 4, 3, 2, 1초)
            if (next > 0 && next <= 5) {
                playAlarmSound("tick");
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
  }, [isPlaying, isTimerMode, isDistanceMode, isIntervalMode]);

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
    if (isIntervalMode && intervalConfig) {
        // 회의 38: wall-clock 기반 — state + refs 동시 초기화
        setIntervalRound(1);
        setIntervalPhase("sprint");
        setIntervalTime(intervalConfig.phase1Sec);
        phaseRef.current = "sprint";
        roundRef.current = 1;
        phaseStartMsRef.current = 0;
        pausedAtMsRef.current = 0;
        midpointFiredRef.current = false;
        lastTickSecondRef.current = -1;
        sessionStartMsRef.current = 0;
        setIntervalElapsedSec(0);
        setElapsedTime(0);
    } else if (isContinuousRun) {
        // 회의 43: 연속 러닝 리셋
        sessionStartMsRef.current = 0;
        pausedAtMsRef.current = 0;
        setIntervalElapsedSec(0);
        setElapsedTime(0);
    } else if (isTimerMode) {
        if (isDistanceMode) {
            setElapsedTime(0);
        } else {
            setElapsedTime(parseTargetTime(exercise.count));
        }
    } else {
        setElapsedTime(0);
    }
  }, [exerciseIndex]);

  // 회의: 세트 전환 애니메이션 effect 제거 (피드백 시트가 대신 전환 커버)

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Dynamic Font Size for Long Titles (한글만 기준)
  const mainTitleForSize = getExerciseName(exercise.name, locale);
  const titleSizeClass = mainTitleForSize.length <= 6
    ? "text-5xl"
    : mainTitleForSize.length <= 9
      ? "text-4xl"
      : mainTitleForSize.length <= 12
        ? "text-3xl"
        : "text-2xl";

  const timerSize = "text-7xl";
  const timerColor = "#74A68D";
  const valueSize = "text-6xl";
  const unitSize = "text-xl";

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
    const interval = setInterval(() => setLocalRestSec(prev => {
      const next = prev - 1;
      // 휴식 종료 5초 전 카운트다운 틱
      if (next > 0 && next <= 5) {
        playAlarmSound("tick");
      }
      // 휴식 종료 알림
      if (next <= 0) {
        playAlarmSound("rest_end");
      }
      return next;
    }), 1000);
    return () => clearInterval(interval);
  }, [view, localRestSec]);

  // 회의: 타이머 0초 자동 진행 제거 — 사용자가 반드시 "휴식 종료" 버튼을 눌러야 넘어감 (Flow B)

  const handleDoneClick = () => {
    if (exercise.type !== "strength" && exercise.type !== "core") {
      // 회의 41/43: 러닝 운동 완료 시 runningStats 산출 (인터벌 + 연속 공용)
      if (isRunningExercise && onRunningStatsComputed) {
        const snap = gpsGetSnapshot();
        let runType: RunningType;
        let completedRounds = 0;
        let totalRounds = 0;
        if (isIntervalMode && intervalConfig) {
          runType =
            intervalConfig.type === "walkrun" ? "walkrun"
            : intervalConfig.type === "fartlek" ? "fartlek"
            : "sprint";
          completedRounds = Math.max(0, intervalRound - 1);
          totalRounds = intervalConfig.rounds;
        } else {
          // 연속 러닝: 라운드 개념 없음, 1회성 세션으로 처리
          runType = continuousRunType ?? "easy";
          completedRounds = 1;
          totalRounds = 1;
        }
        const stats = computeRunningStats({
          runningType: runType,
          isIndoor,
          gpsAvailable: gpsIsAvailable,
          points: snap.points,
          phaseMarks: snap.phaseMarks,
          sessionStartMs: snap.sessionStartMs || Date.now(),
          sessionEndMs: Date.now(),
          completedRounds,
          totalRounds,
        });
        onRunningStatsComputed(stats);
      }
      setIsPlaying(false);
      setIsDoneAnimating(true);
      setRepsStopwatchRunning(false);
      playAlarmSound("start");
      setTimeout(() => {
        onSetComplete(adjustedReps, "target");
      }, 500);
      return;
    }
    setRepsStopwatchRunning(false);
    playAlarmSound("start");

    // 강도별 휴식 시간 (ACSM 기준)
    const restBySets = adjustedReps <= 6 ? 150 : adjustedReps <= 12 ? 75 : 45;
    const restByType = exercise.type === "core" ? 45 : restBySets;

    // 회의: 매 세트마다 피드백 시트 노출 (자동 target 스킵 제거)
    setView("feedback");
    setSelectedFeedback(null);
    setLocalRestSec(restByType);
  };

  const actualWeight = hasWeight ? selectedWeight : undefined;

  // Flow B: 선택만 저장 (즉시 제출 X). 사용자는 마음 바꿀 수 있음.
  const handleSelectFeedback = (type: FeedbackType, reps: number) => {
    setSelectedFeedback({ type, reps });
  };

  // Flow B: "휴식 종료" 버튼 → 실제 제출. selectedFeedback 없으면 호출 안 됨 (버튼 disabled).
  const handleEndRest = () => {
    if (!selectedFeedback) return;
    const { type, reps } = selectedFeedback;
    setLocalRestSec(0);
    setSelectedFeedback(null);
    onSetComplete(reps, type, actualWeight);
    setTimeout(() => onSkipRest(), 50);
  };

  const handleRestMinus15 = () => setLocalRestSec(prev => Math.max(0, prev - 15));
  const handleRestPlus15 = () => setLocalRestSec(prev => prev + 15);

  // Weight Picker View (First set of strength exercises)
  if (hasWeight && !weightConfirmed) {
    const localizedName = getExerciseName(exercise.name, locale);
    const parts = localizedName.split('(');
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

        <div className="flex-1 flex flex-col items-center px-6 overflow-y-auto scrollbar-hide">
          {/* 운동명 */}
          <div className="flex flex-col items-center pt-2 pb-4 shrink-0">
            <div className="flex items-center gap-2 justify-center">
              <h1 className={`font-black text-[#1B4332] tracking-tight leading-tight break-keep text-center ${mainTitle.length <= 6 ? "text-4xl" : mainTitle.length <= 9 ? "text-3xl" : mainTitle.length <= 12 ? "text-2xl" : "text-xl"}`}>{mainTitle}</h1>
              {alternatives.length > 0 && (
                <button
                  onClick={() => setShowSwapMenu(true)}
                  className="w-7 h-7 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400 active:scale-90 transition-all shrink-0"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              )}
            </div>
            {subTitle && <p className="text-base text-gray-400 font-medium mt-0.5">{subTitle}</p>}
          </div>

          {/* 자세 가이드 미리보기 */}
          {(() => {
            const embedUrl = getVideoEmbedUrl(exercise.name);
            if (embedUrl) {
              return (
                <button onClick={() => setShowVideoGuide(true)} className="flex-1 min-h-0 max-h-[40dvh] aspect-[9/16] rounded-2xl overflow-hidden bg-black relative shadow-lg active:scale-[0.97] transition-all">
                  <iframe
                    src={embedUrl}
                    className="w-full h-full pointer-events-none scale-[1.15] origin-center"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    tabIndex={-1}
                    title={t("fit.formGuide")}
                  />
                  <div className="absolute inset-0 flex items-end justify-end p-2">
                    <div className="px-2 py-1 rounded-lg bg-black/50 backdrop-blur-sm flex items-center gap-1">
                      <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                      <span className="text-[9px] font-bold text-white">{t("fit.watchFull")}</span>
                    </div>
                  </div>
                </button>
              );
            }
            return (
              <button
                onClick={() => window.open(getYoutubeSearchUrl(exercise.name), "_blank")}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gray-50 border border-gray-100 active:scale-[0.97] transition-all"
              >
                <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-red-600" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                  </svg>
                </div>
                <span className="text-xs font-bold text-gray-500">{t("fit.formGuide")}</span>
              </button>
            );
          })()}

          {/* 무게 선택 + 프리셋 */}
          <div className="flex flex-col items-center pt-4 pb-2 shrink-0">
            <div className="flex items-center justify-center gap-5 mb-3">
              <button
                onPointerDown={() => startLongPress("down")}
                onPointerUp={() => stopLongPress()}
                onPointerLeave={() => cancelLongPress()}
                className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-2xl active:scale-95 transition-all hover:bg-gray-200 shrink-0"
              >
                -
              </button>
              <div className="w-36 flex items-baseline justify-center">
                <span className="text-7xl font-black text-[#1B4332] tabular-nums">{selectedWeight}</span>
                <span className="text-xl font-bold text-gray-400 ml-1">kg</span>
              </div>
              <button
                onPointerDown={() => startLongPress("up")}
                onPointerUp={() => stopLongPress()}
                onPointerLeave={() => cancelLongPress()}
                className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-2xl active:scale-95 transition-all hover:bg-gray-200 shrink-0"
              >
                +
              </button>
            </div>
            <div className="flex items-center justify-center gap-2">
              {weightPresets.map((w) => (
                <button
                  key={w}
                  onClick={() => setSelectedWeight(w)}
                  className="px-4 py-2 rounded-xl text-sm font-bold bg-gray-100 text-gray-600 transition-all duration-200 active:scale-95 shrink-0"
                >
                  {w}kg
                </button>
              ))}
            </div>
          </div>

        </div>

        <div className="shrink-0 px-6 pb-8 flex items-center gap-3">
          <button
            onClick={confirmWeight}
            className="flex-1 py-4 rounded-2xl bg-[#1B4332] text-white font-bold text-lg shadow-xl active:scale-[0.98] transition-all"
          >
            {t("fit.startWith", { weight: String(selectedWeight) })}
          </button>
          <button
            onClick={() => setShowAiTip(true)}
            className="w-14 h-14 rounded-2xl bg-[#2D6A4F]/10 flex items-center justify-center active:scale-90 transition-all shrink-0"
          >
            <img src="/favicon_backup.png" alt="AI Coach" className="w-7 h-7 rounded-full" />
          </button>
        </div>

        {/* Video Guide Bottom Sheet (weight picker) */}
        {showVideoGuide && (
          <div className="absolute inset-0 z-[60]">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowVideoGuide(false)} />
            <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[2rem] animate-slide-up shadow-2xl flex flex-col" style={{ height: "78vh", paddingBottom: "calc(var(--safe-area-bottom, 0px) + 16px)" }}>
              <div className="shrink-0 pt-4 px-6">
                <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-red-600" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                    </svg>
                    <p className="text-sm font-black text-[#1B4332]">{t("fit.formGuideTitle", { name: getExerciseName(exercise.name, locale) })}</p>
                  </div>
                  <button onClick={() => setShowVideoGuide(false)} className="text-sm text-gray-400 font-bold active:scale-95 transition-all">{t("fit.close")}</button>
                </div>
              </div>
              <div className="flex-1 px-4 pb-4 min-h-0">
                {(() => {
                  const embedUrl = getVideoEmbedUrl(exercise.name);
                  if (embedUrl) {
                    return (
                      <iframe
                        src={embedUrl}
                        className="w-full h-full rounded-2xl bg-black"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        title={`${t("fit.formGuideTitle", { name: getExerciseName(exercise.name, locale) })}`}
                      />
                    );
                  }
                  return (
                    <div className="w-full h-full flex flex-col gap-3">
                      <iframe
                        src={getYoutubeSearchUrl(exercise.name)}
                        className="w-full flex-1 rounded-2xl bg-gray-50 border border-gray-100"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        title={`${getExerciseName(exercise.name, locale)} search`}
                      />
                      <button
                        onClick={() => window.open(getYoutubeSearchUrl(exercise.name), "_blank")}
                        className="shrink-0 flex items-center justify-center gap-2 py-3 rounded-xl bg-gray-100 active:scale-[0.98] transition-all"
                      >
                        <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        <span className="text-xs font-bold text-gray-600">{t("fit.youtubeMore")}</span>
                      </button>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Swap Exercise Bottom Sheet (weight picker) */}
        {showSwapMenu && (
          <div className="absolute inset-0 z-40">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={closeSwap} />
            <div className="absolute bottom-2 left-2 right-2 bg-white rounded-[2rem] p-6 animate-slide-up shadow-2xl" style={{ paddingBottom: "calc(var(--safe-area-bottom, 0px) + 16px)" }}>
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em]">{t("fit.swapTitle")}</p>
                <button onClick={closeSwap} className="text-sm text-gray-400 font-bold">{t("fit.close")}</button>
              </div>
              <input
                type="text"
                value={swapSearch}
                onChange={(e) => setSwapSearch(e.target.value)}
                placeholder={t("fit.searchExercise")}
                className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-[13px] text-[#1B4332] font-medium placeholder-gray-300 outline-none focus:border-[#2D6A4F] transition-colors mb-2"
              />
              <div className="flex gap-1.5 overflow-x-auto scrollbar-hide mb-3 pb-0.5">
                <button
                  onClick={() => setSwapFilter(null)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all ${
                    swapFilter === null ? "bg-[#1B4332] text-white" : "bg-gray-100 text-gray-500"
                  }`}
                >{t("fit.recommended")}</button>
                {LABELED_EXERCISE_POOLS.map(p => (
                  <button
                    key={p.label}
                    onClick={() => setSwapFilter(p.label)}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all ${
                      swapFilter === p.label ? "bg-[#1B4332] text-white" : "bg-gray-100 text-gray-500"
                    }`}
                  >{tLabel(p.label, locale)}</button>
                ))}
              </div>
              <div className="h-[30vh] overflow-y-auto space-y-1.5">
                {(() => {
                  const q = swapSearch.replace(/\s/g, "").toLowerCase();
                  const isSearching = q.length > 0;
                  if (swapFilter !== null) {
                    const pool = LABELED_EXERCISE_POOLS.find(p => p.label === swapFilter);
                    if (!pool) return null;
                    const list = pool.exercises
                      .filter(e => e !== exercise.name)
                      .filter(e => !isSearching || e.replace(/\s/g, "").toLowerCase().includes(q));
                    if (list.length === 0) return <p className="text-center text-sm text-gray-400 font-medium py-6">{t("fit.noResults")}</p>;
                    return list.map((alt: string) => (
                      <button key={alt} onClick={() => { onSwapExercise?.(alt); closeSwap(); }}
                        className={`w-full text-left px-4 py-3 rounded-xl bg-white border text-[13px] font-bold active:scale-[0.98] transition-all ${
                          alternatives.includes(alt) ? "border-[#2D6A4F] text-[#1B4332]" : "border-gray-200 text-gray-600"
                        }`}>{alt.split("(")[0].trim()}</button>
                    ));
                  }
                  if (!isSearching) {
                    if (alternatives.length === 0) return <p className="text-center text-sm text-gray-400 font-medium py-6">{t("fit.selectTab")}</p>;
                    return alternatives.map((alt: string) => (
                      <button key={alt} onClick={() => { onSwapExercise?.(alt); closeSwap(); }}
                        className="w-full text-left px-4 py-3 rounded-xl bg-white border border-gray-200 text-[13px] font-bold text-[#1B4332] active:scale-[0.98] transition-all"
                      >{alt.split("(")[0].trim()}</button>
                    ));
                  }
                  return LABELED_EXERCISE_POOLS.map((group) => {
                    const keywordMatch = group.keywords.some((kw: string) => kw.includes(q) || q.includes(kw));
                    const matched = group.exercises.filter((e: string) => e !== exercise.name)
                      .filter((e: string) => keywordMatch || e.replace(/\s/g, "").toLowerCase().includes(q));
                    if (matched.length === 0) return null;
                    return (
                      <div key={group.label}>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] mt-2 mb-1">{tLabel(group.label, locale)}</p>
                        {matched.map((alt: string) => (
                          <button key={alt} onClick={() => { onSwapExercise?.(alt); closeSwap(); }}
                            className={`w-full text-left px-4 py-3 rounded-xl bg-white border text-[13px] font-bold active:scale-[0.98] transition-all mb-1.5 ${
                              alternatives.includes(alt) ? "border-[#2D6A4F] text-[#1B4332]" : "border-gray-200 text-gray-600"
                            }`}>{alt.split("(")[0].trim()}</button>
                        ))}
                      </div>
                    );
                  }).filter(Boolean);
                })()}
              </div>
            </div>
          </div>
        )}

        {/* AI 코칭 채팅창 */}
        {showAiTip && (
          <AiCoachChat
            record={lastSessionRecord?.maxWeight ? lastSessionRecord : null}
            exerciseName={exercise.name}
            gender={(localStorage.getItem("ohunjal_gender") as "male" | "female") || "male"}
            onClose={() => setShowAiTip(false)}
          />
        )}

      </div>
    );
  }

  // Main Active View
  return (
    <div ref={containerRef} className="flex flex-col h-full bg-white animate-fade-in relative">
      {/* Header with Back Button */}
      <div className="pt-[max(2rem,env(safe-area-inset-top))] pb-1 px-6 flex items-center justify-between relative shrink-0">
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

        <div className="absolute inset-x-16 top-0 bottom-0 flex flex-col items-center justify-center pt-[max(2rem,env(safe-area-inset-top))] pb-1 pointer-events-none z-0">
          <span
            className="text-2xl tracking-widest uppercase font-black px-4 py-1 rounded-xl"
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
              {t("fit.skip")}
            </button>
        )}

        {!isTimerMode && <div className="w-10" />}
      </div>

      {/* Main Content — justify-evenly로 3그룹 균등 배치 */}
      <div className="flex-1 flex flex-col items-center justify-evenly px-6 text-center overflow-hidden">
        {/* 그룹1: 운동 이름 + 영상 */}
        <div className="flex flex-col items-center gap-1 shrink-0">
          {(() => {
            const localName = getExerciseName(exercise.name, locale);
            const parts = localName.split('(');
            const mainTitle = parts[0].trim();
            const subTitle = parts.length > 1 ? parts[1].replace(')', '').trim() : "";

            return (
              <>
                <div className="flex items-center gap-2 justify-center">
                  <h1
                    className={`${titleSizeClass} font-black leading-tight break-keep`}
                    style={{ color: THEME.textMain }}
                  >
                    {mainTitle}
                  </h1>
                  {onSwapExercise && (
                    <button
                      onClick={() => setShowSwapMenu(true)}
                      className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400 active:scale-90 transition-all shrink-0"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                  )}
                </div>
                {subTitle && (
                  <p className="text-lg text-gray-400 font-medium font-english tracking-tight">
                    {subTitle}
                  </p>
                )}
                {/* 자세 가이드 미리보기 — 회의 41/43: 모든 러닝 운동(인터벌+연속)에선 숨김 */}
                {!isRunningExercise && (() => {
                  const embedUrl = getVideoEmbedUrl(exercise.name);
                  if (embedUrl) {
                    return (
                      <button onClick={() => setShowVideoGuide(true)} className="mt-1 h-[35dvh] aspect-[9/16] rounded-2xl overflow-hidden bg-black relative shadow-lg active:scale-[0.97] transition-all">
                        <iframe
                          src={embedUrl}
                          className="w-full h-full pointer-events-none scale-[1.15] origin-center"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          tabIndex={-1}
                          title={t("fit.formGuide")}
                        />
                        <div className="absolute inset-0 flex items-end justify-end p-2">
                          <div className="px-2 py-1 rounded-lg bg-black/50 backdrop-blur-sm flex items-center gap-1">
                            <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                            <span className="text-[9px] font-bold text-white">{t("fit.watchFull")}</span>
                          </div>
                        </div>
                      </button>
                    );
                  }
                  return (
                    <button
                      onClick={() => window.open(getYoutubeSearchUrl(exercise.name), "_blank")}
                      className="mt-3 flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gray-50 border border-gray-100 active:scale-[0.97] transition-all"
                    >
                      <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                        <svg className="w-4 h-4 text-red-600" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                        </svg>
                      </div>
                      <span className="text-xs font-bold text-gray-500">{t("fit.formGuide")}</span>
                      <svg className="w-3.5 h-3.5 text-gray-300 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </button>
                  );
                })()}
              </>
            );
          })()}
        </div>

        {/* 그룹2: 타이머/무게+렙 */}
        <div className="flex flex-col items-center gap-2 shrink-0">
          {isTimerMode ? (
             <div className="flex flex-col items-center">
                {timerCompleted && !isDistanceMode ? (
                  <div className="flex flex-col items-center animate-fade-in">
                    <p className="text-5xl font-black text-[#2D6A4F]">{t("fit.complete")}</p>
                    {isIntervalMode && intervalConfig && (
                      <p className="text-sm font-bold text-gray-500 mt-1">{t("fit.roundComplete", { rounds: String(intervalConfig.rounds) })}</p>
                    )}
                  </div>
                ) : isIntervalMode && intervalConfig && intervalColors ? (
                  <div className="flex flex-col items-center w-full">
                    {/* 회의 41: 라운드 도트 프로그레스 */}
                    <div className="flex items-center gap-1.5 mb-3">
                      {Array.from({ length: intervalConfig.rounds }).map((_, i) => {
                        const isDone = i < intervalRound - 1;
                        const isCurrent = i === intervalRound - 1;
                        return (
                          <span
                            key={i}
                            className={`rounded-full transition-all ${
                              isCurrent
                                ? "w-2.5 h-2.5 bg-[#2D6A4F]"
                                : isDone
                                  ? "w-1.5 h-1.5 bg-[#2D6A4F]"
                                  : "w-1.5 h-1.5 bg-gray-200"
                            }`}
                          />
                        );
                      })}
                    </div>
                    <p className="text-xs font-bold text-gray-400 tracking-wider mb-2">
                      ROUND {intervalRound} / {intervalConfig.rounds}
                    </p>
                    {/* 현재 페이즈 (회의 36: 타입별 색상/라벨) */}
                    <div className={`px-4 py-1 rounded-full text-xs font-black tracking-wider mb-2 ${
                      intervalPhase === "sprint"
                        ? `${intervalColors.phase1Bg} ${intervalColors.phase1Text}`
                        : `${intervalColors.phase2Bg} ${intervalColors.phase2Text}`
                    }`}>
                      {intervalPhase === "sprint" ? t(intervalConfig.phase1Key) : t(intervalConfig.phase2Key)}
                    </div>
                    {/* 카운트다운 */}
                    <p className={`text-6xl font-black tracking-tighter tabular-nums ${
                      intervalPhase === "sprint" ? intervalColors.phase1Timer : intervalColors.phase2Timer
                    }`}>
                      {formatTime(intervalTime)}
                    </p>
                    {/* 페이즈 가이드 한 줄 (회의 36: RPE 기반 주관 강도 힌트) */}
                    <p className="text-[11px] font-medium text-gray-500 mt-2 text-center px-4">
                      {intervalPhase === "sprint"
                        ? t(`${intervalConfig.phase1Key}.guide`)
                        : t(`${intervalConfig.phase2Key}.guide`)}
                    </p>

                    {/* 회의 41: NEXT 페이즈 프리뷰 */}
                    <p className="text-[10px] font-bold text-gray-400 tracking-wider mt-3 uppercase">
                      {t("running.phase.next")}
                      {" · "}
                      {intervalPhase === "sprint"
                        ? `${t(intervalConfig.phase2Key)} ${intervalConfig.phase2Sec}s`
                        : (intervalRound >= intervalConfig.rounds
                            ? t("fit.complete")
                            : `${t(intervalConfig.phase1Key)} ${intervalConfig.phase1Sec}s`)}
                    </p>

                    {/* 회의 41: 3분할 실시간 스탯 (Distance / Pace / Time) */}
                    {!isIndoor && gpsPermissionAsked && (
                      <div className="flex items-start justify-center gap-5 mt-5 w-full">
                        <div className="flex flex-col items-center min-w-[60px]">
                          <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em] mb-0.5">
                            {t("running.stats.distance")}
                          </p>
                          <p className="text-xl font-black text-[#1B4332] leading-none tabular-nums">
                            {formatRunDistanceKm(gpsDistance)}
                          </p>
                          <p className="text-[9px] font-bold text-gray-400 mt-0.5">km</p>
                        </div>
                        <div className="w-px h-10 bg-gray-200 mt-2" />
                        <div className="flex flex-col items-center min-w-[60px]">
                          <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em] mb-0.5">
                            {t("running.stats.pace")}
                          </p>
                          <p className="text-xl font-black text-[#1B4332] leading-none tabular-nums">
                            {formatPace(gpsPace)}
                          </p>
                          <p className="text-[9px] font-bold text-gray-400 mt-0.5">/km</p>
                        </div>
                        <div className="w-px h-10 bg-gray-200 mt-2" />
                        <div className="flex flex-col items-center min-w-[60px]">
                          <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em] mb-0.5">
                            {t("running.stats.time")}
                          </p>
                          <p className="text-xl font-black text-[#1B4332] leading-none tabular-nums">
                            {formatTime(intervalElapsedSec)}
                          </p>
                          <p className="text-[9px] font-bold text-gray-400 mt-0.5">elapsed</p>
                        </div>
                      </div>
                    )}

                    {/* GPS 상태 표시 + 자동 일시정지 */}
                    {gpsAutoPaused && (
                      <p className="text-[10px] font-black text-amber-500 mt-2 animate-pulse">
                        {t("running.autoPaused")}
                      </p>
                    )}
                    {!gpsAutoPaused && !isIndoor && gpsPermissionAsked && gpsStatus === "searching" && (
                      <p className="text-[10px] font-bold text-gray-400 mt-2">
                        {t("running.gps.searching")}
                      </p>
                    )}
                    {!isIndoor && gpsPermissionAsked && gpsStatus === "denied" && (
                      <p className="text-[10px] font-bold text-gray-400 mt-2">
                        {t("running.gps.denied")}
                      </p>
                    )}
                  </div>
                ) : isContinuousRun && continuousRunType ? (
                  <div className="flex flex-col items-center w-full">
                    {/* 회의 43: 연속 러닝(템포/이지/LSD) — 인터벌과 3분할 스탯 통일 */}
                    <p className="text-xs font-black text-gray-400 uppercase tracking-[0.15em] mb-3">
                      {getRunningTypeShareLabel(continuousRunType, locale)}
                    </p>
                    {/* 키 짰 경과 타이머 (히어로) */}
                    <p className="text-6xl font-black tracking-tighter tabular-nums text-[#1B4332]">
                      {formatTime(intervalElapsedSec)}
                    </p>
                    {/* 목표 시간 힌트 */}
                    <p className="text-[11px] font-medium text-gray-500 mt-2">
                      {exercise.count}
                    </p>

                    {/* 3분할 실시간 스탯 (DIST/PACE/TIME) */}
                    {!isIndoor && gpsPermissionAsked && (
                      <div className="flex items-start justify-center gap-5 mt-5 w-full">
                        <div className="flex flex-col items-center min-w-[60px]">
                          <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em] mb-0.5">
                            {t("running.stats.distance")}
                          </p>
                          <p className="text-xl font-black text-[#1B4332] leading-none tabular-nums">
                            {formatRunDistanceKm(gpsDistance)}
                          </p>
                          <p className="text-[9px] font-bold text-gray-400 mt-0.5">km</p>
                        </div>
                        <div className="w-px h-10 bg-gray-200 mt-2" />
                        <div className="flex flex-col items-center min-w-[60px]">
                          <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em] mb-0.5">
                            {t("running.stats.pace")}
                          </p>
                          <p className="text-xl font-black text-[#1B4332] leading-none tabular-nums">
                            {formatPace(gpsPace)}
                          </p>
                          <p className="text-[9px] font-bold text-gray-400 mt-0.5">/km</p>
                        </div>
                        <div className="w-px h-10 bg-gray-200 mt-2" />
                        <div className="flex flex-col items-center min-w-[60px]">
                          <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em] mb-0.5">
                            {t("running.stats.time")}
                          </p>
                          <p className="text-xl font-black text-[#1B4332] leading-none tabular-nums">
                            {formatTime(intervalElapsedSec)}
                          </p>
                          <p className="text-[9px] font-bold text-gray-400 mt-0.5">elapsed</p>
                        </div>
                      </div>
                    )}

                    {/* GPS 상태 표시 + 자동 일시정지 */}
                    {gpsAutoPaused && (
                      <p className="text-[10px] font-black text-amber-500 mt-2 animate-pulse">
                        {t("running.autoPaused")}
                      </p>
                    )}
                    {!gpsAutoPaused && !isIndoor && gpsPermissionAsked && gpsStatus === "searching" && (
                      <p className="text-[10px] font-bold text-gray-400 mt-2">
                        {t("running.gps.searching")}
                      </p>
                    )}
                    {!isIndoor && gpsPermissionAsked && gpsStatus === "denied" && (
                      <p className="text-[10px] font-bold text-gray-400 mt-2">
                        {t("running.gps.denied")}
                      </p>
                    )}
                  </div>
                ) : (
                  <>
                    <p className={`${timerSize} font-black tracking-tighter tabular-nums`} style={{ color: timerColor }}>
                      {formatTime(elapsedTime)}
                    </p>
                    <p className="text-base font-bold text-[#2D6A4F] mt-1">
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
              {/* Weight + Reps 한 라인 */}
              <div className="flex items-baseline gap-4 justify-center">
                {hasWeight && (
                  <button
                    onClick={() => setShowWeightEdit(true)}
                    className="flex items-baseline gap-1 active:opacity-60 transition-all"
                  >
                    <span className={`${valueSize} font-black`} style={{ color: THEME.textMain }}>{selectedWeight}</span>
                    <span className={`${unitSize} font-bold text-gray-400`}>kg</span>
                  </button>
                )}
                {!hasWeight && exercise.weight && (
                  <span className={`font-black text-[#2D6A4F] ${isBodyweight ? "text-3xl" : "text-2xl"}`}>
                    {isBodyweight ? t("fit.bodyweight") : translateWeightGuide(setInfo.targetWeight, locale)}
                  </span>
                )}

                <button
                  onClick={() => setShowRepsEdit(true)}
                  className="flex items-baseline gap-1 active:opacity-60 transition-all"
                >
                  <span className={`${valueSize} font-black`} style={{ color: THEME.textMain }}>{adjustedReps}</span>
                  <span className={`${unitSize} font-bold text-gray-400`}>REPS</span>
                </button>
              </div>

              {/* Stopwatch */}
              <div className="flex flex-col items-center mt-1">
                <span className={`${timerSize} font-black tabular-nums tracking-tighter`} style={{ color: timerColor }}>
                  {formatTime(repsStopwatch)}
                </span>
                <button
                  onClick={() => setRepsStopwatch(0)}
                  className={`mt-1 text-[10px] font-bold text-gray-300 uppercase tracking-widest hover:text-gray-500 transition-colors ${
                    repsStopwatch > 0 && !repsStopwatchRunning ? "visible" : "invisible"
                  }`}
                >
                  RESET
                </button>
              </div>
            </>
          )}
        </div>

        {/* 그룹3: CTA (NEXT는 absolute로 공간 미차지) */}
        <div className="relative flex flex-col items-center shrink-0 gap-3 w-full" style={{ paddingBottom: "var(--safe-area-bottom, 0px)" }}>
        {nextExerciseName && setInfo.current === setInfo.total && (
          <div className="absolute -top-8 -right-6 bg-gray-100 rounded-l-xl px-3 py-1.5 max-w-[100px]">
            <p className="text-[7px] font-black text-gray-400 uppercase tracking-[0.2em] text-right">NEXT</p>
            <p className="text-[11px] font-semibold text-gray-600 leading-snug text-right max-w-[150px] truncate">{getExerciseName(nextExerciseName, locale)}</p>
          </div>
        )}
        {isTimerMode ? (
            <div className="flex flex-col items-center justify-center">
                {timerCompleted ? (
                  <button
                    onClick={handleDoneClick}
                    className="w-20 h-20 rounded-full flex flex-col items-center justify-center bg-[#1B4332] text-white shadow-2xl active:scale-95 transition-all animate-pulse"
                  >
                    <svg className="w-7 h-7 mb-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="font-black text-base tracking-wider">{t("fit.done")}</span>
                  </button>
                ) : isRunningExercise ? (
                  // 회의 41/43: 러닝 운동(인터벌+연속)은 재생/일시정지 상태와 무관하게 재생 + 완료 2버튼 고정
                  <div className="flex items-center gap-6">
                    <button
                      onClick={() => {
                        if (isPlaying) {
                          setIsPlaying(false);
                        } else {
                          playAlarmSound("start");
                          setIsPlaying(true);
                        }
                      }}
                      className={`w-20 h-20 rounded-full flex items-center justify-center text-white shadow-xl active:scale-95 transition-all ${
                        isPlaying ? "bg-amber-500" : "bg-[#2D6A4F]"
                      }`}
                    >
                      {isPlaying ? (
                        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                      ) : (
                        <svg className="w-8 h-8 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                      )}
                    </button>
                    <button
                      onClick={handleRunningCompleteClick}
                      className="w-20 h-20 rounded-full flex items-center justify-center bg-[#1B4332] text-white shadow-xl active:scale-95 transition-all"
                    >
                      <span className="font-black text-base tracking-wider">{t("fit.complete")}</span>
                    </button>
                  </div>
                ) : !isPlaying && elapsedTime > 0 ? (
                  <div className="flex items-center gap-6">
                      <button
                        onClick={() => { playAlarmSound("start"); setIsPlaying(true); }}
                        className="w-20 h-20 rounded-full flex items-center justify-center bg-[#2D6A4F] text-white shadow-xl active:scale-95 transition-all"
                      >
                        <svg className="w-8 h-8 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                      </button>
                      <button
                        onClick={handleDoneClick}
                        className="w-20 h-20 rounded-full flex items-center justify-center bg-[#1B4332] text-white shadow-xl active:scale-95 transition-all"
                      >
                        <span className="font-black text-base tracking-wider">{t("fit.complete")}</span>
                      </button>
                  </div>
                ) : !isPlaying && elapsedTime === 0 && !timerCompleted ? (
                  <button
                    onClick={() => { playAlarmSound("start"); setIsPlaying(true); }}
                    className="w-20 h-20 rounded-full flex items-center justify-center bg-[#2D6A4F] text-white shadow-xl active:scale-95 transition-all"
                  >
                      <svg className="w-8 h-8 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                  </button>
                ) : (
                  <div className="flex items-center gap-6">
                      <button
                        onClick={() => setIsPlaying(false)}
                        className="w-20 h-20 rounded-full flex items-center justify-center bg-amber-500 text-white shadow-xl active:scale-95 transition-all"
                      >
                        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                      </button>
                      <button
                        onClick={handleDoneClick}
                        className="w-20 h-20 rounded-full flex items-center justify-center bg-[#1B4332] text-white shadow-xl active:scale-95 transition-all"
                      >
                        <span className="font-black text-base tracking-wider">{t("fit.complete")}</span>
                      </button>
                  </div>
                )}
            </div>
        ) : (
            <div className="flex items-center gap-6">
              <button
                onClick={() => setRepsStopwatchRunning(!repsStopwatchRunning)}
                className={`w-20 h-20 rounded-full flex items-center justify-center shadow-xl active:scale-95 transition-all ${
                  repsStopwatchRunning ? "bg-amber-500" : "bg-[#2D6A4F]"
                }`}
              >
                {repsStopwatchRunning ? (
                  <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                ) : (
                  <svg className="w-8 h-8 ml-1 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                )}
              </button>
              <button
                onClick={handleDoneClick}
                disabled={isDoneAnimating || view === "feedback"}
                className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 active:scale-95 shadow-xl bg-[#2D6A4F] ${
                  isDoneAnimating ? "scale-105" : ""
                }`}
              >
                {isDoneAnimating ? (
                  <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span className="text-white text-base font-black tracking-wider">
                    {t("fit.done")}
                  </span>
                )}
              </button>
            </div>
        )}
      </div>
      </div>


       {/* Success Overlay */}
       {isDoneAnimating && isLastExercise && setInfo.current === setInfo.total && (
        <div className="absolute inset-0 bg-white/95 flex flex-col items-center justify-center z-50 animate-fade-in">
          <p className="text-2xl font-black" style={{ color: THEME.textMain }}>
            {t("fit.youDidIt")}
          </p>
          <p className="text-sm font-bold text-[#2D6A4F] mt-2">
            {(() => {
              const desc = (exercise.name || "").toLowerCase();
              if (/가슴|푸시|chest|push|벤치/.test(desc)) return t("exp.general_fitness.chest");
              if (/등|풀|back|pull|로우|랫/.test(desc)) return t("exp.general_fitness.back");
              if (/하체|레그|스쿼트|leg|squat|런지|데드/.test(desc)) return t("exp.general_fitness.lower");
              if (/코어|복근|core|ab|플랭크/.test(desc)) return t("exp.general_fitness.core");
              if (/러닝|유산소|cardio|run|hiit/.test(desc)) return t("exp.general_fitness.cardio");
              return t("exp.general_fitness.default");
            })()}
          </p>
        </div>
      )}


      {/* Swap Exercise Bottom Sheet (during exercise) */}
      {showSwapMenu && (
        <div className="absolute inset-0 z-40">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={closeSwap} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[2rem] p-6 animate-slide-up shadow-2xl" style={{ paddingBottom: "calc(var(--safe-area-bottom, 0px) + 16px)" }}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em]">{t("fit.swapTitle")}</p>
              <button onClick={closeSwap} className="text-sm text-gray-400 font-bold">{t("fit.close")}</button>
            </div>
            <input
              type="text"
              value={swapSearch}
              onChange={(e) => setSwapSearch(e.target.value)}
              placeholder={t("fit.searchExercise")}
              className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-[13px] text-[#1B4332] font-medium placeholder-gray-300 outline-none focus:border-[#2D6A4F] transition-colors mb-2"
            />
            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide mb-3 pb-0.5">
              <button
                onClick={() => setSwapFilter(null)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all ${
                  swapFilter === null ? "bg-[#1B4332] text-white" : "bg-gray-100 text-gray-500"
                }`}
              >{t("fit.recommended")}</button>
              {LABELED_EXERCISE_POOLS.map(p => (
                <button
                  key={p.label}
                  onClick={() => setSwapFilter(p.label)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all ${
                    swapFilter === p.label ? "bg-[#1B4332] text-white" : "bg-gray-100 text-gray-500"
                  }`}
                >{tLabel(p.label, locale)}</button>
              ))}
            </div>
            <div className="h-[30vh] overflow-y-auto space-y-1.5">
              {(() => {
                const q = swapSearch.replace(/\s/g, "").toLowerCase();
                const isSearching = q.length > 0;
                if (swapFilter !== null) {
                  const pool = LABELED_EXERCISE_POOLS.find(p => p.label === swapFilter);
                  if (!pool) return null;
                  const list = pool.exercises
                    .filter(e => e !== exercise.name)
                    .filter(e => !isSearching || e.replace(/\s/g, "").toLowerCase().includes(q));
                  if (list.length === 0) return <p className="text-center text-sm text-gray-400 font-medium py-6">{t("fit.noResults")}</p>;
                  return list.map((alt: string) => (
                    <button key={alt} onClick={() => { onSwapExercise?.(alt); closeSwap(); }}
                      className={`w-full text-left px-4 py-3 rounded-xl bg-white border text-[13px] font-bold active:scale-[0.98] transition-all ${
                        alternatives.includes(alt) ? "border-[#2D6A4F] text-[#1B4332]" : "border-gray-200 text-gray-600"
                      }`}>{alt.split("(")[0].trim()}</button>
                  ));
                }
                if (!isSearching) {
                  if (alternatives.length === 0) return <p className="text-center text-sm text-gray-400 font-medium py-6">{t("fit.selectTab")}</p>;
                  return alternatives.map((alt: string) => (
                    <button key={alt} onClick={() => { onSwapExercise?.(alt); closeSwap(); }}
                      className="w-full text-left px-4 py-3 rounded-xl bg-white border border-gray-200 text-[13px] font-bold text-[#1B4332] active:scale-[0.98] transition-all"
                    >{alt.split("(")[0].trim()}</button>
                  ));
                }
                return LABELED_EXERCISE_POOLS.map((group) => {
                  const keywordMatch = group.keywords.some((kw: string) => kw.includes(q) || q.includes(kw));
                  const matched = group.exercises.filter((e: string) => e !== exercise.name)
                    .filter((e: string) => keywordMatch || e.replace(/\s/g, "").toLowerCase().includes(q));
                  if (matched.length === 0) return null;
                  return (
                    <div key={group.label}>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] mt-2 mb-1">{tLabel(group.label, locale)}</p>
                      {matched.map((alt: string) => (
                        <button key={alt} onClick={() => { onSwapExercise?.(alt); closeSwap(); }}
                          className={`w-full text-left px-4 py-3 rounded-xl bg-white border text-[13px] font-bold active:scale-[0.98] transition-all mb-1.5 ${
                            alternatives.includes(alt) ? "border-[#2D6A4F] text-[#1B4332]" : "border-gray-200 text-gray-600"
                          }`}>{alt.split("(")[0].trim()}</button>
                      ))}
                    </div>
                  );
                }).filter(Boolean);
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Weight Edit Bottom Sheet */}
      {showWeightEdit && (
        <div className="absolute inset-0 z-40">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setShowWeightEdit(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[2rem] p-6 animate-slide-up shadow-2xl" style={{ paddingBottom: "calc(var(--safe-area-bottom, 0px) + 16px)" }}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-6" />
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-center mb-4">{t("fit.changeWeight")}</p>
            <div className="flex items-center justify-center gap-4 mb-6">
              <button
                onPointerDown={() => startLongPress("down")}
                onPointerUp={() => stopLongPress()}
                onPointerLeave={() => cancelLongPress()}
                className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-xl active:scale-95 shrink-0"
              >
                -
              </button>
              <div className="w-40 flex items-baseline justify-center">
                <span className="text-5xl font-black text-[#1B4332] tabular-nums">{selectedWeight}</span>
                <span className="text-lg text-gray-400 ml-1">kg</span>
              </div>
              <button
                onPointerDown={() => startLongPress("up")}
                onPointerUp={() => stopLongPress()}
                onPointerLeave={() => cancelLongPress()}
                className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-xl active:scale-95 shrink-0"
              >
                +
              </button>
            </div>
            <div className="flex items-center justify-center gap-2 overflow-x-auto scrollbar-hide py-1 -mx-6 px-6 mb-6">
              {weightPresets.map((w) => (
                <button
                  key={w}
                  onClick={() => setSelectedWeight(w)}
                  className="px-4 py-2 rounded-xl text-sm font-bold bg-gray-100 text-gray-600 transition-all duration-200 active:scale-95 shrink-0"
                >
                  {w}kg
                </button>
              ))}
            </div>
            <button
              onClick={confirmWeight}
              className="w-full py-3.5 rounded-2xl bg-[#1B4332] text-white font-bold text-base active:scale-[0.98] transition-all"
            >
              {t("fit.confirm")}
            </button>
          </div>
        </div>
      )}

      {/* Reps Edit Bottom Sheet */}
      {showRepsEdit && (
        <div className="absolute inset-0 z-40">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setShowRepsEdit(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[2rem] p-6 animate-slide-up shadow-2xl" style={{ paddingBottom: "calc(var(--safe-area-bottom, 0px) + 16px)" }}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-6" />
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-center mb-4">{t("fit.changeReps")}</p>
            <div className="flex items-center justify-center gap-4 mb-6">
              <button
                onClick={() => setAdjustedReps(Math.max(1, adjustedReps - 1))}
                className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-xl active:scale-95"
              >
                -
              </button>
              <span className="text-5xl font-black text-[#1B4332] tabular-nums">{adjustedReps}<span className="text-lg text-gray-400 ml-1">{t("fit.repsUnit")}</span></span>
              <button
                onClick={() => setAdjustedReps(adjustedReps + 1)}
                className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-xl active:scale-95"
              >
                +
              </button>
            </div>
            <div className="flex gap-2 flex-wrap justify-center mb-6">
              {(() => {
                const isHighRep = exercise.type === "core" || setInfo.targetReps >= 15 || !hasWeight;
                const pool = isHighRep
                  ? [5, 8, 10, 15, 20, 30, 40, 50, 60, 80, 100]
                  : [3, 5, 8, 10, 12, 15, 20];
                const target = adjustedReps;
                const sorted = [...pool].sort((a, b) => Math.abs(a - target) - Math.abs(b - target));
                return sorted.slice(0, 4).sort((a, b) => a - b);
              })().map((r) => (
                <button
                  key={r}
                  onClick={() => setAdjustedReps(r)}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                    adjustedReps === r ? "bg-[#1B4332] text-white" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {r}{locale === "ko" ? "회" : ""}
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
              {t("fit.confirm")}
            </button>
          </div>
        </div>
      )}


      {/* Video Guide Bottom Sheet */}
      {showVideoGuide && (
        <div className="absolute inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowVideoGuide(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[2rem] animate-slide-up shadow-2xl flex flex-col" style={{ height: "78vh", paddingBottom: "calc(var(--safe-area-bottom, 0px) + 16px)" }}>
            <div className="shrink-0 pt-4 px-6">
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-red-600" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                  </svg>
                  <p className="text-sm font-black text-[#1B4332]">{t("fit.formGuideTitle", { name: getExerciseName(exercise.name, locale) })}</p>
                </div>
                <button onClick={() => setShowVideoGuide(false)} className="text-sm text-gray-400 font-bold active:scale-95 transition-all">{t("fit.close")}</button>
              </div>
            </div>
            <div className="flex-1 px-4 pb-4 min-h-0">
              {(() => {
                const embedUrl = getVideoEmbedUrl(exercise.name);
                if (embedUrl) {
                  // 매핑된 쇼츠 영상 — 직접 embed
                  return (
                    <iframe
                      src={embedUrl}
                      className="w-full h-full rounded-2xl bg-black"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      title={`${t("fit.formGuideTitle", { name: getExerciseName(exercise.name, locale) })}`}
                    />
                  );
                }
                // 폴백: 유튜브 검색 결과
                return (
                  <div className="w-full h-full flex flex-col gap-3">
                    <iframe
                      src={getYoutubeSearchUrl(exercise.name)}
                      className="w-full flex-1 rounded-2xl bg-gray-50 border border-gray-100"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      title={`${getExerciseName(exercise.name, locale)} search`}
                    />
                    <button
                      onClick={() => window.open(getYoutubeSearchUrl(exercise.name), "_blank")}
                      className="shrink-0 flex items-center justify-center gap-2 py-3 rounded-xl bg-gray-100 active:scale-[0.98] transition-all"
                    >
                      <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      <span className="text-xs font-bold text-gray-600">{t("fit.youtubeMore")}</span>
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Feedback + Rest Bottom Sheet */}
      {view === "feedback" && (() => {
        const isLastSetInExercise = setInfo.current === setInfo.total;
        const hasSelection = selectedFeedback !== null;
        return (
        <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          {/* 백드롭 클릭: 피드백 미선택 시에만 닫힘 (선택 후엔 '다시 선택' 링크로 복귀) */}
          {!hasSelection && <div className="absolute inset-0" onClick={() => { setView("active"); setLocalRestSec(0); }} />}

          <div className="w-full rounded-t-[2.5rem] shadow-[0_-10px_40px_rgba(0,0,0,0.2)] animate-slide-up flex flex-col relative z-10 bg-white px-4 sm:px-6 pt-6" style={{ paddingBottom: "calc(var(--safe-area-bottom, 0px) + 24px)" }}>
            <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mb-4" />

            {/* 1. 마지막 세트: 다음 운동 미리보기 (맨 위) */}
            {nextExerciseName && isLastSetInExercise && (
              <div className="mb-3 bg-gray-100 rounded-xl px-4 py-2.5 flex items-center gap-2">
                <p className="text-[7px] font-black text-gray-400 uppercase tracking-[0.2em] shrink-0">NEXT</p>
                <p className="text-[13px] font-semibold text-gray-600 truncate">{getExerciseName(nextExerciseName, locale)}</p>
              </div>
            )}

            {/* 2. 세트 진행 카드 — 한 줄 가운데 정렬 (wrap 방지) */}
            <div className="mb-3 bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-3.5 text-center">
              <p className="text-lg font-black text-[#1B4332] tracking-tight whitespace-nowrap">
                {setInfo.current >= setInfo.total
                  ? t("fit.lastSetNext")
                  : setInfo.current >= setInfo.total - 1
                    ? t("fit.setComplete.last", { current: String(setInfo.current), total: String(setInfo.total) })
                    : t("fit.setComplete.remaining", { current: String(setInfo.current), total: String(setInfo.total), remaining: String(setInfo.total - setInfo.current) })}
              </p>
            </div>

            {/* 3. REST 카드 — 한 줄 레이아웃 (REST · -15s · 타이머 · +15s · 휴식 종료) */}
            <div className="mb-4 bg-[#1B4332] rounded-2xl px-3 py-3">
              <div className="flex items-center gap-1.5">
                <p className="text-[10px] font-bold text-emerald-300/70 uppercase tracking-wider shrink-0 pl-1">REST</p>
                <button
                  onClick={handleRestMinus15}
                  disabled={localRestSec <= 0}
                  className="w-9 h-9 rounded-full bg-white/10 text-white text-[10px] font-bold shrink-0 active:scale-95 transition-all disabled:opacity-30"
                >
                  {t("fit.minus15sec")}
                </button>
                <div className="min-w-[52px] text-center text-2xl font-black text-white tracking-tighter tabular-nums shrink-0">
                  {localRestSec}s
                </div>
                <button
                  onClick={handleRestPlus15}
                  className="w-9 h-9 rounded-full bg-white/10 text-white text-[10px] font-bold shrink-0 active:scale-95 transition-all"
                >
                  {t("fit.plus15sec")}
                </button>
                <button
                  onClick={handleEndRest}
                  disabled={!hasSelection}
                  className={`flex-1 py-2.5 rounded-xl font-bold text-xs tracking-wide transition-all ml-0.5 ${
                    hasSelection
                      ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/30 hover:bg-emerald-400 active:scale-[0.98] animate-pulse"
                      : "bg-white/10 text-white/40 cursor-not-allowed"
                  }`}
                >
                  {hasSelection ? `${t("fit.endRest")} →` : t("fit.endRestDisabled")}
                </button>
              </div>
            </div>

            {/* 4. 피드백 영역: 선택 전엔 3옵션, 선택 후엔 '다시 선택' 링크 */}
            {!hasSelection ? (
              <>
                <div className="text-center mb-3">
                  <h2 className="text-lg font-black tracking-tight" style={{ color: THEME.textMain }}>
                    {t("fit.howWasSet")}
                  </h2>
                </div>

                <div className="flex flex-col gap-2.5">
                  {/* Option: EASY */}
                  <div className="w-full p-4 rounded-2xl text-white shadow-lg overflow-hidden bg-[#1B4332]">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col items-start">
                        <span className="font-bold text-base">{t("fit.couldDoMore", { count: String(easyExtraReps) })}</span>
                        <span className="text-[10px] text-emerald-300 font-medium tracking-wide">{t("fit.couldDoMoreSub")} ▲</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center bg-[#2D6A4F]/50 rounded-lg px-1.5">
                          <button onClick={() => setEasyExtraReps(Math.max(1, easyExtraReps - 1))} className="w-7 h-7 flex items-center justify-center text-emerald-200 font-bold">-</button>
                          <input type="number" value={easyExtraReps} onChange={(e) => setEasyExtraReps(Math.max(1, Number(e.target.value)))} className="w-10 text-center bg-transparent font-bold text-base outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-white" />
                          <button onClick={() => setEasyExtraReps(easyExtraReps + 1)} className="w-7 h-7 flex items-center justify-center text-emerald-200 font-bold">+</button>
                        </div>
                        <button onClick={() => handleSelectFeedback(easyExtraReps > 5 ? "too_easy" : "easy", adjustedReps + easyExtraReps)} className="bg-emerald-400 text-white w-9 h-9 rounded-xl flex items-center justify-center font-bold shadow-sm active:scale-95 transition-all">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Option: TARGET */}
                  <button onClick={() => handleSelectFeedback("target", adjustedReps)} className="w-full p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-100 active:scale-[0.98] transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col items-start">
                        <span className="font-bold text-base text-[#1B4332]">{t("fit.justRight")}</span>
                        <span className="text-[10px] font-bold tracking-wide text-[#2D6A4F]/70">{t("fit.justRightSub")}</span>
                      </div>
                      <svg className="w-5 h-5 text-[#2D6A4F]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </button>

                  {/* Option: FAIL */}
                  <div className="w-full p-4 rounded-2xl bg-red-50 border-2 border-red-100 flex items-center justify-between">
                    <div className="flex flex-col items-start shrink-0">
                      <span className="font-bold text-base text-red-500">{t("fit.failedHere")}</span>
                      <span className="text-[10px] text-red-300 font-bold tracking-wide">{t("fit.failedReps")}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center bg-red-100/60 rounded-lg px-1.5">
                        <button onClick={() => setFailedReps(Math.max(0, failedReps - 1))} className="w-7 h-7 flex items-center justify-center text-red-400 font-bold">-</button>
                        <input type="number" value={failedReps} onChange={(e) => setFailedReps(Math.min(adjustedReps - 1, Math.max(0, Number(e.target.value))))} className="w-10 text-center bg-transparent font-bold text-base outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-red-600" />
                        <button onClick={() => setFailedReps(Math.min(adjustedReps - 1, failedReps + 1))} className="w-7 h-7 flex items-center justify-center text-red-400 font-bold">+</button>
                      </div>
                      <button onClick={() => handleSelectFeedback("fail", failedReps)} className="bg-red-500 text-white w-9 h-9 rounded-xl flex items-center justify-center font-bold shadow-sm active:scale-95 transition-all">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              /* 선택 완료 후: 다시 선택 링크 */
              <button
                onClick={() => setSelectedFeedback(null)}
                className="w-full py-2 text-center active:scale-[0.98] transition-all"
              >
                <span className="text-[12px] font-bold text-[#2D6A4F]/70">
                  ← {t("fit.reselectFeedback")}
                </span>
              </button>
            )}

            {/* 5. 마지막 세트: 1세트 추가 버튼 (항상 노출, 선택 전후 모두) */}
            {isLastSetInExercise && onAddSet && (
              <button
                onClick={() => { onAddSet(); setView("active"); setLocalRestSec(0); setSelectedFeedback(null); }}
                className="w-full mt-3 py-3 rounded-2xl border-2 border-dashed border-gray-200 text-center active:scale-[0.98] transition-all"
              >
                <span className="text-sm font-bold text-gray-500">{t("fit.addOneSet")}</span>
              </button>
            )}
          </div>
        </div>
        );
      })()}

      {/* 회의 41: GPS 권한 중앙 팝업 (인터벌 러닝 첫 진입 시 1회) */}
      <GpsPermissionDialog
        open={permissionDialogOpen}
        onAllow={handleGpsAllow}
        onLater={handleGpsLater}
      />

      {/* 회의 43 후속: 러닝 조기 종료 확인 모달 */}
      {runCompleteConfirmOpen && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 animate-fade-in"
          style={{ padding: "env(safe-area-inset-top, 0px) 16px env(safe-area-inset-bottom, 0px) 16px" }}
          onClick={() => setRunCompleteConfirmOpen(false)}
        >
          <div
            className="w-80 max-w-[calc(100vw-48px)] bg-white rounded-3xl shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 pt-6 pb-5 text-center">
              <h2 className="text-base font-black text-[#1B4332] mb-2">
                {t("running.complete.confirm.title")}
              </h2>
              <p className="text-[13px] text-gray-500 leading-relaxed">
                {isIntervalMode && intervalConfig
                  ? t("running.complete.confirm.descInterval", {
                      current: String(intervalRound),
                      total: String(intervalConfig.rounds),
                    })
                  : t("running.complete.confirm.descContinuous")}
              </p>
            </div>
            <div className="flex border-t border-gray-100">
              <button
                onClick={() => setRunCompleteConfirmOpen(false)}
                className="flex-1 py-4 text-sm font-bold text-gray-500 active:bg-gray-50 transition-colors"
              >
                {t("running.complete.confirm.cancel")}
              </button>
              <div className="w-px bg-gray-100" />
              <button
                onClick={() => {
                  setRunCompleteConfirmOpen(false);
                  handleDoneClick();
                }}
                className="flex-1 py-4 text-sm font-black text-[#2D6A4F] active:bg-emerald-50 transition-colors"
              >
                {t("running.complete.confirm.proceed")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
