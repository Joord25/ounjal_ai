"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";

import { WorkoutHistory as WorkoutHistoryType } from "@/constants/workout";
import { loadWorkoutHistory, deleteWorkoutHistory } from "@/utils/workoutHistory";
import { updateWeightLog } from "@/utils/userProfile";
import { estimateTrainingLevelDetailed, getOptimalLoadBand } from "@/utils/workoutMetrics";
import { getCurrentSeason, getTierFromExp, getOrRebuildSeasonExp, getOrCreateWeeklyQuests, TIERS, type QuestDefinition, type QuestProgress } from "@/utils/questSystem";
import { WorkoutReport } from "./WorkoutReport";
import { WorkoutHistory } from "./WorkoutHistory";

interface ProofTabProps {
  lockedRuleIds: string[]; // Not used in this version, but kept for compatibility
}

type ViewState = "dashboard" | "list" | "report" | "weight_detail";

/* 롱프레스 삭제 지원 세션 아이템 */
function DaySessionItem({ session, timeStr, onTap, onDelete }: {
  session: WorkoutHistoryType; timeStr: string;
  onTap: () => void; onDelete: () => void;
}) {
  const [showDelete, setShowDelete] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startPress = () => {
    timerRef.current = setTimeout(() => setShowDelete(true), 500);
  };
  const endPress = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  };

  if (confirmDelete) {
    return (
      <div className="w-full flex items-center justify-between p-4 rounded-2xl bg-red-50 border border-red-200">
        <p className="text-sm font-bold text-red-600">이 기록을 삭제할까요?</p>
        <div className="flex gap-2">
          <button onClick={() => setConfirmDelete(false)} className="text-xs font-bold text-gray-500 px-3 py-1.5 rounded-lg bg-gray-100">취소</button>
          <button onClick={onDelete} className="text-xs font-bold text-white px-3 py-1.5 rounded-lg bg-red-500">삭제</button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={showDelete ? () => setShowDelete(false) : onTap}
        onPointerDown={startPress}
        onPointerUp={endPress}
        onPointerLeave={endPress}
        className="w-full flex items-center justify-between p-4 rounded-2xl bg-[#FAFBF9] border border-gray-100 active:scale-[0.98] transition-all"
      >
        <div className="text-left">
          <p className="text-sm font-bold text-[#1B4332]">{session.sessionData.title}</p>
          <p className="text-xs text-[#6B7280] mt-0.5">
            {session.stats.totalSets}세트 · {session.stats.totalVolume.toLocaleString()}kg
          </p>
        </div>
        <span className="text-xs font-medium text-[#6B7280]">{timeStr}</span>
      </button>
      {showDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center shadow-md animate-fade-in"
        >
          <span className="text-white text-xs font-black leading-none">✕</span>
        </button>
      )}
    </div>
  );
}

