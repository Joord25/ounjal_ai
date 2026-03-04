"use client";

import React, { useEffect, useState } from "react";
import { THEME } from "@/constants/theme";
import { WorkoutHistory as WorkoutHistoryType } from "@/constants/workout";
import { WorkoutReport } from "./WorkoutReport";
import { WorkoutHistory } from "./WorkoutHistory";

interface ProofTabProps {
  lockedRuleIds: string[]; // Not used in this version, but kept for compatibility
}

type ViewState = "dashboard" | "list" | "report";

export const ProofTab: React.FC<ProofTabProps> = () => {
  const [history, setHistory] = useState<WorkoutHistoryType[]>([]);
  const [view, setView] = useState<ViewState>("dashboard");
  const [selectedHistory, setSelectedHistory] = useState<WorkoutHistoryType | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("alpha_workout_history");
    if (saved) {
      try {
        // Sort by date descending (newest first)
        const parsed = JSON.parse(saved) as WorkoutHistoryType[];
        parsed.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setHistory(parsed);
      } catch (e) {
        console.error("Failed to parse workout history", e);
      }
    }
  }, []);

  const today = new Date();
  const currentMonth = today.toLocaleString('default', { month: 'long' });
  
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Stats
  const totalWorkouts = history.length;
  const totalVolumeAllTime = history.reduce((acc, curr) => acc + (curr.stats?.totalVolume || 0), 0);

  const handleSessionClick = (session: WorkoutHistoryType) => {
    setSelectedHistory(session);
    setView("report");
  };

  if (view === "report" && selectedHistory) {
    return (
      <WorkoutReport 
        sessionData={selectedHistory.sessionData}
        logs={selectedHistory.logs}
        initialAnalysis={selectedHistory.analysis}
        onClose={() => setView("list")}
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
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-white animate-fade-in relative overflow-hidden">
      {/* Fixed Header */}
      <div className="pt-16 pb-4 px-6 text-center bg-white z-10 shrink-0">
        <span className="text-[10px] tracking-[0.4em] uppercase font-bold text-emerald-500">Proof</span>
        <h1 className="text-4xl font-black text-gray-900 mt-2">훈련 기록</h1>
        <div className="mt-4 inline-flex items-center gap-2 bg-emerald-50 px-4 py-1.5 rounded-full">
          <span className="text-xs font-black text-emerald-700">{currentMonth}</span>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 px-6 pb-32 overflow-y-auto scrollbar-hide pt-8">
        <div className="bg-gray-50 rounded-3xl p-6">
          <div className="grid grid-cols-7 gap-2">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
              <div key={i} className="text-center text-xs font-bold text-gray-400 mb-2">
                {day}
              </div>
            ))}
            {days.map((day) => {
              const dateObj = new Date(today.getFullYear(), today.getMonth(), day);
              const dateStr = dateObj.toDateString();
              
              const isCompleted = history.some(h => new Date(h.date).toDateString() === dateStr);
              const isToday = day === today.getDate();
              
              return (
                <div 
                  key={day} 
                  className={`aspect-square rounded-lg flex items-center justify-center text-xs font-bold relative ${
                    isCompleted 
                      ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200' 
                      : 'bg-white text-gray-300'
                  } ${isToday ? 'ring-2 ring-emerald-500 ring-offset-2' : ''}`}
                >
                  {day}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-4">
          <button 
            onClick={() => setView("list")}
            className="p-6 bg-gray-900 rounded-3xl text-white shadow-lg w-full text-left active:scale-98 transition-transform group"
          >
            <div className="flex justify-between items-center mb-1">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Total Workouts</p>
                <svg className="w-5 h-5 text-gray-500 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
            </div>
            <h3 className="text-3xl font-black">{totalWorkouts} Sessions</h3>
            <p className="text-xs text-gray-500 mt-2 font-medium">Click to view history details</p>
          </button>
          
          <div className="p-6 bg-emerald-50 rounded-3xl text-emerald-900 border border-emerald-100">
            <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-1">Total Volume (All Time)</p>
            <h3 className="text-3xl font-black">{totalVolumeAllTime.toLocaleString()} <span className="text-lg">kg</span></h3>
          </div>
        </div>
      </div>
    </div>
  );
};
