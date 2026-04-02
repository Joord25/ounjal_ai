"use client";

import React, { useEffect, useState } from "react";
import { WorkoutSessionData, ExerciseLog, WorkoutAnalysis, WorkoutHistory } from "@/constants/workout";
import { buildWorkoutMetrics, estimateTrainingLevel, getOptimalLoadBand, getBig4FromHistory, classifySessionIntensity, getIntensityRecommendation } from "@/utils/workoutMetrics";
import { ShareCard } from "./ShareCard";
import { loadRecentHistory as loadRecentHistoryFromStore } from "@/utils/workoutHistory";
import { getTierFromExp, type ExpLogEntry, sumExp, TIERS, processWorkoutCompletion, getOrRebuildSeasonExp } from "@/utils/questSystem";
import { trackEvent } from "@/utils/analytics";
import { useTranslation } from "@/hooks/useTranslation";

/* === RPG 리절트 카드 === */
interface RpgInsight {
  goalLine?: string;       // 1. 목표 연결 한 줄
  weightPR?: string;       // 2. 최고 무게 신기록
  phaseUnlock?: string;    // 3. Phase 해금 알림
  phaseJustUnlocked?: boolean; // 해금 달성 시 true
  volumeCompare?: string;  // 4. vs 지난 세션 비교
}

