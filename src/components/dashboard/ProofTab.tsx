"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";

import { WorkoutHistory as WorkoutHistoryType } from "@/constants/workout";
import { loadWorkoutHistory, deleteWorkoutHistory } from "@/utils/workoutHistory";

import { estimateTrainingLevelDetailed, detectAchievements } from "@/utils/workoutMetrics";
import { SwipeToDelete } from "@/components/SwipeToDelete";
import { useTranslation } from "@/hooks/useTranslation";
import { getCurrentSeason, getTierFromExp, getOrRebuildSeasonExp, getOrCreateWeeklyQuests, rebuildFromHistory, saveSeasonExp, translateQuestLabel, translateExpDetail, type QuestDefinition, type QuestProgress } from "@/utils/questSystem";
import { WorkoutReport } from "@/components/report/WorkoutReport";
import { WorkoutHistory } from "./WorkoutHistory";
import { WeightDetailView } from "./WeightDetailView";
import { HelpCardModal } from "./HelpCardModal";
import { WeightTrendChart } from "./WeightTrendChart";
import { LoadTimelineChart } from "./LoadTimelineChart";
import { VolumeTrendChart } from "./VolumeTrendChart";

const GRASS_COLORS = [
  { bg: "bg-gray-50", text: "text-gray-300", shadow: "" },
  { bg: "bg-[#C2D8C2]", text: "text-gray-700", shadow: "shadow-sm shadow-[#C2D8C2]/40" },
  { bg: "bg-[#7BA57B]", text: "text-white", shadow: "shadow-sm shadow-[#7BA57B]/40" },
  { bg: "bg-[#2D6A4F]", text: "text-white", shadow: "shadow-md shadow-[#2D6A4F]/20" },
  { bg: "bg-[#1B4332]", text: "text-white", shadow: "shadow-md shadow-[#1B4332]/30" },
];

interface ProofTabProps {
  lockedRuleIds: string[]; // Not used in this version, but kept for compatibility
  onShowPrediction?: () => void;
}

type ViewState = "dashboard" | "list" | "report" | "weight_detail";

/**
 * 회의 26: 서버 세션 타이틀 한글 → EN 렌더 번역
 * WorkoutReport/MasterPlanPreview의 translateDesc 체인과 동일 규칙.
 * 복합 패턴(상체(당기기))을 먼저 치환해야 단일 "상체" 치환이 괄호 내용을 망치지 않음.
 */
