"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";

import { WorkoutHistory as WorkoutHistoryType } from "@/constants/workout";
import { loadWorkoutHistory, deleteWorkoutHistory } from "@/utils/workoutHistory";
import { updateWeightLog } from "@/utils/userProfile";
import { estimateTrainingLevelDetailed, getOptimalLoadBand } from "@/utils/workoutMetrics";
import { SwipeToDelete } from "./SwipeToDelete";
import { useTranslation } from "@/hooks/useTranslation";
import { getCurrentSeason, getTierFromExp, getOrRebuildSeasonExp, getOrCreateWeeklyQuests, TIERS, type QuestDefinition, type QuestProgress } from "@/utils/questSystem";
import { WorkoutReport } from "./WorkoutReport";
import { WorkoutHistory } from "./WorkoutHistory";

function tQuestLabel(label: string, locale: string): string {
  if (locale === "ko") return label;
  return label
    .replace(/고강도 운동 (\d+)회/, "High intensity × $1")
    .replace(/중강도 운동 (\d+)회/, "Moderate intensity × $1")
    .replace(/저강도 운동 (\d+)회/, "Low intensity × $1")
    .replace(/이번 주 (\d+)일 운동/, "$1 days this week")
    .replace(/(\d+)일 연속 운동/, "$1-day streak")
    .replace(/새 운동 (\d+)종목 시도/, "Try $1 new exercises");
}

interface ProofTabProps {
  lockedRuleIds: string[]; // Not used in this version, but kept for compatibility
  onShowPrediction?: () => void;
}

type ViewState = "dashboard" | "list" | "report" | "weight_detail";