function RpgResultCard({ totalDurationSec, totalVolume, successRate, isStrengthSession, seasonExp, prevSeasonExp, expGained, intensityLevel, formatDuration, onHelpPress, onShowPrediction, skipAnimation, insight, sessionDesc }: {
  totalDurationSec: number; totalSets?: number; totalVolume: number; successRate: number;
  isStrengthSession: boolean; seasonExp: number; prevSeasonExp: number; expGained: ExpLogEntry[];
  intensityLevel: "high" | "moderate" | "low";
  formatDuration: (s: number) => string; onHelpPress: () => void; onShowPrediction?: () => void; skipAnimation?: boolean;
  insight?: RpgInsight; sessionDesc?: string;
}) {
  const { t } = useTranslation();
  const [visibleChars, setVisibleChars] = useState<number[]>([]);
  const [currentLine, setCurrentLine] = useState(skipAnimation ? 999 : -1);
  const current = getTierFromExp(seasonExp);
  const prev = getTierFromExp(prevSeasonExp);
  const tierUp = current.tierIdx > prev.tierIdx;
  const totalExpGained = sumExp(expGained);

  const intensityLabel = t(`report.intensity.${intensityLevel}`);
  const gradeMsg = successRate >= 95 ? t("report.grade.perfect")
    : successRate >= 80 ? t("report.grade.great")
    : successRate >= 60 ? t("report.grade.good")
    : successRate >= 40 ? t("report.grade.tough")
    : t("report.grade.showed");

  // 볼륨 경험 번역
  const volumeExpMsg = (() => {
    if (!isStrengthSession || totalVolume <= 0) return null;
    const desc = (sessionDesc || "").toLowerCase();
    if (/가슴|푸시|chest|push|벤치/.test(desc)) return "거울 앞에서 어깨 라인이 달라지는 걸 곧 느끼게 돼요";
    if (/등|풀|back|pull|로우|랫/.test(desc)) return "자세가 펴지고 등이 단단해지는 걸 느끼게 돼요";
    if (/하체|레그|스쿼트|leg|squat|런지|데드/.test(desc)) return "계단 3층쯤은 숨 안 차고 올라가는 날이 올 거예요";
    if (/코어|복근|core|ab|플랭크/.test(desc)) return "오래 앉아 일해도 허리가 덜 뻐근해지는 중이에요";
    if (/러닝|유산소|cardio|run|hiit|서킷/.test(desc)) return "일상에서 몸이 가벼워지는 걸 곧 느끼게 돼요";
    return "꾸준히 하면 일상에서 몸이 달라지는 걸 느끼게 돼요";
  })();

  type ReportLine = { text: string; bold?: boolean; highlight?: boolean; onTap?: () => void };

  // 코치카드 블록 구성
  const block1 = { // 감정 + 세션 요약
    gradeMsg,
    sessionInfo: `${sessionDesc || ""} · ${intensityLabel} · ${formatDuration(totalDurationSec)}`,
  };

  const block2Lines: string[] = [ // 경험 번역 (최대 2줄)
    ...(volumeExpMsg ? [volumeExpMsg] : []),
    ...(insight?.weightPR ? ["무거운 짐도 가뿐해지는 날이 가까워지고 있어요"] : []),
  ].slice(0, 2);

  // goalLine 경험 번역
  const goalExpMsg = (() => {
    if (!insight?.goalLine) return null;
    const gl = insight.goalLine;
    if (/kcal/.test(gl)) return "이 페이스면 4주 뒤 체중계 숫자가 달라져요";
    if (/1RM/.test(gl)) return "같은 무게가 점점 가벼워지고 있어요";
    if (/WHO/.test(gl)) return "건강한 삶의 기준을 넘어서고 있어요";
    return null;
  })();
  if (goalExpMsg && block2Lines.length < 2) block2Lines.push(goalExpMsg);

  const block3Lines: string[] = [ // 수치 보조 (압축)
    ...(insight?.volumeCompare ? [insight.volumeCompare] : []),
    ...(insight?.weightPR ? [insight.weightPR] : []),
    ...(insight?.goalLine && !goalExpMsg ? [insight.goalLine] : []),
  ];

  // 타이핑 애니메이션용 전체 라인
  const coachLines: ReportLine[] = [
    { text: block1.gradeMsg, bold: true },
    { text: block1.sessionInfo },
    ...block2Lines.map(t => ({ text: t, highlight: true })),
    ...block3Lines.map(t => ({ text: t })),
  ];

  // 카드2: 게이미피케이션 라인
  const gameLines: ReportLine[] = [
    ...expGained
      .filter(e => e.source !== "workout")
      .map(e => ({ text: `${e.detail}! +${e.amount} EXP`, bold: true, highlight: true })),
    ...(totalExpGained > 0 ? [{ text: `+${totalExpGained} EXP 획득!`, bold: true }] : []),
    ...(tierUp
      ? [{ text: `${prev.tier.name} → ${current.tier.name} 승급!`, bold: true, highlight: true }]
      : current.nextTier
        ? [{ text: `${current.tier.name}  ${current.nextTier.name}까지 ${current.remaining} EXP` }]
        : [{ text: `${current.tier.name}  최고 티어 달성!`, bold: true, highlight: true }]),
    ...(insight?.phaseUnlock ? [{ text: insight.phaseUnlock + (insight.phaseJustUnlocked ? " →" : ""), bold: !!insight.phaseJustUnlocked, highlight: !!insight.phaseJustUnlocked, onTap: insight.phaseJustUnlocked && onShowPrediction ? onShowPrediction : undefined }] : []),
  ];

  // 합쳐서 타이핑 애니메이션용 (코치 → 게임 순)
  const lines = [...coachLines, ...gameLines];

  useEffect(() => {
    if (skipAnimation) {
      // 히스토리 뷰: 즉시 전체 표시
      setVisibleChars(lines.map(l => l.text.length));
      return;
    }
    const timers: ReturnType<typeof setTimeout>[] = [];
    let baseDelay = 300;
    const charSpeed = 20; // ms per character
    const linePause = 250; // pause between lines

    lines.forEach((line, lineIdx) => {
      // Start this line
      timers.push(setTimeout(() => setCurrentLine(lineIdx), baseDelay));

      // Type each character
      for (let c = 0; c <= line.text.length; c++) {
        timers.push(setTimeout(() => {
          setVisibleChars(prev => {
            const next = [...prev];
            next[lineIdx] = c;
            return next;
          });
        }, baseDelay + c * charSpeed));
      }

      baseDelay += line.text.length * charSpeed + linePause;
    });

    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="mb-5 flex flex-col gap-3">
      {/* 카드1: AI 코치 리포트 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 overflow-hidden">
        <div className="flex items-center gap-2 mb-3">
          <img src="/favicon_backup.png" alt="AI" className="w-6 h-6 rounded-full shrink-0" />
          <span className="text-[11px] font-bold text-gray-400">오운잘 AI 코치</span>
        </div>

        {/* 블록1: 감정 + 세션 요약 */}
        {(() => {
          const line0Chars = visibleChars[0] ?? 0;
          const line1Chars = visibleChars[1] ?? 0;
          return (
            <div className="mb-3">
              {0 <= currentLine && (
                <p className="text-[16px] font-black text-[#1B4332] leading-relaxed">
                  {block1.gradeMsg.slice(0, line0Chars)}
                  {0 === currentLine && line0Chars < block1.gradeMsg.length && <span className="inline-block w-0.5 h-4 bg-[#2D6A4F] ml-0.5 animate-pulse align-middle" />}
                </p>
              )}
              {1 <= currentLine && (
                <p className="text-[13px] font-medium text-gray-400 mt-0.5">
                  {block1.sessionInfo.slice(0, line1Chars)}
                  {1 === currentLine && line1Chars < block1.sessionInfo.length && <span className="inline-block w-0.5 h-3 bg-gray-300 ml-0.5 animate-pulse align-middle" />}
                </p>
              )}
            </div>
          );
        })()}

        {/* 블록2: 경험 번역 */}
        {block2Lines.length > 0 && (() => {
          const startIdx = 2;
          const anyVisible = startIdx <= currentLine;
          if (!anyVisible) return null;
          return (
            <div className="bg-[#2D6A4F]/5 rounded-xl px-4 py-3 mb-3">
              {block2Lines.map((text, bi) => {
                const lineIdx = startIdx + bi;
                if (lineIdx > currentLine) return null;
                const chars = visibleChars[lineIdx] ?? 0;
                return (
                  <p key={bi} className={`${bi === 0 ? "text-[15px] font-bold" : "text-[13px]"} text-[#2D6A4F] leading-relaxed`}>
                    {text.slice(0, chars)}
                    {lineIdx === currentLine && chars < text.length && <span className="inline-block w-0.5 h-4 bg-[#2D6A4F] ml-0.5 animate-pulse align-middle" />}
                  </p>
                );
              })}
            </div>
          );
        })()}

        {/* 블록3: 수치 보조 */}
        {block3Lines.length > 0 && (() => {
          const startIdx = 2 + block2Lines.length;
          const anyVisible = startIdx <= currentLine;
          if (!anyVisible) return null;
          return (
            <div className="flex flex-col gap-0.5">
              {block3Lines.map((text, bi) => {
                const lineIdx = startIdx + bi;
                if (lineIdx > currentLine) return null;
                const chars = visibleChars[lineIdx] ?? 0;
                return (
                  <p key={bi} className="text-[12px] text-gray-400 font-medium">
                    {text.slice(0, chars)}
                    {lineIdx === currentLine && chars < text.length && <span className="inline-block w-0.5 h-3 bg-gray-300 ml-0.5 animate-pulse align-middle" />}
                  </p>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* 카드2: 게이미피케이션 (접힌 상태) */}
      {gameLines.length > 0 && (() => {
        const [gameOpen, setGameOpen] = React.useState(false);
        const expSummary = totalExpGained > 0
          ? `+${totalExpGained} EXP${tierUp ? ` · ${current.tier.name} 승급!` : ""}`
          : current.tier.name;
        return (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <button
              onClick={() => setGameOpen(!gameOpen)}
              className="w-full flex items-center justify-between px-5 py-4 active:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: current.tier.color }}>
                  <span className="text-[8px] font-black text-white">⚔</span>
                </div>
                <span className="text-[13px] font-bold text-[#1B4332]">{expSummary}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); onHelpPress(); }}
                  className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center"
                >
                  <span className="text-[9px] font-black text-gray-400">?</span>
                </button>
                <svg className={`w-4 h-4 text-gray-400 transition-transform duration-300 ${gameOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            <div className="px-5 pb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold" style={{ color: current.tier.color }}>{current.tier.name} {seasonExp} EXP</span>
                <span className="text-[11px] text-gray-400">
                  {current.nextTier ? t("report.tierRemaining", { next: current.nextTier.name, remaining: String(current.remaining) }) : t("report.maxTier")}
                </span>
              </div>
              <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{ width: `${current.progress * 100}%`, backgroundColor: current.tier.color }}
                />
              </div>
            </div>

            <div className={`overflow-hidden transition-all duration-300 ${gameOpen ? "max-h-[300px]" : "max-h-0"}`}>
              <div className="px-5 pb-4 pt-1 border-t border-gray-100 flex flex-col gap-1.5">
                {gameLines.map((line, gi) => (
                  <p
                    key={gi}
                    className={`text-[13px] leading-relaxed ${
                      line.highlight ? "text-[#2D6A4F] font-black" : line.bold ? "text-[#1B4332] font-bold" : "text-gray-500"
                    } ${line.onTap ? "underline underline-offset-2 cursor-pointer active:opacity-70" : ""}`}
                    onClick={line.onTap}
                  >
                    {line.text}
                  </p>
                ))}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

interface WorkoutReportProps {
  sessionData: WorkoutSessionData;
  logs?: Record<number, ExerciseLog[]>;
  bodyWeightKg?: number;
  gender?: "male" | "female";
  birthYear?: number;
  sessionDate?: string; // ISO date string — for past sessions from history
  savedDurationSec?: number; // actual elapsed time saved in history
  initialAnalysis?: WorkoutAnalysis | null;
  onClose: () => void;
  onRestart?: () => void;
  onDelete?: () => void;
  onShowPrediction?: () => void;
  onAnalysisComplete?: (analysis: WorkoutAnalysis) => void;
}

// Sync load of recent history from localStorage (initial render), then async update from Firestore
function getRecentHistorySync(): WorkoutHistory[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("alpha_workout_history");
    if (!raw) return [];
    const all: WorkoutHistory[] = JSON.parse(raw);
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
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
  savedDurationSec,
  initialAnalysis = null,
  onClose,
  onRestart,
  onDelete,
  onShowPrediction,
  onAnalysisComplete
}) => {
  const analysis = initialAnalysis;
  const [showLogs, setShowLogs] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [closeAfterShare, setCloseAfterShare] = useState(false);
  const [helpCard, setHelpCard] = useState<string | null>(null);
  const [activeDot, setActiveDot] = useState<string | null>(null);
  const [e1rmIndex, setE1rmIndex] = useState(0);
  const [recentHistory, setRecentHistory] = useState<WorkoutHistory[]>(getRecentHistorySync);

  const { t } = useTranslation();
  useEffect(() => { trackEvent("report_view"); }, []);

  const metrics = buildWorkoutMetrics(sessionData.exercises, logs, bodyWeightKg, savedDurationSec);
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

  // Session intensity classification (ACSM 2009 + NSCA)
  const sessionIntensity = classifySessionIntensity(sessionData.exercises, logs);
  const intensityRec = getIntensityRecommendation(recentHistory, birthYear, gender);

  // Load recent history from Firestore (async update after initial sync render)
  useEffect(() => {
    loadRecentHistoryFromStore().then(setRecentHistory).catch(() => {});
  }, []);


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
  // 강도별 기대 밴드 조정: 저강도는 낮은 볼륨이 정상, 고강도는 높아야 정상
  const intensityMod = sessionIntensity.level === "low" ? 0.4 : sessionIntensity.level === "high" ? 1.15 : 1.0;
  const bandLowRatio = avgGraphLoad > 0 ? (loadBand.low / avgGraphLoad) * intensityMod : 0.5;
  const bandHighRatio = avgGraphLoad > 0 ? (loadBand.high / avgGraphLoad) * (sessionIntensity.level === "low" ? 0.7 : 1.0) : 1.8;
  const bandOverloadRatio = avgGraphLoad > 0 ? (loadBand.overload / avgGraphLoad) * (sessionIntensity.level === "low" ? 0.7 : 1.0) : 2.3;

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
        <span className="text-[11px] font-medium text-gray-400">{(sessionDate ? new Date(sessionDate) : new Date()).toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" })}</span>
        {sessionDate ? (
          <div className="flex items-center gap-1 -mr-2">
            <button onClick={() => setShowShare(true)} className="p-2 active:scale-95 transition-all">
              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </button>
            {onDelete && (
              <button onClick={() => { if (confirm(t("delete.confirm"))) onDelete(); }} className="p-2 active:scale-95 transition-all">
                <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        ) : (
          <div className="w-9" />
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-5 scrollbar-hide" style={{ paddingBottom: "calc(96px + var(--safe-area-bottom, 0px))" }}>

        {/* === RPG 리절트 화면 === */}
        {(() => {
          // Quest-based EXP: process this workout completion and get EXP state
          const seasonState = getOrRebuildSeasonExp(recentHistory, birthYear, gender);
          const prevExp = seasonState.totalExp;

          // Build a pseudo WorkoutHistory for the current session to process quests
          const currentSessionHistory: WorkoutHistory = {
            id: `session-${Date.now()}`,
            date: (sessionDate || new Date().toISOString()),
            sessionData,
            logs,
            stats: { totalVolume, totalSets: isStrengthSession ? metrics.strengthSets : metrics.totalSets, totalReps: metrics.totalReps ?? 0, totalDurationSec, successRate },
          };
          const allHistoryWithCurrent = [...recentHistory, currentSessionHistory];
          const expGained = processWorkoutCompletion(currentSessionHistory, allHistoryWithCurrent, birthYear, gender);
          const currentExp = prevExp + sumExp(expGained);

          // ── Insight 계산 ──
          const insight: RpgInsight = {};

          // 1. 목표 연결 한 줄
          try {
            const fp = JSON.parse(localStorage.getItem("alpha_fitness_profile") || "{}");
            const goal = fp.goal as string | undefined;
            const bw = fp.bodyWeight as number | undefined;
            const freq = fp.weeklyFrequency as number | undefined;
            const sessionMin = fp.sessionMinutes as number | undefined;
            if (goal && bw && freq && sessionMin) {
              const metLow = goal === "endurance" ? 5.0 : goal === "fat_loss" ? 4.0 : 3.5;
              const metHigh = goal === "endurance" ? 8.0 : goal === "fat_loss" ? 7.0 : 6.0;
              const hours = (sessionMin || 45) / 60;
              const sessionCal = Math.round(((metLow + metHigh) / 2) * bw * hours);
              if (goal === "fat_loss") {
                const weeklyCal = sessionCal * freq;
                const weeklyLossKg = Math.round((weeklyCal / 7700) * 100) / 100;
                const pred4w = Math.round((bw - weeklyLossKg * 4) * 10) / 10;
                insight.goalLine = `이번 운동 ~${sessionCal}kcal 소모 → 4주 후 예상 ${pred4w}kg`;
              } else if (goal === "muscle_gain") {
                const bestVal = bestE1RM?.value ?? 0;
                const target = Math.round(bw * 1.0);
                if (bestVal > 0) {
                  const rounded = Math.round(bestVal * 10) / 10;
                  const eNameFull = bestE1RM!.exerciseName.split("(")[0].trim();
                  const eName = eNameFull.length > 6 ? eNameFull.slice(0, 6) + ".." : eNameFull;
                  const pct = Math.min(100, Math.round((bestVal / target) * 100));
                  insight.goalLine = `${eName} 추정1RM ${rounded}kg (중급 ${pct}%)`;
                }
              } else if (goal === "endurance" || goal === "health") {
                const whoMin = 150;
                const weeklyMin = freq * (sessionMin || 45);
                const pct = Math.min(200, Math.round((weeklyMin / whoMin) * 100));
                insight.goalLine = `이번 주 WHO 권장량 ${pct}% 달성 중`;
              }
            }
          } catch {}

          // 2. 최고 무게 신기록
          if (isStrengthSession && logs) {
            let todayMaxWeight = 0;
            for (const exLogs of Object.values(logs)) {
              for (const l of exLogs) {
                const w = parseFloat(l.weightUsed || "0");
                if (w > todayMaxWeight) todayMaxWeight = w;
              }
            }
            if (todayMaxWeight > 0) {
              let historyMaxWeight = 0;
              for (const h of recentHistory) {
                if (h.logs) {
                  for (const exLogs of Object.values(h.logs)) {
                    for (const l of exLogs) {
                      const w = parseFloat(l.weightUsed || "0");
                      if (w > historyMaxWeight) historyMaxWeight = w;
                    }
                  }
                }
              }
              if (todayMaxWeight > historyMaxWeight && historyMaxWeight > 0) {
                insight.weightPR = `최고 무게 신기록! ${historyMaxWeight}kg → ${todayMaxWeight}kg`;
              }
            }
          }

          // 3. Phase 해금 알림
          const totalWorkouts = allHistoryWithCurrent.length;
          const prevWorkouts = recentHistory.length;
          const phaseThresholds = [5, 10, 20];
          // 이전에는 미달이었지만 이번에 달성한 Phase 찾기
          const justUnlockedPhase = phaseThresholds.find(t => prevWorkouts < t && totalWorkouts >= t);
          if (justUnlockedPhase) {
            insight.phaseUnlock = `${justUnlockedPhase}회 달성! 새로운 예측이 해금되었습니다`;
            insight.phaseJustUnlocked = true;
          } else {
            const nextPhase = phaseThresholds.find(t => totalWorkouts < t);
            if (nextPhase) {
              const remaining = nextPhase - totalWorkouts;
              insight.phaseUnlock = `다음 예측 해금까지 ${remaining}회 남음`;
            }
          }

          // 4. vs 지난 세션 볼륨 비교 (현재 세션 제외)
          if (isStrengthSession && totalVolume > 0 && recentHistory.length > 0) {
            // 현재 세션과 볼륨이 동일한 마지막 항목은 자기 자신일 수 있으므로,
            // 현재 세션 날짜/볼륨과 다른 가장 최근 세션을 찾음
            const currentId = sessionData.exercises.map(e => e.name).join(",");
            const prevSessions = recentHistory.filter(h => {
              const hId = h.sessionData.exercises.map((e: { name: string }) => e.name).join(",");
              return hId !== currentId || h.stats.totalVolume !== totalVolume;
            });
            const lastSession = prevSessions[prevSessions.length - 1];
            const lastVol = lastSession?.stats?.totalVolume || 0;
            if (lastVol > 0) {
              const diff = Math.round(((totalVolume - lastVol) / lastVol) * 100);
              if (diff > 0) {
                insight.volumeCompare = `총 볼륨 ${totalVolume.toLocaleString()}kg (지난번 대비 +${diff}%)`;
              } else if (diff < 0) {
                insight.volumeCompare = `총 볼륨 ${totalVolume.toLocaleString()}kg (지난번 대비 ${diff}%)`;
              } else {
                insight.volumeCompare = `총 볼륨 ${totalVolume.toLocaleString()}kg (지난번과 동일)`;
              }
            }
          }

          return (
            <RpgResultCard
              totalDurationSec={totalDurationSec}
              totalSets={isStrengthSession ? metrics.strengthSets : metrics.totalSets}
              totalVolume={totalVolume}
              successRate={successRate}
              isStrengthSession={isStrengthSession}
              seasonExp={currentExp}
              prevSeasonExp={prevExp}
              expGained={expGained}
              intensityLevel={sessionIntensity.level}
              formatDuration={formatDuration}
              onHelpPress={() => setHelpCard("levelSystem")}
              onShowPrediction={onShowPrediction}
              skipAnimation={!!sessionDate}
              insight={insight}
              sessionDesc={sessionData.description || sessionData.title || ""}
            />
          );
        })()}


        {/* === 운동 과학 데이터 (펼쳐보기, 웨이트만) === */}
        {isStrengthSession && (
        <div className="mb-5">
          <button
            onClick={() => setShowDetail(!showDetail)}
            className="w-full flex items-center justify-between bg-white rounded-2xl border border-gray-100 p-4 shadow-sm active:scale-[0.99] transition-all"
          >
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 bg-[#2D6A4F] rounded-full" />
              <span className="text-sm font-bold text-[#1B4332]">운동 과학 데이터</span>
              <span className="text-[10px] text-gray-400 font-medium">1RM · 부하 · 강도 · 피로</span>
            </div>
            <svg className={`w-4 h-4 text-gray-400 transition-transform ${showDetail ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
        )}

        {showDetail && isStrengthSession && <>
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
                      : loadRatio !== null && loadRatio < bandLowRatio
                        ? (sessionIntensity.level === "low" ? "text-[#1B4332]" : "text-blue-500")
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
                          ? (sessionIntensity.level === "low" ? "bg-emerald-50 text-[#2D6A4F]" : "bg-blue-50 text-blue-500")
                          : "bg-gray-50 text-gray-400"
                  }`}>
                    {loadRatio !== null
                      ? (loadRatio >= bandLowRatio && loadRatio <= bandHighRatio
                          ? (sessionIntensity.level === "low" ? "저강도 적정" : sessionIntensity.level === "high" ? "고강도 성장" : "성장 구간")
                          : loadRatio > bandOverloadRatio ? "과부하" : loadRatio > bandHighRatio ? "고부하"
                          : (sessionIntensity.level === "low" ? "회복 세션" : "볼륨 부족"))
                      : "첫 세션"}
                  </span>
                </div>
                <p className="text-[9px] text-gray-400 mt-1.5 font-medium">
                  {loadRatio !== null
                    ? (loadRatio > bandOverloadRatio ? "상한 초과 · 다음엔 줄여보세요"
                      : loadRatio > bandHighRatio ? "적정보다 많아요 · 조절해보세요"
                      : loadRatio < bandLowRatio
                        ? (sessionIntensity.level === "low" ? "저강도 회복 · 계획대로 진행 중" : "적정보다 적어요 · 늘려보세요")
                        : (sessionIntensity.level === "low" ? "저강도 적정 · 회복에 집중" : sessionIntensity.level === "high" ? "고강도 적정 · 좋은 페이스예요" : "성장 구간 · 좋은 페이스예요"))
                    : (historyStats ? `${levelLabel} · ACSM 기준` : `${levelLabel} · 기록 누적 중`)}
                </p>
              </div>

              {/* Session Intensity */}
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm relative animate-count-up" style={{ animationDelay: "0.6s" }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em]">운동 강도</p>
                  <button onClick={() => setHelpCard("intensity")} className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center">
                    <span className="text-[10px] font-black text-gray-400">?</span>
                  </button>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <p className="text-2xl font-black text-[#1B4332] leading-none">
                    {sessionIntensity.level === "high" ? "고강도" : sessionIntensity.level === "moderate" ? "중강도" : "저강도"}
                  </p>
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                    sessionIntensity.level === "high" ? "bg-red-50 text-red-500"
                      : sessionIntensity.level === "moderate" ? "bg-amber-50 text-amber-600"
                      : "bg-blue-50 text-blue-500"
                  }`}>
                    {sessionIntensity.basis === "percent_1rm" && sessionIntensity.avgPercentile1RM
                      ? `${sessionIntensity.avgPercentile1RM}% 1RM`
                      : `평균 ${sessionIntensity.avgRepsPerSet}회`}
                  </span>
                </div>
                <p className="text-[9px] text-gray-400 mt-1.5 font-medium">
                  이번 주: 고{intensityRec.weekSummary.high} · 중{intensityRec.weekSummary.moderate} · 저{intensityRec.weekSummary.low}
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
                    ? `필요회복시간 ${fatigueDrop >= 0 ? "12" : fatigueDrop > -15 ? "24" : fatigueDrop > -25 ? "48" : "72"}시간`
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
        </>}

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
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[2rem] p-6 animate-slide-up shadow-2xl z-50 max-h-[85vh] flex flex-col" style={{ paddingBottom: "calc(var(--safe-area-bottom, 0px) + 16px)" }}>
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
                    <p className="text-[11px] font-bold text-gray-500">체중 대비 기준 ({gender === "female" ? "여성" : "남성"} · 벤치프레스 기준)</p>
                    {gender === "female" ? (
                      <div className="flex gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-gray-200 text-gray-600 rounded">~0.5배 초급</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-[#2D6A4F] rounded">0.5~0.8배 중급</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-700 rounded">0.8배+ 상급</span>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-gray-200 text-gray-600 rounded">~0.8배 초급</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-[#2D6A4F] rounded">0.8~1.2배 중급</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-700 rounded">1.2배+ 상급</span>
                      </div>
                    )}
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
            {helpCard === "intensity" && (
              <>
                <h3 className="text-lg font-black text-[#1B4332] mb-3">운동 강도</h3>
                <div className="space-y-3 text-[13px] text-gray-600 leading-relaxed">
                  <p>오늘 운동이 <span className="font-bold text-[#1B4332]">고강도·중강도·저강도</span> 중 어디에 해당하는지 보여줘요.</p>
                  <p>세트별 사용 중량을 예상 1RM 대비 비율(%1RM)로 환산해서 판정해요. 중량 데이터가 없으면 세트당 평균 반복수로 판정해요.</p>
                  <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                    <p className="text-[11px] font-bold text-gray-500">강도 분류 기준 (ACSM + NSCA)</p>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-red-100 text-red-600 rounded shrink-0">고강도</span>
                        <span className="text-[10px] text-gray-500">80%+ 1RM · 1-6회 · 최대근력</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-700 rounded shrink-0">중강도</span>
                        <span className="text-[10px] text-gray-500">60-79% 1RM · 7-12회 · 근비대</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 text-blue-600 rounded shrink-0">저강도</span>
                        <span className="text-[10px] text-gray-500">60% 미만 1RM · 13회+ · 근지구력</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                    <p className="text-[11px] font-bold text-gray-500">주간 권장 배분 ({gender === "female" ? "여성" : "남성"} · 연령별)</p>
                    {gender === "female" ? (
                      <div className="space-y-1 text-[10px]">
                        <div className="flex justify-between"><span className="text-gray-500">20-39세</span><span className="font-bold text-gray-600">고 2회 · 중 2회 · 저 1회</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">40-59세</span><span className="font-bold text-gray-600">고 2회 · 중 2회 · 저 1회 (골밀도)</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">60세+</span><span className="font-bold text-gray-600">고 1회 · 중 2회 · 저 1회</span></div>
                      </div>
                    ) : (
                      <div className="space-y-1 text-[10px]">
                        <div className="flex justify-between"><span className="text-gray-500">20-39세</span><span className="font-bold text-gray-600">고 2회 · 중 2회 · 저 1회</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">40-59세</span><span className="font-bold text-gray-600">고 1회 · 중 3회 · 저 1회</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">60세+</span><span className="font-bold text-gray-600">고 1회 · 중 2회 · 저 1회</span></div>
                      </div>
                    )}
                  </div>
                  {gender === "female" && (
                    <p className="text-[11px] text-gray-500"><span className="font-bold text-[#2D6A4F]">여성 참고</span>: 에스트로겐의 항염증 효과로 회복이 ~15% 빠르며, 40대 이후 골밀도 유지를 위해 고강도 비중을 유지하는 것이 권장돼요 (ACSM 폐경 후 가이드라인).</p>
                  )}
                  <p>고·중·저를 <span className="font-bold text-[#2D6A4F]">골고루 배분</span>하면 과훈련을 방지하고 성장 효율이 가장 높아요. 이번 주 배분을 확인하고 다음 세션 강도를 조절해보세요.</p>
                  <p className="text-[10px] text-gray-400 mt-2 pt-2 border-t border-gray-100">근거: ACSM Resistance Exercise Guidelines (2025), WHO Physical Activity Guidelines (2020, PMC 7719906), Schoenfeld et al. (2019, PMC 6303131)</p>
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
            {helpCard === "levelSystem" && (
              <>
                <h3 className="text-lg font-black text-[#1B4332] mb-3">시즌 티어 시스템</h3>
                <div className="space-y-3 text-[13px] text-gray-600 leading-relaxed">
                  <p>운동을 완료할 때마다 <span className="font-bold text-[#1B4332]">경험치(EXP)</span>가 쌓이고, 일정 횟수를 채우면 티어가 올라가요.</p>
                  <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                    <p className="text-[11px] font-bold text-gray-500">시즌 티어 구간</p>
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
                  <p>주 3회 꾸준히 하면 시즌 내 Diamond까지 갈 수 있어요.</p>
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

      {/* Footer Button — only for current session (not history view) */}
      {!sessionDate && (
        <div className={`absolute bottom-0 left-0 right-0 px-5 bg-gradient-to-t from-[#FAFAFA] via-[#FAFAFA] to-transparent pt-10 pb-0 z-20 ${showShare ? "hidden" : ""}`}>
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
              onClick={() => setShowShare(true)}
              className="py-3 px-4 rounded-2xl bg-white border border-gray-200 text-[#1B4332] font-bold text-sm active:scale-95 transition-all flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              공유
            </button>
            <button
              onClick={() => { setCloseAfterShare(true); setShowShare(true); }}
              className="flex-1 py-3 rounded-2xl bg-[#1B4332] text-white font-bold text-base shadow-xl shadow-[#1B4332]/20 active:scale-95 transition-all"
            >
              완료
            </button>
          </div>
        </div>
      )}

      {/* Share Card Modal */}
      {showShare && (
        <ShareCard
          sessionData={sessionData}
          logs={logs}
          metrics={metrics}
          analysis={analysis}
          bodyWeightKg={bodyWeightKg}
          sessionDate={sessionDate}
          recentHistory={recentHistory}
          onClose={() => { setShowShare(false); if (closeAfterShare) { setCloseAfterShare(false); onClose(); } }}
        />
      )}
    </div>
  );
};