function translateSessionTitle(title: string, locale: string): string {
  if (locale === "ko") return title;
  return title
    .replace(/상체\(밀기\)/g, "Upper (Push)").replace(/상체\(당기기\)/g, "Upper (Pull)")
    .replace(/상체 \+ 밀기/g, "Upper + Push").replace(/상체 \+ 당기기/g, "Upper + Pull")
    .replace(/하체/g, "Lower").replace(/상체/g, "Upper").replace(/가슴/g, "Chest").replace(/등/g, "Back")
    .replace(/어깨/g, "Shoulders").replace(/팔/g, "Arms")
    .replace(/밀기/g, "Push").replace(/당기기/g, "Pull")
    .replace(/(\d+)종/g, "$1 exercises").replace(/(\d+)세트/g, "$1 sets")
    .replace(/집중 운동/g, "Focus")
    .replace(/인터벌 러닝/g, "Interval Running").replace(/이지 런/g, "Easy Run").replace(/장거리 러닝/g, "Long Distance Run")
    .replace(/러너 코어/g, "Runner Core")
    .replace(/근비대/g, "Hypertrophy").replace(/근력 강화/g, "Strength")
    .replace(/살 빼기/g, "Fat Loss").replace(/근육 키우기/g, "Muscle Gain").replace(/힘 세지기/g, "Strength")
    .replace(/체지방 감량/g, "Fat Loss").replace(/전반적 체력 향상/g, "General Fitness")
    .replace(/기초체력강화/g, "Fitness").replace(/기초체력/g, "Fitness")
    .replace(/홈트레이닝/g, "Home Training").replace(/러닝/g, "Running");
}

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
          <p className="text-sm font-bold text-[#1B4332]">{translateSessionTitle(session.sessionData.title, locale)}</p>
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
  const [history, setHistory] = useState<WorkoutHistoryType[]>([]);
  const [view, setView] = useState<ViewState>("dashboard");
  const [selectedHistory, setSelectedHistory] = useState<WorkoutHistoryType | null>(null);
  const [monthOffset, setMonthOffset] = useState(0); // 0 = current month, -1 = last month, etc.
  const [weightLog, setWeightLog] = useState<{ date: string; weight: number }[]>([]);
  const [helpCard, setHelpCard] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expLogOpen, setExpLogOpen] = useState(false);
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
  const [proofView, setProofView] = useState<"calendar" | "quest">("calendar");

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
        onClose={() => setView(reportReturnView)}
        onDelete={() => {
          const updated = history.filter(h => h.id !== selectedHistory.id);
          setHistory(updated);
          localStorage.setItem("ohunjal_workout_history", JSON.stringify(updated));
          deleteWorkoutHistory([selectedHistory.id]).catch(() => {});
          // Rebuild EXP from remaining history
          const rebuilt = rebuildFromHistory(updated, !isNaN(savedBirthYear) ? savedBirthYear : undefined, savedGender);
          saveSeasonExp(rebuilt);
          setView(reportReturnView);
        }}
        onAnalysisComplete={(analysis) => {
            // Update history in localStorage and state
            try {
                const updatedHistory = history.map(h => 
                    h.id === selectedHistory.id ? { ...h, analysis } : h
                );
                setHistory(updatedHistory);
                localStorage.setItem("ohunjal_workout_history", JSON.stringify(updatedHistory));
                
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
    <div className="flex flex-col h-full bg-[#F0F4F1] animate-fade-in relative overflow-hidden">
      {/* ── 다크 히어로 존 (스크롤에 포함 — 위로 밀려남) ── */}
      <div className="shrink-0 pt-[max(1rem,env(safe-area-inset-top))] px-4 sm:px-6 text-center z-10 relative"
        style={{ background: "radial-gradient(ellipse at 50% 0%, #2D6A4F 0%, #1B4332 70%)" }}>
        {/* 서브타이틀 제거 — 월 네비에 이미 정보 충분 */}
        {/* 월 네비게이션 */}
        <div className="inline-flex items-center gap-1 bg-white/10 rounded-full">
          <button
            onClick={() => setMonthOffset(prev => prev - 1)}
            className="p-2 pl-3 active:opacity-60 transition-opacity"
          >
            <svg className="w-3.5 h-3.5 text-[#95D5B2]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-xs font-black text-white min-w-[100px] text-center">{currentMonthLabel}</span>
          <button
            onClick={() => setMonthOffset(prev => Math.min(prev + 1, 0))}
            disabled={isCurrentMonth}
            className="p-2 pr-3 active:opacity-60 transition-opacity disabled:opacity-20"
          >
            <svg className="w-3.5 h-3.5 text-[#95D5B2]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        {/* 히어로: 좌 숫자 + 우 통계 */}
        <div className="mt-3 mb-1">
          {monthHistory.length > 0 ? (
            <div className="flex items-end gap-4 px-2">
              <h1 className="text-5xl font-black text-white leading-none" style={{ textShadow: "0 0 30px rgba(82,183,136,0.3)" }}>{monthHistory.length}<span className="text-base font-bold text-[#95D5B2]/50 ml-1">{t("proof.workoutCount")}</span></h1>
              <p className="text-base text-[#95D5B2]/60 ml-auto font-bold">
                <span className="text-xl font-black text-white/90">{Math.round(monthHistory.reduce((s, h) => s + (h.stats.totalVolume || 0), 0)).toLocaleString()}</span> kg · <span className="text-xl font-black text-white/90">{Math.round(monthHistory.reduce((s, h) => s + (h.stats.totalDurationSec || 0), 0) / 60)}</span> {locale === "ko" ? "분" : "min"} · <span className="text-xl font-black text-white/90">{monthHistory.reduce((s, h) => s + (h.stats.totalSets || 0), 0)}</span> {locale === "ko" ? "세트" : "sets"}
              </p>
            </div>
          ) : isCurrentMonth ? (
            <div className="text-center">
              <h1 className="text-xl font-black text-white">{t("proof.createFirstRecord")}</h1>
              <p className="text-[12px] font-medium text-[#95D5B2]/50 mt-1">{t("proof.startToday")}</p>
            </div>
          ) : (
            <div className="text-center">
              <h1 className="text-xl font-black text-white/30">{t("proof.noRecordsMonth")}</h1>
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
            <div className="mt-3 pb-2">
              <p className="text-[10px] font-black text-[#95D5B2]/40 uppercase tracking-[0.15em] mb-2 text-left">
                {locale === "ko" ? "나의 업적" : "Highlights"}
              </p>
              <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 -mx-4 px-4 sm:-mx-6 sm:px-6">
                {recent.map((a, i) => {
                  const cardStyle = a.type === "pr"
                    ? "border-amber-400/30 shadow-[0_2px_15px_rgba(251,191,36,0.15)]"
                    : a.type === "streak"
                      ? "border-[#52B788]/30 shadow-[0_2px_15px_rgba(82,183,136,0.15)]"
                      : a.type === "milestone"
                        ? "border-white/20 shadow-[0_2px_15px_rgba(255,255,255,0.1)]"
                        : "border-white/15 shadow-[0_2px_10px_rgba(0,0,0,0.3)]";
                  return (
                  <div key={i} className={`shrink-0 bg-white/10 backdrop-blur-md rounded-2xl border px-4 py-3 min-w-[140px] ${cardStyle}`}>
                    <p className="text-[9px] font-bold text-[#95D5B2]/40 mb-1">
                      {a.date.slice(0, 10).replace(/-/g, ".")}
                    </p>
                    <p className="text-sm font-black text-white leading-tight">
                      {locale === "ko" ? a.title : a.titleEn}
                    </p>
                    <p className={`text-[9px] font-bold mt-1 ${a.type === "pr" ? "text-amber-400/70" : "text-[#52B788]/60"}`}>
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
        className="flex-1 overflow-y-auto scrollbar-hide"
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
        {/* 다크 → 라이트 그라데이션 전환 */}
        <div className="h-16 bg-gradient-to-b from-[#1B4332] to-[#F0F4F1] -mx-4 sm:-mx-6 px-4 sm:px-6" />
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

        {/* ── 부위 도감 (이번 달) ── */}
        {monthHistory.length > 0 && (() => {
          const partCount: Record<string, number> = {};
          for (const h of monthHistory) {
            const title = (h.sessionData.title || h.sessionData.description || "").toLowerCase();
            if (/가슴|chest|push|푸쉬/.test(title)) partCount["chest"] = (partCount["chest"] || 0) + 1;
            if (/등|back|pull|당기/.test(title)) partCount["back"] = (partCount["back"] || 0) + 1;
            if (/어깨|shoulder|숄더/.test(title)) partCount["shoulder"] = (partCount["shoulder"] || 0) + 1;
            if (/하체|leg|lower|스쿼트|squat/.test(title)) partCount["legs"] = (partCount["legs"] || 0) + 1;
            if (/팔|arm|이두|삼두|bicep|tricep/.test(title)) partCount["arms"] = (partCount["arms"] || 0) + 1;
            if (/코어|core|복근|abs/.test(title)) partCount["core"] = (partCount["core"] || 0) + 1;
            if (/러닝|유산소|cardio|run|hiit|서킷/.test(title)) partCount["cardio"] = (partCount["cardio"] || 0) + 1;
          }
          const parts = [
            { key: "chest", ko: "가슴", en: "Chest" },
            { key: "back", ko: "등", en: "Back" },
            { key: "shoulder", ko: "어깨", en: "Shoulder" },
            { key: "legs", ko: "하체", en: "Legs" },
            { key: "arms", ko: "팔", en: "Arms" },
            { key: "core", ko: "코어", en: "Core" },
            { key: "cardio", ko: "유산소", en: "Cardio" },
          ];
          const maxCount = 8; // ACSM 권장 부위별 주 2회 = 월 8회
          return (
            <div className="bg-white/80 rounded-2xl border border-[#2D6A4F]/10 p-4 shadow-sm mb-5 relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#2D6A4F]/30 rounded-l-2xl" />
              <p className="text-[10px] font-black text-[#2D6A4F]/50 uppercase tracking-[0.15em] mb-3 pl-2">
                {locale === "ko" ? "부위 도감" : "Body Part Log"}
              </p>
              <div className="space-y-2.5 pl-2">
                {parts.map(p => {
                  const count = partCount[p.key] || 0;
                  const pct = Math.min((count / maxCount) * 100, 100);
                  return (
                    <div key={p.key} className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-[#1B4332]/60 w-10 shrink-0">{locale === "ko" ? p.ko : p.en}</span>
                      <div className="flex-1 h-2 bg-[#2D6A4F]/10 rounded-full overflow-hidden">
                        <div className="h-full bg-[#2D6A4F] rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[10px] font-bold text-[#1B4332]/40 w-4 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Calendar / Quest Toggle */}
        <div className="flex gap-1 bg-[#2D6A4F]/10 rounded-2xl p-1 mb-5">
          <button
            onClick={() => setProofView("calendar")}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
              proofView === "calendar" ? "bg-white text-[#1B4332] shadow-sm" : "text-gray-400"
            }`}
          >
            {t("proof.calendar")}
          </button>
          <button
            onClick={() => setProofView("quest")}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
              proofView === "quest" ? "bg-white text-[#1B4332] shadow-sm" : "text-gray-400"
            }`}
          >
            {t("proof.quests")}
          </button>
        </div>

        {proofView === "calendar" ? (
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
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

              // Grass intensity: total minutes across all sessions
              const totalMin = daySessions.reduce((s, h) => s + (h.stats?.totalDurationSec || 0), 0) / 60;
              const grassLevel = !isCompleted ? 0
                : totalMin <= 0 ? 2 // fallback: duration unknown → mid level
                : totalMin < 15 ? 1
                : totalMin < 30 ? 2
                : totalMin < 50 ? 3
                : 4;

              const g = GRASS_COLORS[grassLevel];

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
                  {daySessions.length > 1 && (
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
        </div>
        ) : (
          /* === Weekly Quest Card (toggle view) === */
          (() => {
            const bYear = !isNaN(savedBirthYear) ? savedBirthYear : undefined;
            const { questDefs, questState: qs, window } = getOrCreateWeeklyQuests(history, bYear, savedGender);
            const coreQs = questDefs.filter(q => !q.isBonus);
            const bonusQs = questDefs.filter(q => q.isBonus);
            const doneCount = qs.quests.filter(q => q.completed).length;
            const coreDone = coreQs.every(cq => qs.quests.find(p => p.questId === cq.id)?.completed);
            const prog = (qDef: QuestDefinition): QuestProgress =>
              qs.quests.find(p => p.questId === qDef.id) || { questId: qDef.id, current: 0, completed: false };

            // 회의 18: 윈도우 기간 포맷 (예: "4/1 ~ 4/5, 5일")
            const fmtMd = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
            const rangeLabel = `${fmtMd(window.start)} ~ ${fmtMd(window.end)}, ${window.days}${t("proof.questDays")}`;

            return (
              <div className="rounded-3xl bg-white border border-gray-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-black text-[#1B4332]">{t("proof.weeklyQuests")}</h3>
                  <span className="text-[11px] font-bold text-[#2D6A4F] bg-[#2D6A4F]/10 px-2 py-0.5 rounded-full">{t("proof.questComplete", { done: String(doneCount), total: String(questDefs.length) })}</span>
                </div>
                <p className="text-[11px] text-gray-400 mb-3">{rangeLabel}</p>
                {window.isScaled && (
                  <p className="text-[11px] text-[#2D6A4F] bg-[#2D6A4F]/5 rounded-lg px-3 py-2 mb-3">{t("proof.questScaledNotice")}</p>
                )}
                <div className="space-y-3">
                  {coreQs.map(q => {
                    const p = prog(q);
                    const pct = Math.min(p.current / q.target, 1);
                    return (
                      <div key={q.id}>
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-[12px] font-bold ${p.completed ? "text-[#2D6A4F]" : "text-gray-700"}`}>
                            {p.completed ? "✓ " : ""}{translateQuestLabel(q, t)}
                          </span>
                          <span className="text-[11px] font-bold text-gray-400">{q.exp} EXP</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct * 100}%`, backgroundColor: p.completed ? "#2D6A4F" : "#a7f3d0" }} />
                          </div>
                          <span className="text-[10px] font-bold text-gray-400 min-w-[32px] text-right">{p.current}/{q.target}</span>
                        </div>
                      </div>
                    );
                  })}
                  {bonusQs.length > 0 && (
                    <div className="pt-2 border-t border-gray-100 space-y-3">
                      {bonusQs.map(q => {
                        const p = prog(q);
                        const pct = Math.min(p.current / q.target, 1);
                        return (
                          <div key={q.id} className="opacity-60">
                            <div className="flex items-center justify-between mb-1">
                              <span className={`text-[12px] font-bold ${p.completed ? "text-[#2D6A4F]" : "text-gray-500"}`}>
                                {p.completed ? "✓ " : "☆ "}{translateQuestLabel(q, t)}
                              </span>
                              <span className="text-[11px] font-bold text-gray-400">{q.exp} EXP</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct * 100}%`, backgroundColor: p.completed ? "#2D6A4F" : "#d1d5db" }} />
                              </div>
                              <span className="text-[10px] font-bold text-gray-400 min-w-[32px] text-right">{p.current}/{q.target}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {coreDone && !qs.weeklyBonusClaimed && (
                    <div className="mt-2 p-3 bg-[#2D6A4F]/10 rounded-xl text-center">
                      <span className="text-[12px] font-black text-[#2D6A4F]">{t("proof.allClearBonus")}</span>
                    </div>
                  )}
                </div>
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

        <div className="mt-6 flex flex-col gap-3">
          {/* Weight Trend Graph */}
          {weightLog.length > 0 && (
            <WeightTrendChart weightLog={weightLog} onViewAll={() => setView("weight_detail")} />
          )}

          {/* === 성장 예측 리포트 === */}
          {onShowPrediction && (
            <button
              onClick={onShowPrediction}
              className="w-full bg-white rounded-3xl border border-[#2D6A4F]/10 shadow-sm p-5 flex items-center justify-between active:scale-[0.98] transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#2D6A4F]/10 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-[#2D6A4F]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-[#1B4332]">{t("proof.growthPrediction")}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{t("proof.growthPrediction.desc")}</p>
                </div>
              </div>
              <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          {/* === Season Tier Card === */}
          {(() => {
            const seasonInfo = getCurrentSeason();
            const seasonExp = getOrRebuildSeasonExp(history, !isNaN(savedBirthYear) ? savedBirthYear : undefined, savedGender);
            const tierResult = getTierFromExp(seasonExp.totalExp);
            const seasonSessions = history.filter(h => {
              const d = h.date.slice(0, 10);
              return d >= seasonInfo.startDate && d <= seasonInfo.endDate;
            }).length;

            const expLog = [...seasonExp.expLog].sort((a, b) => b.date.localeCompare(a.date));

            return (
              <div className="rounded-3xl overflow-hidden border shadow-sm" style={{ borderColor: `${tierResult.tier.color}30` }}>
                <div
                  className="px-6 py-4 cursor-pointer"
                  style={{ background: `linear-gradient(135deg, ${tierResult.tier.color}20, ${tierResult.tier.color}08)` }}
                  onClick={() => setExpLogOpen(v => !v)}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold text-gray-400 mb-1">{locale === "ko" ? seasonInfo.label : seasonInfo.label.replace("시즌", "Season")}</p>
                    <button onClick={(e) => { e.stopPropagation(); setHelpCard("tierSystem"); }} className="w-5 h-5 rounded-full bg-black/5 flex items-center justify-center -mt-1 -mr-1">
                      <span className="text-[10px] font-black text-gray-400">?</span>
                    </button>
                  </div>
                  <span className="text-2xl font-black" style={{ color: tierResult.tier.color }}>{tierResult.tier.name}</span>
                  <div className="mt-3">
                    <div className="w-full h-2.5 bg-black/5 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${tierResult.progress * 100}%`, backgroundColor: tierResult.tier.color }} />
                    </div>
                    <div className="flex justify-between mt-1.5">
                      <span className="text-[11px] font-bold" style={{ color: tierResult.tier.color }}>{seasonExp.totalExp} EXP</span>
                      <span className="text-[11px] text-gray-400">
                        {tierResult.nextTier ? t("report.tierRemaining", { next: tierResult.nextTier.name, remaining: `${tierResult.remaining} EXP` }) : t("report.maxTier")}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-[11px] text-gray-400">{t("proof.seasonWorkouts", { count: String(seasonSessions) })}</p>
                    <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-300 ${expLogOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>

                {/* EXP 내역 아코디언 */}
                <div className={`overflow-hidden transition-all duration-300 ${expLogOpen ? "max-h-[300px]" : "max-h-0"}`}>
                  <div className="px-6 py-3 border-t overflow-y-auto max-h-[280px]" style={{ borderColor: `${tierResult.tier.color}15` }}>
                    {expLog.length === 0 ? (
                      <p className="text-[11px] text-gray-400 text-center py-2">{t("proof.noExpYet")}</p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {expLog.map((entry, i) => (
                          <div key={i} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-gray-400 w-12 shrink-0">
                                {entry.date.slice(5, 10).replace("-", ".")}
                              </span>
                              <span className="text-[11px] text-gray-600">{translateExpDetail(entry, t)}</span>
                            </div>
                            <span className="text-[11px] font-bold shrink-0 ml-2" style={{ color: tierResult.tier.color }}>+{entry.amount}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Workout History List Button */}
          <button
            onClick={() => setView("list")}
            className="p-6 bg-white rounded-3xl border border-gray-100 shadow-sm w-full text-left active:scale-[0.98] transition-all group"
          >
            <div className="flex justify-between items-center mb-1">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em]">{t("proof.totalWorkouts")}</p>
                <svg className="w-5 h-5 text-gray-300 group-hover:text-gray-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
            </div>
            <h3 className="text-3xl font-black text-[#1B4332]">{history.length} <span className="text-lg text-[#2D6A4F]/50">{t("proof.sessionUnit")}</span></h3>
            <p className="text-xs text-gray-400 mt-2 font-medium">{t("proof.clickToDetail")}</p>
          </button>

          {/* === Collapsible Advanced Stats === */}
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
                              <span className="text-[20px] font-black text-[#1B4332] leading-none">{d.value}</span>
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
