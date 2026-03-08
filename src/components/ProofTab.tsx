"use client";

import React, { useEffect, useState } from "react";

import { WorkoutHistory as WorkoutHistoryType } from "@/constants/workout";
import { loadWorkoutHistory } from "@/utils/workoutHistory";
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
  const [monthOffset, setMonthOffset] = useState(0); // 0 = current month, -1 = last month, etc.
  const [weightLog, setWeightLog] = useState<{ date: string; weight: number }[]>([]);
  const [activeVolumeDot, setActiveVolumeDot] = useState<number | null>(null);
  const [activeWeightDot, setActiveWeightDot] = useState<number | null>(null);

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

  const handleSessionClick = (session: WorkoutHistoryType) => {
    setSelectedHistory(session);
    setView("report");
  };

  const handleDeleteSession = (sessionIds: string[]) => {
    const idSet = new Set(sessionIds);
    const updatedHistory = history.filter(h => !idSet.has(h.id));
    setHistory(updatedHistory);
    localStorage.setItem("alpha_workout_history", JSON.stringify(updatedHistory));
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
        onDelete={handleDeleteSession}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#FAFBF9] animate-fade-in relative overflow-hidden">
      {/* Fixed Header */}
      <div className="pt-6 pb-4 px-6 text-center z-10 shrink-0">
        <span className="text-[11px] tracking-[0.4em] uppercase font-serif font-medium text-[#2D6A4F]">Proof</span>
        <h1 className="text-4xl font-black text-[#1B4332] mt-2">훈련 기록</h1>
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

      {/* Scrollable Content */}
      <div className="flex-1 px-6 pb-6 overflow-y-auto scrollbar-hide pt-2">
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

              const isCompleted = history.some(h => new Date(h.date).toDateString() === dateStr);
              const isToday = isCurrentMonth && day === today.getDate();
              const isSunday = dayOfWeek === 0;


              return (
                <div
                  key={day}
                  className={`aspect-square rounded-xl flex items-center justify-center text-xs font-bold relative transition-all ${
                    isCompleted
                      ? 'bg-[#2D6A4F] text-white shadow-md shadow-[#2D6A4F]/20'
                      : isSunday ? 'bg-gray-50 text-rose-400'
                      : 'bg-gray-50 text-gray-300'
                  } ${isToday ? 'ring-2 ring-emerald-400 ring-offset-2' : ''}`}
                >
                  {day}
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
              <div className="p-6 bg-white rounded-3xl border border-[#2D6A4F]/10 shadow-sm">
                <div className="flex justify-between items-baseline mb-4">
                  <h3 className="text-lg font-black text-[#1B4332]">세션별 볼륨</h3>
                  <span className="text-[10px] font-black text-[#2D6A4F]/60">최근 {recentGroups.length}일</span>
                </div>

                <div className="flex h-32 gap-2 pt-4 pb-5">
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

                    {/* All dots with hover tooltip */}
                    {allDots.map((d, i) => {
                      const yPct = getY(d.volume);
                      const isLast = i === allDots.length - 1;
                      const isActive = activeVolumeDot === i;
                      return (
                        <div
                          key={i}
                          className="absolute flex flex-col items-center cursor-pointer"
                          style={{ left: `${d.xPct}%`, top: `${yPct}%`, transform: "translate(-50%, -50%)" }}
                          onPointerEnter={() => setActiveVolumeDot(i)}
                          onPointerLeave={() => setActiveVolumeDot(null)}
                          onTouchStart={() => setActiveVolumeDot(isActive ? null : i)}
                        >
                          {isActive && (
                            <span className="absolute -top-6 text-[10px] font-black text-gray-700 bg-white px-1.5 py-0.5 rounded shadow-sm border border-gray-100 animate-fade-in z-20 whitespace-nowrap">
                              {d.volume.toLocaleString()}kg
                            </span>
                          )}
                          <div className={`rounded-full transition-transform ${isActive ? "scale-150" : ""} ${isLast ? "w-3 h-3 bg-[#2D6A4F]" : "w-2 h-2 bg-white border-2 border-[#2D6A4F]"}`} />
                        </div>
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
              <div className="p-6 bg-white rounded-3xl border border-[#2D6A4F]/10 shadow-sm">
                <div className="flex justify-between items-baseline mb-1">
                  <p className="text-[10px] font-bold text-[#2D6A4F] uppercase tracking-widest">체중 변화</p>
                  <span className={`text-[10px] font-black ${diff > 0 ? "text-rose-400" : diff < 0 ? "text-sky-400" : "text-gray-400"}`}>
                    {diff > 0 ? "+" : ""}{diff.toFixed(1)}kg
                  </span>
                </div>
                <div className="flex items-baseline gap-1 mb-4">
                  <h3 className="text-3xl font-black text-[#1B4332]">{latestWeight.toFixed(1)}</h3>
                  <span className="text-lg text-[#2D6A4F]/50">kg</span>
                </div>

                <div className="flex h-32 gap-2 pt-4 pb-5">
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

                    {/* Dots with hover tooltip */}
                    {weights.map((w, i) => {
                      const xPct = weights.length === 1 ? 50 : (i / (weights.length - 1)) * 100;
                      const yPct = 95 - ((w - minW) / range) * 90;
                      const isLast = i === weights.length - 1;
                      const isActive = activeWeightDot === i;
                      return (
                        <div
                          key={i}
                          className="absolute flex flex-col items-center cursor-pointer"
                          style={{ left: `${xPct}%`, top: `${yPct}%`, transform: "translate(-50%, -50%)" }}
                          onPointerEnter={() => setActiveWeightDot(i)}
                          onPointerLeave={() => setActiveWeightDot(null)}
                          onTouchStart={() => setActiveWeightDot(isActive ? null : i)}
                        >
                          {isActive && (
                            <span className="absolute -top-6 text-[10px] font-black text-gray-700 bg-white px-1.5 py-0.5 rounded shadow-sm border border-gray-100 animate-fade-in z-20 whitespace-nowrap">
                              {w.toFixed(1)}kg
                            </span>
                          )}
                          <div className={`rounded-full transition-transform ${isActive ? "scale-150" : ""} ${isLast ? "w-3 h-3 bg-[#2D6A4F]" : "w-2 h-2 bg-white border-2 border-[#2D6A4F]"}`} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
};
