"use client";

import React, { useEffect, useState } from "react";
import { WorkoutSessionData, ExerciseLog, WorkoutAnalysis, WorkoutHistory } from "@/constants/workout";
import { analyzeWorkoutSession } from "@/utils/gemini";
import { buildWorkoutMetrics, estimateTrainingLevel, getOptimalLoadBand, getBig4FromHistory } from "@/utils/workoutMetrics";
import { loadRecentHistory as loadRecentHistoryFromStore } from "@/utils/workoutHistory";

interface WorkoutReportProps {
  sessionData: WorkoutSessionData;
  logs?: Record<number, ExerciseLog[]>;
  bodyWeightKg?: number;
  gender?: "male" | "female";
  birthYear?: number;
  sessionDate?: string; // ISO date string — for past sessions from history
  initialAnalysis?: WorkoutAnalysis | null;
  onClose: () => void;
  onRestart?: () => void;
  onAnalysisComplete?: (analysis: WorkoutAnalysis) => void;
}

// Sync load of recent history from localStorage (initial render), then async update from Firestore
function getRecentHistorySync(): WorkoutHistory[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("alpha_workout_history");
    if (!raw) return [];
    const all: WorkoutHistory[] = JSON.parse(raw);
    const cutoff = Date.now() - 28 * 24 * 60 * 60 * 1000;
    return all.filter(h => new Date(h.date).getTime() > cutoff);
  } catch {
    return [];
  }
}

function get28dAvgVolume(history: WorkoutHistory[]): { avgVolume28d: number; sessionCount: number } | null {
  if (history.length === 0) return null;
  const totalVol = history.reduce((s, h) => s + (h.stats.totalVolume || 0), 0);
  return { avgVolume28d: totalVol / history.length, sessionCount: history.length };
}

