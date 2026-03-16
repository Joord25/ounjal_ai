"use client";

import React, { useState, useMemo } from "react";
import { WorkoutHistory as WorkoutHistoryType } from "@/constants/workout";

interface WorkoutHistoryProps {
  history: WorkoutHistoryType[];
  onSelectSession: (session: WorkoutHistoryType) => void;
  onBack: () => void;
  onDelete: (sessionIds: string[]) => void;
}

function getMonthKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(key: string): string {
  const [y, m] = key.split("-");
  return `${y}년 ${parseInt(m)}월`;
}

export const WorkoutHistory: React.FC<WorkoutHistoryProps> = ({
  history,
  onSelectSession,
  onBack,
  onDelete
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Build sorted list of available months
  const months = useMemo(() => {
    const set = new Set<string>();
    history.forEach(h => set.add(getMonthKey(h.date)));
    return Array.from(set).sort().reverse(); // newest first
  }, [history]);

  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  // Current month (default to latest)
  const currentMonth = selectedMonth || months[0] || null;

  // Filtered sessions for current month
  const filteredHistory = useMemo(() => {
    if (!currentMonth) return history;
    return history.filter(h => getMonthKey(h.date) === currentMonth);
  }, [history, currentMonth]);

  const currentMonthIndex = currentMonth ? months.indexOf(currentMonth) : 0;
  const canGoNewer = currentMonthIndex > 0;
  const canGoOlder = currentMonthIndex < months.length - 1;

  const goMonth = (dir: -1 | 1) => {
    // -1 = newer, +1 = older
    const nextIdx = currentMonthIndex + dir;
    if (nextIdx >= 0 && nextIdx < months.length) {
      setSelectedMonth(months[nextIdx]);
      setSelected(new Set());
    }
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === filteredHistory.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredHistory.map(h => h.id)));
    }
  };

  const handleDelete = () => {
    onDelete(Array.from(selected));
    setSelected(new Set());
    setIsEditing(false);
    setShowDeleteConfirm(false);
  };

  const exitEditing = () => {
    setIsEditing(false);
    setSelected(new Set());
  };

  return (
    <div className="flex flex-col h-full bg-white animate-fade-in relative overflow-hidden">
      {/* Header */}
      <div className="pt-[max(3rem,env(safe-area-inset-top))] pb-3 sm:pb-4 px-4 sm:px-6 flex items-center justify-between bg-white z-10 shrink-0">
        <button
          onClick={isEditing ? exitEditing : onBack}
          className="p-2 -ml-2"
        >
          <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg sm:text-xl font-serif font-medium text-[#1B4332] uppercase tracking-wide">Workout History</h1>
        {filteredHistory.length > 0 ? (
          <button
            onClick={() => isEditing ? exitEditing() : setIsEditing(true)}
            className="text-sm font-bold text-[#2D6A4F] active:opacity-60"
          >
            {isEditing ? "완료" : "편집"}
          </button>
        ) : (
          <div className="w-10" />
        )}
      </div>

      {/* Month Navigator */}
      {months.length > 0 && (
        <div className="px-6 pb-3 flex items-center justify-center gap-4 shrink-0">
          <button
            onClick={() => goMonth(-1)}
            disabled={!canGoNewer}
            className="p-1.5 disabled:opacity-20"
          >
            <svg className="w-4 h-4 text-[#2D6A4F]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-sm font-bold text-[#1B4332] min-w-[100px] text-center">
            {currentMonth ? formatMonthLabel(currentMonth) : ""}
          </span>
          <button
            onClick={() => goMonth(1)}
            disabled={!canGoOlder}
            className="p-1.5 disabled:opacity-20"
          >
            <svg className="w-4 h-4 text-[#2D6A4F]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}

      {/* Select All bar (edit mode) */}
      {isEditing && filteredHistory.length > 0 && (
        <div className="px-6 pb-3 flex items-center justify-between shrink-0">
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-2 text-sm font-bold text-gray-600 active:opacity-60"
          >
            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
              selected.size === filteredHistory.length ? "bg-[#2D6A4F] border-[#2D6A4F]" : "border-gray-300"
            }`}>
              {selected.size === filteredHistory.length && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            전체 선택
          </button>
          {selected.size > 0 && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="text-sm font-bold text-red-500 active:opacity-60"
            >
              {selected.size}개 삭제
            </button>
          )}
        </div>
      )}

      <div className="flex-1 px-4 sm:px-6 overflow-y-auto scrollbar-hide" style={{ paddingBottom: "calc(128px + var(--safe-area-bottom, 0px))" }}>
        <div className="space-y-4">
          {filteredHistory.map((session) => (
            <div key={session.id} className="relative flex items-stretch gap-3">
              {/* Checkbox (edit mode) */}
              {isEditing && (
                <button
                  onClick={() => toggleSelect(session.id)}
                  className="flex items-center shrink-0 pt-5"
                >
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                    selected.has(session.id) ? "bg-[#2D6A4F] border-[#2D6A4F]" : "border-gray-300"
                  }`}>
                    {selected.has(session.id) && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </button>
              )}

              <button
                onClick={() => isEditing ? toggleSelect(session.id) : onSelectSession(session)}
                className="flex-1 bg-gray-50 p-5 rounded-2xl border border-gray-100 flex items-center justify-between hover:bg-gray-100 transition-colors text-left"
              >
                <div className="flex-1 min-w-0 mr-3">
                  <p className="text-xs font-bold text-gray-400 mb-1">
                    {new Date(session.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                  <h3 className="text-lg font-black text-[#1B4332] mb-1">{session.sessionData.title}</h3>
                  <p className="text-sm text-gray-500 line-clamp-1">{session.sessionData.description}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                   <span className="text-lg font-black text-[#2D6A4F]">
                     {session.stats?.totalVolume?.toLocaleString() || 0} <span className="text-xs text-gray-400">kg</span>
                   </span>
                   <span className="text-xs font-bold text-gray-400">
                     {session.stats?.totalSets || 0} Sets
                     {session.stats?.totalDurationSec ? ` · ${session.stats.totalDurationSec >= 3600 ? `${Math.floor(session.stats.totalDurationSec / 3600)}h${Math.floor((session.stats.totalDurationSec % 3600) / 60)}m` : `${Math.floor(session.stats.totalDurationSec / 60)}m`}` : ""}
                   </span>
                </div>
              </button>

            </div>
          ))}

          {filteredHistory.length === 0 && (
              <div className="text-center py-10 text-gray-400">
                  <p>{history.length === 0 ? "운동 기록이 없습니다." : "이 달의 기록이 없습니다."}</p>
              </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selected.size > 0 && (
        <div className="absolute inset-0 bg-black/40 z-50 flex items-center justify-center animate-fade-in px-8">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-black text-[#1B4332] mb-2">기록 삭제</h3>
            <p className="text-sm text-gray-500 mb-6">
              {selected.size}개의 운동 기록을 삭제하시겠습니까?<br/>삭제된 기록은 복구할 수 없습니다.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600 font-bold text-sm active:scale-95 transition-all"
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold text-sm active:scale-95 transition-all"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