export const ProofTab: React.FC<ProofTabProps> = () => {
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
  const currentMonthLabel = viewDate.toLocaleString('ko-KR', { year: 'numeric', month: 'long' });

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
          <h1 className="text-lg sm:text-xl font-serif font-medium text-[#1B4332] uppercase tracking-wide">체중 기록</h1>
          {sortedLog.length > 0 ? (
            <button
              onClick={() => weightSelectMode ? exitSelectMode() : setWeightSelectMode(true)}
              className="text-sm font-bold text-[#2D6A4F] active:opacity-60"
            >
              {weightSelectMode ? "완료" : "편집"}
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
              전체 선택
            </button>
            {selectedWeightIdxs.size > 0 && (
              <button
                onClick={() => setShowBulkDeleteConfirm(true)}
                className="text-sm font-bold text-red-500 active:opacity-60"
              >
                {selectedWeightIdxs.size}개 삭제
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
              <p>체중 기록이 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedLog.map((entry, idx) => {
                const dateObj = new Date(entry.date + "T00:00:00");
                const dateLabel = dateObj.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" });
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
              <h3 className="text-lg font-black text-[#1B4332] mb-2">기록 삭제</h3>
              <p className="text-sm text-gray-500 mb-6">
                {selectedWeightIdxs.size}개의 체중 기록을 삭제하시겠습니까?<br/>삭제된 기록은 복구할 수 없습니다.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowBulkDeleteConfirm(false)}
                  className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600 font-bold text-sm active:scale-95 transition-all"
                >
                  취소
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold text-sm active:scale-95 transition-all"
                >
                  삭제
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
              <h3 className="text-lg font-black text-[#1B4332] mb-5">체중 기록 추가</h3>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">날짜</label>
                  <input
                    type="date"
                    value={newWeightDate}
                    onChange={e => setNewWeightDate(e.target.value)}
                    max={new Date().toISOString().slice(0, 10)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-bold text-[#1B4332] focus:outline-none focus:border-[#2D6A4F]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">체중 (kg)</label>
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
                  취소
                </button>
                <button
                  onClick={handleAddWeight}
                  disabled={!newWeightValue || parseFloat(newWeightValue) <= 0}
                  className="flex-1 py-3 rounded-xl bg-[#1B4332] text-white font-bold text-sm active:scale-95 transition-all disabled:opacity-40"
                >
                  저장
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
              <h1 className="text-4xl font-black text-[#1B4332]">{monthHistory.length}<span className="text-lg font-bold text-[#2D6A4F]/50 ml-1">회 운동</span></h1>
              <p className="text-[12px] font-medium text-gray-400 mt-1">{isCurrentMonth ? "이번 달의 기록" : `${viewMonth + 1}월의 기록`}</p>
            </>
          ) : isCurrentMonth ? (
            <>
              <h1 className="text-xl font-black text-[#1B4332]">첫 기록을 만들어보세요</h1>
              <p className="text-[12px] font-medium text-gray-400 mt-1">오늘 시작하면 여기에 쌓여요</p>
            </>
          ) : (
            <>
              <h1 className="text-xl font-black text-gray-300">기록이 없어요</h1>
              <p className="text-[12px] font-medium text-gray-400 mt-1">{viewMonth + 1}월</p>
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
            캘린더
          </button>
          <button
            onClick={() => setProofView("quest")}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
              proofView === "quest" ? "bg-white text-[#1B4332] shadow-sm" : "text-gray-400"
            }`}
          >
            퀘스트
          </button>
        </div>

        {proofView === "calendar" ? (
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
          <div className="grid grid-cols-7 gap-2">
            {['일', '월', '화', '수', '목', '금', '토'].map((day, i) => (
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
                    isCompleted
                      ? 'bg-[#2D6A4F] text-white shadow-md shadow-[#2D6A4F]/20 cursor-pointer active:scale-90'
                      : 'bg-gray-50 text-gray-300'
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
                  <h3 className="text-sm font-black text-[#1B4332]">이번 주 퀘스트</h3>
                  <span className="text-[11px] font-bold text-[#2D6A4F] bg-[#2D6A4F]/10 px-2 py-0.5 rounded-full">{doneCount}/{questDefs.length} 완료</span>
                </div>
                <div className="space-y-3">
                  {coreQs.map(q => {
                    const p = prog(q);
                    const pct = Math.min(p.current / q.target, 1);
                    return (
                      <div key={q.id}>
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-[12px] font-bold ${p.completed ? "text-[#2D6A4F]" : "text-gray-700"}`}>
                            {p.completed ? "✓ " : ""}{q.label}
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
                                {p.completed ? "✓ " : "☆ "}{q.label}
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
                      <span className="text-[12px] font-black text-[#2D6A4F]">올클리어 보너스 +5 EXP!</span>
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
            <p className="text-[15px] font-bold text-[#1B4332] mb-1">아직 운동 기록이 없어요</p>
            <p className="text-[12px] text-gray-400">첫 운동을 완료하면 여기에 기록이 쌓여요</p>
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
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em]">체중 변화</p>
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
                  {diff <= -1 ? "목표에 한 발짝 가까워지고 있어요!" : diff <= -0.3 ? "조금씩 변화가 시작되고 있어요" : diff >= 0.5 ? "근육이 붙으면서 체중이 오를 수 있어요" : "꾸준히 기록하면 변화가 보여요"}
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
                    <p className="text-[10px] font-bold text-gray-400 mb-1">{seasonInfo.label}</p>
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
                        {tierResult.nextTier ? `${tierResult.nextTier.name}까지 ${tierResult.remaining} EXP` : "최고 티어!"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-[11px] text-gray-400">이번 시즌 {seasonSessions}회 운동</p>
                    <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-300 ${expLogOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>

                {/* EXP 내역 아코디언 */}
                <div className={`overflow-hidden transition-all duration-300 ${expLogOpen ? "max-h-[300px]" : "max-h-0"}`}>
                  <div className="px-6 py-3 border-t overflow-y-auto max-h-[280px]" style={{ borderColor: `${tierResult.tier.color}15` }}>
                    {expLog.length === 0 ? (
                      <p className="text-[11px] text-gray-400 text-center py-2">아직 경험치 내역이 없어요</p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {expLog.map((entry, i) => (
                          <div key={i} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-gray-400 w-12 shrink-0">
                                {entry.date.slice(5, 10).replace("-", ".")}
                              </span>
                              <span className="text-[11px] text-gray-600">{entry.detail}</span>
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
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em]">총 운동 횟수</p>
                <svg className="w-5 h-5 text-gray-300 group-hover:text-gray-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
            </div>
            <h3 className="text-3xl font-black text-[#1B4332]">{history.length} <span className="text-lg text-[#2D6A4F]/50">세션</span></h3>
            <p className="text-xs text-gray-400 mt-2 font-medium">클릭하여 기록 상세보기</p>
          </button>

          {/* === Collapsible Advanced Stats === */}
          <button
            onClick={() => setShowAdvancedStats(v => !v)}
            className="flex items-center justify-center gap-1.5 w-full py-3 text-[12px] font-bold text-gray-400 active:opacity-60 transition-opacity"
          >
            운동 과학 데이터
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
            const lvlLabel = levelEst.level === "advanced" ? "고수" : levelEst.level === "intermediate" ? "중수" : "뉴비";
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
                      <h3 className="text-base font-black text-white">내 운동 등급</h3>
                      <button onClick={() => setHelpCard("trainingLevel")} className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                        <span className="text-[10px] font-black text-white/80">?</span>
                      </button>
                    </div>
                    <span className="text-xl font-black text-white tracking-tight">{lvlLabel}</span>
                  </div>
                  {levelEst.decayed && (
                    <p className="text-[10px] text-white/70 mt-1">최근 운동이 뜸해서 등급이 내려갔어요</p>
                  )}
                </div>
                <div className="bg-white px-5 py-4">
                  {levelEst.source === "default" ? (
                    <p className="text-[12px] text-gray-400 leading-relaxed py-2">아직 기록이 부족해서 뉴비로 시작해요. 운동을 기록하면 자동으로 등급이 올라가요!</p>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {levelEst.details.map((d, i) => {
                        const accent = d.level === "advanced" ? "border-amber-400 text-amber-500 bg-amber-50"
                          : d.level === "intermediate" ? "border-emerald-400 text-emerald-600 bg-emerald-50"
                          : "border-gray-300 text-gray-400 bg-gray-50";
                        const nm = d.level === "advanced" ? "고수" : d.level === "intermediate" ? "중수" : "뉴비";
                        return (
                          <div key={i} className="flex items-center gap-4 py-4 first:pt-1 last:pb-1">
                            <div className={`w-1 h-12 rounded-full ${accent.split(" ")[0].replace("border", "bg")}`} />
                            <p className="flex-1 min-w-0 text-[14px] text-gray-700 font-bold">{d.exercise}</p>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-gray-400 font-medium">최고 무게</span>
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
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em]">4주 운동량 변화</p>
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
                  <span className="flex items-center gap-1"><span className="w-2 h-2 bg-amber-50 border border-amber-200 rounded-sm inline-block" /> 많음</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-100 rounded-sm inline-block" /> 딱 좋음</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 bg-[#2D6A4F] rounded-full inline-block" /> 운동량</span>
                </div>
                {/* Load verdict */}
                {(() => {
                  const latest = graphData[graphData.length - 1].loadScore;
                  const isOverload = latest > loadBand.overload;
                  const isHigh = latest > loadBand.high && !isOverload;
                  const isOptimal = latest >= loadBand.low && latest <= loadBand.high;
                  const label = isOverload ? "너무 많아요" : isHigh ? "조금 많아요" : isOptimal ? "딱 좋아요" : "조금 적어요";
                  const color = "text-gray-500";
                  const comment = isOverload
                    ? "오늘 좀 무리했어요! 다음엔 가볍게 하는 게 좋겠어요."
                    : isHigh
                    ? "살짝 많았지만 가끔은 괜찮아요. 자주 이러면 몸이 힘들 수 있어요."
                    : isOptimal
                    ? "딱 좋은 운동량이에요! 이 페이스 유지하면 성장해요."
                    : "운동량이 적었어요. 쉬는 날엔 괜찮지만 계속되면 아쉬워요.";
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
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em] mb-1">이번 달 운동량</p>
                  <h3 className="text-xl font-black text-gray-300">기록 없음</h3>
                </div>
              );
            }

            // Group sessions by date string
            const dateGroups: { dateStr: string; sessions: { volume: number; idx: number }[] }[] = [];
            let globalIdx = 0;
            sessionsWithVolume.forEach(h => {
              const dateStr = new Date(h.date).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" });
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
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em]">이번 달 운동량</p>
                  <span className="text-[9px] font-black text-gray-300">최근 {recentGroups.length}일</span>
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
                <h3 className="text-lg font-black text-[#1B4332] mb-3">시즌 티어 시스템</h3>
                <div className="space-y-3 text-[13px] text-gray-600 leading-relaxed">
                  <p>운동하면 <span className="font-bold text-[#1B4332]">경험치(EXP)</span>가 쌓여요. EXP가 쌓이면 티어가 올라가요!</p>
                  <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                    <p className="text-[11px] font-bold text-gray-500">EXP를 얻는 방법</p>
                    <div className="space-y-1.5 text-[11px]">
                      <p>운동 완료 → <span className="font-bold text-[#2D6A4F]">+1 EXP</span></p>
                      <p>주간 퀘스트 완료 → <span className="font-bold text-[#2D6A4F]">+2~5 EXP</span></p>
                      <p>주간 올클리어 → <span className="font-bold text-[#2D6A4F]">+5 EXP 보너스</span></p>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                    <p className="text-[11px] font-bold text-gray-500">티어 구간</p>
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
                  <p>시즌은 <span className="font-bold text-[#1B4332]">4개월마다 리셋</span>돼요 (1~4월, 5~8월, 9~12월). 새 시즌이 시작되면 Iron부터 다시 도전!</p>
                  <p>주 3회 꾸준히 + 퀘스트 달성하면 시즌 내 <span className="font-bold text-[#1B4332]">Diamond</span>까지 갈 수 있어요.</p>
                </div>
              </>
            )}
            {helpCard === "loadTimeline" && (
              <>
                <h3 className="text-lg font-black text-[#1B4332] mb-3">4주 운동량 변화</h3>
                <div className="space-y-3 text-[13px] text-gray-600 leading-relaxed">
                  <p>최근 4주 동안 <span className="font-bold text-[#1B4332]">얼마나 운동했는지</span> 그래프로 보여줘요. 점 하나가 운동 한 번이에요.</p>
                  <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 bg-emerald-100 border border-emerald-200 rounded-sm inline-block shrink-0" />
                      <p className="text-[11px]"><span className="font-bold text-[#2D6A4F]">초록색 = 딱 좋은 운동량</span></p>
                    </div>
                    <p className="text-[11px] text-gray-500 ml-5">내 등급에 맞는 적정 운동량이에요. 여기 안에 있으면 잘하고 있는 거예요!</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="w-3 h-3 bg-amber-50 border border-amber-200 rounded-sm inline-block shrink-0" />
                      <p className="text-[11px]"><span className="font-bold text-amber-600">노란색 = 좀 많았어요</span></p>
                    </div>
                    <p className="text-[11px] text-gray-500 ml-5">가끔은 괜찮지만 계속 넘으면 몸이 힘들 수 있어요.</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="w-3 h-3 bg-[#2D6A4F] rounded-full inline-block shrink-0" />
                      <p className="text-[11px]"><span className="font-bold text-[#2D6A4F]">점 = 그날 운동량</span></p>
                    </div>
                    <p className="text-[11px] text-gray-500 ml-5">들어올린 무게 × 횟수의 합이에요. 점을 터치하면 수치를 볼 수 있어요.</p>
                  </div>
                  <p>초록 영역 안에 점이 꾸준히 찍히면 <span className="font-bold text-[#2D6A4F]">성장하고 있다는 뜻</span>이에요!</p>
                  <p className="text-[10px] text-gray-400 mt-2 pt-2 border-t border-gray-100">근거: ACSM, Schoenfeld et al. (2017), NSCA</p>
                </div>
              </>
            )}
            {helpCard === "trainingLevel" && (
              <>
                <h3 className="text-lg font-black text-[#1B4332] mb-3">내 운동 등급</h3>
                <div className="space-y-3 text-[13px] text-gray-600 leading-relaxed">
                  <p>운동 기록을 보고 <span className="font-bold text-[#1B4332]">자동으로 등급을 매겨줘요</span>. 이 등급에 따라 운동량 기준이 달라져요.</p>
                  <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                    <p className="text-[11px] font-bold text-gray-500">어떻게 판정하나요?</p>
                    <div className="space-y-1.5">
                      <div className="flex items-start gap-2">
                        <span className="text-[10px] font-black text-[#2D6A4F] mt-0.5 shrink-0">1순위</span>
                        <p className="text-[11px]"><span className="font-bold">3대 운동</span>(스쿼트/벤치프레스/데드리프트)에서 들 수 있는 최고 무게를 체중과 비교</p>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-[10px] font-black text-[#2D6A4F] mt-0.5 shrink-0">2순위</span>
                        <p className="text-[11px]"><span className="font-bold">맨몸 운동</span>(푸쉬업/풀업) 몇 개 하는지</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                    <p className="text-[11px] font-bold text-gray-500">등급 기준 (남성 · 최고 무게/체중)</p>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px]">
                        <span className="font-medium text-gray-500">종목</span>
                        <div className="flex gap-3">
                          <span className="font-bold text-gray-400 w-10 text-center">뉴비</span>
                          <span className="font-bold text-[#2D6A4F] w-10 text-center">중수</span>
                          <span className="font-bold text-amber-600 w-10 text-center">고수</span>
                        </div>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-gray-600">스쿼트</span>
                        <div className="flex gap-3">
                          <span className="text-gray-400 w-10 text-center">~0.75x</span>
                          <span className="text-[#2D6A4F] w-10 text-center">0.75x</span>
                          <span className="text-amber-600 w-10 text-center">1.25x+</span>
                        </div>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-gray-600">벤치프레스</span>
                        <div className="flex gap-3">
                          <span className="text-gray-400 w-10 text-center">~0.50x</span>
                          <span className="text-[#2D6A4F] w-10 text-center">0.50x</span>
                          <span className="text-amber-600 w-10 text-center">1.00x+</span>
                        </div>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-gray-600">데드리프트</span>
                        <div className="flex gap-3">
                          <span className="text-gray-400 w-10 text-center">~0.75x</span>
                          <span className="text-[#2D6A4F] w-10 text-center">0.75x</span>
                          <span className="text-amber-600 w-10 text-center">1.50x+</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                    <p className="text-[11px] font-bold text-gray-500">맨몸 운동 기준 (남성)</p>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-gray-600">푸쉬업</span>
                        <span className="text-gray-500">~10회 뉴비 · 10~25회 중수 · 25회+ 고수</span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-gray-600">풀업</span>
                        <span className="text-gray-500">~1회 뉴비 · 1~8회 중수 · 8회+ 고수</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-amber-50 rounded-xl p-3">
                    <p className="text-[11px] font-bold text-amber-700 mb-1">등급 유지 조건</p>
                    <p className="text-[10px] text-amber-600">최고 기록으로 등급이 올라가지만, 최근 4주간 운동을 안 하면 한 단계 내려가요. 꾸준히 해야 유지돼요!</p>
                  </div>
                  <p>여성은 기준이 조금 다르게 적용돼요.</p>
                  <p className="text-[10px] text-gray-400 mt-2 pt-2 border-t border-gray-100">근거: NSCA, Rippetoe & Kilgore (2006)</p>
                </div>
              </>
            )}
            </div>
            <button
              onClick={() => setHelpCard(null)}
              className="w-full py-3 mt-5 rounded-2xl bg-[#1B4332] text-white font-bold text-sm active:scale-[0.98] transition-all shrink-0"
            >
              확인
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
              {viewMonth + 1}월 {dayPickerSessions.day}일 운동 기록
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
