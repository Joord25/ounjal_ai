"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";

import { WorkoutHistory as WorkoutHistoryType } from "@/constants/workout";
import { loadWorkoutHistory, deleteWorkoutHistory, replaceCachedWorkoutHistory } from "@/utils/workoutHistory";

import { estimateTrainingLevelDetailed, detectAchievements } from "@/utils/workoutMetrics";
import { SwipeToDelete } from "@/components/SwipeToDelete";
import { useTranslation } from "@/hooks/useTranslation";
import { useUnits } from "@/hooks/useUnits";
import { kgToLb } from "@/utils/units";
import { translateDesc } from "@/components/report/reportUtils";
import { getCurrentSeason, getTierFromExp, getOrRebuildSeasonExp, rebuildFromHistory, saveSeasonExp } from "@/utils/questSystem";
import { WorkoutReport } from "@/components/report/WorkoutReport";
import { WorkoutHistory } from "./WorkoutHistory";
import { WeightDetailView } from "./WeightDetailView";
import { HelpCardModal } from "./HelpCardModal";
import { WeightTrendChart } from "./WeightTrendChart";
import { LoadTimelineChart } from "./LoadTimelineChart";
import { VolumeTrendChart } from "./VolumeTrendChart";
import { MonthlyRunningScience } from "@/components/report/MonthlyRunningScience";
import {
  type FitnessCategory,
  type CategoryPercentile,
  getCategoryBestBwRatio,
  bwRatioToPercentile,
  percentileToRank,
  getBestRunningPace,
  getCardioPacePercentile,
  getCardioConfidenceStatus,
  getAgeGroupLabel,
  computeOverallPercentile,
} from "@/utils/fitnessPercentile";
import { HexagonChart, type HexagonAxis } from "@/components/report/HexagonChart";

const RANK_CATEGORY_LABELS: Record<FitnessCategory, { ko: string; en: string }> = {
  chest: { ko: "가슴", en: "Chest" },
  back: { ko: "등", en: "Back" },
  shoulder: { ko: "어깨", en: "Shoulder" },
  legs: { ko: "하체", en: "Legs" },
  core: { ko: "코어 & 팔", en: "Core & Arms" },
  cardio: { ko: "체력", en: "Cardio" },
};
const RANK_CATEGORIES: FitnessCategory[] = ["chest", "back", "shoulder", "legs", "core", "cardio"];

const GRASS_COLORS = [
  { bg: "bg-gray-50", text: "text-gray-300", shadow: "" },
  { bg: "bg-[#C2D8C2]", text: "text-gray-700", shadow: "shadow-sm shadow-[#C2D8C2]/40" },
  { bg: "bg-[#7BA57B]", text: "text-white", shadow: "shadow-sm shadow-[#7BA57B]/40" },
  { bg: "bg-[#2D6A4F]", text: "text-white", shadow: "shadow-md shadow-[#2D6A4F]/20" },
  { bg: "bg-[#1B4332]", text: "text-white", shadow: "shadow-md shadow-[#1B4332]/30" },
];

// 회의 64-M3 UI: 중도 종료일은 intensity 의미 없음 → 단일 앰버 톤
const ABANDONED_GRASS = { bg: "bg-amber-200", text: "text-amber-900", shadow: "shadow-sm shadow-amber-200/40" };

interface ProofTabProps {
  lockedRuleIds: string[]; // Not used in this version, but kept for compatibility
  onShowPrediction?: () => void;
}

type ViewState = "dashboard" | "list" | "report" | "weight_detail";

// 세션 타이틀 번역은 @/components/report/reportUtils 의 translateDesc 사용 (회의 53 단일화)

/* 스와이프 삭제 지원 세션 아이템 */
function DaySessionItem({ session, timeStr, onTap, onDelete }: {
  session: WorkoutHistoryType; timeStr: string;
  onTap: () => void; onDelete: () => void;
}) {
  const { t, locale } = useTranslation();
  return (
    <SwipeToDelete onDelete={onDelete}>
      <button
        onClick={onTap}
        className="w-full flex items-center justify-between p-4 rounded-2xl bg-[#FAFBF9] border border-gray-100 active:scale-[0.98] transition-all"
      >
        <div className="text-left">
          <p className="text-sm font-bold text-[#1B4332]">{translateDesc(session.sessionData.title, locale)}</p>
          <p className="text-xs text-[#6B7280] mt-0.5">
            {t("proof.setsVolume", { sets: String(session.stats.totalSets), volume: session.stats.totalVolume.toLocaleString() })}
          </p>
        </div>
        <span className="text-xs font-medium text-[#6B7280]">{timeStr}</span>
      </button>
    </SwipeToDelete>
  );
}

