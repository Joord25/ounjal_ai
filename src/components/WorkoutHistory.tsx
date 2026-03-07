"use client";

import React, { useState } from "react";
import { WorkoutHistory as WorkoutHistoryType } from "@/constants/workout";

interface WorkoutHistoryProps {
  history: WorkoutHistoryType[];
  onSelectSession: (session: WorkoutHistoryType) => void;
  onBack: () => void;
  onDelete: (sessionIds: string[]) => void;
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

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === history.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(history.map(h => h.id)));
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
      <div className="pt-16 pb-4 px-6 flex items-center justify-between bg-white z-10 shrink-0">
        <button
          onClick={isEditing ? exitEditing : onBack}
          className="p-2 -ml-2"
        >
          <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-serif font-medium text-[#1B4332] uppercase tracking-wide">Workout History</h1>
        {history.length > 0 ? (
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

      {/* Select All bar (edit mode) */}
      {isEditing && history.length > 0 && (
        <div className="px-6 pb-3 flex items-center justify-between shrink-0">
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-2 text-sm font-bold text-gray-600 active:opacity-60"
          >
            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
              selected.size === history.length ? "bg-[#2D6A4F] border-[#2D6A4F]" : "border-gray-300"
            }`}>
              {selected.size === history.length && (
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

      <div className="flex-1 px-6 pb-32 overflow-y-auto scrollbar-hide">
        <div className="space-y-4">
          {history.map((session) => (
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
                   </span>
                </div>
              </button>

            </div>
          ))}

          {history.length === 0 && (
              <div className="text-center py-10 text-gray-400">
                  <p>운동 기록이 없습니다.</p>
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
