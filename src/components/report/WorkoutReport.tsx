"use client";

import React, { useEffect, useRef, useState } from "react";
import { WorkoutSessionData, ExerciseLog, WorkoutAnalysis, WorkoutHistory, RunningStats } from "@/constants/workout";
import { RunningReportBody } from "@/components/report/RunningReportBody";
import { detectRunningType } from "@/utils/runningFormat";
import { buildWorkoutMetrics, estimateTrainingLevel, getOptimalLoadBand, getBig4FromHistory, classifySessionIntensity, getIntensityRecommendation, getWeeklyIntensityTarget } from "@/utils/workoutMetrics";
import { ShareCard } from "./ShareCard";
import { loadRecentHistory as loadRecentHistoryFromStore, updateCoachMessages, getCachedWorkoutHistory, updateReportTabs } from "@/utils/workoutHistory";
import { getTrialStatus } from "@/utils/trialStatus";
import { getPlanCount } from "@/utils/userProfile";
import { detectPersona } from "@/utils/personaSystem";
import { type ExpLogEntry, sumExp, getOrRebuildSeasonExp } from "@/utils/questSystem";
import { calcSessionCalories } from "@/utils/predictionUtils";
import { trackEvent } from "@/utils/analytics";
import { useTranslation } from "@/hooks/useTranslation";
import { useUnits } from "@/hooks/useUnits";
import { kgToLb } from "@/utils/units";
import { getExerciseName } from "@/utils/exerciseName";

import { ExpTierCard, type RpgInsight } from "./ExpTierCard";
import { RpgResultCard, type HeroData, type HeroType } from "./RpgResultCard";
import { ReportHelpModal } from "./ReportHelpModal";
import { translateDesc } from "./reportUtils";

import { StatusTab } from "./tabs/StatusTab";
import { TodayTab } from "./tabs/TodayTab";
import { NextTab } from "./tabs/NextTab";
import { NutritionTab } from "./tabs/NutritionTab";

type ReportTabId = "status" | "today" | "next" | "nutrition";

/** 시간대 맥락 메시지 키 반환 */
function getTimeContextKey(): string {
  const h = new Date().getHours();
  if (h >= 0 && h < 5) return "report.hero.time.night";
  if (h >= 5 && h < 8) return "report.hero.time.dawn";
  if (h >= 8 && h < 11) return "report.hero.time.morning";
  if (h >= 11 && h < 12) return "report.hero.time.preLunch";
  if (h >= 12 && h < 14) return "report.hero.time.lunch";
  if (h >= 14 && h < 18) return "report.hero.time.afternoon";
  if (h >= 18 && h < 22) return "report.hero.time.evening";
  return "report.hero.time.night";
}

/** 마이크로 PR 감지 */
function detectMicroPR(
  exercises: WorkoutSessionData["exercises"],
  logs: Record<number, ExerciseLog[]>,
  history: WorkoutHistory[],
  t: (key: string, vars?: Record<string, string>) => string,
  locale: string,
  toDispW: (kg: number) => number,
  U: string,
): HeroData | null {
  const historyBest: Record<string, { maxWeight: number; maxRepsAtWeight: Record<number, number>; maxVolume: number; count: number }> = {};
  for (const h of history) {
    if (!h.logs) continue;
    for (const ex of h.sessionData.exercises) {
      const exIdx = h.sessionData.exercises.indexOf(ex);
      const exLogs = h.logs[exIdx];
      if (!exLogs || exLogs.length === 0) continue;
      const name = ex.name;
      if (!historyBest[name]) historyBest[name] = { maxWeight: 0, maxRepsAtWeight: {}, maxVolume: 0, count: 0 };
      historyBest[name].count++;
      let exVol = 0;
      for (const l of exLogs) {
        const w = parseFloat(l.weightUsed || "0");
        if (w > historyBest[name].maxWeight) historyBest[name].maxWeight = w;
        if (w > 0) {
          const prevMax = historyBest[name].maxRepsAtWeight[w] || 0;
          if (l.repsCompleted > prevMax) historyBest[name].maxRepsAtWeight[w] = l.repsCompleted;
        }
        exVol += (w || 0) * l.repsCompleted;
      }
      if (exVol > historyBest[name].maxVolume) historyBest[name].maxVolume = exVol;
    }
  }
  for (let i = 0; i < exercises.length; i++) {
    const ex = exercises[i]; const exLogs = logs[i];
    if (!exLogs || exLogs.length === 0) continue;
    const best = historyBest[ex.name];
    if (!best || best.count < 1) continue;
    for (const l of exLogs) {
      const w = parseFloat(l.weightUsed || "0");
      if (w > 0 && w > best.maxWeight && best.maxWeight > 0) {
        const displayName = getExerciseName(ex.name, locale).split("(")[0].trim();
        return { type: "weightPR", label: t("report.hero.pr"), isDark: true, bigNumber: `${toDispW(best.maxWeight)} → ${toDispW(w)} ${U}`, subText: displayName, exerciseName: ex.name, exerciseType: ex.type, vars: { name: displayName, weight: String(toDispW(w)), prev: String(toDispW(best.maxWeight)) } };
      }
    }
  }
  for (let i = 0; i < exercises.length; i++) {
    const ex = exercises[i]; const exLogs = logs[i];
    if (!exLogs || exLogs.length === 0) continue;
    const best = historyBest[ex.name];
    if (!best || best.count < 1) continue;
    for (const l of exLogs) {
      const w = parseFloat(l.weightUsed || "0");
      if (w > 0 && best.maxRepsAtWeight[w] && l.repsCompleted > best.maxRepsAtWeight[w]) {
        const displayName = getExerciseName(ex.name, locale).split("(")[0].trim();
        const diff = l.repsCompleted - best.maxRepsAtWeight[w];
        return { type: "repsPR", label: t("report.hero.pr"), isDark: true, bigNumber: `${best.maxRepsAtWeight[w]} → ${l.repsCompleted}`, subText: `${displayName} · ${toDispW(w)}${U}`, exerciseName: ex.name, exerciseType: ex.type, vars: { name: displayName, diff: String(diff), prev: String(best.maxRepsAtWeight[w]), current: String(l.repsCompleted) } };
      }
    }
  }
  for (let i = 0; i < exercises.length; i++) {
    const ex = exercises[i]; const exLogs = logs[i];
    if (!exLogs || exLogs.length === 0) continue;
    const best = historyBest[ex.name];
    if (!best || best.count < 1) continue;
    let todayVol = 0;
    for (const l of exLogs) todayVol += (parseFloat(l.weightUsed || "0") || 0) * l.repsCompleted;
    if (todayVol > best.maxVolume && best.maxVolume > 0) {
      const displayName = getExerciseName(ex.name, locale).split("(")[0].trim();
      return { type: "volumePR", label: t("report.hero.sessionRecord"), isDark: true, bigNumber: `${Math.round(toDispW(best.maxVolume)).toLocaleString()} → ${Math.round(toDispW(todayVol)).toLocaleString()} ${U}`, subText: displayName, exerciseName: ex.name, exerciseType: ex.type, vars: { name: displayName } };
    }
  }
  return null;
}




interface WorkoutReportProps {
  sessionData: WorkoutSessionData;
  logs?: Record<number, ExerciseLog[]>;
  bodyWeightKg?: number;
  gender?: "male" | "female";
  birthYear?: number;
  sessionDate?: string; // ISO date string — for past sessions from history
  savedDurationSec?: number; // actual elapsed time saved in history
  initialAnalysis?: WorkoutAnalysis | null;
  onClose: () => void;
  onRestart?: () => void;
  onDelete?: () => void;
  onShowPrediction?: () => void;
  onAnalysisComplete?: (analysis: WorkoutAnalysis) => void;
  precomputedExpGained?: ExpLogEntry[];
  precomputedPrevExp?: number;
  savedCoachMessages?: string[];
  runningStats?: RunningStats;  // 회의 41: 러닝 세션 전용
  isPremium?: boolean;  // 회의 37: 유료 회원 여부 (영양 채팅 무제한)
  /** 히스토리에서 열 때 저장된 4탭 데이터 */
  savedReportTabs?: WorkoutHistory["reportTabs"];
  /** 4탭 데이터 저장 콜백 */
  onReportTabsSaved?: (tabs: NonNullable<WorkoutHistory["reportTabs"]>) => void;
}

// Sync load of recent history from localStorage (initial render), then async update from Firestore
// (회의 52: 유틸 경유)
function getRecentHistorySync(): WorkoutHistory[] {
  const all = getCachedWorkoutHistory();
  const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
  return all.filter(h => new Date(h.date).getTime() > cutoff);
}