export const ProofTab: React.FC<ProofTabProps> = ({ onShowPrediction }) => {
  const { t, locale } = useTranslation();
  const { system: unitSystem, labels: unitLabels } = useUnits();
  const isImperial = unitSystem === "imperial";
  const toDisplayWeight = (kg: number) => isImperial ? kgToLb(kg) : kg;
  const [history, setHistory] = useState<WorkoutHistoryType[]>([]);
  const [view, setView] = useState<ViewState>("dashboard");
  const [selectedHistory, setSelectedHistory] = useState<WorkoutHistoryType | null>(null);
  const [monthOffset, setMonthOffset] = useState(0); // 0 = current month, -1 = last month, etc.
  const [weightLog, setWeightLog] = useState<{ date: string; weight: number }[]>([]);
  const [helpCard, setHelpCard] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [showAdvancedStats, setShowAdvancedStats] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const isPulling = useRef(false);

  const refreshData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const data = await loadWorkoutHistory();
      data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setHistory(data);
      // Reload weight log
      const savedWeight = localStorage.getItem("ohunjal_weight_log");
      if (savedWeight) {
        try { setWeightLog(JSON.parse(savedWeight)); } catch { /* ignore */ }
      }
    } catch (e) {
      console.error("Failed to refresh", e);
    } finally {
      setIsRefreshing(false);
      setPullDistance(0);
    }
  }, []);

  useEffect(() => {
    loadWorkoutHistory().then((data) => {
      data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setHistory(data);
    }).catch((e) => {
      console.error("Failed to load workout history", e);
    });
    const savedWeight = localStorage.getItem("ohunjal_weight_log");
    if (savedWeight) {
      try {
        setWeightLog(JSON.parse(savedWeight));
      } catch { /* ignore */ }
    } else {
      // Seed from existing body weight if no log exists yet
      const currentWeight = localStorage.getItem("ohunjal_body_weight");
      if (currentWeight) {
        const w = parseFloat(currentWeight);
        if (!isNaN(w) && w > 0) {
          const seed = [{ date: new Date().toISOString().slice(0, 10), weight: w }];
          localStorage.setItem("ohunjal_weight_log", JSON.stringify(seed));
          setWeightLog(seed);
        }
      }
    }
  }, []);

  const today = new Date();
  const viewDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();
  const isCurrentMonth = monthOffset === 0;
  const currentMonthLabel = viewDate.toLocaleString(locale === "ko" ? "ko-KR" : "en-US", { year: "numeric", month: "long" });

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Stats - filtered by selected month
  const monthHistory = history.filter(h => {
    const d = new Date(h.date);
    return d.getFullYear() === viewYear && d.getMonth() === viewMonth;
  });
  const [reportReturnView, setReportReturnView] = useState<"dashboard" | "list">("list");
  const [dayPickerSessions, setDayPickerSessions] = useState<{ sessions: WorkoutHistoryType[]; day: number } | null>(null);
  const [proofView, setProofView] = useState<"calendar" | "bodypart" | "weight" | "tier">("calendar");

  const handleSessionClick = (session: WorkoutHistoryType, returnTo: "dashboard" | "list" = "list") => {
    setSelectedHistory(session);
    setReportReturnView(returnTo);
    setView("report");
  };

  // Load user profile from localStorage for consistent report rendering
  const savedBodyWeight = typeof window !== "undefined" ? parseFloat(localStorage.getItem("ohunjal_body_weight") || "") : NaN;
  const savedGender = typeof window !== "undefined" ? (localStorage.getItem("ohunjal_gender") as "male" | "female") || undefined : undefined;
  const savedBirthYear = typeof window !== "undefined" ? parseInt(localStorage.getItem("ohunjal_birth_year") || "") : NaN;

  const handleDeleteSession = (sessionIds: string[]) => {
    const idSet = new Set(sessionIds);
    const updatedHistory = history.filter(h => !idSet.has(h.id));
    setHistory(updatedHistory);
    deleteWorkoutHistory(sessionIds);
    // Rebuild EXP from remaining history
    const rebuilt = rebuildFromHistory(updatedHistory, !isNaN(savedBirthYear) ? savedBirthYear : undefined, savedGender);
    saveSeasonExp(rebuilt);
  };

  if (view === "report" && selectedHistory) {
    return (
      <WorkoutReport
        sessionData={selectedHistory.sessionData}
        logs={selectedHistory.logs}
        bodyWeightKg={!isNaN(savedBodyWeight) ? savedBodyWeight : undefined}
        gender={savedGender}
        birthYear={!isNaN(savedBirthYear) ? savedBirthYear : undefined}
        sessionDate={selectedHistory.date}
        savedDurationSec={selectedHistory.stats?.totalDurationSec}
        initialAnalysis={selectedHistory.analysis}
        savedCoachMessages={selectedHistory.coachMessages}
        runningStats={selectedHistory.runningStats}
        savedReportTabs={selectedHistory.reportTabs}
        abandoned={selectedHistory.abandoned}
        onClose={() => setView(reportReturnView)}
        onDelete={() => {
          const updated = history.filter(h => h.id !== selectedHistory.id);
          setHistory(updated);
          replaceCachedWorkoutHistory(updated);
          deleteWorkoutHistory([selectedHistory.id]).catch(() => {});
          // Rebuild EXP from remaining history
          const rebuilt = rebuildFromHistory(updated, !isNaN(savedBirthYear) ? savedBirthYear : undefined, savedGender);
          saveSeasonExp(rebuilt);
          setView(reportReturnView);
        }}
        onAnalysisComplete={(analysis) => {
            // Update history in localStorage and state (회의 52: 유틸 경유)
            try {
                const updatedHistory = history.map(h =>
                    h.id === selectedHistory.id ? { ...h, analysis } : h
                );
                setHistory(updatedHistory);
                replaceCachedWorkoutHistory(updatedHistory);

                // Update selectedHistory as well to reflect changes immediately if needed
                setSelectedHistory({ ...selectedHistory, analysis });
            } catch (e) {
                console.error("Failed to save analysis in ProofTab", e);
            }
        }}
      />
    );
  }

  if (view === "list") {
    return (
      <WorkoutHistory
        history={history}
        onSelectSession={handleSessionClick}
        onBack={() => setView("dashboard")}
        onDelete={handleDeleteSession}
      />
    );
  }

  if (view === "weight_detail") {
    return (
      <WeightDetailView
        weightLog={weightLog}
        onWeightLogChange={setWeightLog}
        onBack={() => setView("dashboard")}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#FAFBF9] animate-fade-in relative overflow-hidden">
      {/* ── 히어로 존 (라이트 톤) ── */}
      <div className="shrink-0 pt-[max(1.5rem,calc(env(safe-area-inset-top)+0.5rem))] px-4 sm:px-6 text-center z-10 relative bg-[#FAFBF9]">
        {/* 월 네비게이션 */}
        <div className="inline-flex items-center gap-1 bg-[#2D6A4F]/10 rounded-full">
          <button
            onClick={() => setMonthOffset(prev => prev - 1)}
            className="p-2 pl-3 active:opacity-60 transition-opacity"
          >
            <svg className="w-3.5 h-3.5 text-[#2D6A4F]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-xs font-black text-[#1B4332] min-w-[100px] text-center">{currentMonthLabel}</span>
          <button
            onClick={() => setMonthOffset(prev => Math.min(prev + 1, 0))}
            disabled={isCurrentMonth}
            className="p-2 pr-3 active:opacity-60 transition-opacity disabled:opacity-20"
          >
            <svg className="w-3.5 h-3.5 text-[#2D6A4F]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        {/* 히어로: 좌 숫자 + 우 통계 */}
        <div className="mt-5 mb-2">
          {monthHistory.length > 0 ? (
            <div className="flex items-end gap-2 px-2">
              <h1 className="font-black text-[#1B4332] leading-none shrink-0" style={{ fontSize: "clamp(2.75rem, 12vw, 3rem)" }}>{monthHistory.length}<span className="font-bold text-[#2D6A4F]/50 ml-1" style={{ fontSize: "clamp(0.875rem, 4vw, 1rem)" }}>{t("proof.workoutCount")}</span></h1>
              <p className="text-[#2D6A4F]/50 ml-auto font-bold text-right leading-tight min-w-0 break-keep" style={{ fontSize: "clamp(0.7rem, 2.6vw, 0.8rem)" }}>
                <span className="font-black text-[#1B4332]" style={{ fontSize: "clamp(1rem, 4vw, 1.125rem)" }}>{Math.round(toDisplayWeight(monthHistory.reduce((s, h) => s + (h.stats.totalVolume || 0), 0))).toLocaleString()}</span>{unitLabels.weight}
                {" · "}
                <span className="font-black text-[#1B4332]" style={{ fontSize: "clamp(1rem, 4vw, 1.125rem)" }}>{Math.round(monthHistory.reduce((s, h) => s + (h.stats.totalDurationSec || 0), 0) / 60)}</span>{locale === "ko" ? "분" : "m"}
                {" · "}
                <span className="font-black text-[#1B4332]" style={{ fontSize: "clamp(1rem, 4vw, 1.125rem)" }}>{monthHistory.reduce((s, h) => s + (h.stats.totalSets || 0), 0)}</span>{locale === "ko" ? "세트" : "s"}
              </p>
            </div>
          ) : isCurrentMonth ? (
            <div className="text-center">
              <h1 className="text-xl font-black text-[#1B4332]">{t("proof.createFirstRecord")}</h1>
              <p className="text-[12px] font-medium text-[#2D6A4F]/50 mt-1">{t("proof.startToday")}</p>
            </div>
          ) : (
            <div className="text-center">
              <h1 className="text-xl font-black text-gray-300">{t("proof.noRecordsMonth")}</h1>
              <p className="text-[12px] font-medium text-[#95D5B2]/40 mt-1">{t("proof.monthLabel", { month: String(viewMonth + 1) })}</p>
            </div>
          )}
        </div>
        {/* ── 하이라이트 (업적 횡스크롤 — 다크존 안) ── */}
        {(() => {
          const achievements = detectAchievements(history);
          if (achievements.length === 0) return null;
          const recent = achievements.slice(0, 10);
          return (
            <div className="mt-5 pb-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1 h-px bg-gradient-to-r from-transparent to-[#2D6A4F]/20" />
                <p className="text-[13px] font-serif font-bold text-[#2D6A4F]/50 tracking-[0.25em]">
                  {locale === "ko" ? "나의 업적" : "My Achievements"}
                </p>
                <div className="flex-1 h-px bg-gradient-to-l from-transparent to-[#2D6A4F]/20" />
              </div>
              <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 -mx-4 px-4 sm:-mx-6 sm:px-6">
                {recent.map((a, i) => {
                  const cardStyle = a.type === "pr"
                    ? "border-amber-400/30"
                    : a.type === "streak"
                      ? "border-[#2D6A4F]/30"
                      : a.type === "milestone"
                        ? "border-[#2D6A4F]/20"
                        : "border-gray-200";
                  return (
                  <div key={i} className={`shrink-0 bg-white/80 rounded-2xl border px-4 py-3 min-w-[140px] shadow-sm ${cardStyle}`}>
                    <p className="text-[9px] font-bold text-gray-400 mb-1">
                      {a.date.slice(0, 10).replace(/-/g, ".")}
                    </p>
                    <p className="text-sm font-black text-[#1B4332] leading-tight">
                      {a.type === "pr" && a.weightKg != null
                        ? `${locale === "ko" ? (a.exerciseName || a.title) : (a.exerciseNameEn || a.titleEn)} ${Math.round(toDisplayWeight(a.weightKg))}${unitLabels.weight}`
                        : (locale === "ko" ? a.title : a.titleEn)}
                    </p>
                    <p className={`text-[9px] font-bold mt-1 ${a.type === "pr" ? "text-amber-600/70" : "text-[#2D6A4F]/60"}`}>
                      {a.type === "pr" ? (locale === "ko" ? "신기록" : "PR") : a.type === "streak" ? (locale === "ko" ? "연속" : "Streak") : a.type === "milestone" ? (locale === "ko" ? "달성" : "Milestone") : (locale === "ko" ? "시작" : "First")}
                    </p>
                  </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>

      {/* 전체 스크롤 영역 (히어로 뒤로 콘텐츠가 자연스럽게 밀려올라감) */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto scrollbar-hide px-4 sm:px-6"
        style={{ paddingBottom: "calc(8px + var(--safe-area-bottom, 0px))" }}
        onTouchStart={(e) => {
          if (scrollRef.current && scrollRef.current.scrollTop === 0) {
            touchStartY.current = e.touches[0].clientY;
            isPulling.current = true;
          }
        }}
        onTouchMove={(e) => {
          if (!isPulling.current) return;
          const dy = e.touches[0].clientY - touchStartY.current;
          if (dy > 0 && scrollRef.current && scrollRef.current.scrollTop === 0) {
            setPullDistance(Math.min(dy * 0.5, 80));
          } else {
            isPulling.current = false;
            setPullDistance(0);
          }
        }}
        onTouchEnd={() => {
          if (isPulling.current && pullDistance > 50) {
            refreshData();
          } else {
            setPullDistance(0);
          }
          isPulling.current = false;
        }}
      >
        {/* Pull-to-refresh indicator */}
        <div
          className="flex items-center justify-center overflow-hidden transition-all"
          style={{ height: pullDistance > 0 || isRefreshing ? Math.max(pullDistance, isRefreshing ? 40 : 0) : 0 }}
        >
          <div className={`w-5 h-5 border-2 border-[#2D6A4F] border-t-transparent rounded-full ${isRefreshing ? "animate-spin" : ""}`}
            style={{ opacity: pullDistance > 20 || isRefreshing ? 1 : pullDistance / 20, transform: `rotate(${pullDistance * 3}deg)` }}
          />
        </div>
        {/* 하이라이트는 다크존으로 이동됨 */}

        {/* 부위 도감은 4탭 카드 안으로 이동 */}

        {/* 4탭 통합 카드 */}
        <div className="border-t border-b border-gray-200 mb-5">
          <div className="flex gap-0.5 bg-[#2D6A4F]/10 p-1 m-3 mb-0 rounded-xl">
            {([
              { key: "calendar" as const, label: locale === "ko" ? "캘린더" : "Calendar" },
              { key: "bodypart" as const, label: locale === "ko" ? "내 등수" : "My Rank" },
              { key: "weight" as const, label: locale === "ko" ? "체중변화" : "Weight" },
              { key: "tier" as const, label: locale === "ko" ? "티어" : "Tier" },
            ]).map(tab => (
              <button
                key={tab.key}
                onClick={() => setProofView(tab.key)}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                  proofView === tab.key ? "bg-white text-[#1B4332] shadow-sm" : "text-gray-400"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

        {proofView === "calendar" ? (
        <div className="p-4 min-h-[320px]">
          <div className="grid grid-cols-7 gap-2">
            {(locale === "ko" ? ['일', '월', '화', '수', '목', '금', '토'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']).map((day, i) => (
              <div key={i} className={`text-center text-xs font-bold mb-2 ${
                i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'
              }`}>
                {day}
              </div>
            ))}
            {/* Empty cells for offset (Sunday start) */}
            {Array.from({ length: new Date(viewYear, viewMonth, 1).getDay() }, (_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {days.map((day) => {
              const dateObj = new Date(viewYear, viewMonth, day);
              const dateStr = dateObj.toDateString();

              const daySessions = history.filter(h => new Date(h.date).toDateString() === dateStr);
              const isCompleted = daySessions.length > 0;
              const isToday = isCurrentMonth && day === today.getDate();

              // 회의 64-M3: 중도 전용일 = 완주 세션 0 + 중도 세션 ≥1. 혼합일(완주+중도)은 emerald + 느낌표 배지
              const hasNonAbandoned = daySessions.some(h => h.abandoned !== true);
              const hasAbandoned = daySessions.some(h => h.abandoned === true);
              const isAbandonedOnly = isCompleted && !hasNonAbandoned;
              const isMixedDay = hasNonAbandoned && hasAbandoned;

              // Grass intensity: total minutes across all sessions (완주 우선일에만 적용)
              const totalMin = daySessions.reduce((s, h) => s + (h.stats?.totalDurationSec || 0), 0) / 60;
              const grassLevel = !isCompleted ? 0
                : totalMin <= 0 ? 2 // fallback: duration unknown → mid level
                : totalMin < 15 ? 1
                : totalMin < 30 ? 2
                : totalMin < 50 ? 3
                : 4;

              const g = isAbandonedOnly ? ABANDONED_GRASS : GRASS_COLORS[grassLevel];

              return (
                <div
                  key={day}
                  onClick={() => {
                    if (daySessions.length === 1) {
                      handleSessionClick(daySessions[0], "dashboard");
                    } else if (daySessions.length > 1) {
                      const sorted = [...daySessions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                      setDayPickerSessions({ sessions: sorted, day });
                    }
                  }}
                  className={`aspect-square rounded-xl flex items-center justify-center text-xs font-bold relative transition-all ${
                    g.bg} ${g.text} ${g.shadow} ${
                    isCompleted ? 'cursor-pointer active:scale-90' : ''
                  } ${isToday ? 'ring-2 ring-emerald-400 ring-offset-2' : ''}`}
                >
                  {day}
                  {/* 회의 64-M3: 혼합일(완주+중도) = amber 느낌표 / 그 외 multi-session = 카운트 */}
                  {isMixedDay ? (
                    <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-amber-400 rounded-full flex items-center justify-center shadow-sm">
                      <span className="text-[8px] font-black text-white leading-none">!</span>
                    </span>
                  ) : daySessions.length > 1 && (
                    <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-white rounded-full flex items-center justify-center shadow-sm">
                      <span className="text-[7px] font-black text-[#2D6A4F]">{daySessions.length}</span>
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* 잔디 색상 범례 */}
          <div className="flex items-center justify-center gap-2 mt-3 mb-1">
            <span className="text-[10px] text-gray-400 font-medium">{locale === "ko" ? "적음" : "Less"}</span>
            <div className="w-3 h-3 rounded-sm bg-[#C2D8C2]" />
            <div className="w-3 h-3 rounded-sm bg-[#7BA57B]" />
            <div className="w-3 h-3 rounded-sm bg-[#2D6A4F]" />
            <div className="w-3 h-3 rounded-sm bg-[#1B4332]" />
            <span className="text-[10px] text-gray-400 font-medium">{locale === "ko" ? "많음" : "More"}</span>
            <span className="text-[10px] text-gray-500 ml-1">{locale === "ko" ? "· 운동시간 기준" : "· by duration"}</span>
          </div>
          {/* 회의 64-M3: 중도 종료 범례 */}
          <div className="flex items-center justify-center gap-2 mb-1">
            <div className="w-3 h-3 rounded-sm bg-amber-200" />
            <span className="text-[10px] text-gray-500">{locale === "ko" ? "중도 종료" : "Incomplete"}</span>
          </div>
        </div>
        ) : proofView === "bodypart" ? (
          /* === 내 등수 탭 === 부위별 퍼센타일 헥사곤 (전체 history 기준 누적, StatusTab 디자인 재사용) */
          <div className="p-4 min-h-[320px]">
            {(() => {
              const age = !isNaN(savedBirthYear) ? new Date().getFullYear() - savedBirthYear : 30;
              const bodyWeightKg = !isNaN(savedBodyWeight) ? savedBodyWeight : 0;
              const gender = savedGender;
              const isKo = locale === "ko";

              if (!gender || bodyWeightKg <= 0) {
                return (
                  <p className="text-sm text-gray-400 text-center py-12">
                    {isKo ? "프로필 설정 후 등수가 표시돼요" : "Set profile to see your rank"}
                  </p>
                );
              }

              // 누적 기준 (전체 history) 카테고리별 best bwRatio
              const bestByCategory = getCategoryBestBwRatio([], {}, history, bodyWeightKg);

              // cardio 페이스 percentile (러닝 history 기반)
              const runningHistory = history
                .filter(h => h.runningStats)
                .map(h => ({ date: h.date, runningStats: h.runningStats! }));
              const cardioStatus = getCardioConfidenceStatus(runningHistory);
              const cardioBestPace = getBestRunningPace(runningHistory);

              // 카테고리별 퍼센타일 (StatusTab 과 동일 구조)
              const categoryPercentiles: CategoryPercentile[] = RANK_CATEGORIES.map((cat) => {
                if (cat === "cardio") {
                  if (cardioStatus.eligibleRunCount === 0 || cardioBestPace == null) {
                    return { category: cat, rank: 50, percentile: 50, bwRatio: 0, hasData: false };
                  }
                  const percentile = getCardioPacePercentile(cardioBestPace, gender, age);
                  return {
                    category: cat,
                    rank: percentileToRank(percentile),
                    percentile,
                    bwRatio: 0,
                    hasData: true,
                  };
                }
                const bwRatio = bestByCategory.get(cat);
                if (!bwRatio || bwRatio <= 0) {
                  return { category: cat, rank: 50, percentile: 50, bwRatio: 0, hasData: false };
                }
                const percentile = bwRatioToPercentile(bwRatio, cat, gender, age);
                return {
                  category: cat,
                  rank: percentileToRank(percentile),
                  percentile,
                  bwRatio,
                  hasData: true,
                };
              });

              const overallPercentile = computeOverallPercentile(categoryPercentiles);
              const overallRank = percentileToRank(overallPercentile);
              const hasAnyData = categoryPercentiles.some((c) => c.hasData);

              const hexAxes: HexagonAxis[] = categoryPercentiles.map((cp) => ({
                label: isKo ? RANK_CATEGORY_LABELS[cp.category].ko : RANK_CATEGORY_LABELS[cp.category].en,
                value: cp.hasData ? cp.percentile : 0,
                rankText: cp.hasData ? `${cp.rank}${isKo ? "등" : "th"}` : "-",
                tentative: cp.category === "cardio" && cp.hasData && !cardioStatus.isConfirmed,
              }));

              const ageGroupLabel = getAgeGroupLabel(age, locale);
              const genderLabel = isKo ? (gender === "male" ? "남성" : "여성") : (gender === "male" ? "men" : "women");

              return (
                <div className="w-full">
                  <p className="text-sm font-black text-[#1B4332] text-center mb-1">
                    {isKo
                      ? `${ageGroupLabel} ${genderLabel} 100명 중`
                      : `Among 100 ${ageGroupLabel} ${genderLabel}`}
                  </p>
                  <HexagonChart axes={hexAxes} />
                  {hasAnyData && (
                    <div className="text-center mt-3">
                      <p className="text-lg font-black text-[#1B4332]">
                        {isKo ? `종합 ${overallRank}등` : `Overall rank: ${overallRank}`}
                      </p>
                    </div>
                  )}
                  {!hasAnyData && (
                    <p className="text-center text-xs text-gray-400 mt-2">
                      {isKo ? "운동 기록이 쌓이면 나의 위치가 보여요" : "Your ranking will appear as you log workouts"}
                    </p>
                  )}
                </div>
              );
            })()}
          </div>
        ) : proofView === "weight" ? (
          /* === 체중 변화 탭 === */
          <div className="p-4 min-h-[320px] flex items-center justify-center">
            {weightLog.length > 0 ? (
              <div className="w-full"><WeightTrendChart weightLog={weightLog} onViewAll={() => setView("weight_detail")} embedded /></div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-8">{locale === "ko" ? "체중 기록이 없어요" : "No weight data yet"}</p>
            )}
          </div>
        ) : (
          /* === 티어 탭 === */
          (() => {
            const seasonExp = getOrRebuildSeasonExp(history, !isNaN(savedBirthYear) ? savedBirthYear : undefined, savedGender);
            const tierInfo = getTierFromExp(seasonExp.totalExp);
            const seasonInfo = getCurrentSeason();
            return (
              <div className="p-4 min-h-[320px]">
                <div className={`bg-gradient-to-r ${tierInfo.tier.name === "Diamond" ? "from-purple-500 to-indigo-400" : tierInfo.tier.name === "Platinum" ? "from-cyan-500 to-blue-400" : tierInfo.tier.name === "Gold" ? "from-amber-500 to-orange-400" : tierInfo.tier.name === "Silver" ? "from-gray-400 to-gray-300" : tierInfo.tier.name === "Bronze" ? "from-amber-700 to-amber-600" : "from-gray-500 to-gray-400"} rounded-2xl px-5 py-4 mb-3`}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-black text-white">{locale === "ko" ? seasonInfo.label : seasonInfo.label.replace("시즌", "Season")}</p>
                    <p className="text-xl font-black text-white">{tierInfo.tier.name}</p>
                  </div>
                  <div className="mt-2 h-2 bg-white/20 rounded-full overflow-hidden">
                    <div className="h-full bg-white rounded-full transition-all" style={{ width: `${tierInfo.nextTier ? Math.min(tierInfo.progress * 100, 100) : 100}%` }} />
                  </div>
                  <p className="text-[10px] text-white/60 mt-1">{seasonExp.totalExp} / {tierInfo.nextTier ? tierInfo.nextTier.minExp : "MAX"} EXP</p>
                </div>
                {/* 경험치 내역 */}
                {(() => {
                  const expLog = [...seasonExp.expLog].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
                  if (expLog.length === 0) return <p className="text-[11px] text-gray-400 text-center">{locale === "ko" ? "운동할수록 티어가 올라가요" : "Work out more to level up"}</p>;
                  return (
                    <div className="space-y-1.5 mt-1 max-h-[180px] overflow-y-auto scrollbar-hide">
                      {expLog.map((entry, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-400 w-12 shrink-0">{entry.date.slice(5, 10).replace("-", ".")}</span>
                            <span className="text-[11px] text-gray-600">{entry.source === "workout" ? (locale === "ko" ? "운동 완료" : "Workout") : entry.source === "quest" ? (locale === "ko" ? "퀘스트 달성" : "Quest") : (locale === "ko" ? "주간 보너스" : "Weekly Bonus")}</span>
                          </div>
                          <span className="text-[11px] font-bold text-[#2D6A4F] shrink-0">+{entry.amount}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            );
          })()
        )}

        {/* 기록 없을 때 안내 */}
        {history.length === 0 && (
          <div className="mt-4 rounded-2xl bg-[#2D6A4F]/5 border border-[#2D6A4F]/10 px-5 py-6 text-center">
            <p className="text-[15px] font-bold text-[#1B4332] mb-1">{t("proof.noRecordYet")}</p>
            <p className="text-[12px] text-gray-400">{t("proof.firstWorkoutHere")}</p>
          </div>
        )}
        </div>{/* 통합 카드 닫기 */}

        <div className="mt-4 flex flex-col gap-3">
          {/* 체중/시즌티어/성장예측/총운동은 4탭 카드 안으로 이동 */}

          {/* === Collapsible Advanced Stats + 성장 예측 === */}
          <button
            onClick={() => setShowAdvancedStats(v => !v)}
            className="flex items-center justify-center gap-1.5 w-full py-3 text-[12px] font-bold text-gray-400 active:opacity-60 transition-opacity"
          >
            {t("proof.scienceData")}
            <svg className={`w-3.5 h-3.5 transition-transform ${showAdvancedStats ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showAdvancedStats && (<>
          {/* Training Level Estimation Card */}
          {(() => {
            const bw = !isNaN(savedBodyWeight) ? savedBodyWeight : undefined;
            const g = savedGender;
            const levelEst = estimateTrainingLevelDetailed(history, bw, g);
            const lvlLabel = levelEst.level === "advanced" ? t("proof.level.advanced") : levelEst.level === "intermediate" ? t("proof.level.intermediate") : t("proof.level.beginner");
            const lvlGradient = levelEst.level === "advanced"
              ? "from-amber-500 to-orange-400"
              : levelEst.level === "intermediate"
              ? "from-emerald-500 to-teal-400"
              : "from-gray-400 to-gray-300";

            return (
              <div className="rounded-3xl overflow-hidden border border-[#2D6A4F]/10 shadow-sm">
                <div className={`bg-gradient-to-r ${lvlGradient} px-6 py-4`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-black text-white">{t("proof.myGrade")}</h3>
                      <button onClick={() => setHelpCard("trainingLevel")} className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                        <span className="text-[10px] font-black text-white/80">?</span>
                      </button>
                    </div>
                    <span className="text-xl font-black text-white tracking-tight">{lvlLabel}</span>
                  </div>
                  {levelEst.decayed && (
                    <p className="text-[10px] text-white/70 mt-1">{t("proof.gradeDecayed")}</p>
                  )}
                </div>
                <div className="bg-white px-5 py-4">
                  {levelEst.source === "default" ? (
                    <p className="text-[12px] text-gray-400 leading-relaxed py-2">{t("proof.gradeDefault")}</p>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {levelEst.details.map((d, i) => {
                        const accent = d.level === "advanced" ? "border-amber-400 text-amber-500 bg-amber-50"
                          : d.level === "intermediate" ? "border-emerald-400 text-emerald-600 bg-emerald-50"
                          : "border-gray-300 text-gray-400 bg-gray-50";
                        const nm = d.level === "advanced" ? t("proof.level.advanced") : d.level === "intermediate" ? t("proof.level.intermediate") : t("proof.level.beginner");
                        return (
                          <div key={i} className="flex items-center gap-4 py-4 first:pt-1 last:pb-1">
                            <div className={`w-1 h-12 rounded-full ${accent.split(" ")[0].replace("border", "bg")}`} />
                            <p className="flex-1 min-w-0 text-[14px] text-gray-700 font-bold">{d.exercise.startsWith("big3.") ? t(d.exercise) : d.exercise}</p>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-gray-400 font-medium">{t("proof.maxWeight")}</span>
                              <span className="text-[20px] font-black text-[#1B4332] leading-none">{d.weightKg != null ? `${Math.round(toDisplayWeight(d.weightKg))}${unitLabels.weight}` : d.value}</span>
                              <span className={`text-[11px] font-black px-2.5 py-1 rounded-lg ${accent.split(" ").slice(1).join(" ")}`}>{nm}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <p className="text-[8px] text-gray-300 mt-2 pt-2 border-t border-gray-50">NSCA · Rippetoe & Kilgore (2006)</p>
                </div>
              </div>
            );
          })()}

          {/* 4-Week Load Timeline */}
          <LoadTimelineChart
            history={history}
            bodyWeightKg={!isNaN(savedBodyWeight) ? savedBodyWeight : undefined}
            gender={savedGender}
            birthYear={!isNaN(savedBirthYear) ? savedBirthYear : undefined}
            onHelpPress={() => setHelpCard("loadTimeline")}
          />

          {/* Volume Trend Graph */}
          <VolumeTrendChart monthHistory={monthHistory} />

          {/* 회의 64-β: 월간 러닝 과학데이터 (3서브탭) */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden pt-6">
            <MonthlyRunningScience history={history} />
          </div>

          {/* 성장 예측 리포트 */}
          {onShowPrediction && (
            <button
              onClick={onShowPrediction}
              className="w-full bg-white rounded-2xl border border-[#2D6A4F]/10 shadow-sm p-4 flex items-center justify-between active:scale-[0.98] transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#2D6A4F]/10 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-[#2D6A4F]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <p className="text-sm font-bold text-[#1B4332]">{t("proof.growthPrediction")}</p>
              </div>
              <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          </>)}
        </div>
      </div>

      {/* Help Card Bottom Sheet */}
      {helpCard && (
        <HelpCardModal helpCard={helpCard} onClose={() => setHelpCard(null)} />
      )}
      {/* Day Picker Bottom Sheet — multiple sessions on same day */}
      {dayPickerSessions && (
        <div className="absolute inset-0 z-50 flex items-end animate-fade-in" onClick={() => setDayPickerSessions(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
          <div
            className="relative z-10 w-full bg-white rounded-t-[2rem] px-6 pt-5 pb-8 animate-slide-in-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
            <h3 className="text-[#1B4332] text-base font-bold mb-4">
              {t("proof.dayRecord", { month: String(viewMonth + 1), day: String(dayPickerSessions.day) })}
            </h3>
            <div className="flex flex-col gap-2">
              {dayPickerSessions.sessions.map((session, idx) => {
                const d = new Date(session.date);
                const timeStr = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
                return (
                  <DaySessionItem
                    key={session.id || idx}
                    session={session}
                    timeStr={timeStr}
                    onTap={() => {
                      setDayPickerSessions(null);
                      handleSessionClick(session, "dashboard");
                    }}
                    onDelete={() => {
                      if (!session.id) return;
                      handleDeleteSession([session.id]);
                      const remaining = dayPickerSessions.sessions.filter(s => s.id !== session.id);
                      if (remaining.length === 0) {
                        setDayPickerSessions(null);
                      } else {
                        setDayPickerSessions({ ...dayPickerSessions, sessions: remaining });
                      }
                    }}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