/* 스와이프 삭제 지원 세션 아이템 */
function DaySessionItem({ session, timeStr, onTap, onDelete }: {
  session: WorkoutHistoryType; timeStr: string;
  onTap: () => void; onDelete: () => void;
}) {
  const { t } = useTranslation();
  return (
    <SwipeToDelete onDelete={onDelete}>
      <button
        onClick={onTap}
        className="w-full flex items-center justify-between p-4 rounded-2xl bg-[#FAFBF9] border border-gray-100 active:scale-[0.98] transition-all"
      >
        <div className="text-left">
          <p className="text-sm font-bold text-[#1B4332]">{session.sessionData.title}</p>
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
  const [activeVolumeDot, setActiveVolumeDot] = useState<number | null>(null);
  const [activeWeightDot, setActiveWeightDot] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expLogOpen, setExpLogOpen] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [showAddWeight, setShowAddWeight] = useState(false);
  const [newWeightDate, setNewWeightDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newWeightValue, setNewWeightValue] = useState("");
  const [weightSelectMode, setWeightSelectMode] = useState(false);
  const [selectedWeightIdxs, setSelectedWeightIdxs] = useState<Set<number>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [activeTimelineDot, setActiveTimelineDot] = useState<number | null>(null);
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
      const savedWeight = localStorage.getItem("alpha_weight_log");
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
    const savedWeight = localStorage.getItem("alpha_weight_log");
    if (savedWeight) {
      try {
        setWeightLog(JSON.parse(savedWeight));
      } catch { /* ignore */ }
    } else {
      // Seed from existing body weight if no log exists yet
      const currentWeight = localStorage.getItem("alpha_body_weight");
      if (currentWeight) {
        const w = parseFloat(currentWeight);
        if (!isNaN(w) && w > 0) {
          const seed = [{ date: new Date().toISOString().slice(0, 10), weight: w }];
          localStorage.setItem("alpha_weight_log", JSON.stringify(seed));
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

  const handleDeleteSession = (sessionIds: string[]) => {
    const idSet = new Set(sessionIds);
    const updatedHistory = history.filter(h => !idSet.has(h.id));
    setHistory(updatedHistory);
    // Sync deletion to Firestore + localStorage
    deleteWorkoutHistory(sessionIds);
  };

  // Load user profile from localStorage for consistent report rendering
  const savedBodyWeight = typeof window !== "undefined" ? parseFloat(localStorage.getItem("alpha_body_weight") || "") : NaN;
  const savedGender = typeof window !== "undefined" ? (localStorage.getItem("alpha_gender") as "male" | "female") || undefined : undefined;
  const savedBirthYear = typeof window !== "undefined" ? parseInt(localStorage.getItem("alpha_birth_year") || "") : NaN;

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
        onClose={() => setView(reportReturnView)}
        onDelete={() => {
          const updated = history.filter(h => h.id !== selectedHistory.id);
          setHistory(updated);
          localStorage.setItem("alpha_workout_history", JSON.stringify(updated));
          deleteWorkoutHistory([selectedHistory.id]).catch(() => {});
          setView(reportReturnView);
        }}
        onAnalysisComplete={(analysis) => {
            // Update history in localStorage and state
            try {
                const updatedHistory = history.map(h => 
                    h.id === selectedHistory.id ? { ...h, analysis } : h
                );
                setHistory(updatedHistory);
                localStorage.setItem("alpha_workout_history", JSON.stringify(updatedHistory));
                
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
    const sortedLog = [...weightLog].sort((a, b) => b.date.localeCompare(a.date)); // newest first



    const toggleWeightSelect = (idx: number) => {
      setSelectedWeightIdxs(prev => {
        const next = new Set(prev);
        if (next.has(idx)) next.delete(idx); else next.add(idx);
        return next;
      });
    };

    const handleSelectAll = () => {
      if (selectedWeightIdxs.size === sortedLog.length) {
        setSelectedWeightIdxs(new Set());
      } else {
        setSelectedWeightIdxs(new Set(sortedLog.map((_, i) => i)));
      }
    };

    const handleBulkDelete = () => {
      const updated = sortedLog.filter((_, i) => !selectedWeightIdxs.has(i));
      setWeightLog(updated);
      updateWeightLog(updated);
      setSelectedWeightIdxs(new Set());
      setWeightSelectMode(false);
      setShowBulkDeleteConfirm(false);
    };

    const exitSelectMode = () => {
      setWeightSelectMode(false);
      setSelectedWeightIdxs(new Set());
      setShowBulkDeleteConfirm(false);
    };

    const handleAddWeight = () => {
      const parsed = parseFloat(newWeightValue);
      if (isNaN(parsed) || parsed <= 0 || !newWeightDate) return;
      // Check if date already exists
      const existing = weightLog.findIndex(e => e.date === newWeightDate);
      let updated: { date: string; weight: number }[];
      if (existing >= 0) {
        updated = weightLog.map((e, i) => i === existing ? { ...e, weight: parsed } : e);
      } else {
        updated = [...weightLog, { date: newWeightDate, weight: parsed }];
      }
      setWeightLog(updated);
      updateWeightLog(updated);
      setShowAddWeight(false);
      setNewWeightValue("");
      setNewWeightDate(new Date().toISOString().slice(0, 10));
    };

    return (
      <div className="flex flex-col h-full bg-[#FAFBF9] animate-fade-in relative overflow-hidden">
        {/* Header */}
        <div className="pt-[max(3rem,env(safe-area-inset-top))] pb-3 sm:pb-4 px-4 sm:px-6 flex items-center justify-between bg-[#FAFBF9] z-10 shrink-0">
          <button
            onClick={weightSelectMode ? exitSelectMode : () => setView("dashboard")}
            className="p-2 -ml-2"
          >
            <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg sm:text-xl font-serif font-medium text-[#1B4332] uppercase tracking-wide">{t("proof.weightLog")}</h1>
          {sortedLog.length > 0 ? (
            <button
              onClick={() => weightSelectMode ? exitSelectMode() : setWeightSelectMode(true)}
              className="text-sm font-bold text-[#2D6A4F] active:opacity-60"
            >
              {weightSelectMode ? t("common.complete") : t("common.edit")}
            </button>
          ) : (
            <div className="w-10" />
          )}
        </div>

        {/* Select All bar (edit mode) */}
        {weightSelectMode && sortedLog.length > 0 && (
          <div className="px-6 pb-3 flex items-center justify-between shrink-0">
            <button
              onClick={handleSelectAll}
              className="flex items-center gap-2 text-sm font-bold text-gray-600 active:opacity-60"
            >
              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                selectedWeightIdxs.size === sortedLog.length ? "bg-[#2D6A4F] border-[#2D6A4F]" : "border-gray-300"
              }`}>
                {selectedWeightIdxs.size === sortedLog.length && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              {t("proof.selectAll")}
            </button>
            {selectedWeightIdxs.size > 0 && (
              <button
                onClick={() => setShowBulkDeleteConfirm(true)}
                className="text-sm font-bold text-red-500 active:opacity-60"
              >
                {t("proof.deleteN", { count: String(selectedWeightIdxs.size) })}
              </button>
            )}
          </div>
        )}

        {/* Weight List */}
        <div
        className="flex-1 px-4 sm:px-6 overflow-y-auto scrollbar-hide"
        style={{ paddingBottom: "calc(128px + var(--safe-area-bottom, 0px))", overscrollBehavior: "contain" }}
        onTouchMove={(e) => {
          const el = e.currentTarget;
          if (el.scrollTop === 0) e.preventDefault();
        }}
      >
          {sortedLog.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <p>{t("proof.noWeightRecords")}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedLog.map((entry, idx) => {
                const dateObj = new Date(entry.date + "T00:00:00");
                const dateLabel = dateObj.toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US", { year: "numeric", month: "long", day: "numeric", weekday: "short" });
                const prevEntry = sortedLog[idx + 1]; // older entry (sorted newest first)
                const diff = prevEntry ? entry.weight - prevEntry.weight : null;

                return (
                  <div key={entry.date} className="relative flex items-stretch gap-3">
                    {/* Checkbox (edit mode) */}
                    {weightSelectMode && (
                      <button
                        onClick={() => toggleWeightSelect(idx)}
                        className="flex items-center shrink-0 pt-5"
                      >
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                          selectedWeightIdxs.has(idx) ? "bg-[#2D6A4F] border-[#2D6A4F]" : "border-gray-300"
                        }`}>
                          {selectedWeightIdxs.has(idx) && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      </button>
                    )}

                    <div
                      className="flex-1 bg-gray-50 p-5 rounded-2xl border border-gray-100 transition-colors"
                      onClick={weightSelectMode ? () => toggleWeightSelect(idx) : undefined}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-gray-400">{dateLabel}</p>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-lg font-black text-[#1B4332]">{entry.weight.toFixed(1)}</span>
                          <span className="text-xs text-gray-400">kg</span>
                          {diff !== null && diff !== 0 && (
                            <span className={`text-[10px] font-black ml-1 ${diff > 0 ? "text-rose-400" : "text-sky-400"}`}>
                              {diff > 0 ? "+" : ""}{diff.toFixed(1)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Delete Confirmation Modal */}
        {showBulkDeleteConfirm && selectedWeightIdxs.size > 0 && (
          <div className="absolute inset-0 bg-black/40 z-50 flex items-center justify-center animate-fade-in px-8">
            <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl">
              <h3 className="text-lg font-black text-[#1B4332] mb-2">{t("proof.deleteRecords")}</h3>
              <p className="text-sm text-gray-500 mb-6">
                {t("proof.deleteWeightConfirm", { count: String(selectedWeightIdxs.size) })}<br/>{t("proof.deleteIrreversible")}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowBulkDeleteConfirm(false)}
                  className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600 font-bold text-sm active:scale-95 transition-all"
                >
                  {t("proof.cancel")}
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold text-sm active:scale-95 transition-all"
                >
                  {t("proof.delete")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Weight Bottom Sheet */}
        {showAddWeight && (
          <div className="absolute inset-0 z-50">
            <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={() => setShowAddWeight(false)} />
            <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[2rem] p-6 animate-slide-up shadow-2xl" style={{ paddingBottom: "calc(var(--safe-area-bottom, 0px) + 24px)" }}>
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-6" />
              <h3 className="text-lg font-black text-[#1B4332] mb-5">{t("proof.addWeightRecord")}</h3>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">{t("proof.date")}</label>
                  <input
                    type="date"
                    value={newWeightDate}
                    onChange={e => setNewWeightDate(e.target.value)}
                    max={new Date().toISOString().slice(0, 10)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-bold text-[#1B4332] focus:outline-none focus:border-[#2D6A4F]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">{t("proof.weightKg")}</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="75.0"
                    value={newWeightValue}
                    onChange={e => setNewWeightValue(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-bold text-[#1B4332] focus:outline-none focus:border-[#2D6A4F]"
                    autoFocus
                    onKeyDown={e => { if (e.key === "Enter") handleAddWeight(); }}
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowAddWeight(false)}
                  className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600 font-bold text-sm active:scale-95 transition-all"
                >
                  {t("proof.cancel")}
                </button>
                <button
                  onClick={handleAddWeight}
                  disabled={!newWeightValue || parseFloat(newWeightValue) <= 0}
                  className="flex-1 py-3 rounded-xl bg-[#1B4332] text-white font-bold text-sm active:scale-95 transition-all disabled:opacity-40"
                >
                  {t("proof.save")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#FAFBF9] animate-fade-in relative overflow-hidden">
      {/* Fixed Header */}
      <div className="pt-[max(1.5rem,env(safe-area-inset-top))] pb-3 sm:pb-4 px-4 sm:px-6 text-center z-10 shrink-0">
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
          <span className="text-xs font-black text-[#2D6A4F] min-w-[100px] text-center">{currentMonthLabel}</span>
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
        {/* 성취 숫자 or 안내 */}
        <div className="mt-3">
          {monthHistory.length > 0 ? (
            <>
              <h1 className="text-4xl font-black text-[#1B4332]">{monthHistory.length}<span className="text-lg font-bold text-[#2D6A4F]/50 ml-1">{t("proof.workoutCount")}</span></h1>
              <p className="text-[12px] font-medium text-gray-400 mt-1">{isCurrentMonth ? t("proof.thisMonth") : `${viewMonth + 1}${t("proof.monthRecord")}`}</p>
            </>
          ) : isCurrentMonth ? (
            <>
              <h1 className="text-xl font-black text-[#1B4332]">{t("proof.createFirstRecord")}</h1>
              <p className="text-[12px] font-medium text-gray-400 mt-1">{t("proof.startToday")}</p>
            </>
          ) : (
            <>
              <h1 className="text-xl font-black text-gray-300">{t("proof.noRecordsMonth")}</h1>
              <p className="text-[12px] font-medium text-gray-400 mt-1">{t("proof.monthLabel", { month: String(viewMonth + 1) })}</p>
            </>
          )}
        </div>
      </div>

      {/* Scrollable Content with pull-to-refresh */}
      <div
        ref={scrollRef}
        className="flex-1 px-4 sm:px-6 sm:pb-6 overflow-y-auto scrollbar-hide pt-2"
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
        {/* Calendar / Quest Toggle */}
        <div className="flex gap-1 bg-gray-100 rounded-2xl p-1 mb-4">
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

              const grassColors = [
                { bg: "bg-gray-50", text: "text-gray-300", shadow: "" },
                { bg: "bg-[#D1FAE5]", text: "text-gray-700", shadow: "shadow-sm shadow-[#D1FAE5]/40" },
                { bg: "bg-[#6EE7B7]", text: "text-gray-800", shadow: "shadow-sm shadow-[#6EE7B7]/40" },
                { bg: "bg-[#2D6A4F]", text: "text-white", shadow: "shadow-md shadow-[#2D6A4F]/20" },
                { bg: "bg-[#1B4332]", text: "text-white", shadow: "shadow-md shadow-[#1B4332]/30" },
              ];
              const g = grassColors[grassLevel];

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
        </div>
        ) : (
          /* === Weekly Quest Card (toggle view) === */
          (() => {
            const bYear = !isNaN(savedBirthYear) ? savedBirthYear : undefined;
            const { questDefs, questState: qs } = getOrCreateWeeklyQuests(history, bYear, savedGender);
            const coreQs = questDefs.filter(q => !q.isBonus);
            const bonusQs = questDefs.filter(q => q.isBonus);
            const doneCount = qs.quests.filter(q => q.completed).length;
            const coreDone = coreQs.every(cq => qs.quests.find(p => p.questId === cq.id)?.completed);
            const prog = (qDef: QuestDefinition): QuestProgress =>
              qs.quests.find(p => p.questId === qDef.id) || { questId: qDef.id, current: 0, completed: false };

            return (
              <div className="rounded-3xl bg-white border border-gray-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-black text-[#1B4332]">{t("proof.weeklyQuests")}</h3>
                  <span className="text-[11px] font-bold text-[#2D6A4F] bg-[#2D6A4F]/10 px-2 py-0.5 rounded-full">{t("proof.questComplete", { done: String(doneCount), total: String(questDefs.length) })}</span>
                </div>
                <div className="space-y-3">
                  {coreQs.map(q => {
                    const p = prog(q);
                    const pct = Math.min(p.current / q.target, 1);
                    return (
                      <div key={q.id}>
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-[12px] font-bold ${p.completed ? "text-[#2D6A4F]" : "text-gray-700"}`}>
                            {p.completed ? "✓ " : ""}{tQuestLabel(q.label, locale)}
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
                                {p.completed ? "✓ " : "☆ "}{tQuestLabel(q.label, locale)}
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
          {weightLog.length > 0 && (() => {
            const sorted = [...weightLog].sort((a, b) => a.date.localeCompare(b.date));
            const recent = sorted.slice(-30);
            if (recent.length === 0) return null;

            const weights = recent.map(e => e.weight);
            const rawMin = Math.min(...weights);
            const rawMax = Math.max(...weights);
            const padding = rawMax - rawMin < 1 ? 2 : (rawMax - rawMin) * 0.2;
            const minW = rawMin - padding;
            const maxW = rawMax + padding;
            const range = maxW - minW;
            const latestWeight = weights[weights.length - 1];
            const firstWeight = weights[0];
            const diff = latestWeight - firstWeight;

            return (
              <div className="p-4 sm:p-6 bg-white rounded-3xl border border-[#2D6A4F]/10 shadow-sm overflow-visible transition-all">
                <div className="flex justify-between items-baseline mb-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em]">{t("proof.weightTrend")}</p>
                  </div>
                  <button
                    type="button"
                    className="flex items-center gap-2 cursor-pointer active:scale-95 transition-transform"
                    onClick={() => setView("weight_detail")}
                  >
                    <span className={`text-[10px] font-black ${diff > 0 ? "text-rose-400" : diff < 0 ? "text-sky-400" : "text-gray-400"}`}>
                      {diff > 0 ? "+" : ""}{diff.toFixed(1)}kg
                    </span>
                    <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
                <div className="flex items-baseline gap-1 mb-1 sm:mb-2">
                  <h3 className="text-2xl sm:text-3xl font-black text-[#1B4332]">{latestWeight.toFixed(1)}</h3>
                  <span className="text-base sm:text-lg text-[#2D6A4F]/50">kg</span>
                </div>
                <p className="text-[12px] font-bold text-[#2D6A4F] mb-3">
                  {diff <= -1 ? t("proof.weightMsg.losing") : diff <= -0.3 ? t("proof.weightMsg.starting") : diff >= 0.5 ? t("proof.weightMsg.gaining") : t("proof.weightMsg.steady")}
                </p>

                <div className="relative h-36 sm:h-32 mt-2 sm:mt-1 mb-2 mx-5">
                  {/* Y-axis reference lines */}
                  {(() => {
                    const ticks = [rawMin, (rawMin + rawMax) / 2, rawMax];
                    return ticks.map((v, ti) => {
                      const yPct = 95 - ((v - minW) / range) * 90;
                      return (
                        <div key={ti} className="absolute left-0 right-0 pointer-events-none" style={{ top: `${yPct}%` }}>
                          <div className="border-t border-dashed border-gray-200/60 w-full" />
                          <span className="absolute -left-1 -translate-x-full -translate-y-1/2 text-[8px] text-gray-300 font-bold">{v.toFixed(1)}</span>
                        </div>
                      );
                    });
                  })()}
                  <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <path
                      d={recent.map((_, i) => {
                        const x = recent.length === 1 ? 50 : (i / (recent.length - 1)) * 100;
                        const y = 95 - ((weights[i] - minW) / range) * 90;
                        return `${i === 0 ? "M" : "L"} ${x} ${y}`;
                      }).join(" ") + ` L 100 100 L 0 100 Z`}
                      fill="url(#weightGradient)"
                    />
                    <defs>
                      <linearGradient id="weightGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2D6A4F" stopOpacity="0.15" />
                        <stop offset="100%" stopColor="#2D6A4F" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path
                      d={recent.map((_, i) => {
                        const x = recent.length === 1 ? 50 : (i / (recent.length - 1)) * 100;
                        const y = 95 - ((weights[i] - minW) / range) * 90;
                        return `${i === 0 ? "M" : "L"} ${x} ${y}`;
                      }).join(" ")}
                      fill="none" stroke="#2D6A4F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                  {weights.map((w, i) => {
                    const xPct = weights.length === 1 ? 50 : (i / (weights.length - 1)) * 100;
                    const yPct = 95 - ((w - minW) / range) * 90;
                    const isActive = activeWeightDot === i;
                    return (
                      <button type="button" key={i} className="absolute z-10 flex items-center justify-center"
                        style={{ left: `${xPct}%`, top: `${yPct}%`, transform: "translate(-50%, -50%)", width: 44, height: 44, background: "none", border: "none", padding: 0 }}
                        onPointerUp={(e) => { e.stopPropagation(); setActiveWeightDot(isActive ? null : i); }}
                      >
                        {isActive && (
                          <span className="absolute -top-7 text-[10px] font-black text-gray-700 bg-white px-1.5 py-0.5 rounded shadow-sm border border-gray-100 z-20 whitespace-nowrap pointer-events-none">
                            {w.toFixed(1)}kg
                          </span>
                        )}
                        <div className={`rounded-full transition-transform ${isActive ? "scale-150" : ""} w-2 h-2 bg-white border-2 border-[#2D6A4F]`} />
                      </button>
                    );
                  })}
                </div>
                <div className="relative text-[9px] text-gray-300 font-medium mx-5">
                  <span className="absolute left-0 -translate-x-1/2">{recent[0].date.slice(5).replace("-", "/")}</span>
                  <span className="absolute right-0 translate-x-1/2">{recent[recent.length - 1].date.slice(5).replace("-", "/")}</span>
                  <span>&nbsp;</span>
                </div>
              </div>
            );
          })()}

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
                              <span className="text-[11px] text-gray-600">{locale === "ko" ? entry.detail : entry.detail.replace("운동 완료", "Workout").replace("완료", "Complete").replace("주간 올클리어", "Weekly All Clear")}</span>
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
                            <p className="flex-1 min-w-0 text-[14px] text-gray-700 font-bold">{d.exercise}</p>
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
          {(() => {
            const bw = !isNaN(savedBodyWeight) ? savedBodyWeight : undefined;
            const g = savedGender;
            const levelEst = estimateTrainingLevelDetailed(history, bw, g);

            // Last 28 days sessions with volume
            const now = new Date();
            const fourWeeksAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 28);
            const recentSessions = history
              .filter(h => (h.stats?.totalVolume || 0) > 0 && new Date(h.date) >= fourWeeksAgo)
              .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            if (recentSessions.length < 2) return null;

            const graphData = recentSessions.map(h => ({
              date: new Date(h.date),
              loadScore: h.stats.totalVolume && bw ? Math.round((h.stats.totalVolume / bw) * 10) / 10 : h.stats.totalVolume,
              volume: h.stats.totalVolume,
            }));

            const avgLoad = graphData.length > 0
              ? graphData.reduce((s, d) => s + d.loadScore, 0) / graphData.length
              : 0;
            const loadBand = getOptimalLoadBand(avgLoad, graphData.length, levelEst.level, !isNaN(savedBirthYear) ? savedBirthYear : undefined);
            const maxLoad = Math.max(...graphData.map(g => g.loadScore), 1);
            const maxScale = Math.max(maxLoad, loadBand.high, loadBand.overload) * 1.1;

            return (
              <div className="p-4 sm:p-6 bg-white rounded-3xl border border-[#2D6A4F]/10 shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em]">{t("proof.4weekVolume")}</p>
                  <button onClick={() => setHelpCard("loadTimeline")} className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center">
                    <span className="text-[10px] font-black text-gray-400">?</span>
                  </button>
                </div>
                <div className="relative h-36 sm:h-32 mt-5 sm:mt-4 mb-2 mx-5">
                  {/* Y-axis reference lines */}
                  {(() => {
                    const tickValues = [0, Math.round(loadBand.low), Math.round(loadBand.high), Math.round(loadBand.overload)].filter((v, i, a) => a.indexOf(v) === i);
                    return tickValues.map((v, ti) => {
                      const yPct = 100 - ((v / maxScale) * 80);
                      if (yPct < 0 || yPct > 100) return null;
                      return (
                        <div key={ti} className="absolute left-0 right-0 pointer-events-none" style={{ top: `${yPct}%` }}>
                          <div className="border-t border-dashed border-gray-200/60 w-full" />
                          <span className="absolute -left-1 -translate-x-full -translate-y-1/2 text-[8px] text-gray-300 font-bold">{v}</span>
                        </div>
                      );
                    });
                  })()}
                  {/* Zones */}
                  {(() => {
                    const topPct = 100 - (loadBand.high / maxScale) * 80;
                    const overloadPct = 100 - (loadBand.overload / maxScale) * 80;
                    const bottomPct = 100 - (loadBand.low / maxScale) * 80;
                    return (
                      <>
                        <div className="absolute left-0 right-0 bg-amber-50/50 border-t border-amber-200/50 rounded-t" style={{ top: `${Math.max(0, overloadPct)}%`, height: `${Math.max(0, topPct - overloadPct)}%` }} />
                        <div className="absolute left-0 right-0 bg-emerald-50 border-y border-emerald-100 rounded" style={{ top: `${Math.max(0, topPct)}%`, height: `${Math.max(4, bottomPct - topPct)}%` }} />
                      </>
                    );
                  })()}
                  {/* Line */}
                  <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <path
                      className="animate-draw-line"
                      style={{ animationDelay: "0.8s" }}
                      d={graphData.map((d, i) => {
                        const x = (i / (graphData.length - 1)) * 100;
                        const y = 100 - ((d.loadScore / maxScale) * 80);
                        return `${i === 0 ? "M" : "L"} ${x} ${y}`;
                      }).join(" ")}
                      fill="none" stroke="#2D6A4F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                  {/* Dots */}
                  {graphData.map((d, i) => {
                    const xPct = (i / (graphData.length - 1)) * 100;
                    const yPct = 100 - ((d.loadScore / maxScale) * 80);
                    const isActive = activeTimelineDot === i;
                    return (
                      <button
                        type="button"
                        key={i}
                        className="absolute animate-dot-pop z-10 flex items-center justify-center"
                        style={{ left: `${xPct}%`, top: `${yPct}%`, transform: "translate(-50%, -50%)", width: 44, height: 44, background: "none", border: "none", padding: 0, animationDelay: `${0.9 + i * 0.1}s` }}
                        onPointerUp={(e) => { e.stopPropagation(); setActiveTimelineDot(isActive ? null : i); }}
                      >
                        {isActive && (
                          <span className="absolute -top-7 text-[10px] font-black text-gray-700 bg-white px-1.5 py-0.5 rounded shadow-sm border border-gray-100 z-20 whitespace-nowrap pointer-events-none">
                            {d.loadScore.toFixed(1)}
                          </span>
                        )}
                        <div className={`rounded-full border-2 transition-transform ${isActive ? "scale-150" : ""} w-2 h-2 bg-white border-[#2D6A4F]`} />
                      </button>
                    );
                  })}
                </div>
                <div className="relative text-[9px] text-gray-300 font-medium mx-5">
                  <span className="absolute left-0 -translate-x-1/2">{graphData.length > 0 ? `${graphData[0].date.getMonth() + 1}/${graphData[0].date.getDate()}` : ""}</span>
                  <span className="absolute right-0 translate-x-1/2">{graphData.length > 0 ? `${graphData[graphData.length - 1].date.getMonth() + 1}/${graphData[graphData.length - 1].date.getDate()}` : ""}</span>
                  <span>&nbsp;</span>
                </div>
                <div className="flex justify-center gap-2 text-[9px] text-gray-300 font-medium mt-1">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 bg-amber-50 border border-amber-200 rounded-sm inline-block" /> {t("proof.zoneHigh")}</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-100 rounded-sm inline-block" /> {t("proof.zoneOptimal")}</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 bg-[#2D6A4F] rounded-full inline-block" /> {t("proof.zoneVolume")}</span>
                </div>
                {/* Load verdict */}
                {(() => {
                  const latest = graphData[graphData.length - 1].loadScore;
                  const isOverload = latest > loadBand.overload;
                  const isHigh = latest > loadBand.high && !isOverload;
                  const isOptimal = latest >= loadBand.low && latest <= loadBand.high;
                  const label = isOverload ? t("proof.loadOverload") : isHigh ? t("proof.loadHigh") : isOptimal ? t("proof.loadOptimal") : t("proof.loadLow");
                  const color = "text-gray-500";
                  const comment = isOverload
                    ? t("proof.loadOverload.desc")
                    : isHigh
                    ? t("proof.loadHigh.desc")
                    : isOptimal
                    ? t("proof.loadOptimal.desc")
                    : t("proof.loadLow.desc");
                  return (
                    <div className="mt-4 pt-4 border-t border-gray-100 text-center">
                      <p className="text-2xl font-black text-[#1B4332]">{latest.toFixed(1)} <span className={`text-base ${color}`}>— {label}</span></p>
                      <p className="text-[11px] text-gray-400 mt-1 leading-relaxed pb-2">{comment}</p>
                    </div>
                  );
                })()}
              </div>
            );
          })()}

          {/* Volume Trend Graph — grouped by date */}
          {(() => {
            const sessionsWithVolume = monthHistory
              .filter(h => (h.stats?.totalVolume || 0) > 0)
              .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            if (sessionsWithVolume.length === 0) {
              return (
                <div className="p-6 bg-white rounded-3xl border border-[#2D6A4F]/10 shadow-sm">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em] mb-1">{t("proof.monthVolume")}</p>
                  <h3 className="text-xl font-black text-gray-300">{t("proof.noVolume")}</h3>
                </div>
              );
            }

            // Group sessions by date string
            const dateGroups: { dateStr: string; sessions: { volume: number; idx: number }[] }[] = [];
            let globalIdx = 0;
            sessionsWithVolume.forEach(h => {
              const dateStr = new Date(h.date).toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US", { month: "numeric", day: "numeric" });
              const vol = h.stats.totalVolume || 0;
              const last = dateGroups[dateGroups.length - 1];
              if (last && last.dateStr === dateStr) {
                last.sessions.push({ volume: vol, idx: globalIdx++ });
              } else {
                dateGroups.push({ dateStr, sessions: [{ volume: vol, idx: globalIdx++ }] });
              }
            });
            // Keep last 7 date groups
            const recentGroups = dateGroups.slice(-7);

            // All dots flat list with x position based on date group
            const allDots: { volume: number; xPct: number; globalIdx: number }[] = [];
            // Line connects through max volume per date group
            const lineDots: { volume: number; xPct: number }[] = [];

            // If only 1 date group, spread sessions evenly across x-axis
            const totalSessions = recentGroups.reduce((s, g) => s + g.sessions.length, 0);
            const isSingleGroup = recentGroups.length === 1;
            let sessionCounter = 0;

            recentGroups.forEach((group, gi) => {
              let maxVol = 0;
              group.sessions.forEach((s) => {
                const xPct = isSingleGroup
                  ? (totalSessions === 1 ? 50 : (sessionCounter / (totalSessions - 1)) * 100)
                  : (gi / (recentGroups.length - 1)) * 100;
                allDots.push({ volume: s.volume, xPct, globalIdx: s.idx });
                if (s.volume > maxVol) { maxVol = s.volume; }
                sessionCounter++;
              });
              if (isSingleGroup) {
                // Each session becomes its own line point
                group.sessions.forEach((s, si) => {
                  const xPct = totalSessions === 1 ? 50 : ((sessionCounter - group.sessions.length + si) / (totalSessions - 1)) * 100;
                  lineDots.push({ volume: s.volume, xPct });
                });
              } else {
                lineDots.push({ volume: maxVol, xPct: gi / (recentGroups.length - 1) * 100 });
              }
            });

            const allVolumes = allDots.map(d => d.volume);
            const rawMin = Math.min(...allVolumes);
            const rawMax = Math.max(...allVolumes);
            const padding = rawMax - rawMin < 100 ? 200 : (rawMax - rawMin) * 0.2;
            const minV = Math.max(0, rawMin - padding);
            const range = (rawMax + padding) - minV;

            const getY = (v: number) => 95 - ((v - minV) / range) * 90;

            return (
              <div className="p-4 sm:p-6 bg-white rounded-3xl border border-[#2D6A4F]/10 shadow-sm overflow-visible">
                <div className="flex justify-between items-baseline mb-3 sm:mb-4">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em]">{t("proof.monthVolume")}</p>
                  <span className="text-[9px] font-black text-gray-300">{t("proof.recentDays", { count: String(recentGroups.length) })}</span>
                </div>

                <div className="relative h-36 sm:h-32 mt-5 sm:mt-4 mb-2 mx-5">
                  {/* Y-axis reference lines */}
                  {(() => {
                    const mid = Math.round((rawMin + rawMax) / 2 / 100) * 100;
                    const ticks = [rawMin, mid, rawMax].filter((v, i, a) => a.indexOf(v) === i && v >= 0);
                    return ticks.map((v, ti) => {
                      const yPct = getY(v);
                      if (yPct < 0 || yPct > 100) return null;
                      return (
                        <div key={ti} className="absolute left-0 right-0 pointer-events-none" style={{ top: `${yPct}%` }}>
                          <div className="border-t border-dashed border-gray-200/60 w-full" />
                          <span className="absolute -left-1 -translate-x-full -translate-y-1/2 text-[8px] text-gray-300 font-bold">{v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}</span>
                        </div>
                      );
                    });
                  })()}
                  <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <path
                      d={
                        lineDots.map((d, i) => {
                          const y = getY(d.volume);
                          return `${i === 0 ? "M" : "L"} ${d.xPct} ${y}`;
                        }).join(" ") + ` L ${lineDots[lineDots.length - 1].xPct} 100 L ${lineDots[0].xPct} 100 Z`
                      }
                      fill="url(#volumeGradient)"
                    />
                    <defs>
                      <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2D6A4F" stopOpacity="0.15" />
                        <stop offset="100%" stopColor="#2D6A4F" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path
                      d={lineDots.map((d, i) => {
                        const y = getY(d.volume);
                        return `${i === 0 ? "M" : "L"} ${d.xPct} ${y}`;
                      }).join(" ")}
                      fill="none" stroke="#2D6A4F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                  {allDots.map((d, i) => {
                    const yPct = getY(d.volume);
                    const isActive = activeVolumeDot === i;
                    return (
                      <button type="button" key={i} className="absolute z-10 flex items-center justify-center"
                        style={{ left: `${d.xPct}%`, top: `${yPct}%`, transform: "translate(-50%, -50%)", width: 44, height: 44, background: "none", border: "none", padding: 0 }}
                        onPointerUp={(e) => { e.stopPropagation(); setActiveVolumeDot(isActive ? null : i); }}
                      >
                        {isActive && (
                          <span className="absolute -top-7 text-[10px] font-black text-gray-700 bg-white px-1.5 py-0.5 rounded shadow-sm border border-gray-100 z-20 whitespace-nowrap pointer-events-none">
                            {d.volume.toLocaleString()}kg
                          </span>
                        )}
                        <div className={`rounded-full transition-transform ${isActive ? "scale-150" : ""} w-2 h-2 bg-white border-2 border-[#2D6A4F]`} />
                      </button>
                    );
                  })}
                </div>
                <div className="relative text-[9px] text-gray-300 font-medium mx-5">
                  <span className="absolute left-0 -translate-x-1/2">{recentGroups[0].dateStr}</span>
                  <span className="absolute right-0 translate-x-1/2">{recentGroups[recentGroups.length - 1].dateStr}</span>
                  <span>&nbsp;</span>
                </div>
              </div>
            );
          })()}

          </>)}
        </div>
      </div>

      {/* Help Card Bottom Sheet */}
      {helpCard && (
        <div className="absolute inset-0 z-40">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setHelpCard(null)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[2rem] p-6 pb-2 animate-slide-up shadow-2xl z-50 max-h-[85vh] flex flex-col">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5 shrink-0" />
            <div className="flex-1 overflow-y-auto scrollbar-hide">
            {helpCard === "tierSystem" && (
              <>
                <h3 className="text-lg font-black text-[#1B4332] mb-3">{t("proof.help.tierSystem")}</h3>
                <div className="space-y-3 text-[13px] text-gray-600 leading-relaxed">
                  <p dangerouslySetInnerHTML={{ __html: t("proof.help.tierDesc1") }} />
                  <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                    <p className="text-[11px] font-bold text-gray-500">{t("proof.help.howToGetExp")}</p>
                    <div className="space-y-1.5 text-[11px]">
                      <p>{t("proof.help.expWorkout")} <span className="font-bold text-[#2D6A4F]">+1 EXP</span></p>
                      <p>{t("proof.help.expQuest")} <span className="font-bold text-[#2D6A4F]">+2~5 EXP</span></p>
                      <p>{t("proof.help.expAllClear")} <span className="font-bold text-[#2D6A4F]">+5 EXP</span></p>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                    <p className="text-[11px] font-bold text-gray-500">{t("proof.help.tierRanges")}</p>
                    <div className="space-y-1.5">
                      {TIERS.map((t, i) => {
                        const next = TIERS[i + 1];
                        return (
                          <div key={t.name} className="flex items-center gap-2">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded shrink-0 min-w-[72px] text-center" style={{ backgroundColor: `${t.color}20`, color: t.color }}>{t.name}</span>
                            <span className="text-[10px] text-gray-500">{next ? `${t.minExp}~${next.minExp - 1} EXP` : `${t.minExp} EXP+`}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <p dangerouslySetInnerHTML={{ __html: t("proof.help.tierReset") }} />
                  <p dangerouslySetInnerHTML={{ __html: t("proof.help.tierGoal") }} />
                </div>
              </>
            )}
            {helpCard === "loadTimeline" && (
              <>
                <h3 className="text-lg font-black text-[#1B4332] mb-3">{t("proof.help.4weekTitle")}</h3>
                <div className="space-y-3 text-[13px] text-gray-600 leading-relaxed">
                  <p dangerouslySetInnerHTML={{ __html: t("proof.help.4weekDesc") }} />
                  <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 bg-emerald-100 border border-emerald-200 rounded-sm inline-block shrink-0" />
                      <p className="text-[11px]"><span className="font-bold text-[#2D6A4F]">{t("proof.help.zoneGreenLabel")}</span></p>
                    </div>
                    <p className="text-[11px] text-gray-500 ml-5">{t("proof.help.zoneGreenDesc")}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="w-3 h-3 bg-amber-50 border border-amber-200 rounded-sm inline-block shrink-0" />
                      <p className="text-[11px]"><span className="font-bold text-amber-600">{t("proof.help.zoneYellowLabel")}</span></p>
                    </div>
                    <p className="text-[11px] text-gray-500 ml-5">{t("proof.help.zoneYellowDesc")}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="w-3 h-3 bg-[#2D6A4F] rounded-full inline-block shrink-0" />
                      <p className="text-[11px]"><span className="font-bold text-[#2D6A4F]">{t("proof.help.dotLabel")}</span></p>
                    </div>
                    <p className="text-[11px] text-gray-500 ml-5">{t("proof.help.dotDesc")}</p>
                  </div>
                  <p dangerouslySetInnerHTML={{ __html: t("proof.help.zoneConclusion") }} />
                  <p className="text-[10px] text-gray-400 mt-2 pt-2 border-t border-gray-100">ACSM, Schoenfeld et al. (2017), NSCA</p>
                </div>
              </>
            )}
            {helpCard === "trainingLevel" && (
              <>
                <h3 className="text-lg font-black text-[#1B4332] mb-3">{t("proof.help.gradeTitle")}</h3>
                <div className="space-y-3 text-[13px] text-gray-600 leading-relaxed">
                  <p dangerouslySetInnerHTML={{ __html: t("proof.help.gradeDesc") }} />
                  <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                    <p className="text-[11px] font-bold text-gray-500">{t("proof.help.howToGrade")}</p>
                    <div className="space-y-1.5">
                      <div className="flex items-start gap-2">
                        <span className="text-[10px] font-black text-[#2D6A4F] mt-0.5 shrink-0">{t("proof.help.gradePriority1")}</span>
                        <p className="text-[11px]" dangerouslySetInnerHTML={{ __html: t("proof.help.gradePriority1Desc") }} />
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-[10px] font-black text-[#2D6A4F] mt-0.5 shrink-0">{t("proof.help.gradePriority2")}</span>
                        <p className="text-[11px]" dangerouslySetInnerHTML={{ __html: t("proof.help.gradePriority2Desc") }} />
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                    <p className="text-[11px] font-bold text-gray-500">{t("proof.help.gradeStandardMale")}</p>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px]">
                        <span className="font-medium text-gray-500">{t("proof.help.exercise")}</span>
                        <div className="flex gap-3">
                          <span className="font-bold text-gray-400 w-10 text-center">{t("proof.level.beginner")}</span>
                          <span className="font-bold text-[#2D6A4F] w-10 text-center">{t("proof.level.intermediate")}</span>
                          <span className="font-bold text-amber-600 w-10 text-center">{t("proof.level.advanced")}</span>
                        </div>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-gray-600">{t("proof.help.squat")}</span>
                        <div className="flex gap-3">
                          <span className="text-gray-400 w-10 text-center">~0.75x</span>
                          <span className="text-[#2D6A4F] w-10 text-center">0.75x</span>
                          <span className="text-amber-600 w-10 text-center">1.25x+</span>
                        </div>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-gray-600">{t("proof.help.benchPress")}</span>
                        <div className="flex gap-3">
                          <span className="text-gray-400 w-10 text-center">~0.50x</span>
                          <span className="text-[#2D6A4F] w-10 text-center">0.50x</span>
                          <span className="text-amber-600 w-10 text-center">1.00x+</span>
                        </div>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-gray-600">{t("proof.help.deadlift")}</span>
                        <div className="flex gap-3">
                          <span className="text-gray-400 w-10 text-center">~0.75x</span>
                          <span className="text-[#2D6A4F] w-10 text-center">0.75x</span>
                          <span className="text-amber-600 w-10 text-center">1.50x+</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                    <p className="text-[11px] font-bold text-gray-500">{t("proof.help.bodyweightMale")}</p>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-gray-600">{t("proof.help.pushup")}</span>
                        <span className="text-gray-500">{t("proof.help.pushupRange")}</span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-gray-600">{t("proof.help.pullup")}</span>
                        <span className="text-gray-500">{t("proof.help.pullupRange")}</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-amber-50 rounded-xl p-3">
                    <p className="text-[11px] font-bold text-amber-700 mb-1">{t("proof.help.gradeKeep")}</p>
                    <p className="text-[10px] text-amber-600">{t("proof.help.gradeKeepDesc")}</p>
                  </div>
                  <p>{t("proof.help.femaleNote")}</p>
                  <p className="text-[10px] text-gray-400 mt-2 pt-2 border-t border-gray-100">NSCA, Rippetoe & Kilgore (2006)</p>
                </div>
              </>
            )}
            </div>
            <button
              onClick={() => setHelpCard(null)}
              className="w-full py-3 mt-5 rounded-2xl bg-[#1B4332] text-white font-bold text-sm active:scale-[0.98] transition-all shrink-0"
            >
              {t("proof.help.confirm")}
            </button>
          </div>
        </div>
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