export const WorkoutReport: React.FC<WorkoutReportProps> = ({
  sessionData,
  logs = {},
  bodyWeightKg,
  gender,
  birthYear,
  sessionDate,
  initialAnalysis = null,
  onClose,
  onRestart,
  onAnalysisComplete
}) => {
  const [analysis, setAnalysis] = useState<WorkoutAnalysis | null>(initialAnalysis);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [helpCard, setHelpCard] = useState<string | null>(null);
  const [activeDot, setActiveDot] = useState<string | null>(null);
  const [e1rmIndex, setE1rmIndex] = useState(0);
  const [activeTimelineDot, setActiveTimelineDot] = useState<number | null>(null);
  const [recentHistory, setRecentHistory] = useState<WorkoutHistory[]>(getRecentHistorySync);

  const metrics = buildWorkoutMetrics(sessionData.exercises, logs, bodyWeightKg);
  const { sessionCategory, totalVolume, bestE1RM, allE1RMs, successRate, fatigueDrop, loadScore, totalDurationSec } = metrics;
  const isStrengthSession = sessionCategory === "strength" || sessionCategory === "mixed";

  // Merge today's big-4 e1RMs with history (today takes priority)
  const big4Combined = (() => {
    const historyBig4 = getBig4FromHistory(recentHistory);
    const merged = new Map<string, { exerciseName: string; value: number; fromToday: boolean; decayed: boolean; weeksAgo: number }>();
    // History first (lower priority)
    for (const h of historyBig4) {
      merged.set(h.exerciseName, { ...h, fromToday: false });
    }
    // Today overwrites
    for (const t of allE1RMs) {
      merged.set(t.exerciseName, { exerciseName: t.exerciseName, value: t.value, fromToday: true, decayed: false, weeksAgo: 0 });
    }
    return Array.from(merged.values()).sort((a, b) => b.value - a.value);
  })();

  const formatDuration = (sec: number) => {
    if (sec >= 3600) return `${Math.floor(sec / 3600)}시간 ${Math.floor((sec % 3600) / 60)}분`;
    if (sec >= 60) return `${Math.floor(sec / 60)}분 ${sec % 60 > 0 ? `${sec % 60}초` : ""}`.trim();
    return `${sec}초`;
  };

  const historyStats = get28dAvgVolume(recentHistory);

  // Training level estimation from history (근거: NSCA, Rippetoe 2006)
  const trainingLevel = estimateTrainingLevel(recentHistory, bodyWeightKg, gender);

  // Load recent history from Firestore (async update after initial sync render)
  useEffect(() => {
    loadRecentHistoryFromStore().then(setRecentHistory).catch(() => {});
  }, []);

  useEffect(() => {
    if (initialAnalysis) {
      setAnalysis(initialAnalysis);
      return;
    }

    if (Object.keys(logs).length > 0 && !analysis && !isAnalyzing) {
      const fetchAnalysis = async () => {
        setIsAnalyzing(true);
        const result = await analyzeWorkoutSession(
          sessionData, logs, bodyWeightKg, gender, birthYear, historyStats
        );
        setAnalysis(result);
        setIsAnalyzing(false);

        if (result && onAnalysisComplete) {
          onAnalysisComplete(result);
        }
      };
      fetchAnalysis();
    }
  }, [logs, sessionData, initialAnalysis]);

  // Build graph data from history (last 28 days load scores)
  const graphData = recentHistory.map(h => ({
    date: new Date(h.date),
    loadScore: h.stats.totalVolume && bodyWeightKg ? Math.round((h.stats.totalVolume / bodyWeightKg) * 10) / 10 : h.stats.totalVolume,
    volume: h.stats.totalVolume,
  }));
  // Add today's session
  if (totalVolume > 0) {
    graphData.push({
      date: new Date(),
      loadScore: loadScore,
      volume: totalVolume,
    });
  }

  // Evidence-based load band (레벨+연령 보정)
  // Exclude today's session from avgGraphLoad to avoid self-referencing bias
  const historyGraphData = graphData.slice(0, -1); // all except today
  const avgGraphLoad = historyGraphData.length > 0
    ? historyGraphData.reduce((s, d) => s + d.loadScore, 0) / historyGraphData.length
    : (graphData.length > 0 ? graphData[0].loadScore : 0);
  const loadBand = getOptimalLoadBand(avgGraphLoad, historyGraphData.length, trainingLevel, birthYear);

  // 부하 판정: loadScore vs loadBand 직접 비교 (비율 왜곡 방지)
  const bandLowRatio = avgGraphLoad > 0 ? loadBand.low / avgGraphLoad : 0.5;
  const bandHighRatio = avgGraphLoad > 0 ? loadBand.high / avgGraphLoad : 1.8;
  const bandOverloadRatio = avgGraphLoad > 0 ? loadBand.overload / avgGraphLoad : 2.3;

  // loadRatio: today's loadScore vs historical average loadScore
  const loadRatio = avgGraphLoad > 0 ? loadScore / avgGraphLoad : null;

  // 레벨 표시명
  const levelLabel = trainingLevel === "advanced" ? "상급" : trainingLevel === "intermediate" ? "중급" : "초급";

  return (
    <div className="flex flex-col h-full bg-[#FAFAFA] animate-fade-in relative">
      {/* Top Bar */}
      <div className="pt-[max(1.25rem,env(safe-area-inset-top))] pb-3 px-4 sm:px-6 flex items-center justify-between shrink-0 bg-[#FAFAFA] z-10">
        <button onClick={onClose} className="p-2 -ml-2">
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-[11px] font-serif font-medium tracking-[0.25em] text-gray-400 uppercase">Session Report</span>
        <div className="w-9" />
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-5 pb-24 sm:pb-[86px] scrollbar-hide">
        {/* Header */}
        <div className="flex flex-col items-center mb-6 mt-2">
          <h1 className="text-3xl font-serif font-light text-[#1B4332] tracking-[0.08em] animate-report-pop uppercase">Session Complete</h1>
          <p className="text-xs text-gray-400 font-medium mt-1 animate-report-slide" style={{ animationDelay: "0.2s" }}>{(sessionDate ? new Date(sessionDate) : new Date()).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" })}</p>
        </div>

        {/* === AI Coach Briefing === */}
        <div className="mb-5">
          {isAnalyzing ? (
            <div className="bg-white rounded-2xl p-5 border border-gray-100 flex flex-col items-center gap-3 animate-pulse shadow-sm">
              <div className="w-7 h-7 border-2 border-emerald-200 border-t-[#2D6A4F] rounded-full animate-spin" />
              <p className="text-xs font-bold text-gray-400">AI 코치가 세션을 분석중입니다...</p>
            </div>
          ) : analysis ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm animate-report-slide" style={{ animationDelay: "0.3s" }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-[#1B4332] flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h2 className="text-sm font-black text-[#1B4332] tracking-tight uppercase">코치 브리핑</h2>
              </div>
              <p className="text-[13px] font-medium text-gray-700 leading-relaxed">
                {analysis.briefing}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-5 border border-gray-100 text-center shadow-sm">
              <p className="text-xs text-gray-400">데이터가 부족하여 분석할 수 없습니다.</p>
            </div>
          )}
        </div>

        {/* === 2x2 Metric Cards === */}
        <div className="grid grid-cols-2 gap-2.5 mb-5">
          {isStrengthSession ? (
            <>
              {/* Top Lift */}
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm relative animate-count-up" style={{ animationDelay: "0.4s" }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em]">예상 최고 중량(1RM)</p>
                  <button onClick={() => setHelpCard("topLift")} className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center">
                    <span className="text-[10px] font-black text-gray-400">?</span>
                  </button>
                </div>
                {(() => {
                  const currentItem = big4Combined[e1rmIndex] || (big4Combined.length > 0 ? big4Combined[0] : null);
                  const current = currentItem || bestE1RM;
                  const currentBwRatio = current && bodyWeightKg ? current.value / bodyWeightKg : null;

                  return (
                    <>
                      <div className="flex items-baseline gap-2">
                        {currentBwRatio !== null && (
                          <span className="text-[10px] font-bold text-gray-400">체중의</span>
                        )}
                        <p className="text-2xl font-black text-[#1B4332] leading-none">
                          {currentBwRatio !== null
                            ? `${currentBwRatio.toFixed(1)}배`
                            : current ? `${Math.round(current.value)}kg` : "-"}
                        </p>
                        {currentBwRatio !== null && (
                          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                            currentBwRatio >= 1.2
                              ? "bg-amber-50 text-amber-600"
                              : currentBwRatio >= 0.8
                                ? "bg-emerald-50 text-[#2D6A4F]"
                                : "bg-gray-100 text-gray-500"
                          }`}>
                            {currentBwRatio >= 1.2 ? "상급" : currentBwRatio >= 0.8 ? "중급" : "초급"}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-1.5">
                        <p className="text-[9px] text-gray-400 font-medium leading-tight truncate flex-1">
                          {current
                            ? `${current.exerciseName.replace(/\s*\(.*\)$/, '')} ${Math.round(current.value)}kg`
                            : "-"}
                        </p>
                        {big4Combined.length > 1 && (
                          <div className="flex items-center ml-1 shrink-0">
                            <button
                              onClick={() => setE1rmIndex((e1rmIndex + 1) % big4Combined.length)}
                              className="w-4 h-4 rounded-full bg-gray-100 flex items-center justify-center"
                            >
                              <span className="text-[8px] text-gray-400">▶</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Load Status */}
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm relative animate-count-up" style={{ animationDelay: "0.5s" }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em]">부하 상태</p>
                  <button onClick={() => setHelpCard("loadStatus")} className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center">
                    <span className="text-[10px] font-black text-gray-400">?</span>
                  </button>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <p className={`text-2xl font-black leading-none ${
                    loadRatio !== null && loadRatio > bandHighRatio ? "text-amber-600"
                      : loadRatio !== null && loadRatio < bandLowRatio ? "text-blue-500"
                      : "text-[#1B4332]"
                  }`}>
                    {loadRatio !== null
                      ? `${loadRatio >= 1 ? "+" : ""}${Math.round((loadRatio - 1) * 100)}%`
                      : "-"}
                  </p>
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                    loadRatio !== null && loadRatio >= bandLowRatio && loadRatio <= bandHighRatio
                      ? "bg-emerald-50 text-[#2D6A4F]"
                      : loadRatio !== null && loadRatio > bandHighRatio
                        ? "bg-amber-50 text-amber-600"
                        : loadRatio !== null && loadRatio < bandLowRatio
                          ? "bg-blue-50 text-blue-500"
                          : "bg-gray-50 text-gray-400"
                  }`}>
                    {loadRatio !== null
                      ? (loadRatio >= bandLowRatio && loadRatio <= bandHighRatio ? "성장 구간" : loadRatio > bandOverloadRatio ? "과부하" : loadRatio > bandHighRatio ? "고부하" : "볼륨 부족")
                      : "첫 세션"}
                  </span>
                </div>
                <p className="text-[9px] text-gray-400 mt-1.5 font-medium">
                  {loadRatio !== null
                    ? (loadRatio > bandOverloadRatio ? "상한 초과 · 다음엔 줄여보세요" : loadRatio > bandHighRatio ? "적정보다 많아요 · 조절해보세요" : loadRatio < bandLowRatio ? "적정보다 적어요 · 늘려보세요" : "성장 구간 · 좋은 페이스예요")
                    : (historyStats ? `${levelLabel} · ACSM 기준` : `${levelLabel} · 기록 누적 중`)}
                </p>
              </div>

              {/* Target Rate */}
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm relative animate-count-up" style={{ animationDelay: "0.6s" }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em]">타깃 적중률</p>
                  <button onClick={() => setHelpCard("targetRate")} className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center">
                    <span className="text-[10px] font-black text-gray-400">?</span>
                  </button>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <p className="text-2xl font-black text-[#1B4332] leading-none">
                    {successRate}%
                  </p>
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                    successRate >= 85
                      ? "bg-emerald-50 text-[#2D6A4F]"
                      : successRate >= 70
                        ? "bg-amber-50 text-amber-600"
                        : "bg-red-50 text-red-500"
                  }`}>
                    {successRate >= 85 ? "잘함" : successRate >= 70 ? "보통" : "무리"}
                  </span>
                </div>
                <p className="text-[9px] text-gray-400 mt-1.5 font-medium">
                  {metrics.totalSets}세트 중 {Math.round(metrics.totalSets * successRate / 100)}세트 성공
                </p>
              </div>

              {/* Fatigue Drop */}
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm relative animate-count-up" style={{ animationDelay: "0.7s" }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em]">피로 신호</p>
                  <button onClick={() => setHelpCard("fatigueDrop")} className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center">
                    <span className="text-[10px] font-black text-gray-400">?</span>
                  </button>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <p className="text-2xl font-black text-[#1B4332] leading-none">
                    {fatigueDrop !== null ? `${fatigueDrop > 0 ? "+" : ""}${fatigueDrop}%` : "-"}
                  </p>
                  {fatigueDrop !== null && (
                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                      fatigueDrop > -15
                        ? "bg-emerald-50 text-[#2D6A4F]"
                        : fatigueDrop > -25
                          ? "bg-amber-50 text-amber-600"
                          : "bg-red-50 text-red-500"
                    }`}>
                      {fatigueDrop > -15 ? "안정" : fatigueDrop > -25 ? "주의" : "위험"}
                    </span>
                  )}
                </div>
                <p className="text-[9px] text-gray-400 mt-1.5 font-medium">
                  {fatigueDrop !== null
                    ? `필요회복시간 ${fatigueDrop > -10 ? "24" : fatigueDrop > -20 ? "36" : fatigueDrop > -30 ? "48" : "72"}시간`
                    : "후반 reps 변화"}
                </p>
              </div>
            </>
          ) : (
            <>
              {/* Cardio/Mobility: Total Duration */}
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm relative animate-count-up" style={{ animationDelay: "0.4s" }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em]">총 운동 시간</p>
                </div>
                <p className="text-2xl font-black text-[#1B4332] leading-none">
                  {formatDuration(totalDurationSec)}
                </p>
                <p className="text-[9px] text-gray-400 mt-1.5 font-medium">
                  {sessionCategory === "cardio" ? "유산소 세션" : "가동성 세션"}
                </p>
              </div>

              {/* Completion Rate */}
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm relative animate-count-up" style={{ animationDelay: "0.5s" }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em]">완료율</p>
                </div>
                <p className="text-2xl font-black text-[#1B4332] leading-none">
                  {successRate}%
                </p>
                <p className="text-[9px] text-gray-400 mt-1.5 font-medium">
                  {metrics.totalSets}개 항목 중 {Math.round(metrics.totalSets * successRate / 100)}개 완료
                </p>
              </div>

              {/* Total Exercises */}
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm relative animate-count-up" style={{ animationDelay: "0.6s" }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em]">수행 종목</p>
                </div>
                <p className="text-2xl font-black text-[#1B4332] leading-none">
                  {sessionData.exercises.length}개
                </p>
                <p className="text-[9px] text-gray-400 mt-1.5 font-medium">
                  {sessionCategory === "cardio" ? "러닝 + 코어" : "스트레칭 + 가동성"}
                </p>
              </div>

              {/* Session Type */}
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm relative animate-count-up" style={{ animationDelay: "0.7s" }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em]">세션 타입</p>
                </div>
                <p className="text-2xl font-black text-[#1B4332] leading-none">
                  {sessionCategory === "cardio" ? "🏃" : "🧘"}
                </p>
                <p className="text-[9px] text-gray-400 mt-1.5 font-medium">
                  {sessionCategory === "cardio" ? "유산소 / 달리기" : "회복 / 가동성"}
                </p>
              </div>
            </>
          )}
        </div>

        {/* === 4-Week Load Graph (strength only) === */}
        {isStrengthSession && graphData.length > 1 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-5 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em]">4주 부하 타임라인</p>
              <button onClick={() => setHelpCard("loadTimeline")} className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center">
                <span className="text-[10px] font-black text-gray-400">?</span>
              </button>
            </div>
            <div className="relative h-32 sm:h-28 mt-5 sm:mt-4 mb-2">
              {/* Evidence-based optimal band (레벨+연령 보정) */}
              {graphData.length > 1 && (() => {
                const maxLoad = Math.max(...graphData.map(g => g.loadScore), 1);
                const maxScale = Math.max(maxLoad, loadBand.high, loadBand.overload) * 1.1;
                const topPct = 100 - (loadBand.high / maxScale) * 80;
                const bottomPct = 100 - (loadBand.low / maxScale) * 80;
                const overloadPct = 100 - (loadBand.overload / maxScale) * 80;
                return (
                  <>
                    {/* Overload warning zone (above optimal) */}
                    <div
                      className="absolute left-0 right-0 bg-amber-50/50 border-t border-amber-200/50 rounded-t"
                      style={{
                        top: `${Math.max(0, overloadPct)}%`,
                        height: `${Math.max(0, topPct - overloadPct)}%`,
                      }}
                    />
                    {/* Optimal zone */}
                    <div
                      className="absolute left-0 right-0 bg-emerald-50 border-y border-emerald-100 rounded"
                      style={{
                        top: `${Math.max(0, topPct)}%`,
                        height: `${Math.max(4, bottomPct - topPct)}%`,
                      }}
                    />
                  </>
                );
              })()}
              {/* Line + dots */}
              <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                {graphData.length > 1 && (
                  <path
                    className="animate-draw-line"
                    style={{ animationDelay: "0.8s" }}
                    d={graphData.map((d, i) => {
                      const x = (i / (graphData.length - 1)) * 100;
                      const maxLoad = Math.max(...graphData.map(g => g.loadScore), 1);
                      const maxScale = Math.max(maxLoad, loadBand.high, loadBand.overload) * 1.1;
                      const y = 100 - ((d.loadScore / maxScale) * 80);
                      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
                    }).join(" ")}
                    fill="none"
                    stroke="#2D6A4F"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                )}
              </svg>
              {graphData.map((d, i) => {
                const xPct = graphData.length === 1 ? 50 : (i / (graphData.length - 1)) * 100;
                const maxLoad = Math.max(...graphData.map(g => g.loadScore), 1);
                const maxScale = Math.max(maxLoad, loadBand.high, loadBand.overload) * 1.1;
                const yPct = 100 - ((d.loadScore / maxScale) * 80);
                const isToday = i === graphData.length - 1;
                const isOverload = d.loadScore > loadBand.overload;
                const isAboveBand = d.loadScore > loadBand.high && !isOverload;
                const isBelowBand = d.loadScore < loadBand.low;
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
                    <div className={`rounded-full border-2 transition-transform ${isActive ? "scale-150" : ""} ${
                      isToday
                        ? isOverload ? "bg-red-500 border-red-500 w-3 h-3"
                          : isAboveBand ? "bg-amber-500 border-amber-500 w-3 h-3"
                          : isBelowBand ? "bg-blue-400 border-blue-400 w-3 h-3"
                          : "bg-[#2D6A4F] border-[#2D6A4F] w-3 h-3"
                        : "bg-white border-[#2D6A4F] w-2.5 h-2.5"
                    }`} />
                  </button>
                );
              })}
            </div>
            <div className="flex justify-between text-[9px] text-gray-300 font-medium">
              <span>{graphData.length > 0 ? `${graphData[0].date.getMonth() + 1}/${graphData[0].date.getDate()}` : ""}</span>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-amber-50 border border-amber-200 rounded-sm inline-block" /> 주의</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-100 rounded-sm inline-block" /> 최적</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-[#2D6A4F] rounded-full inline-block" /> 부하</span>
              </div>
              <span>오늘</span>
            </div>
          </div>
        )}

        {/* === Next Session Plan === */}
        {analysis && analysis.nextSessionAdvice && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-5 shadow-sm">
            <p className="text-[10px] font-serif font-medium text-gray-400 uppercase tracking-[0.15em] mb-3">Next Session Plan</p>
            <ul className="space-y-2">
              {analysis.nextSessionAdvice.split('\n').filter(a => a.trim()).map((advice: string, i: number) => (
                <li key={i} className="flex items-start gap-2.5 text-[13px] font-medium text-gray-700 leading-snug">
                  <span className="text-[#2D6A4F] font-bold mt-0.5 shrink-0">·</span>
                  {advice.trim()}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* === Summary Stats Row === */}
        <div className="flex gap-2 mb-5 animate-report-slide" style={{ animationDelay: "0.9s" }}>
          {isStrengthSession ? (
            <>
              <div className="flex-1 bg-white rounded-xl border border-gray-100 py-3 px-3 text-center shadow-sm">
                <p className="text-[9px] font-bold text-gray-400 uppercase">총 볼륨</p>
                <p className="text-base font-black text-[#1B4332]">{totalVolume.toLocaleString()}<span className="text-[10px] text-gray-400 ml-0.5">kg</span></p>
              </div>
              <div className="flex-1 bg-white rounded-xl border border-gray-100 py-3 px-3 text-center shadow-sm">
                <p className="text-[9px] font-bold text-gray-400 uppercase">총 세트</p>
                <p className="text-base font-black text-[#1B4332]">{metrics.strengthSets}</p>
              </div>
              <div className="flex-1 bg-white rounded-xl border border-gray-100 py-3 px-3 text-center shadow-sm">
                <p className="text-[9px] font-bold text-gray-400 uppercase">총 렙수</p>
                <p className="text-base font-black text-[#1B4332]">{metrics.totalReps}</p>
              </div>
            </>
          ) : (
            <>
              <div className="flex-1 bg-white rounded-xl border border-gray-100 py-3 px-3 text-center shadow-sm">
                <p className="text-[9px] font-bold text-gray-400 uppercase">운동 시간</p>
                <p className="text-base font-black text-[#1B4332]">{formatDuration(totalDurationSec)}</p>
              </div>
              <div className="flex-1 bg-white rounded-xl border border-gray-100 py-3 px-3 text-center shadow-sm">
                <p className="text-[9px] font-bold text-gray-400 uppercase">총 항목</p>
                <p className="text-base font-black text-[#1B4332]">{metrics.totalSets}</p>
              </div>
              <div className="flex-1 bg-white rounded-xl border border-gray-100 py-3 px-3 text-center shadow-sm">
                <p className="text-[9px] font-bold text-gray-400 uppercase">완료율</p>
                <p className="text-base font-black text-[#1B4332]">{successRate}%</p>
              </div>
            </>
          )}
        </div>

        {/* === Workout Logs (Collapsible) === */}
        <div className="mb-4">
          <button
            onClick={() => setShowLogs(!showLogs)}
            className="w-full flex items-center justify-between bg-white rounded-2xl border border-gray-100 p-4 shadow-sm active:scale-[0.99] transition-all"
          >
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 bg-[#2D6A4F] rounded-full" />
              <span className="text-sm font-serif font-medium text-[#1B4332] uppercase tracking-wide">Workout Logs</span>
            </div>
            <svg className={`w-4 h-4 text-gray-400 transition-transform ${showLogs ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showLogs && (
            <div className="mt-3 space-y-4">
              {sessionData.exercises.map((ex, idx) => {
                const exerciseLogs = logs[idx];
                if (!exerciseLogs || exerciseLogs.length === 0) return null;

                // Skip time-based exercises (plank, stretches, etc.) where reps aren't meaningful
                const isTimeBased = ex.type === "warmup" || ex.type === "cardio"
                  || /초|sec|min|분|유지|hold/i.test(ex.count)
                  || exerciseLogs.every(l => l.repsCompleted === 0);
                if (isTimeBased) {
                  return (
                    <div key={idx} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm animate-slide-up" style={{ animationDelay: `${idx * 0.05}s` }}>
                      <div className="flex justify-between items-baseline">
                        <h3 className="font-bold text-gray-800 text-sm text-left">{ex.name}</h3>
                        <span className="text-[9px] text-gray-400 uppercase font-black tracking-widest bg-gray-50 px-2 py-0.5 rounded">{ex.type}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-2">{ex.count} · {exerciseLogs.length}세트 완료</p>
                    </div>
                  );
                }

                const maxReps = Math.max(...exerciseLogs.map(l => l.repsCompleted), 1);
                const weights = exerciseLogs.map(l => parseFloat(l.weightUsed || "0")).filter(w => w > 0);
                const hasWeight = weights.length > 0;
                const maxWeight = hasWeight ? Math.max(...weights, 1) : 1;
                const minWeight = hasWeight ? Math.min(...weights) : 0;
                const weightRange = maxWeight - minWeight;
                const weightPadding = weightRange < 1 ? 2 : weightRange * 0.2;

                return (
                  <div key={idx} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm animate-slide-up" style={{ animationDelay: `${idx * 0.05}s` }}>
                    <div className="flex justify-between items-baseline mb-3">
                      <h3 className="font-bold text-gray-800 text-sm text-left">{ex.name}</h3>
                      <span className="text-[9px] text-gray-400 uppercase font-black tracking-widest bg-gray-50 px-2 py-0.5 rounded">{ex.type}</span>
                    </div>

                    {/* Graphs — single px-2 wrapper so all dots & labels share the same coordinate space */}
                    <div className="px-2">
                      {/* Weight Graph */}
                      {hasWeight && (
                        <>
                          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">중량 (kg)</p>
                          <div className="relative h-16 mb-3">
                            {exerciseLogs.length > 1 && (
                              <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                                <path
                                  d={exerciseLogs.map((log, i) => {
                                    const x = (i / (exerciseLogs.length - 1)) * 100;
                                    const w = parseFloat(log.weightUsed || "0");
                                    const y = weightRange < 1
                                      ? 50
                                      : 95 - ((w - (minWeight - weightPadding)) / (weightRange + weightPadding * 2)) * 90;
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
                            )}
                            {exerciseLogs.map((log, i) => {
                              const xPct = exerciseLogs.length === 1 ? 50 : (i / (exerciseLogs.length - 1)) * 100;
                              const w = parseFloat(log.weightUsed || "0");
                              const yPct = weightRange < 1
                                ? 50
                                : 95 - ((w - (minWeight - weightPadding)) / (weightRange + weightPadding * 2)) * 90;
                              const dotKey = `w-${idx}-${i}`;
                              const isActive = activeDot === dotKey;
                              const prevW = i > 0 ? parseFloat(exerciseLogs[i - 1].weightUsed || "0") : w;
                              const weightColor = w > prevW ? "border-emerald-400" : w < prevW ? "border-red-400" : "border-[#2D6A4F]";
                              return (
                                <button
                                  type="button"
                                  key={i}
                                  className="absolute z-10 flex items-center justify-center"
                                  style={{ left: `${xPct}%`, top: `${yPct}%`, transform: "translate(-50%, -50%)", width: 44, height: 44, background: "none", border: "none", padding: 0 }}
                                  onPointerUp={(e) => { e.stopPropagation(); setActiveDot(isActive ? null : dotKey); }}
                                >
                                  {isActive && (
                                    <span className="absolute -top-7 text-[10px] font-black text-gray-700 bg-white px-1.5 py-0.5 rounded shadow-sm border border-gray-100 z-20 whitespace-nowrap pointer-events-none">
                                      {log.weightUsed}kg
                                    </span>
                                  )}
                                  <div className={`w-2.5 h-2.5 bg-white border-[2.5px] rounded-full transition-transform ${isActive ? "scale-150" : ""} ${weightColor}`} />
                                </button>
                              );
                            })}
                          </div>
                        </>
                      )}

                      {/* Reps Graph */}
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">반복 횟수</p>
                      <div className="relative h-16">
                        {exerciseLogs.length > 1 && (
                          <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                            <path
                              d={exerciseLogs.map((log, i) => {
                                const x = (i / (exerciseLogs.length - 1)) * 100;
                                const y = 95 - ((log.repsCompleted / maxReps) * 80);
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
                        )}
                        {exerciseLogs.map((log, i) => {
                          const xPct = exerciseLogs.length === 1 ? 50 : (i / (exerciseLogs.length - 1)) * 100;
                          const yPct = 95 - ((log.repsCompleted / maxReps) * 80);
                          const dotKey = `r-${idx}-${i}`;
                          const isActive = activeDot === dotKey;
                          return (
                            <button
                              type="button"
                              key={i}
                              className="absolute z-10 flex items-center justify-center"
                              style={{ left: `${xPct}%`, top: `${yPct}%`, transform: "translate(-50%, -50%)", width: 44, height: 44, background: "none", border: "none", padding: 0 }}
                              onPointerUp={(e) => { e.stopPropagation(); setActiveDot(isActive ? null : dotKey); }}
                            >
                              {isActive && (
                                <span className="absolute -top-7 text-[10px] font-black text-gray-700 bg-white px-1.5 py-0.5 rounded shadow-sm border border-gray-100 z-20 whitespace-nowrap pointer-events-none">
                                  {log.repsCompleted}회
                                </span>
                              )}
                              <div className={`w-2.5 h-2.5 bg-white border-[2.5px] rounded-full transition-transform ${isActive ? "scale-150" : ""} ${
                                log.feedback === "fail" ? "border-red-400" :
                                log.feedback === "target" ? "border-[#2D6A4F]" : "border-emerald-400"
                              }`} />
                            </button>
                          );
                        })}
                      </div>

                      {/* Set labels — same px-2 container so positions match dots exactly */}
                      <div className="relative h-5 mt-1">
                        {exerciseLogs.map((log, i) => {
                          const xPct = exerciseLogs.length === 1 ? 50 : (i / (exerciseLogs.length - 1)) * 100;
                          const isFirst = i === 0;
                          const isLast = i === exerciseLogs.length - 1 && exerciseLogs.length > 1;
                          const tx = isFirst ? "translateX(0%)" : isLast ? "translateX(-100%)" : "translateX(-50%)";
                          return (
                            <span key={i} className="absolute text-[9px] font-bold text-gray-300 whitespace-nowrap" style={{ left: `${xPct}%`, transform: tx }}>
                              S{log.setNumber}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Help Card Bottom Sheet */}
      {helpCard && (
        <div className="absolute inset-0 z-40">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setHelpCard(null)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[2rem] p-6 pb-10 animate-slide-up shadow-2xl z-50 max-h-[85vh] flex flex-col">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5 shrink-0" />
            <div className="flex-1 overflow-y-auto scrollbar-hide">
            {helpCard === "topLift" && (
              <>
                <h3 className="text-lg font-black text-[#1B4332] mb-3">예상 최고 중량(1RM)</h3>
                <div className="space-y-3 text-[13px] text-gray-600 leading-relaxed">
                  <p>오늘 운동 기록으로 <span className="font-bold text-[#1B4332]">내가 1회 최대로 들 수 있는 무게(1RM)</span>를 추정하고, 체중 대비 몇 배인지 보여줘요.</p>
                  <p>예를 들어 <span className="font-bold">1.1배</span>면 체중의 1.1배를 들 수 있다는 뜻이에요.</p>
                  <p>▶ 버튼으로 <span className="font-bold">4대 운동</span>(스쿼트 · 데드리프트 · 벤치프레스 · 오버헤드프레스)의 기록을 넘겨볼 수 있어요.</p>
                  <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                    <p className="text-[11px] font-bold text-gray-500">체중 대비 기준 (남성 · 벤치프레스 기준)</p>
                    <div className="flex gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-gray-200 text-gray-600 rounded">~0.8배 초급</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-[#2D6A4F] rounded">0.8~1.2배 중급</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-700 rounded">1.2배+ 상급</span>
                    </div>
                  </div>
                  <p><span className="font-bold">1RM</span>은 오늘 세트 기록(무게 × 횟수)에서 Epley 공식으로 추정한 값이에요. 실제 1회 최대 시도 없이도 내 근력 수준을 알 수 있어요.</p>
                  <p className="text-[10px] text-gray-400 mt-2 pt-2 border-t border-gray-100">근거: NSCA Essentials of S&C (4th ed.), Epley (1985)</p>
                </div>
              </>
            )}
            {helpCard === "loadStatus" && (
              <>
                <h3 className="text-lg font-black text-[#1B4332] mb-3">부하 상태</h3>
                <div className="space-y-3 text-[13px] text-gray-600 leading-relaxed">
                  <p>오늘 운동량이 <span className="font-bold text-[#1B4332]">내 레벨에 맞는 적정 볼륨인지</span> 보여줘요.</p>
                  <p>오늘 부하는 최근 4주 평균 대비 <span className="font-bold text-[#1B4332]">{loadRatio !== null ? `${loadRatio >= 1 ? "+" : ""}${Math.round((loadRatio - 1) * 100)}%` : "-"}</span>예요. 0%면 평균과 같은 양이고, 현재 레벨(<span className="font-bold">{levelLabel}</span>)에 맞는 기준으로 판정해요.</p>
                  <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                    <p className="text-[11px] font-bold text-gray-500">볼륨 구간 안내 ({levelLabel})</p>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 text-blue-600 rounded shrink-0">볼륨 부족</span>
                        <span className="text-[10px] text-gray-500">성장에 필요한 최소 자극에 못 미쳐요</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-[#2D6A4F] rounded shrink-0">성장 구간</span>
                        <span className="text-[10px] text-gray-500">근성장에 가장 좋은 볼륨이에요</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-700 rounded shrink-0">고부하</span>
                        <span className="text-[10px] text-gray-500">가끔은 괜찮지만 자주 넘으면 주의</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-red-100 text-red-600 rounded shrink-0">과부하</span>
                        <span className="text-[10px] text-gray-500">쉬어가는 게 좋아요</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                    <p className="text-[11px] font-bold text-gray-500">레벨별 기준 (세션 볼륨 / 체중)</p>
                    <div className="space-y-1 text-[10px]">
                      <div className="flex justify-between"><span className="text-gray-500">초급</span><span className="font-bold text-gray-600">최소 15 · 최적 55 · 상한 70</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">중급</span><span className="font-bold text-gray-600">최소 40 · 최적 110 · 상한 140</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">상급</span><span className="font-bold text-gray-600">최소 70 · 최적 180 · 상한 220</span></div>
                    </div>
                  </div>
                  <p><span className="font-bold text-[#2D6A4F]">성장 구간</span>을 꾸준히 유지하면 가장 효과적이에요. 기록이 쌓이면 내 데이터에 맞게 조정돼요.</p>
                  <p className="text-[10px] text-gray-400 mt-2 pt-2 border-t border-gray-100">근거: ACSM (2009), Israetel RP Strength, NSCA Volume Load</p>
                </div>
              </>
            )}
            {helpCard === "targetRate" && (
              <>
                <h3 className="text-lg font-black text-[#1B4332] mb-3">타깃 적중률</h3>
                <div className="space-y-3 text-[13px] text-gray-600 leading-relaxed">
                  <p>AI가 정해준 목표 횟수를 <span className="font-bold text-[#1B4332]">실제로 얼마나 잘 채웠는지</span> 보여주는 거예요.</p>
                  <p>예를 들어 <span className="font-bold">84%</span>라면, 전체 세트 중 84%를 목표대로 성공했다는 뜻이에요.</p>
                  <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                    <p className="text-[11px] font-bold text-gray-500">적중률 기준</p>
                    <div className="flex gap-2 flex-wrap">
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-[#2D6A4F] rounded">85%+ 잘함</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-700 rounded">70~85% 보통</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-red-100 text-red-600 rounded">~70% 무리</span>
                    </div>
                  </div>
                  <p>85% 이상이면 무게를 올릴 타이밍이고, 70% 이하면 무게를 좀 낮추는 게 좋아요.</p>
                  <p className="text-[10px] text-gray-400 mt-2 pt-2 border-t border-gray-100">근거: NSCA RPE 가이드라인, Helms et al. (2018), ACSM (2009)</p>
                </div>
              </>
            )}
            {helpCard === "loadTimeline" && (
              <>
                <h3 className="text-lg font-black text-[#1B4332] mb-3">4주 부하 타임라인</h3>
                <div className="space-y-3 text-[13px] text-gray-600 leading-relaxed">
                  <p>최근 4주간의 <span className="font-bold text-[#1B4332]">운동 부하(볼륨)를 그래프로</span> 보여줘요. 점 하나가 운동 한 번이에요.</p>
                  <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 bg-emerald-100 border border-emerald-200 rounded-sm inline-block shrink-0" />
                      <p className="text-[11px]"><span className="font-bold text-[#2D6A4F]">초록색 영역 = 성장 구간</span></p>
                    </div>
                    <p className="text-[11px] text-gray-500 ml-5">{levelLabel} 레벨과 연령에 맞춘 적정 볼륨 구간이에요. 이 안에 있으면 잘하고 있는 거예요.</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="w-3 h-3 bg-amber-50 border border-amber-200 rounded-sm inline-block shrink-0" />
                      <p className="text-[11px]"><span className="font-bold text-amber-600">노란색 영역 = 고부하 주의</span></p>
                    </div>
                    <p className="text-[11px] text-gray-500 ml-5">적정 범위를 넘은 구간이에요. 가끔은 괜찮지만 자주 넘으면 조절이 필요해요.</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="w-3 h-3 bg-[#2D6A4F] rounded-full inline-block shrink-0" />
                      <p className="text-[11px]"><span className="font-bold text-[#2D6A4F]">점 = 세션별 부하</span></p>
                    </div>
                    <p className="text-[11px] text-gray-500 ml-5">총 볼륨(무게 × 횟수)을 체중으로 나눈 값이에요. 높을수록 강하게 운동한 거예요. 점을 터치하면 수치를 확인할 수 있어요.</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                    <p className="text-[11px] font-bold text-gray-500">레벨별 구간 수치 (볼륨 / 체중)</p>
                    <div className="space-y-1 text-[10px]">
                      <div className="flex justify-between"><span className="text-gray-500">초급</span><span className="font-bold text-gray-600">적정 15~55 · 주의 55~70 · 상한 70+</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">중급</span><span className="font-bold text-gray-600">적정 40~110 · 주의 110~140 · 상한 140+</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">상급</span><span className="font-bold text-gray-600">적정 70~180 · 주의 180~220 · 상한 220+</span></div>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">예: 체중 70kg, 총 볼륨 4,200kg → Load Score = 60</p>
                  </div>
                  <p>꾸준히 초록 영역 안에 점이 찍히면 <span className="font-bold text-[#2D6A4F]">잘 관리되고 있는 거예요</span>. 노란 영역 위로 자주 벗어나면 볼륨 조절이 필요해요.</p>
                  <p className="text-[10px] text-gray-400 mt-2 pt-2 border-t border-gray-100">근거: ACSM 점진적 과부하 원칙, Schoenfeld et al. (2017), Israetel RP Strength, NSCA</p>
                </div>
              </>
            )}
            {helpCard === "fatigueDrop" && (
              <>
                <h3 className="text-lg font-black text-[#1B4332] mb-3">피로 신호</h3>
                <div className="space-y-3 text-[13px] text-gray-600 leading-relaxed">
                  <p>운동 <span className="font-bold text-[#1B4332]">전반부와 후반부의 반복 횟수 차이</span>를 비교한 거예요.</p>
                  <p>예를 들어 <span className="font-bold">-12%</span>이면, 후반에 반복 횟수가 12% 줄어든 거예요. 약간의 피로는 자연스러운 거예요.</p>
                  <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                    <p className="text-[11px] font-bold text-gray-500">피로 신호 기준</p>
                    <div className="flex gap-2 flex-wrap">
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-[#2D6A4F] rounded">-15%까지 안정</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-700 rounded">-15~25% 주의</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-red-100 text-red-600 rounded">-25%+ 위험</span>
                    </div>
                  </div>
                  <p>피로가 크면 다음 세션에서 볼륨을 줄이거나 휴식을 더 가져야 해요. 꾸준히 안정 구간이면 잘 관리되고 있는 거예요.</p>
                  <p className="text-[10px] text-gray-400 mt-2 pt-2 border-t border-gray-100">근거: Morán-Navarro et al. (2017), NSCA 세트간 피로 가이드라인, ACSM 회복 권장</p>
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

      {/* Footer Button */}
      <div className="absolute bottom-0 left-0 right-0 px-5 pb-1.5 bg-gradient-to-t from-[#FAFAFA] via-[#FAFAFA] to-transparent pt-10 z-20">
        <div className="flex gap-2">
          {onRestart && (
            <button
              onClick={onRestart}
              className="flex-1 py-3 rounded-2xl bg-white border border-gray-200 text-gray-500 font-bold text-sm active:scale-95 transition-all"
            >
              Restart
            </button>
          )}
          <button
            onClick={onClose}
            className={`${onRestart ? "flex-1" : "w-full"} py-3 rounded-2xl bg-[#1B4332] text-white font-bold text-base shadow-xl shadow-[#1B4332]/20 active:scale-95 transition-all`}
          >
            완료
          </button>
        </div>
      </div>
    </div>
  );
};
