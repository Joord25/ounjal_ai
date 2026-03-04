"use client";

import React, { useEffect, useState } from "react";
import { THEME } from "@/constants/theme";
import { WorkoutSessionData, ExerciseLog, WorkoutAnalysis } from "@/constants/workout";
import { analyzeWorkoutSession } from "@/utils/gemini";

interface WorkoutReportProps {
  sessionData: WorkoutSessionData;
  logs?: Record<number, ExerciseLog[]>;
  initialAnalysis?: WorkoutAnalysis | null; // 이미 분석된 데이터가 있으면 받음
  onClose: () => void;
  onRestart?: () => void;
  onAnalysisComplete?: (analysis: WorkoutAnalysis) => void; // 분석 완료 시 부모에게 알림
}

export const WorkoutReport: React.FC<WorkoutReportProps> = ({ 
  sessionData, 
  logs = {}, 
  initialAnalysis = null,
  onClose, 
  onRestart,
  onAnalysisComplete
}) => {
  const [analysis, setAnalysis] = useState<WorkoutAnalysis | null>(initialAnalysis);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [expandedExercise, setExpandedExercise] = useState<number | null>(null);

  const totalSets = Object.values(logs).reduce((acc, curr) => acc + curr.length, 0);
  const successSets = Object.values(logs).flat().filter(l => l.feedback !== 'fail').length;
  const successRate = totalSets > 0 ? Math.round((successSets / totalSets) * 100) : 0;

  // Statistics Calculation
  const totalReps = Object.values(logs).flat().reduce((acc, curr) => {
    // If it's a distance based exercise (LSD, etc), don't count distance as reps
    // Or maybe we should? The user prompt shows "0각 다리각..." which looks like a font rendering issue or encoding issue.
    // But the image shows "TOTAL REPS" card having garbled text.
    // The issue is likely that `totalReps` is being calculated as NaN or some weird string concatenation if repsCompleted is not a number.
    
    // Ensure repsCompleted is treated as number
    const reps = typeof curr.repsCompleted === 'number' ? curr.repsCompleted : parseInt(curr.repsCompleted as any) || 0;
    return acc + reps;
  }, 0);
  
  const totalVolume = Object.values(logs).flat().reduce((acc, curr) => {
    // Attempt to parse weight string (e.g., "60kg", "100lbs")
    if (!curr.weightUsed || curr.weightUsed === "Bodyweight") return acc;
    const weight = parseInt(curr.weightUsed); // Parses "60kg" -> 60
    return !isNaN(weight) ? acc + (weight * curr.repsCompleted) : acc;
  }, 0);

  const interventionCount = Object.values(logs).flat().filter(l => l.feedback !== 'target').length;

  useEffect(() => {
    // 1. 이미 초기 분석 데이터가 있으면 그것을 사용 (AI 호출 X)
    if (initialAnalysis) {
        setAnalysis(initialAnalysis);
        return;
    }

    // 2. 로그는 있는데 분석 데이터가 없으면 AI 호출
    if (Object.keys(logs).length > 0 && !analysis && !isAnalyzing) {
      const fetchAnalysis = async () => {
        setIsAnalyzing(true);
        const result = await analyzeWorkoutSession(sessionData, logs);
        setAnalysis(result);
        setIsAnalyzing(false);
        
        // 분석 완료 후 부모에게 전달 (저장용)
        if (result && onAnalysisComplete) {
            onAnalysisComplete(result);
        }
      };
      fetchAnalysis();
    }
  }, [logs, sessionData, initialAnalysis]); // 의존성 배열 수정

  return (
    <div className="flex flex-col h-full bg-white animate-fade-in relative">
      <div className="flex-1 overflow-y-auto px-6 pt-12 pb-24 scrollbar-hide">
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <h1 className="text-3xl font-black text-gray-900 mb-1 tracking-tight">SESSION COMPLETE</h1>
          <p className="text-gray-500 font-medium">{new Date().toLocaleDateString()}</p>
        </div>

        {/* Summary Card (Updated with More Stats) */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          <div className="bg-gray-50 p-4 rounded-3xl border border-gray-100 text-center shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase mb-1 tracking-wider">Total Volume</p>
            <p className="text-2xl font-black text-gray-900">{totalVolume.toLocaleString()}<span className="text-sm text-gray-400 ml-1">kg</span></p>
          </div>
          <div className="bg-gray-50 p-4 rounded-3xl border border-gray-100 text-center shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase mb-1 tracking-wider">Total Reps</p>
            <p className="text-2xl font-black text-gray-900">{totalReps}</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-3xl border border-gray-100 text-center shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase mb-1 tracking-wider">Total Sets</p>
            <p className="text-2xl font-black text-gray-900">{totalSets}</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-3xl border border-gray-100 text-center shadow-sm">
             <p className="text-[10px] font-bold text-gray-400 uppercase mb-1 tracking-wider">Success Rate</p>
            <p className="text-2xl font-black text-emerald-600">{successRate}%</p>
          </div>
        </div>

        {/* AI Analysis Section */}
        <div className="mb-8">
          {isAnalyzing ? (
            <div className="bg-white rounded-3xl p-6 border-2 border-gray-100 flex flex-col items-center gap-4 animate-pulse">
               <div className="w-8 h-8 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"/>
               <p className="text-sm font-bold text-gray-400">AI가 세션을 분석중입니다...</p>
            </div>
          ) : analysis ? (
            <div className="bg-white rounded-3xl border-2 border-black p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden">
              <div className="mb-4 border-b-2 border-black pb-4">
                <h2 className="text-xl font-black text-black tracking-tighter uppercase leading-none">
                  AI session briefings
                </h2>
              </div>

              <div className="space-y-6">
                <div>
                  <p className="text-base font-bold text-black leading-relaxed">
                    <span className="text-emerald-600 mr-2">오운잘 AI:</span>
                    {analysis.briefing}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">NEXT SESSION PLAN</p>
                  <ul className="space-y-3">
                    {analysis.nextSessionAdvice.split('\n').map((advice: string, i: number) => (
                      <li key={i} className="flex items-start gap-3 text-sm font-medium text-gray-800 leading-snug bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <span className="text-emerald-600 font-bold min-w-[1.2rem] mt-0.5">•</span>
                        {advice.trim()}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
             <div className="bg-gray-50 rounded-3xl p-6 border border-gray-100 text-center">
               <p className="text-sm text-gray-400">데이터가 부족하여 분석할 수 없습니다.</p>
             </div>
          )}
        </div>

        {/* Detailed Logs */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 border-b pb-2 mb-4">
            <div className="w-1 h-6 bg-gray-300 rounded-full"/>
            <h2 className="text-xl font-black text-gray-900">WORKOUT LOGS</h2>
          </div>
          
          {sessionData.exercises.map((ex, idx) => {
            const exerciseLogs = logs[idx];
            if (!exerciseLogs || exerciseLogs.length === 0) return null;
            
            const isExpanded = expandedExercise === idx;
            const maxReps = Math.max(...exerciseLogs.map(l => l.repsCompleted), 1);

            return (
              <div key={idx} className="animate-slide-up" style={{ animationDelay: `${idx * 0.1}s` }}>
                <button 
                  onClick={() => setExpandedExercise(isExpanded ? null : idx)}
                  className="w-full flex justify-between items-baseline mb-3 px-1 group"
                >
                  <h3 className="font-bold text-gray-800 text-lg text-left">{ex.name}</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-400 uppercase font-black tracking-widest bg-gray-100 px-2 py-1 rounded-md group-hover:bg-gray-200 transition-colors">{ex.type}</span>
                    <span className="text-gray-400 text-xs transition-transform duration-300 transform group-hover:text-gray-600" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
                  </div>
                </button>
                
                {/* Graph View (Expandable) */}
                {isExpanded && (
                  <div className="mb-4 bg-gray-50 p-6 rounded-2xl border border-gray-100 animate-fade-in origin-top">
                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-8 text-center tracking-widest">Reps Distribution</p>
                    <div className="relative h-24 w-full px-2">
                        {/* SVG Line */}
                        {exerciseLogs.length > 1 && (
                            <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                                <path
                                    d={exerciseLogs.map((log, i) => {
                                        const x = (i / (exerciseLogs.length - 1)) * 100;
                                        const y = 100 - ((log.repsCompleted / maxReps) * 80);
                                        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                                    }).join(' ')}
                                    fill="none"
                                    stroke="#10b981"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    vectorEffect="non-scaling-stroke"
                                />
                            </svg>
                        )}

                        {/* Points & Labels */}
                        {exerciseLogs.map((log, i) => {
                             const xPct = exerciseLogs.length === 1 ? 50 : (i / (exerciseLogs.length - 1)) * 100;
                             const yPct = 100 - ((log.repsCompleted / maxReps) * 80);
                             
                             return (
                                <div 
                                    key={i}
                                    className="absolute flex flex-col items-center group"
                                    style={{
                                        left: `${xPct}%`,
                                        top: `${yPct}%`,
                                        transform: 'translate(-50%, -50%)'
                                    }}
                                >
                                    {/* Value Label */}
                                    <span className="absolute -top-7 text-xs font-black text-gray-800 bg-white px-2 py-0.5 rounded shadow-sm border border-gray-100">
                                        {log.repsCompleted}
                                    </span>
                                    
                                    {/* Dot */}
                                    <div className={`w-3 h-3 bg-white border-[3px] rounded-full z-10 ${
                                        log.feedback === 'fail' ? 'border-red-400' : 
                                        log.feedback === 'target' ? 'border-emerald-500' : 'border-blue-400'
                                    }`} />
                                    
                                    {/* X-Axis Label */}
                                    <span className="absolute top-4 text-[10px] font-bold text-gray-400 whitespace-nowrap mt-1">
                                        S{log.setNumber}
                                    </span>
                                </div>
                             );
                        })}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {exerciseLogs.map((log, i) => {
                    const isAdjusted = log.feedback !== 'target'; 
                    
                    return (
                    <div key={i} className="flex justify-between items-center text-sm bg-white border border-gray-100 p-4 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-xs font-black text-gray-400 border border-gray-100">
                          {log.setNumber}
                        </span>
                        <div className="flex flex-col">
                           <span className="font-black text-gray-800 text-lg leading-none">
                             {log.repsCompleted} <span className="text-xs text-gray-400 font-bold">Reps</span>
                           </span>
                           {log.weightUsed && log.weightUsed !== "Bodyweight" && (
                               <span className="text-xs text-emerald-600 font-bold mt-1">
                                  {log.weightUsed}
                               </span>
                           )}
                        </div>
                      </div>
                      
                      {isAdjusted ? (
                        <div className="flex items-center gap-2">
                           <span className="bg-black text-white text-[10px] font-bold px-1.5 py-0.5 rounded tracking-wider">AI</span>
                           <span className={`text-[10px] px-3 py-1.5 rounded-full font-black uppercase tracking-wide ${
                            log.feedback === 'fail' ? 'bg-red-50 text-red-500' :
                            'bg-blue-50 text-blue-600'
                          }`}>
                            {log.feedback === 'fail' ? 'Fail' : 'Adjusted'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] px-3 py-1.5 rounded-full font-black uppercase tracking-wide bg-gray-50 text-gray-400">
                          CLEARED
                        </span>
                      )}
                    </div>
                  )})}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer Button */}
      <div className="absolute bottom-0 left-0 right-0 px-6 pb-3 bg-gradient-to-t from-white via-white to-transparent pt-12 z-20 flex flex-col gap-3">
        <button
          onClick={onClose}
          className="w-full py-3 rounded-2xl bg-[#065f46] text-white font-bold text-lg shadow-2xl shadow-emerald-900/20 active:scale-95 transition-all"
        >
          완료
        </button>
        
        {onRestart && (
            <button
              onClick={onRestart}
              className="w-full py-3 rounded-xl bg-gray-100 text-gray-500 font-bold text-sm active:scale-95 transition-all"
            >
              다시 컨디션 체크 (Restart)
            </button>
        )}
      </div>
    </div>
  );
};
