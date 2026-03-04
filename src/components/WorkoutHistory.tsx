"use client";

import React from "react";
import { WorkoutHistory as WorkoutHistoryType } from "@/constants/workout";

interface WorkoutHistoryProps {
  history: WorkoutHistoryType[];
  onSelectSession: (session: WorkoutHistoryType) => void;
  onBack: () => void;
}

export const WorkoutHistory: React.FC<WorkoutHistoryProps> = ({ 
  history, 
  onSelectSession, 
  onBack 
}) => {
  return (
    <div className="flex flex-col h-full bg-white animate-fade-in relative overflow-hidden">
      {/* Header */}
      <div className="pt-16 pb-4 px-6 flex items-center justify-between bg-white z-10 shrink-0">
        <button 
          onClick={onBack}
          className="p-2 -ml-2"
        >
          <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-black text-gray-900 uppercase tracking-tight">Workout History</h1>
        <div className="w-10" />
      </div>

      <div className="flex-1 px-6 pb-32 overflow-y-auto scrollbar-hide">
        <div className="space-y-4">
          {history.map((session) => (
            <button
              key={session.id}
              onClick={() => onSelectSession(session)}
              className="w-full bg-gray-50 p-5 rounded-2xl border border-gray-100 flex items-center justify-between hover:bg-gray-100 transition-colors text-left"
            >
              <div>
                <p className="text-xs font-bold text-gray-400 mb-1">
                  {new Date(session.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
                <h3 className="text-lg font-black text-gray-900 mb-1">{session.sessionData.title}</h3>
                <p className="text-sm text-gray-500 line-clamp-1">{session.sessionData.description}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                 <span className="text-lg font-black text-emerald-600">
                   {session.stats?.totalVolume?.toLocaleString() || 0} <span className="text-xs text-gray-400">kg</span>
                 </span>
                 <span className="text-xs font-bold text-gray-400">
                   {session.stats?.totalSets || 0} Sets
                 </span>
              </div>
            </button>
          ))}
          
          {history.length === 0 && (
              <div className="text-center py-10 text-gray-400">
                  <p>No workout history yet.</p>
              </div>
          )}
        </div>
      </div>
    </div>
  );
};
