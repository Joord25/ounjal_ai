"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";

import { WorkoutHistory as WorkoutHistoryType } from "@/constants/workout";
import { loadWorkoutHistory, deleteWorkoutHistory } from "@/utils/workoutHistory";
import { updateWeightLog } from "@/utils/userProfile";
import { estimateTrainingLevelDetailed } from "@/utils/workoutMetrics";
import { WorkoutReport } from "./WorkoutReport";
import { WorkoutHistory } from "./WorkoutHistory";

interface ProofTabProps {
  lockedRuleIds: string[]; // Not used in this version, but kept for compatibility
}

type ViewState = "dashboard" | "list" | "report" | "weight_detail";

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
  const [pullDistance, setPullDistance] = useState(0);
  const [showAddWeight, setShowAddWeight] = useState(false);
  const [newWeightDate, setNewWeightDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newWeightValue, setNewWeightValue] = useState("");
  const [weightSelectMode, setWeightSelectMode] = useState(false);
  const [selectedWeightIdxs, setSelectedWeightIdxs] = useState<Set<number>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
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
  const monthWorkouts = monthHistory.length;

  const [reportReturnView, setReportReturnView] = useState<"dashboard" | "list">("list");

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
        <div className="flex-1 px-4 sm:px-6 overflow-y-auto scrollbar-hide" style={{ paddingBottom: "calc(128px + var(--safe-area-bottom, 0px))" }}>
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
        <span className="text-[11px] tracking-[0.4em] uppercase font-serif font-medium text-[#2D6A4F]">Proof</span>
        <h1 className="text-3xl sm:text-4xl font-black text-[#1B4332] mt-2">훈련 기록</h1>
        <div className="mt-4 inline-flex items-center gap-1 bg-[#2D6A4F]/10 rounded-full">
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
      </div>

      {/* Scrollable Content with pull-to-refresh */}
      <div
        ref={scrollRef}
        className="flex-1 px-4 sm:px-6 sm:pb-6 overflow-y-auto scrollbar-hide pt-2"
        style={{ paddingBottom: "calc(96px + var(--safe-area-bottom, 0px))" }}
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
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
          <div className="grid grid-cols-7 gap-2">
            {['월', '화', '수', '목', '금', '토', '일'].map((day, i) => (
              <div key={i} className={`text-center text-xs font-bold mb-2 ${
                i === 6 ? 'text-rose-400' : 'text-gray-400'
              }`}>
                {day}
              </div>
            ))}
            {/* Empty cells for offset (Monday start) */}
            {Array.from({ length: (() => {
              const firstDay = new Date(viewYear, viewMonth, 1).getDay();
              return firstDay === 0 ? 6 : firstDay - 1;
            })() }, (_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {days.map((day) => {
              const dateObj = new Date(viewYear, viewMonth, day);
              const dateStr = dateObj.toDateString();
              const dayOfWeek = dateObj.getDay();

              const daySessions = history.filter(h => new Date(h.date).toDateString() === dateStr);
              const isCompleted = daySessions.length > 0;
              const isToday = isCurrentMonth && day === today.getDate();
              const isSunday = dayOfWeek === 0;

              return (
                <div
                  key={day}
                  onClick={() => {
                    if (daySessions.length === 1) {
                      handleSessionClick(daySessions[0], "dashboard");
                    } else if (daySessions.length > 1) {
                      // Multiple sessions on same day — show the most recent one
                      const sorted = [...daySessions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                      handleSessionClick(sorted[0], "dashboard");
                    }
                  }}
                  className={`aspect-square rounded-xl flex items-center justify-center text-xs font-bold relative transition-all ${
                    isCompleted
                      ? 'bg-[#2D6A4F] text-white shadow-md shadow-[#2D6A4F]/20 cursor-pointer active:scale-90'
                      : isSunday ? 'bg-gray-50 text-rose-400'
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

        <div className="mt-6 flex flex-col gap-3">
          <button
            onClick={() => setView("list")}
            className="p-6 bg-[#1B4332] rounded-3xl text-white shadow-lg shadow-[#1B4332]/20 w-full text-left active:scale-[0.98] transition-all group"
          >
            <div className="flex justify-between items-center mb-1">
                <p className="text-[10px] font-bold text-emerald-300/80 uppercase tracking-widest">총 운동 횟수</p>
                <svg className="w-5 h-5 text-emerald-400/50 group-hover:text-emerald-300 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
            </div>
            <h3 className="text-3xl font-black text-white">{monthWorkouts} <span className="text-lg text-emerald-300">세션</span></h3>
            <p className="text-xs text-emerald-400/50 mt-2 font-medium">클릭하여 기록 상세보기</p>
          </button>

          {/* Training Level Estimation Card */}
          {(() => {
            const bw = !isNaN(savedBodyWeight) ? savedBodyWeight : undefined;
            const g = savedGender;
            const levelEst = estimateTrainingLevelDetailed(history, bw, g);
            const lvlLabel = levelEst.level === "advanced" ? "상급" : levelEst.level === "intermediate" ? "중급" : "초급";
            const lvlBadgeCls = levelEst.level === "advanced" ? "bg-amber-50 text-amber-600"
              : levelEst.level === "intermediate" ? "bg-emerald-50 text-[#2D6A4F]"
              : "bg-gray-100 text-gray-500";

            return (
              <div className="p-6 bg-white rounded-3xl border border-[#2D6A4F]/10 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black text-[#1B4332]">훈련 레벨</h3>
                    <button onClick={() => setHelpCard("trainingLevel")} className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center">
                      <span className="text-[10px] font-black text-gray-400">?</span>
                    </button>
                  </div>
                  <span className={`text-[11px] font-black px-2.5 py-1 rounded-lg ${lvlBadgeCls}`}>{lvlLabel}</span>
                </div>
                {levelEst.source === "default" ? (
                  <p className="text-[12px] text-gray-400 leading-relaxed">아직 3대 운동이나 맨몸 운동 기록이 없어서 기본값(초급)으로 설정돼 있어요. 운동을 기록하면 자동으로 레벨이 조정돼요.</p>
                ) : (
                  <>
                    <p className="text-[11px] text-gray-400 mb-3">
                      {levelEst.source === "big3"
                        ? "3대 운동 e1RM/체중 비율 기준"
                        : "맨몸 운동 최대 렙수 기준"}
                      {levelEst.decayed && (
                        <span className="text-amber-500 ml-1">· 최근 4주 기록 부족으로 하향 조정</span>
                      )}
                    </p>
                    <div className="space-y-2">
                      {levelEst.details.map((d, i) => {
                        const clr = d.level === "advanced" ? "text-amber-600" : d.level === "intermediate" ? "text-[#2D6A4F]" : "text-gray-400";
                        const bg = d.level === "advanced" ? "bg-amber-50" : d.level === "intermediate" ? "bg-emerald-50" : "bg-gray-50";
                        const nm = d.level === "advanced" ? "상급" : d.level === "intermediate" ? "중급" : "초급";
                        return (
                          <div key={i} className="flex items-center justify-between">
                            <span className="text-[12px] font-bold text-gray-700">{d.exercise}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-gray-400 font-medium">{d.value}</span>
                              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${bg} ${clr}`}>{nm}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
                <p className="text-[9px] text-gray-300 mt-3 pt-2 border-t border-gray-100">NSCA · Rippetoe & Kilgore (2006) · Epley e1RM</p>
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
                  <p className="text-[10px] font-bold text-[#2D6A4F] uppercase tracking-widest mb-1">세션별 볼륨</p>
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
                  <h3 className="text-base sm:text-lg font-black text-[#1B4332]">세션별 볼륨</h3>
                  <span className="text-[10px] font-black text-[#2D6A4F]/60">최근 {recentGroups.length}일</span>
                </div>

                <div className="flex h-36 sm:h-32 gap-2 pt-6 pb-5">
                  {/* Y-axis labels */}
                  <div className="flex flex-col justify-between shrink-0 w-10">
                    <span className="text-[8px] text-gray-300 font-bold text-right">{(rawMax / 1000).toFixed(1)}k</span>
                    <span className="text-[8px] text-gray-300 font-bold text-right">{(rawMin / 1000).toFixed(1)}k</span>
                  </div>

                  {/* Graph area */}
                  <div className="relative flex-1 overflow-visible">
                    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                      <line x1="0" y1="5" x2="100" y2="5" stroke="#f3f4f6" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
                      <line x1="0" y1="50" x2="100" y2="50" stroke="#f3f4f6" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
                      <line x1="0" y1="95" x2="100" y2="95" stroke="#f3f4f6" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />

                      {/* Area fill — follows max line */}
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

                      {/* Line through max volume per date */}
                      <path
                        d={lineDots.map((d, i) => {
                          const y = getY(d.volume);
                          return `${i === 0 ? "M" : "L"} ${d.xPct} ${y}`;
                        }).join(" ")}
                        fill="none"
                        stroke="#2D6A4F"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                      />
                    </svg>

                    {/* Date labels under each group x position */}
                    {recentGroups.map((group, gi) => {
                      const xPct = isSingleGroup
                        ? (totalSessions === 1 ? 50 : (gi / Math.max(recentGroups.length - 1, 1)) * 100)
                        : (gi / (recentGroups.length - 1)) * 100;
                      return (
                        <span
                          key={`date-${gi}`}
                          className="absolute text-[9px] text-gray-300 font-medium whitespace-nowrap"
                          style={{ left: `${xPct}%`, bottom: "-18px", transform: "translateX(-50%)" }}
                        >
                          {group.dateStr}
                        </span>
                      );
                    })}

                    {/* Dots — tap to show value */}
                    {allDots.map((d, i) => {
                      const yPct = getY(d.volume);
                      const isLast = i === allDots.length - 1;
                      const isActive = activeVolumeDot === i;
                      return (
                        <button
                          type="button"
                          key={i}
                          className="absolute z-10 flex items-center justify-center"
                          style={{ left: `${d.xPct}%`, top: `${yPct}%`, transform: "translate(-50%, -50%)", width: 44, height: 44, background: "none", border: "none", padding: 0 }}
                          onPointerUp={(e) => { e.stopPropagation(); setActiveVolumeDot(isActive ? null : i); }}
                        >
                          {isActive && (
                            <span className="absolute -top-7 text-[10px] font-black text-gray-700 bg-white px-1.5 py-0.5 rounded shadow-sm border border-gray-100 z-20 whitespace-nowrap pointer-events-none">
                              {d.volume.toLocaleString()}kg
                            </span>
                          )}
                          <div className={`rounded-full transition-transform ${isActive ? "scale-150" : ""} ${isLast ? "w-3 h-3 bg-[#2D6A4F]" : "w-2 h-2 bg-white border-2 border-[#2D6A4F]"}`} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Weight Trend Graph */}
          {weightLog.length > 0 && (() => {
            const sorted = [...weightLog].sort((a, b) => a.date.localeCompare(b.date));
            const recent = sorted.slice(-30); // last 30 entries
            if (recent.length === 0) return null;

            const weights = recent.map(e => e.weight);
            const rawMin = Math.min(...weights);
            const rawMax = Math.max(...weights);
            // Add padding so flat lines sit in the middle, not at edges
            const padding = rawMax - rawMin < 1 ? 2 : (rawMax - rawMin) * 0.2;
            const minW = rawMin - padding;
            const maxW = rawMax + padding;
            const range = maxW - minW;
            const latestWeight = weights[weights.length - 1];
            const firstWeight = weights[0];
            const diff = latestWeight - firstWeight;

            return (
              <div
                className="p-4 sm:p-6 bg-white rounded-3xl border border-[#2D6A4F]/10 shadow-sm overflow-visible cursor-pointer active:scale-[0.98] transition-all"
                onClick={() => setView("weight_detail")}
              >
                <div className="flex justify-between items-baseline mb-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] font-bold text-[#2D6A4F] uppercase tracking-widest">체중 변화</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-black ${diff > 0 ? "text-rose-400" : diff < 0 ? "text-sky-400" : "text-gray-400"}`}>
                      {diff > 0 ? "+" : ""}{diff.toFixed(1)}kg
                    </span>
                    <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
                <div className="flex items-baseline gap-1 mb-3 sm:mb-4">
                  <h3 className="text-2xl sm:text-3xl font-black text-[#1B4332]">{latestWeight.toFixed(1)}</h3>
                  <span className="text-base sm:text-lg text-[#2D6A4F]/50">kg</span>
                </div>

                <div className="flex h-36 sm:h-32 gap-2 pt-6 pb-5">
                  {/* Y-axis labels */}
                  <div className="flex flex-col justify-between shrink-0 w-8">
                    <span className="text-[8px] text-gray-300 font-bold text-right">{rawMax.toFixed(1)}</span>
                    <span className="text-[8px] text-gray-300 font-bold text-right">{rawMin.toFixed(1)}</span>
                  </div>

                  {/* Graph area */}
                  <div className="relative flex-1 overflow-visible">
                    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                      {/* Grid lines */}
                      <line x1="0" y1="5" x2="100" y2="5" stroke="#f3f4f6" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
                      <line x1="0" y1="50" x2="100" y2="50" stroke="#f3f4f6" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
                      <line x1="0" y1="95" x2="100" y2="95" stroke="#f3f4f6" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />

                      {/* Area fill */}
                      <path
                        d={
                          recent.map((_, i) => {
                            const x = recent.length === 1 ? 50 : (i / (recent.length - 1)) * 100;
                            const y = 95 - ((weights[i] - minW) / range) * 90;
                            return `${i === 0 ? "M" : "L"} ${x} ${y}`;
                          }).join(" ") + ` L 100 100 L 0 100 Z`
                        }
                        fill="url(#weightGradient)"
                      />
                      <defs>
                        <linearGradient id="weightGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#2D6A4F" stopOpacity="0.15" />
                          <stop offset="100%" stopColor="#2D6A4F" stopOpacity="0" />
                        </linearGradient>
                      </defs>

                      {/* Line */}
                      <path
                        d={recent.map((_, i) => {
                          const x = recent.length === 1 ? 50 : (i / (recent.length - 1)) * 100;
                          const y = 95 - ((weights[i] - minW) / range) * 90;
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

                    {/* Date labels — first and last */}
                    {recent.length > 0 && [0, recent.length - 1].filter((v, i, a) => a.indexOf(v) === i).map(idx => {
                      const xPct = recent.length === 1 ? 50 : (idx / (recent.length - 1)) * 100;
                      return (
                        <span
                          key={`wdate-${idx}`}
                          className="absolute text-[9px] text-gray-300 font-medium whitespace-nowrap"
                          style={{ left: `${xPct}%`, bottom: "-18px", transform: "translateX(-50%)" }}
                        >
                          {recent[idx].date.slice(5).replace("-", "/")}
                        </span>
                      );
                    })}

                    {/* Dots — tap to show value */}
                    {weights.map((w, i) => {
                      const xPct = weights.length === 1 ? 50 : (i / (weights.length - 1)) * 100;
                      const yPct = 95 - ((w - minW) / range) * 90;
                      const isLast = i === weights.length - 1;
                      const isActive = activeWeightDot === i;
                      return (
                        <button
                          type="button"
                          key={i}
                          className="absolute z-10 flex items-center justify-center"
                          style={{ left: `${xPct}%`, top: `${yPct}%`, transform: "translate(-50%, -50%)", width: 44, height: 44, background: "none", border: "none", padding: 0 }}
                          onPointerUp={(e) => { e.stopPropagation(); setActiveWeightDot(isActive ? null : i); }}
                        >
                          {isActive && (
                            <span className="absolute -top-7 text-[10px] font-black text-gray-700 bg-white px-1.5 py-0.5 rounded shadow-sm border border-gray-100 z-20 whitespace-nowrap pointer-events-none">
                              {w.toFixed(1)}kg
                            </span>
                          )}
                          <div className={`rounded-full transition-transform ${isActive ? "scale-150" : ""} ${isLast ? "w-3 h-3 bg-[#2D6A4F]" : "w-2 h-2 bg-white border-2 border-[#2D6A4F]"}`} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Help Card Bottom Sheet */}
      {helpCard && (
        <div className="absolute inset-0 z-40">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setHelpCard(null)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[2rem] p-6 pb-2 animate-slide-up shadow-2xl z-50 max-h-[85vh] flex flex-col">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5 shrink-0" />
            <div className="flex-1 overflow-y-auto scrollbar-hide">
            {helpCard === "trainingLevel" && (
              <>
                <h3 className="text-lg font-black text-[#1B4332] mb-3">훈련 레벨 추정</h3>
                <div className="space-y-3 text-[13px] text-gray-600 leading-relaxed">
                  <p>운동 기록을 분석해서 <span className="font-bold text-[#1B4332]">자동으로 훈련 레벨을 판정</span>해요. 이 레벨에 따라 부하 타임라인의 최적 범위가 조정돼요.</p>
                  <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                    <p className="text-[11px] font-bold text-gray-500">판정 기준</p>
                    <div className="space-y-1.5">
                      <div className="flex items-start gap-2">
                        <span className="text-[10px] font-black text-[#2D6A4F] mt-0.5 shrink-0">1순위</span>
                        <p className="text-[11px]"><span className="font-bold">3대 운동</span>(스쿼트/벤치프레스/데드리프트)의 추정 최대중량(e1RM)을 체중으로 나눈 비율</p>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-[10px] font-black text-[#2D6A4F] mt-0.5 shrink-0">2순위</span>
                        <p className="text-[11px]"><span className="font-bold">맨몸 운동</span>(푸쉬업/풀업)의 최대 반복 횟수</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                    <p className="text-[11px] font-bold text-gray-500">레벨 기준 (남성 · 3대 운동 e1RM/체중)</p>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px]">
                        <span className="font-medium text-gray-500">종목</span>
                        <div className="flex gap-3">
                          <span className="font-bold text-gray-400 w-10 text-center">초급</span>
                          <span className="font-bold text-[#2D6A4F] w-10 text-center">중급</span>
                          <span className="font-bold text-amber-600 w-10 text-center">상급</span>
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
                        <span className="text-gray-500">~10회 초급 · 10~25회 중급 · 25회+ 상급</span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-gray-600">풀업</span>
                        <span className="text-gray-500">~1회 초급 · 1~8회 중급 · 8회+ 상급</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-amber-50 rounded-xl p-3">
                    <p className="text-[11px] font-bold text-amber-700 mb-1">레벨 유지 조건</p>
                    <p className="text-[10px] text-amber-600">역대 최고 기록으로 레벨이 올라가지만, 최근 4주간 해당 레벨 수준의 운동 기록이 없으면 한 단계 하향돼요. 꾸준히 운동해야 레벨이 유지됩니다.</p>
                  </div>
                  <p>여성은 3대 운동 기준 ×0.6, 맨몸 상체 기준 ×0.5가 적용돼요.</p>
                  <p className="text-[10px] text-gray-400 mt-2 pt-2 border-t border-gray-100">근거: NSCA Essentials of S&C (4th ed.), Rippetoe & Kilgore (2006), Epley e1RM 공식</p>
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
    </div>
  );
};