function get28dAvgVolume(history: WorkoutHistory[]): { avgVolume28d: number; sessionCount: number } | null {
  if (history.length === 0) return null;
  const totalVol = history.reduce((s, h) => s + (h.stats.totalVolume || 0), 0);
  return { avgVolume28d: totalVol / history.length, sessionCount: history.length };
}

export const WorkoutReport: React.FC<WorkoutReportProps> = ({
  sessionData,
  logs = {},
  bodyWeightKg,
  gender,
  birthYear,
  sessionDate,
  savedDurationSec,
  initialAnalysis = null,
  onClose,
  onRestart,
  onDelete,
  onShowPrediction,
  onAnalysisComplete,
  precomputedExpGained,
  precomputedPrevExp,
  savedCoachMessages: propCoachMessages,
  runningStats,
  isPremium,
  savedReportTabs,
  onReportTabsSaved,
}) => {
  const analysis = initialAnalysis;
  const [showLogs, setShowLogs] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [closeAfterShare, setCloseAfterShare] = useState(false);
  const [helpCard, setHelpCard] = useState<string | null>(null);
  const [activeDot, setActiveDot] = useState<string | null>(null);
  const [e1rmIndex, setE1rmIndex] = useState(0);
  const [recentHistory, setRecentHistory] = useState<WorkoutHistory[]>(getRecentHistorySync);
  const [activeReportTab, setActiveReportTab] = useState<ReportTabId>("status");
  // 영양 가이드 캐시 (탭 전환 시 리셋 방지)
  const [cachedNutritionGuide, setCachedNutritionGuide] = useState<unknown>(null);
  const [cachedChatHistory, setCachedChatHistory] = useState<{ role: "user" | "assistant"; content: string }[]>([]);

  const { t, locale } = useTranslation();
  const { system: unitSystem, labels: unitLabels } = useUnits();
  const U = unitLabels.weight;
  const toDispW = (kg: number) => unitSystem === "imperial" ? Math.round(kgToLb(kg) * 10) / 10 : kg;

  // 리포트 열리자마자 reportTabs 저장 (영양 제외 — 영양은 Gemini 응답 후 별도 업데이트)
  useEffect(() => {
    if (sessionDate || !onReportTabsSaved) return; // 히스토리 뷰면 저장 안 함
    try {
      const fp = JSON.parse(localStorage.getItem("ohunjal_fitness_profile") || "{}");
      const m = buildWorkoutMetrics(sessionData.exercises, logs, bodyWeightKg, savedDurationSec);
      const userGoal = fp.goal || "health";
      let volChange: number | null = null;
      // 최신 localStorage에서 직접 읽기 (Firestore 동기화 전 stale state 방지)
      const hist = getRecentHistorySync();
      if ((m.sessionCategory === "strength" || m.sessionCategory === "mixed") && m.totalVolume > 0 && hist.length > 0) {
        const cid = sessionData.exercises.map(e => e.name).join(",");
        // 같은 카테고리(strength/mixed) 세션 중 현재 세션 제외
        const prev = hist.filter(h => {
          const hId = h.sessionData.exercises.map((e: {name:string}) => e.name).join(",");
          if (hId === cid && h.stats.totalVolume === m.totalVolume) return false;
          const hVol = h.stats?.totalVolume || 0;
          return hVol > 0; // 볼륨 있는 strength/mixed 세션만
        });
        const last = prev[prev.length - 1];
        if (last?.stats?.totalVolume) volChange = Math.round(((m.totalVolume - last.stats.totalVolume) / last.stats.totalVolume) * 100);
      }
      // 회의 55: 레거시 단순 공식 → calcSessionCalories 통일 (EPOC + 볼륨 강도 + 활동시간)
      const bw = bodyWeightKg ?? 70;
      const calBurned = calcSessionCalories({
        sessionData, logs,
        stats: { totalVolume: m.totalVolume, totalSets: metrics.totalSets, totalReps: metrics.totalReps, totalDurationSec: savedDurationSec || m.totalDurationSec || 2700 },
        date: "", id: "",
      } as WorkoutHistory, bw);
      const recoveryH = m.fatigueDrop === null ? "24" : m.fatigueDrop >= 0 ? "12" : m.fatigueDrop > -15 ? "24" : m.fatigueDrop > -25 ? "48" : "48~72";
      // 퀘스트 진행률 계산
      let questProgress: NonNullable<WorkoutHistory["reportTabs"]>["next"]["questProgress"];
      try {
        const target = getWeeklyIntensityTarget(birthYear, gender);
        const now = new Date();
        const dow = now.getDay();
        const monOff = dow === 0 ? -6 : 1 - dow;
        const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + monOff);
        mon.setHours(0, 0, 0, 0);
        let hi = 0, md = 0, lo = 0;
        for (const h of hist) {
          if (new Date(h.date) < mon) continue;
          if (!h.logs || !h.sessionData?.exercises) continue;
          const lvl = classifySessionIntensity(h.sessionData.exercises, h.logs).level;
          if (lvl === "high") hi++; else if (lvl === "moderate") md++; else lo++;
        }
        const todayLvl = classifySessionIntensity(sessionData.exercises, logs).level;
        if (todayLvl === "high") hi++; else if (todayLvl === "moderate") md++; else lo++;
        questProgress = { high: { done: hi, target: target.high }, moderate: { done: md, target: target.moderate }, low: { done: lo, target: target.low }, total: { done: hi + md + lo, target: target.total } };
      } catch {}

      onReportTabsSaved({
        goal: userGoal,
        status: { percentiles: [], overallRank: 0, fitnessAge: 0, ageGroupLabel: "", genderLabel: "" },
        today: { volumeChangePercent: volChange, caloriesBurned: calBurned, foodAnalogy: "", recoveryHours: recoveryH, stimulusMessage: "" },
        next: { message: "", recommendedPart: "", recommendedIntensity: "", questProgress },
        nutrition: null,
      });

      // 영양 가이드 백그라운드 프리로드 (유저가 영양 탭 안 열어도 저장)
      (async () => {
        try {
          const { getAuth } = await import("firebase/auth");
          const user = getAuth().currentUser;
          if (!user) return;
          const token = await user.getIdToken();
          const durationMin = Math.round(m.totalDurationSec / 60);
          const userAge = birthYear ? new Date().getFullYear() - birthYear : 30;
          const res = await fetch("/api/getNutritionGuide", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              locale, bodyWeightKg: bw, heightCm: fp.height, age: userAge,
              gender: gender ?? "male", goal: userGoal, weeklyFrequency: fp.weeklyFrequency || 3,
              todaySession: { type: m.sessionCategory, durationMin, estimatedCalories: calBurned },
            }),
          });
          const nutritionData = await res.json();
          setCachedNutritionGuide(nutritionData);
          // Firestore 업데이트 (회의 52: 유틸 경유, 중복 localStorage write 제거)
          const history = getCachedWorkoutHistory();
          const lastEntry = history[history.length - 1];
          if (lastEntry?.reportTabs) {
            lastEntry.reportTabs.nutrition = nutritionData;
            updateReportTabs(lastEntry.id, lastEntry.reportTabs);
          }
        } catch {}
      })();
    } catch {}
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const metrics = buildWorkoutMetrics(sessionData.exercises, logs, bodyWeightKg, savedDurationSec);
  const { sessionCategory, totalVolume, bestE1RM, allE1RMs, successRate, fatigueDrop, loadScore, totalDurationSec } = metrics;
  const reportTrackedRef = useRef(false);
  useEffect(() => {
    if (reportTrackedRef.current) return;
    reportTrackedRef.current = true;
    trackEvent("report_view", {
      total_volume: Math.round(totalVolume || 0),
      has_pr: !!bestE1RM && (bestE1RM.value || 0) > 0,
      session_category: sessionCategory,
    });
  }, [totalVolume, bestE1RM, sessionCategory]);
  const isStrengthSession = sessionCategory === "strength" || sessionCategory === "mixed";

  // Merge today's big-4 e1RMs with history (today takes priority)
  const big4Combined = (() => {
    const historyBig4 = getBig4FromHistory(recentHistory);
    const merged = new Map<string, { exerciseName: string; value: number; fromToday: boolean; decayed: boolean; weeksAgo: number }>();
    // History first (lower priority)
    for (const h of historyBig4) {
      merged.set(h.exerciseName, { ...h, fromToday: false });
    }
    // Today overwrites
    for (const t of allE1RMs) {
      merged.set(t.exerciseName, { exerciseName: t.exerciseName, value: t.value, fromToday: true, decayed: false, weeksAgo: 0 });
    }
    return Array.from(merged.values()).sort((a, b) => b.value - a.value);
  })();

  const formatDuration = (sec: number) => {
    if (sec >= 3600) return t("report.formatDuration.hm", { h: String(Math.floor(sec / 3600)), m: String(Math.floor((sec % 3600) / 60)) });
    if (sec >= 60) {
      const s = sec % 60;
      return s > 0
        ? t("report.formatDuration.ms", { m: String(Math.floor(sec / 60)), s: String(s) })
        : t("report.formatDuration.mOnly", { m: String(Math.floor(sec / 60)) });
    }
    return t("report.formatDuration.sOnly", { s: String(sec) });
  };

  const historyStats = get28dAvgVolume(recentHistory);

  // Training level estimation from history (근거: NSCA, Rippetoe 2006)
  const trainingLevel = estimateTrainingLevel(recentHistory, bodyWeightKg, gender);

  // Session intensity classification (ACSM 2009 + NSCA)
  const sessionIntensity = classifySessionIntensity(sessionData.exercises, logs);
  const intensityRec = getIntensityRecommendation(recentHistory, birthYear, gender);

  // Load recent history from Firestore (async update after initial sync render)
  useEffect(() => {
    loadRecentHistoryFromStore().then(setRecentHistory).catch(() => {});
  }, []);


  // Build graph data from history (last 28 days load scores)
  const bwForCalc = bodyWeightKg ?? 70;
  const graphData = recentHistory.map(h => ({
    date: new Date(h.date),
    loadScore: h.stats.totalVolume && bodyWeightKg ? Math.round((h.stats.totalVolume / bodyWeightKg) * 10) / 10 : h.stats.totalVolume,
    volume: h.stats.totalVolume,
    calories: calcSessionCalories(h, bwForCalc),
  }));
  // Add today's session
  if (totalVolume > 0) {
    const todayCal = calcSessionCalories({ sessionData, logs, stats: { totalVolume, totalSets: metrics.totalSets, totalReps: metrics.totalReps, totalDurationSec: savedDurationSec || totalDurationSec || 2700 }, date: "", id: "" } as WorkoutHistory, bwForCalc);
    graphData.push({
      date: new Date(),
      loadScore: loadScore,
      volume: totalVolume,
      calories: todayCal,
    });
  }

  // Evidence-based load band (레벨+연령 보정)
  // Exclude today's session from avgGraphLoad to avoid self-referencing bias
  const historyGraphData = graphData.slice(0, -1); // all except today
  const avgGraphLoad = historyGraphData.length > 0
    ? historyGraphData.reduce((s, d) => s + d.loadScore, 0) / historyGraphData.length
    : (graphData.length > 0 ? graphData[0].loadScore : 0);
  const loadBand = getOptimalLoadBand(avgGraphLoad, historyGraphData.length, trainingLevel, birthYear);

  // 부하 판정: loadScore vs loadBand 직접 비교 (비율 왜곡 방지)
  // 강도별 기대 밴드 조정: 저강도는 낮은 볼륨이 정상, 고강도는 높아야 정상
  const intensityMod = sessionIntensity.level === "low" ? 0.4 : sessionIntensity.level === "high" ? 1.15 : 1.0;
  const bandLowRatio = avgGraphLoad > 0 ? (loadBand.low / avgGraphLoad) * intensityMod : 0.5;
  const bandHighRatio = avgGraphLoad > 0 ? (loadBand.high / avgGraphLoad) * (sessionIntensity.level === "low" ? 0.7 : 1.0) : 1.8;
  const bandOverloadRatio = avgGraphLoad > 0 ? (loadBand.overload / avgGraphLoad) * (sessionIntensity.level === "low" ? 0.7 : 1.0) : 2.3;

  // loadRatio: today's loadScore vs historical average loadScore
  const loadRatio = avgGraphLoad > 0 ? loadScore / avgGraphLoad : null;

  // 레벨 표시명
  const levelLabel = t(`report.level.${trainingLevel === "advanced" ? "advanced" : trainingLevel === "intermediate" ? "intermediate" : "beginner"}`);

  return (
    <div className="flex flex-col h-full bg-[#FAFAFA] animate-fade-in relative">
      {/* Top Bar */}
      <div className="pt-[max(1.25rem,env(safe-area-inset-top))] pb-3 px-4 sm:px-6 flex items-center justify-between shrink-0 bg-[#FAFAFA] z-10">
        <button onClick={onClose} className="p-2 -ml-2">
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-[11px] font-medium text-gray-400">{(sessionDate ? new Date(sessionDate) : new Date()).toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US", { month: "long", day: "numeric", weekday: "short" })}</span>
        {sessionDate ? (
          <div className="flex items-center gap-1 -mr-2">
            <button onClick={() => setShowShare(true)} className="p-2 active:scale-95 transition-all">
              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </button>
            {onDelete && (
              <button onClick={() => { if (confirm(t("delete.confirm"))) onDelete(); }} className="p-2 active:scale-95 transition-all">
                <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        ) : (
          <div className="w-9" />
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-5 scrollbar-hide" style={{ paddingBottom: "calc(96px + var(--safe-area-bottom, 0px))" }}>

        {/* === 체험 진행 + 오늘의 나 — 회의 53 (박충환 Enrich + 소비심리학) — 현재 세션에서만 === */}
        {!sessionDate && !isPremium && (() => {
          const isLoggedIn = typeof window !== "undefined" && localStorage.getItem("auth_logged_in") === "1";
          const trial = getTrialStatus(isLoggedIn, isPremium ?? false, getPlanCount());
          if (trial.stage === "premium") return null;
          const persona = detectPersona(recentHistory);
          return (
            <div className="mb-4 p-4 rounded-2xl bg-gradient-to-br from-[#2D6A4F]/5 to-[#2D6A4F]/10 border border-[#2D6A4F]/15">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-black text-[#2D6A4F] uppercase tracking-[0.15em]">
                  {locale === "ko" ? "오늘의 나" : "Today's You"}
                </p>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-[#1B4332]/70">
                    {trial.stage === "guest"
                      ? `${locale === "ko" ? "무료 체험" : "Free trial"} ${trial.currentCompleted}/${trial.currentLimit}`
                      : trial.stage === "exhausted"
                      ? (locale === "ko" ? "무료 체험 완료" : "Free trial done")
                      : `${locale === "ko" ? "무료 체험" : "Free trial"} ${trial.currentCompleted}/${trial.currentLimit}`}
                  </span>
                  <div className="flex gap-0.5">
                    {Array.from({ length: trial.currentLimit }).map((_, i) => (
                      <div
                        key={i}
                        className={`w-1 h-1 rounded-full ${
                          i < trial.currentCompleted ? "bg-[#2D6A4F]" : "bg-gray-300"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <p className="text-[14px] font-black text-[#1B4332] leading-tight">
                {locale === "ko" ? persona.catchphrase : persona.catchphraseEn}
              </p>
              {recentHistory.length >= 3 && (
                <p className="text-[11px] font-bold text-[#2D6A4F] mt-1">
                  {locale === "ko"
                    ? `당신의 운동 스타일: ${persona.name}형`
                    : `Your style: ${persona.nameEn}`}
                </p>
              )}
              {trial.stage !== "exhausted" && trial.remaining <= 1 && (
                <p className="text-[11px] font-medium text-gray-500 mt-2">
                  {locale === "ko"
                    ? (trial.stage === "guest"
                        ? "다음 운동 후 로그인 안내가 있어요"
                        : "다음 운동 후 프리미엄 안내가 있어요")
                    : (trial.stage === "guest"
                        ? "Sign in reminder after next workout"
                        : "Premium reminder after next workout")}
                </p>
              )}
            </div>
          );
        })()}

        {/* === 4탭 네비게이션 (회의 37) — 현재 세션에서만, 히스토리에서는 숨김 === */}
        {!sessionDate && <div className="flex bg-white rounded-2xl border border-gray-100 p-1 mb-5 shadow-sm">
          {(["status", "today", "next"] as ReportTabId[]).map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveReportTab(tab); setShowDetail(false); setShowLogs(false); }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeReportTab === tab
                  ? "bg-[#1B4332] text-white shadow-sm"
                  : "text-gray-400 active:bg-gray-50"
              }`}
            >
              {t(`report.tab.${tab}`)}
            </button>
          ))}
        </div>}

        {/* === 탭 내용 (현재 세션에서만) === */}
        {!sessionDate && <>
        {activeReportTab === "status" && (() => {
          const currentYear = new Date().getFullYear();
          const userAge = birthYear ? currentYear - birthYear : 30;
          return (
            <StatusTab
              exercises={sessionData.exercises}
              logs={logs}
              bodyWeightKg={bodyWeightKg ?? 70}
              gender={gender ?? "male"}
              age={userAge}
              recentHistory={recentHistory}
              currentRunningStats={runningStats ?? null}
              onHelpPress={() => setHelpCard("fitnessAge")}
              onRankHelpPress={() => setHelpCard("fitnessRank")}
            />
          );
        })()}
        {activeReportTab === "today" && (() => {
          // 볼륨 변화 % 계산 (기존 insight 로직과 동일)
          let volumeChangePercent: number | null = null;
          if (isStrengthSession && totalVolume > 0 && recentHistory.length > 0) {
            const currentId = sessionData.exercises.map(e => e.name).join(",");
            // 같은 카테고리 세션 중 현재 세션 제외, 볼륨 있는 것만
            const prevSessions = recentHistory.filter(h => {
              const hId = h.sessionData.exercises.map((e: { name: string }) => e.name).join(",");
              if (hId === currentId && h.stats.totalVolume === totalVolume) return false;
              return (h.stats?.totalVolume || 0) > 0;
            });
            const lastSession = prevSessions[prevSessions.length - 1];
            const lastVol = lastSession?.stats?.totalVolume || 0;
            if (lastVol > 0) volumeChangePercent = Math.round(((totalVolume - lastVol) / lastVol) * 100);
          }
          // 유저 목표 + PR 감지
          let userGoal: string | undefined;
          try { userGoal = JSON.parse(localStorage.getItem("ohunjal_fitness_profile") || "{}").goal; } catch {}
          // PR 감지 (기존 detectMicroPR 재활용)
          const microPR = detectMicroPR(sessionData.exercises, logs, recentHistory, t, locale, toDispW, U);
          const prInfo = microPR ? { exerciseName: microPR.subText || "", value: microPR.bigNumber } : null;
          return (
            <TodayTab
              sessionCategory={sessionCategory}
              totalVolume={totalVolume}
              volumeChangePercent={volumeChangePercent}
              goal={userGoal}
              gender={gender}
              bodyWeightKg={bodyWeightKg}
              totalDurationSec={totalDurationSec}
              savedDurationSec={savedDurationSec}
              fatigueDrop={fatigueDrop}
              totalSets={metrics.totalSets}
              totalReps={metrics.totalReps}
              sessionDesc={sessionData.description || sessionData.title || ""}
              graphData={graphData}
              prInfo={prInfo}
              loadBand={loadBand.low > 0 ? { low: loadBand.low, high: loadBand.high } : null}
              todayLoadScore={loadScore}
              onHelpPress={() => setHelpCard("loadTimeline")}
              calorieOverride={calcSessionCalories({ sessionData, logs, stats: { totalVolume, totalSets: metrics.totalSets, totalReps: metrics.totalReps, totalDurationSec: savedDurationSec || totalDurationSec || 2700 }, date: "", id: "" } as WorkoutHistory, bodyWeightKg ?? 70)}
            />
          );
        })()}
        {activeReportTab === "next" && (() => {
          // condition에서 bodyPart 추출
          let todayBodyPart: string | undefined;
          let weeklySchedule: string[] | undefined;
          try {
            const fp = JSON.parse(localStorage.getItem("ohunjal_fitness_profile") || "{}");
            todayBodyPart = fp.lastCondition?.bodyPart;
            weeklySchedule = fp.weeklySchedule;
          } catch {}
          // 스트릭 계산
          const heroStreak = (() => {
            if (recentHistory.length === 0) return 0;
            let count = 0;
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const dayMs = 24 * 60 * 60 * 1000;
            for (let i = 0; ; i++) {
              const checkDate = new Date(today.getTime() - i * dayMs);
              if (recentHistory.some(h => new Date(h.date).toDateString() === checkDate.toDateString())) { count++; }
              else if (i === 0) { count++; continue; }
              else break;
            }
            return count;
          })();
          return (
            <NextTab
              todayBodyPart={todayBodyPart}
              sessionCategory={sessionCategory}
              fatigueDrop={fatigueDrop}
              recentHistory={recentHistory}
              weeklySchedule={weeklySchedule}
              streak={heroStreak}
              totalVolume={totalVolume}
              gender={gender}
              sessionDesc={sessionData.description || sessionData.title || ""}
              exercises={sessionData.exercises}
              logs={logs}
              birthYear={birthYear}
            />
          );
        })()}
        {activeReportTab === "nutrition" && (() => {
          const currentYear = new Date().getFullYear();
          const userAge = birthYear ? currentYear - birthYear : 30;
          let userGoal = "health";
          let userFreq = 3;
          let userHeight: number | undefined;
          let todayBodyPart: string | undefined;
          try {
            const fp = JSON.parse(localStorage.getItem("ohunjal_fitness_profile") || "{}");
            userGoal = fp.goal || "health";
            userFreq = fp.weeklyFrequency || 3;
            userHeight = fp.height;
            todayBodyPart = fp.lastCondition?.bodyPart;
          } catch {}
          const durationMin = Math.round(totalDurationSec / 60);
          const met = sessionCategory === "cardio" ? 8 : 4.5;
          const estimatedCal = Math.round(met * (bodyWeightKg ?? 70) * (durationMin / 60));
          return (
            <NutritionTab
              bodyWeightKg={bodyWeightKg ?? 70}
              heightCm={userHeight}
              age={userAge}
              gender={gender ?? "male"}
              goal={userGoal}
              weeklyFrequency={userFreq}
              todaySession={{
                type: sessionCategory,
                durationMin,
                bodyPart: todayBodyPart,
                estimatedCalories: estimatedCal,
              }}
              cachedGuide={cachedNutritionGuide as Parameters<typeof NutritionTab>[0]["cachedGuide"]}
              onGuideLoaded={(g) => {
                setCachedNutritionGuide(g);
                // 영양 데이터 Firestore 업데이트 (회의 52: 유틸 경유, 중복 localStorage write 제거)
                if (onReportTabsSaved && !sessionDate) {
                  try {
                    const history = getCachedWorkoutHistory();
                    const lastEntry = history[history.length - 1];
                    if (lastEntry?.reportTabs) {
                      lastEntry.reportTabs.nutrition = g;
                      updateReportTabs(lastEntry.id, lastEntry.reportTabs);
                    }
                  } catch {}
                }
              }}
              isPremium={isPremium}
              onChatHistoryChange={(msgs) => setCachedChatHistory(msgs)}
            />
          );
        })()}
        </>}

        {/* === 히스토리 뷰: savedReportTabs 있으면 4탭, 없으면 기존 RPG === */}
        {!!sessionDate && !!savedReportTabs && <>
          {/* 4탭 네비게이션 (히스토리 — 저장된 데이터) */}
          <div className="flex bg-white rounded-2xl border border-gray-100 p-1 mb-5 shadow-sm">
            {(["status", "today", "next"] as ReportTabId[]).map((tab) => (
              <button
                key={tab}
                onClick={() => { setActiveReportTab(tab); setShowDetail(false); setShowLogs(false); }}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  activeReportTab === tab
                    ? "bg-[#1B4332] text-white shadow-sm"
                    : "text-gray-400 active:bg-gray-50"
                }`}
              >
                {t(`report.tab.${tab}`)}
              </button>
            ))}
          </div>
          {activeReportTab === "status" && (
            <StatusTab
              exercises={sessionData.exercises}
              logs={logs}
              bodyWeightKg={bodyWeightKg ?? 70}
              gender={gender ?? "male"}
              age={birthYear ? new Date().getFullYear() - birthYear : 30}
              recentHistory={recentHistory}
              currentRunningStats={runningStats ?? null}
              onHelpPress={() => setHelpCard("fitnessAge")}
              onRankHelpPress={() => setHelpCard("fitnessRank")}
            />
          )}
          {activeReportTab === "today" && (() => {
            const detectedRunningType = detectRunningType(sessionData.exercises);
            const isRunning = detectedRunningType !== null;
            if (isRunning) {
              const effectiveRS: RunningStats = runningStats ?? {
                runningType: detectedRunningType, isIndoor: false, gpsAvailable: false,
                distance: 0, duration: totalDurationSec, avgPace: null, sprintAvgPace: null,
                recoveryAvgPace: null, bestPace: null, intervalRounds: [], completionRate: 0,
              };
              return <RunningReportBody runningStats={effectiveRS} recentHistory={recentHistory} sessionDate={sessionDate} />;
            }
            // 운동 당시 목표 우선, 없으면 현재 목표 폴백
            const userGoal: string | undefined = savedReportTabs.goal || (() => { try { return JSON.parse(localStorage.getItem("ohunjal_fitness_profile") || "{}").goal; } catch { return undefined; } })();
            return (
              <TodayTab
                sessionCategory={sessionCategory}
                totalVolume={totalVolume}
                volumeChangePercent={savedReportTabs.today.volumeChangePercent}
                goal={userGoal}
                gender={gender}
                bodyWeightKg={bodyWeightKg}
                totalDurationSec={totalDurationSec}
                savedDurationSec={savedDurationSec}
                fatigueDrop={fatigueDrop}
                totalSets={metrics.totalSets}
                totalReps={metrics.totalReps}
                sessionDesc={sessionData.description || sessionData.title || ""}
                graphData={graphData}
                loadBand={loadBand.low > 0 ? { low: loadBand.low, high: loadBand.high } : null}
                todayLoadScore={loadScore}
                onHelpPress={() => setHelpCard("loadTimeline")}
                calorieOverride={calcSessionCalories({ sessionData, logs, stats: { totalVolume, totalSets: metrics.totalSets, totalReps: metrics.totalReps, totalDurationSec: savedDurationSec || totalDurationSec || 2700 }, date: "", id: "" } as WorkoutHistory, bodyWeightKg ?? 70)}
              />
            );
          })()}
          {activeReportTab === "next" && savedReportTabs.next && (
            <NextTab
              todayBodyPart={undefined}
              sessionCategory={sessionCategory}
              fatigueDrop={fatigueDrop}
              recentHistory={recentHistory}
              streak={0}
              totalVolume={totalVolume}
              gender={gender}
              sessionDesc={sessionData.description || sessionData.title || ""}
              exercises={sessionData.exercises}
              logs={logs}
              birthYear={birthYear}
            />
          )}
          {activeReportTab === "nutrition" && savedReportTabs.nutrition && (
            <NutritionTab
              bodyWeightKg={bodyWeightKg ?? 70}
              age={birthYear ? new Date().getFullYear() - birthYear : 30}
              gender={gender ?? "male"}
              goal="health"
              weeklyFrequency={3}
              todaySession={{ type: sessionCategory, durationMin: Math.round(totalDurationSec / 60), estimatedCalories: 0 }}
              cachedGuide={savedReportTabs.nutrition}
              readOnly={true}
              savedChatHistory={savedReportTabs.nutrition.chatHistory}
            />
          )}
        </>}
        {!!sessionDate && !savedReportTabs && (() => {
          const seasonState = getOrRebuildSeasonExp(recentHistory, birthYear, gender);
          const expGained: ExpLogEntry[] = [];
          const prevExp = seasonState.totalExp;
          const currentExp = seasonState.totalExp;

          const insight: RpgInsight = {};
          if (isStrengthSession && totalVolume > 0 && recentHistory.length > 0) {
            const currentId = sessionData.exercises.map(e => e.name).join(",");
            const prevSessions = recentHistory.filter(h => {
              const hId = h.sessionData.exercises.map((e: { name: string }) => e.name).join(",");
              return hId !== currentId || h.stats.totalVolume !== totalVolume;
            });
            const lastSession = prevSessions[prevSessions.length - 1];
            const lastVol = lastSession?.stats?.totalVolume || 0;
            if (lastVol > 0) {
              const diff = Math.round(((totalVolume - lastVol) / lastVol) * 100);
              if (diff > 0) insight.volumeCompare = t("report.insight.volumeUp", { volume: totalVolume.toLocaleString(), diff: String(diff) });
              else if (diff < 0) insight.volumeCompare = t("report.insight.volumeDown", { volume: totalVolume.toLocaleString(), diff: String(diff) });
              else insight.volumeCompare = t("report.insight.volumeSame", { volume: totalVolume.toLocaleString() });
            }
          }

          const microPR = detectMicroPR(sessionData.exercises, logs, recentHistory, t, locale, toDispW, U);
          const heroStreak = (() => {
            if (recentHistory.length === 0) return 0;
            let count = 0;
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const dayMs = 24 * 60 * 60 * 1000;
            for (let i = 0; ; i++) {
              const checkDate = new Date(today.getTime() - i * dayMs);
              if (recentHistory.some(h => new Date(h.date).toDateString() === checkDate.toDateString())) { count++; }
              else if (i === 0) { count++; continue; }
              else break;
            }
            return count;
          })();

          const hero: HeroData = microPR ?? (() => {
            const isRunning = sessionData.exercises.some(e => e.type === "cardio");
            if (isRunning) return { type: "running" as HeroType, label: t("report.hero.todaysWork"), bigNumber: formatDuration(totalDurationSec), subText: translateDesc(sessionData.description || "", locale), isDark: false };
            if (successRate >= 100 && isStrengthSession) return { type: "perfect" as HeroType, label: t("report.hero.perfectSession"), bigNumber: t("report.hero.perfectDesc"), isDark: false };
            if (heroStreak >= 3) return { type: "streak" as HeroType, label: t("report.hero.streakLabel", { days: String(heroStreak) }), bigNumber: t("report.hero.streakDesc"), isDark: false, vars: { days: String(heroStreak) } };
            if (totalVolume > 0) return { type: "volume" as HeroType, label: t("report.hero.todaysWork"), bigNumber: `${Math.round(toDispW(totalVolume)).toLocaleString()} ${U}`, subText: t("report.hero.totalVolume"), isDark: false };
            return { type: "volume" as HeroType, label: t("report.hero.todaysWork"), bigNumber: formatDuration(totalDurationSec), subText: translateDesc(sessionData.description || "", locale), isDark: false };
          })();

          const nextWorkout = (() => {
            try {
              const fp = JSON.parse(localStorage.getItem("ohunjal_fitness_profile") || "{}");
              const schedule = fp.weeklySchedule as string[] | undefined;
              if (!schedule) return undefined;
              const today = new Date().getDay();
              for (let i = 1; i <= 7; i++) {
                const nextDay = (today + i) % 7;
                const label = schedule[nextDay === 0 ? 6 : nextDay - 1];
                if (label && label !== "rest" && label !== "휴식") return translateDesc(label, locale);
              }
            } catch {}
            return undefined;
          })();

          const detectedRunningType = detectRunningType(sessionData.exercises);
          const isRunningReport = detectedRunningType !== null;

          return (
            <>
              <RpgResultCard
                totalDurationSec={totalDurationSec}
                totalSets={isStrengthSession ? metrics.strengthSets : metrics.totalSets}
                totalVolume={totalVolume}
                successRate={successRate}
                isStrengthSession={isStrengthSession}
                seasonExp={currentExp}
                prevSeasonExp={prevExp}
                expGained={expGained}
                intensityLevel={sessionIntensity.level}
                formatDuration={formatDuration}
                onHelpPress={() => setHelpCard("levelSystem")}
                onShowPrediction={onShowPrediction}
                skipAnimation={true}
                insight={insight}
                sessionDesc={sessionData.description || sessionData.title || ""}
                hero={hero}
                timeContext={t(getTimeContextKey())}
                streak={heroStreak}
                nextWorkoutName={nextWorkout}
                logs={logs}
                exercises={sessionData.exercises}
                condition={(() => { try { return JSON.parse(localStorage.getItem("ohunjal_fitness_profile") || "{}").lastCondition; } catch { return undefined; } })()}
                savedCoachMessages={propCoachMessages || (() => {
                  const match = recentHistory.find(h => h.id && h.coachMessages && h.coachMessages.length > 0 && h.sessionData.exercises.map(e => e.name).join(",") === sessionData.exercises.map(e => e.name).join(","));
                  return match?.coachMessages;
                })()}
                onCoachMessagesLoaded={(msgs) => { try { const history = getCachedWorkoutHistory(); const latest = history[history.length - 1]; if (latest) updateCoachMessages(latest.id, msgs); } catch {} }}
                runningStats={runningStats}
                hideExpCard={isRunningReport}
              />
              {isRunningReport && (
                <ExpTierCard seasonExp={currentExp} prevSeasonExp={prevExp} expGained={expGained} insight={insight} streak={heroStreak} nextWorkoutName={nextWorkout} onHelpPress={() => setHelpCard("levelSystem")} onShowPrediction={onShowPrediction} />
              )}
            </>
          );
        })()}

        {/* === 러닝 세션 전용 본문 (현재 세션 — 오늘 탭에서만) === */}
        {!sessionDate && activeReportTab === "today" && (() => {
          const detectedRunningType = detectRunningType(sessionData.exercises);
          const isRunningReport = detectedRunningType !== null;
          if (!isRunningReport) return null;
          const effectiveRunningStats: RunningStats = runningStats ?? {
            runningType: detectedRunningType,
            isIndoor: false,
            gpsAvailable: false,
            distance: 0,
            duration: totalDurationSec,
            avgPace: null,
            sprintAvgPace: null,
            recoveryAvgPace: null,
            bestPace: null,
            intervalRounds: [],
            completionRate: 0,
          };
          return (
            <div className="mb-5">
              <RunningReportBody runningStats={effectiveRunningStats} recentHistory={recentHistory} />
            </div>
          );
        })()}

        {/* === 운동 과학 데이터 (펼쳐보기, 웨이트만) — 오늘 탭 or 히스토리에서만 === */}
        {(activeReportTab === "today" || (!!sessionDate && !savedReportTabs)) && isStrengthSession && (
        <div className="mb-5">
          <button
            onClick={() => setShowDetail(!showDetail)}
            className="w-full flex items-center justify-center gap-2 py-3 active:opacity-60 transition-all"
          >
            <span className="text-sm text-gray-400 font-medium">{t("report.scienceData")}</span>
            <svg className={`w-4 h-4 text-gray-400 transition-transform ${showDetail ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
        )}

        {showDetail && isStrengthSession && <>
        {/* === 2x2 Metric Cards === */}
        <div className="grid grid-cols-2 gap-2.5 mb-5">
          {isStrengthSession ? (
            <>
              {/* Top Lift */}
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm relative animate-count-up" style={{ animationDelay: "0.4s" }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em]">{t("report.card.e1rm")}</p>
                  <button onClick={() => setHelpCard("topLift")} className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center">
                    <span className="text-[10px] font-black text-gray-400">?</span>
                  </button>
                </div>
                {(() => {
                  const currentItem = big4Combined[e1rmIndex] || (big4Combined.length > 0 ? big4Combined[0] : null);
                  const current = currentItem || bestE1RM;
                  const currentBwRatio = current && bodyWeightKg ? current.value / bodyWeightKg : null;

                  return (
                    <>
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <p className="text-2xl font-black text-[#1B4332] leading-none">
                          {currentBwRatio !== null
                            ? t("report.card.bwTimes", { ratio: currentBwRatio.toFixed(1) })
                            : current ? `${Math.round(toDispW(current.value))}${U}` : "-"}
                        </p>
                        {currentBwRatio !== null && (
                          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                            currentBwRatio >= 1.2
                              ? "bg-amber-50 text-amber-600"
                              : currentBwRatio >= 0.8
                                ? "bg-emerald-50 text-[#2D6A4F]"
                                : "bg-gray-100 text-gray-500"
                          }`}>
                            {currentBwRatio >= 1.2 ? t("report.level.advanced") : currentBwRatio >= 0.8 ? t("report.level.intermediate") : t("report.level.beginner")}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-1.5">
                        <p className="text-[9px] text-gray-400 font-medium leading-tight truncate flex-1">
                          {current
                            ? `${getExerciseName(current.exerciseName, locale)} ${Math.round(toDispW(current.value))}${U}`
                            : "-"}
                        </p>
                        {big4Combined.length > 1 && (
                          <div className="flex items-center ml-1 shrink-0">
                            <button
                              onClick={() => setE1rmIndex((e1rmIndex + 1) % big4Combined.length)}
                              className="w-4 h-4 rounded-full bg-gray-100 flex items-center justify-center"
                            >
                              <span className="text-[8px] text-gray-400">▶</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Load Status */}
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm relative animate-count-up" style={{ animationDelay: "0.5s" }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em]">{t("report.card.loadStatus")}</p>
                  <button onClick={() => setHelpCard("loadStatus")} className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center">
                    <span className="text-[10px] font-black text-gray-400">?</span>
                  </button>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <p className={`text-2xl font-black leading-none ${
                    loadRatio !== null && loadRatio > bandHighRatio ? "text-amber-600"
                      : loadRatio !== null && loadRatio < bandLowRatio
                        ? (sessionIntensity.level === "low" ? "text-[#1B4332]" : "text-blue-500")
                      : "text-[#1B4332]"
                  }`}>
                    {loadRatio !== null
                      ? `${loadRatio >= 1 ? "+" : ""}${Math.round((loadRatio - 1) * 100)}%`
                      : "-"}
                  </p>
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                    loadRatio !== null && loadRatio >= bandLowRatio && loadRatio <= bandHighRatio
                      ? "bg-emerald-50 text-[#2D6A4F]"
                      : loadRatio !== null && loadRatio > bandHighRatio
                        ? "bg-amber-50 text-amber-600"
                        : loadRatio !== null && loadRatio < bandLowRatio
                          ? (sessionIntensity.level === "low" ? "bg-emerald-50 text-[#2D6A4F]" : "bg-blue-50 text-blue-500")
                          : "bg-gray-50 text-gray-400"
                  }`}>
                    {loadRatio !== null
                      ? (loadRatio >= bandLowRatio && loadRatio <= bandHighRatio
                          ? (sessionIntensity.level === "low" ? t("report.load.lowOptimal") : sessionIntensity.level === "high" ? t("report.load.highGrowth") : t("report.load.growth"))
                          : loadRatio > bandOverloadRatio ? t("report.load.overload") : loadRatio > bandHighRatio ? t("report.load.highLoad")
                          : (sessionIntensity.level === "low" ? t("report.load.recovery") : t("report.load.deficit")))
                      : t("report.load.first")}
                  </span>
                </div>
                <p className="text-[9px] text-gray-400 mt-1.5 font-medium">
                  {loadRatio !== null
                    ? (loadRatio > bandOverloadRatio ? t("report.load.overloadTip")
                      : loadRatio > bandHighRatio ? t("report.load.highTip")
                      : loadRatio < bandLowRatio
                        ? (sessionIntensity.level === "low" ? t("report.load.lowRecovery") : t("report.load.deficitTip"))
                        : (sessionIntensity.level === "low" ? t("report.load.lowOptimalTip") : sessionIntensity.level === "high" ? t("report.load.highGrowthTip") : t("report.load.growthTip")))
                    : (historyStats ? t("report.load.acsmBasis", { level: levelLabel }) : t("report.load.accumulating", { level: levelLabel }))}
                </p>
              </div>

              {/* Session Intensity */}
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm relative animate-count-up" style={{ animationDelay: "0.6s" }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em]">{t("report.card.intensity")}</p>
                  <button onClick={() => setHelpCard("intensity")} className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center">
                    <span className="text-[10px] font-black text-gray-400">?</span>
                  </button>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <p className="text-2xl font-black text-[#1B4332] leading-none">
                    {t(`report.intensityLabel.${sessionIntensity.level}`)}
                  </p>
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                    sessionIntensity.level === "high" ? "bg-red-50 text-red-500"
                      : sessionIntensity.level === "moderate" ? "bg-amber-50 text-amber-600"
                      : "bg-blue-50 text-blue-500"
                  }`}>
                    {sessionIntensity.basis === "percent_1rm" && sessionIntensity.avgPercentile1RM
                      ? `${sessionIntensity.avgPercentile1RM}% 1RM`
                      : t("report.intensityAvgReps", { reps: String(sessionIntensity.avgRepsPerSet) })}
                  </span>
                </div>
                <p className="text-[9px] text-gray-400 mt-1.5 font-medium">
                  {t("report.intensityWeek", { high: String(intensityRec.weekSummary.high), moderate: String(intensityRec.weekSummary.moderate), low: String(intensityRec.weekSummary.low) })}
                </p>
              </div>

              {/* Fatigue Drop */}
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm relative animate-count-up" style={{ animationDelay: "0.7s" }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em]">{t("report.card.fatigue")}</p>
                  <button onClick={() => setHelpCard("fatigueDrop")} className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center">
                    <span className="text-[10px] font-black text-gray-400">?</span>
                  </button>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <p className="text-2xl font-black text-[#1B4332] leading-none">
                    {fatigueDrop !== null ? `${fatigueDrop > 0 ? "+" : ""}${fatigueDrop}%` : "-"}
                  </p>
                  {fatigueDrop !== null && (
                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                      fatigueDrop > -15
                        ? "bg-emerald-50 text-[#2D6A4F]"
                        : fatigueDrop > -25
                          ? "bg-amber-50 text-amber-600"
                          : "bg-red-50 text-red-500"
                    }`}>
                      {fatigueDrop > -15 ? t("report.fatigue.stable") : fatigueDrop > -25 ? t("report.fatigue.caution") : t("report.fatigue.danger")}
                    </span>
                  )}
                </div>
                <p className="text-[9px] text-gray-400 mt-1.5 font-medium">
                  {fatigueDrop !== null
                    ? t("report.fatigue.recoveryTime", { hours: fatigueDrop >= 0 ? "12" : fatigueDrop > -15 ? "24" : fatigueDrop > -25 ? "48" : "72" })
                    : t("report.fatigue.repsChange")}
                </p>
              </div>
            </>
          ) : (
            <>
              {/* Cardio/Mobility: Total Duration */}
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm relative animate-count-up" style={{ animationDelay: "0.4s" }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em]">{t("report.card.totalTime")}</p>
                </div>
                <p className="text-2xl font-black text-[#1B4332] leading-none">
                  {formatDuration(totalDurationSec)}
                </p>
                <p className="text-[9px] text-gray-400 mt-1.5 font-medium">
                  {sessionCategory === "cardio" ? t("report.card.cardioSession") : t("report.card.mobilitySession")}
                </p>
              </div>

              {/* Completion Rate */}
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm relative animate-count-up" style={{ animationDelay: "0.5s" }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em]">{t("report.card.completionRate")}</p>
                </div>
                <p className="text-2xl font-black text-[#1B4332] leading-none">
                  {successRate}%
                </p>
                <p className="text-[9px] text-gray-400 mt-1.5 font-medium">
                  {t("report.card.completionDetail", { total: String(metrics.totalSets), done: String(Math.round(metrics.totalSets * successRate / 100)) })}
                </p>
              </div>

              {/* Total Exercises */}
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm relative animate-count-up" style={{ animationDelay: "0.6s" }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em]">{t("report.card.exercises")}</p>
                </div>
                <p className="text-2xl font-black text-[#1B4332] leading-none">
                  {t("report.card.exerciseCount", { count: String(sessionData.exercises.length) })}
                </p>
                <p className="text-[9px] text-gray-400 mt-1.5 font-medium">
                  {sessionCategory === "cardio" ? t("report.card.cardioDesc") : t("report.card.mobilityDesc")}
                </p>
              </div>

              {/* Session Type */}
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm relative animate-count-up" style={{ animationDelay: "0.7s" }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em]">{t("report.card.sessionType")}</p>
                </div>
                <div className="text-[#1B4332]">
                  {sessionCategory === "cardio" ? (
                    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  ) : (
                    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                  )}
                </div>
                <p className="text-[9px] text-gray-400 mt-1.5 font-medium">
                  {sessionCategory === "cardio" ? t("report.card.cardioType") : t("report.card.mobilityType")}
                </p>
              </div>
            </>
          )}
        </div>



        {/* === Summary Stats Row === */}
        <div className="flex gap-2 mb-5 animate-report-slide" style={{ animationDelay: "0.9s" }}>
          {isStrengthSession ? (
            <>
              <div className="flex-1 bg-white rounded-xl border border-gray-100 py-3 px-3 text-center shadow-sm">
                <p className="text-[9px] font-bold text-gray-400 uppercase">{t("report.summary.totalVolume")}</p>
                <p className="text-base font-black text-[#1B4332]">{Math.round(toDispW(totalVolume)).toLocaleString()}<span className="text-[10px] text-gray-400 ml-0.5">{U}</span></p>
              </div>
              <div className="flex-1 bg-white rounded-xl border border-gray-100 py-3 px-3 text-center shadow-sm">
                <p className="text-[9px] font-bold text-gray-400 uppercase">{t("report.summary.totalSets")}</p>
                <p className="text-base font-black text-[#1B4332]">{metrics.strengthSets}</p>
              </div>
              <div className="flex-1 bg-white rounded-xl border border-gray-100 py-3 px-3 text-center shadow-sm">
                <p className="text-[9px] font-bold text-gray-400 uppercase">{t("report.summary.totalReps")}</p>
                <p className="text-base font-black text-[#1B4332]">{metrics.totalReps}</p>
              </div>
            </>
          ) : (
            <>
              <div className="flex-1 bg-white rounded-xl border border-gray-100 py-3 px-3 text-center shadow-sm">
                <p className="text-[9px] font-bold text-gray-400 uppercase">{t("report.summary.duration")}</p>
                <p className="text-base font-black text-[#1B4332]">{formatDuration(totalDurationSec)}</p>
              </div>
              <div className="flex-1 bg-white rounded-xl border border-gray-100 py-3 px-3 text-center shadow-sm">
                <p className="text-[9px] font-bold text-gray-400 uppercase">{t("report.summary.totalItems")}</p>
                <p className="text-base font-black text-[#1B4332]">{metrics.totalSets}</p>
              </div>
              <div className="flex-1 bg-white rounded-xl border border-gray-100 py-3 px-3 text-center shadow-sm">
                <p className="text-[9px] font-bold text-gray-400 uppercase">{t("report.summary.completionRate")}</p>
                <p className="text-base font-black text-[#1B4332]">{successRate}%</p>
              </div>
            </>
          )}
        </div>
        </>}

        {/* === Workout Logs (Collapsible) — 오늘 탭 or 히스토리에서만 === */}
        {(activeReportTab === "today" || (!!sessionDate && !savedReportTabs)) && <div className="mb-4">
          <button
            onClick={() => setShowLogs(!showLogs)}
            className="w-full flex items-center justify-center gap-2 py-3 active:opacity-60 transition-all"
          >
            <span className="text-sm text-gray-400 font-medium">Workout Logs</span>
            <svg className={`w-4 h-4 text-gray-400 transition-transform ${showLogs ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showLogs && (
            <div className="mt-3 space-y-4">
              {sessionData.exercises.map((ex, idx) => {
                const exerciseLogs = logs[idx];
                if (!exerciseLogs || exerciseLogs.length === 0) return null;

                // Skip time-based exercises (plank, stretches, etc.) where reps aren't meaningful
                const isTimeBased = ex.type === "warmup" || ex.type === "cardio"
                  || /초|sec|min|분|유지|hold/i.test(ex.count)
                  || exerciseLogs.every(l => l.repsCompleted === 0);
                if (isTimeBased) {
                  return (
                    <div key={idx} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm animate-slide-up" style={{ animationDelay: `${idx * 0.05}s` }}>
                      <div className="flex justify-between items-baseline">
                        <h3 className="font-bold text-gray-800 text-sm text-left">{getExerciseName(ex.name, locale)}</h3>
                        <span className="text-[9px] text-gray-400 uppercase font-black tracking-widest bg-gray-50 px-2 py-0.5 rounded">{ex.type}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-2">{t("report.log.setsComplete", { count: locale !== "ko" ? ex.count.replace(/(\d+)분/g, "$1 min").replace(/(\d+)초/g, "$1 sec").replace(/(\d+)세트/g, "$1 sets").replace(/(\d+)회/g, "$1 reps") : ex.count, sets: String(exerciseLogs.length) })}</p>
                    </div>
                  );
                }

                const maxReps = Math.max(...exerciseLogs.map(l => l.repsCompleted), 1);
                const weights = exerciseLogs.map(l => parseFloat(l.weightUsed || "0")).filter(w => w > 0);
                const hasWeight = weights.length > 0;
                const maxWeight = hasWeight ? Math.max(...weights, 1) : 1;
                const minWeight = hasWeight ? Math.min(...weights) : 0;
                const weightRange = maxWeight - minWeight;
                const weightPadding = weightRange < 1 ? 2 : weightRange * 0.2;

                return (
                  <div key={idx} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm animate-slide-up" style={{ animationDelay: `${idx * 0.05}s` }}>
                    <div className="flex justify-between items-baseline mb-3">
                      <h3 className="font-bold text-gray-800 text-sm text-left">{getExerciseName(ex.name, locale)}</h3>
                      <span className="text-[9px] text-gray-400 uppercase font-black tracking-widest bg-gray-50 px-2 py-0.5 rounded">{ex.type}</span>
                    </div>

                    {/* Graphs — single px-2 wrapper so all dots & labels share the same coordinate space */}
                    <div className="px-2">
                      {/* Weight Graph */}
                      {hasWeight && (
                        <>
                          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">{t("report.log.weight")}</p>
                          <div className="relative h-16 mb-3">
                            {exerciseLogs.length > 1 && (
                              <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                                <path
                                  d={exerciseLogs.map((log, i) => {
                                    const x = (i / (exerciseLogs.length - 1)) * 100;
                                    const w = parseFloat(log.weightUsed || "0");
                                    const y = weightRange < 1
                                      ? 50
                                      : 95 - ((w - (minWeight - weightPadding)) / (weightRange + weightPadding * 2)) * 90;
                                    return `${i === 0 ? "M" : "L"} ${x} ${y}`;
                                  }).join(" ")}
                                  fill="none"
                                  stroke="#2D6A4F"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  vectorEffect="non-scaling-stroke"
                                />
                              </svg>
                            )}
                            {exerciseLogs.map((log, i) => {
                              const xPct = exerciseLogs.length === 1 ? 50 : (i / (exerciseLogs.length - 1)) * 100;
                              const w = parseFloat(log.weightUsed || "0");
                              const yPct = weightRange < 1
                                ? 50
                                : 95 - ((w - (minWeight - weightPadding)) / (weightRange + weightPadding * 2)) * 90;
                              const dotKey = `w-${idx}-${i}`;
                              const isActive = activeDot === dotKey;
                              const prevW = i > 0 ? parseFloat(exerciseLogs[i - 1].weightUsed || "0") : w;
                              const weightColor = w > prevW ? "border-emerald-400" : w < prevW ? "border-red-400" : "border-[#2D6A4F]";
                              return (
                                <button
                                  type="button"
                                  key={i}
                                  className="absolute z-10 flex items-center justify-center"
                                  style={{ left: `${xPct}%`, top: `${yPct}%`, transform: "translate(-50%, -50%)", width: 44, height: 44, background: "none", border: "none", padding: 0 }}
                                  onPointerUp={(e) => { e.stopPropagation(); setActiveDot(isActive ? null : dotKey); }}
                                >
                                  {isActive && (
                                    <span className="absolute -top-7 text-[10px] font-black text-gray-700 bg-white px-1.5 py-0.5 rounded shadow-sm border border-gray-100 z-20 whitespace-nowrap pointer-events-none">
                                      {toDispW(parseFloat(log.weightUsed || "0"))}{U}
                                    </span>
                                  )}
                                  <div className={`w-2.5 h-2.5 bg-white border-[2.5px] rounded-full transition-transform ${isActive ? "scale-150" : ""} ${weightColor}`} />
                                </button>
                              );
                            })}
                          </div>
                        </>
                      )}

                      {/* Reps Graph */}
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">{t("report.log.reps")}</p>
                      <div className="relative h-16">
                        {exerciseLogs.length > 1 && (
                          <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                            <path
                              d={exerciseLogs.map((log, i) => {
                                const x = (i / (exerciseLogs.length - 1)) * 100;
                                const y = 95 - ((log.repsCompleted / maxReps) * 80);
                                return `${i === 0 ? "M" : "L"} ${x} ${y}`;
                              }).join(" ")}
                              fill="none"
                              stroke="#2D6A4F"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              vectorEffect="non-scaling-stroke"
                            />
                          </svg>
                        )}
                        {exerciseLogs.map((log, i) => {
                          const xPct = exerciseLogs.length === 1 ? 50 : (i / (exerciseLogs.length - 1)) * 100;
                          const yPct = 95 - ((log.repsCompleted / maxReps) * 80);
                          const dotKey = `r-${idx}-${i}`;
                          const isActive = activeDot === dotKey;
                          return (
                            <button
                              type="button"
                              key={i}
                              className="absolute z-10 flex items-center justify-center"
                              style={{ left: `${xPct}%`, top: `${yPct}%`, transform: "translate(-50%, -50%)", width: 44, height: 44, background: "none", border: "none", padding: 0 }}
                              onPointerUp={(e) => { e.stopPropagation(); setActiveDot(isActive ? null : dotKey); }}
                            >
                              {isActive && (
                                <span className="absolute -top-7 text-[10px] font-black text-gray-700 bg-white px-1.5 py-0.5 rounded shadow-sm border border-gray-100 z-20 whitespace-nowrap pointer-events-none">
                                  {t("report.log.repsCount", { count: String(log.repsCompleted) })}
                                </span>
                              )}
                              <div className={`w-2.5 h-2.5 bg-white border-[2.5px] rounded-full transition-transform ${isActive ? "scale-150" : ""} ${
                                log.feedback === "fail" ? "border-red-400" :
                                log.feedback === "target" ? "border-[#2D6A4F]" : "border-emerald-400"
                              }`} />
                            </button>
                          );
                        })}
                      </div>

                      {/* Set labels — same px-2 container so positions match dots exactly */}
                      <div className="relative h-5 mt-1">
                        {exerciseLogs.map((log, i) => {
                          const xPct = exerciseLogs.length === 1 ? 50 : (i / (exerciseLogs.length - 1)) * 100;
                          const isFirst = i === 0;
                          const isLast = i === exerciseLogs.length - 1 && exerciseLogs.length > 1;
                          const tx = isFirst ? "translateX(0%)" : isLast ? "translateX(-100%)" : "translateX(-50%)";
                          return (
                            <span key={i} className="absolute text-[9px] font-bold text-gray-300 whitespace-nowrap" style={{ left: `${xPct}%`, transform: tx }}>
                              S{log.setNumber}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>}
      </div>

      {/* Help Card Bottom Sheet */}
      {helpCard && (
        <ReportHelpModal helpCard={helpCard} onClose={() => setHelpCard(null)} gender={gender} loadRatio={loadRatio} levelLabel={levelLabel} />
      )}

      {/* Footer Button — only for current session (not history view) */}
      {!sessionDate && (
        <div className={`absolute bottom-0 left-0 right-0 px-5 bg-gradient-to-t from-[#FAFAFA] via-[#FAFAFA] to-transparent pt-10 pb-0 z-20 ${showShare ? "hidden" : ""}`}>
          <div className="flex gap-2">
            {onRestart && (
              <button
                onClick={onRestart}
                className="flex-1 py-3 rounded-2xl bg-white border border-gray-200 text-gray-500 font-bold text-sm active:scale-95 transition-all"
              >
                Restart
              </button>
            )}
            <button
              onClick={() => setShowShare(true)}
              className="py-3 px-4 rounded-2xl bg-white border border-gray-200 text-[#1B4332] font-bold text-sm active:scale-95 transition-all flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              {t("report.btn.share")}
            </button>
            <button
              onClick={() => {
                // 4탭 데이터 저장
                if (onReportTabsSaved && !sessionDate) {
                  try {
                    const fp = JSON.parse(localStorage.getItem("ohunjal_fitness_profile") || "{}");
                    const userAge = birthYear ? new Date().getFullYear() - birthYear : 30;
                    const userGoal = fp.goal || "health";
                    // 볼륨 변화 — 같은 카테고리 세션끼리 비교
                    let volChange: number | null = null;
                    if (isStrengthSession && totalVolume > 0 && recentHistory.length > 0) {
                      const cid = sessionData.exercises.map(e => e.name).join(",");
                      const prev = recentHistory.filter(h => {
                        const hId = h.sessionData.exercises.map((e: {name:string}) => e.name).join(",");
                        if (hId === cid && h.stats.totalVolume === totalVolume) return false;
                        return (h.stats?.totalVolume || 0) > 0;
                      });
                      const last = prev[prev.length - 1];
                      if (last?.stats?.totalVolume) volChange = Math.round(((totalVolume - last.stats.totalVolume) / last.stats.totalVolume) * 100);
                    }
                    // 회의 55: 레거시 단순 공식 → calcSessionCalories 통일
                    const bw = bodyWeightKg ?? 70;
                    const calBurned = calcSessionCalories({
                      sessionData, logs,
                      stats: { totalVolume, totalSets: metrics.totalSets, totalReps: metrics.totalReps, totalDurationSec: savedDurationSec || totalDurationSec || 2700 },
                      date: "", id: "",
                    } as WorkoutHistory, bw);
                    const recoveryH = fatigueDrop === null ? "24" : fatigueDrop >= 0 ? "12" : fatigueDrop > -15 ? "24" : fatigueDrop > -25 ? "48" : "48~72";
                    const nutritionData = cachedNutritionGuide ? {
                      ...(cachedNutritionGuide as { dailyCalorie: number; goalBasis: string; macros: { protein: number; carb: number; fat: number }; meals: { time: string; menu: string }[]; keyTip: string }),
                      chatHistory: cachedChatHistory.length > 0 ? cachedChatHistory : undefined,
                    } : null;
                    onReportTabsSaved({
                      status: { percentiles: [], overallRank: 0, fitnessAge: userAge, ageGroupLabel: "", genderLabel: "" },
                      today: { volumeChangePercent: volChange, caloriesBurned: calBurned, foodAnalogy: "", recoveryHours: recoveryH, stimulusMessage: "" },
                      next: { message: "", recommendedPart: "", recommendedIntensity: "" },
                      nutrition: nutritionData,
                    });
                  } catch {}
                }
                setCloseAfterShare(true); setShowShare(true);
              }}
              className="flex-1 py-3 rounded-2xl bg-[#1B4332] text-white font-bold text-base shadow-xl shadow-[#1B4332]/20 active:scale-95 transition-all"
            >
              {t("report.btn.complete")}
            </button>
          </div>
        </div>
      )}

      {/* Share Card Modal */}
      {showShare && (
        <ShareCard
          sessionData={sessionData}
          logs={logs}
          metrics={metrics}
          analysis={analysis}
          bodyWeightKg={bodyWeightKg}
          sessionDate={sessionDate}
          recentHistory={recentHistory}
          runningStats={runningStats}
          onClose={() => { setShowShare(false); if (closeAfterShare) { setCloseAfterShare(false); onClose(); } }}
        />
      )}
    </div>
  );
};
