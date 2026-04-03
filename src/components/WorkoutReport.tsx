"use client";

import React, { useEffect, useState } from "react";
import { WorkoutSessionData, ExerciseLog, WorkoutAnalysis, WorkoutHistory } from "@/constants/workout";
import { buildWorkoutMetrics, estimateTrainingLevel, getOptimalLoadBand, getBig4FromHistory, classifySessionIntensity, getIntensityRecommendation } from "@/utils/workoutMetrics";
import { ShareCard } from "./ShareCard";
import { loadRecentHistory as loadRecentHistoryFromStore, updateCoachMessages } from "@/utils/workoutHistory";
import { getTierFromExp, type ExpLogEntry, sumExp, TIERS, getOrRebuildSeasonExp } from "@/utils/questSystem";
import { trackEvent } from "@/utils/analytics";
import { useTranslation } from "@/hooks/useTranslation";
import { getExerciseName } from "@/utils/exerciseName";
import { auth } from "@/lib/firebase";

function translateDesc(desc: string, locale: string): string {
  if (locale === "ko") return desc;
  return desc
    .replace(/하체/g, "Lower").replace(/가슴/g, "Chest").replace(/등/g, "Back")
    .replace(/어깨/g, "Shoulders").replace(/팔/g, "Arms")
    .replace(/상체\(밀기\(Push\)\)/g, "Upper (Push)").replace(/상체\(당기기\(Pull\)\)/g, "Upper (Pull)")
    .replace(/(\d+)종/g, "$1 exercises").replace(/(\d+)세트/g, "$1 sets")
    .replace(/집중 운동/g, "Focus")
    .replace(/인터벌 러닝/g, "Interval Running").replace(/이지 런/g, "Easy Run").replace(/장거리 러닝/g, "Long Distance Run")
    .replace(/러너 코어/g, "Runner Core").replace(/맨몸 \+ 덤벨 전신 서킷/g, "Bodyweight + Dumbbell Circuit")
    .replace(/근비대/g, "Hypertrophy").replace(/근력 강화/g, "Strength")
    .replace(/체지방 감량/g, "Fat Loss").replace(/전반적 체력 향상/g, "General Fitness")
    .replace(/상체 뻣뻣함 개선/g, "Upper stiffness relief").replace(/하체 무거움 완화/g, "Lower heaviness relief")
    .replace(/전반적 피로 회복/g, "Fatigue recovery").replace(/최적 컨디션/g, "Optimal condition");
}

/* === 히어로 데이터 타입 === */
type HeroType = "weightPR" | "repsPR" | "volumePR" | "perfect" | "streak" | "volume" | "first" | "running";
interface HeroData {
  type: HeroType;
  label: string;
  bigNumber: string;
  subText?: string;
  coachLine?: string;    // 서버에서 받아옴 (초기 undefined)
  isDark: boolean;
  // 서버 호출용 메타
  exerciseName?: string;
  exerciseType?: string;
  vars?: Record<string, string>;
}

/** 시간대 맥락 메시지 키 반환 */
function getTimeContextKey(): string {
  const h = new Date().getHours();
  if (h >= 0 && h < 5) return "report.hero.time.night";
  if (h >= 5 && h < 8) return "report.hero.time.dawn";
  if (h >= 8 && h < 11) return "report.hero.time.morning";
  if (h >= 11 && h < 12) return "report.hero.time.preLunch";
  if (h >= 12 && h < 14) return "report.hero.time.lunch";
  if (h >= 14 && h < 18) return "report.hero.time.afternoon";
  if (h >= 18 && h < 22) return "report.hero.time.evening";
  return "report.hero.time.night";
}

/** 마이크로 PR 감지 — 같은 운동의 이전 최고와 비교 (2회차+) — 메시지 없이 타입만 */
function detectMicroPR(
  exercises: WorkoutSessionData["exercises"],
  logs: Record<number, ExerciseLog[]>,
  history: WorkoutHistory[],
  t: (key: string, vars?: Record<string, string>) => string,
  locale: string,
): HeroData | null {
  // 히스토리에서 운동별 최고 기록 추출
  const historyBest: Record<string, { maxWeight: number; maxRepsAtWeight: Record<number, number>; maxVolume: number; count: number }> = {};
  for (const h of history) {
    if (!h.logs) continue;
    for (const ex of h.sessionData.exercises) {
      const exIdx = h.sessionData.exercises.indexOf(ex);
      const exLogs = h.logs[exIdx];
      if (!exLogs || exLogs.length === 0) continue;
      const name = ex.name;
      if (!historyBest[name]) historyBest[name] = { maxWeight: 0, maxRepsAtWeight: {}, maxVolume: 0, count: 0 };
      historyBest[name].count++;
      let exVol = 0;
      for (const l of exLogs) {
        const w = parseFloat(l.weightUsed || "0");
        if (w > historyBest[name].maxWeight) historyBest[name].maxWeight = w;
        if (w > 0) {
          const prevMax = historyBest[name].maxRepsAtWeight[w] || 0;
          if (l.repsCompleted > prevMax) historyBest[name].maxRepsAtWeight[w] = l.repsCompleted;
        }
        exVol += (w || 0) * l.repsCompleted;
      }
      if (exVol > historyBest[name].maxVolume) historyBest[name].maxVolume = exVol;
    }
  }

  // 우선순위 1: 무게 PR
  for (let i = 0; i < exercises.length; i++) {
    const ex = exercises[i];
    const exLogs = logs[i];
    if (!exLogs || exLogs.length === 0) continue;
    const best = historyBest[ex.name];
    if (!best || best.count < 1) continue;
    for (const l of exLogs) {
      const w = parseFloat(l.weightUsed || "0");
      if (w > 0 && w > best.maxWeight && best.maxWeight > 0) {
        const displayName = getExerciseName(ex.name, locale).split("(")[0].trim();
        return {
          type: "weightPR", label: t("report.hero.pr"), isDark: true,
          bigNumber: `${best.maxWeight} → ${w} kg`, subText: displayName,
          exerciseName: ex.name, exerciseType: ex.type,
          vars: { name: displayName, weight: String(w), prev: String(best.maxWeight) },
        };
      }
    }
  }

  // 우선순위 2: 렙수 PR
  for (let i = 0; i < exercises.length; i++) {
    const ex = exercises[i];
    const exLogs = logs[i];
    if (!exLogs || exLogs.length === 0) continue;
    const best = historyBest[ex.name];
    if (!best || best.count < 1) continue;
    for (const l of exLogs) {
      const w = parseFloat(l.weightUsed || "0");
      if (w > 0 && best.maxRepsAtWeight[w] && l.repsCompleted > best.maxRepsAtWeight[w]) {
        const displayName = getExerciseName(ex.name, locale).split("(")[0].trim();
        const diff = l.repsCompleted - best.maxRepsAtWeight[w];
        return {
          type: "repsPR", label: t("report.hero.pr"), isDark: true,
          bigNumber: `${best.maxRepsAtWeight[w]} → ${l.repsCompleted}`, subText: `${displayName} · ${w}kg`,
          exerciseName: ex.name, exerciseType: ex.type,
          vars: { name: displayName, diff: String(diff), prev: String(best.maxRepsAtWeight[w]), current: String(l.repsCompleted) },
        };
      }
    }
  }

  // 우선순위 3: 볼륨 PR
  for (let i = 0; i < exercises.length; i++) {
    const ex = exercises[i];
    const exLogs = logs[i];
    if (!exLogs || exLogs.length === 0) continue;
    const best = historyBest[ex.name];
    if (!best || best.count < 1) continue;
    let todayVol = 0;
    for (const l of exLogs) todayVol += (parseFloat(l.weightUsed || "0") || 0) * l.repsCompleted;
    if (todayVol > best.maxVolume && best.maxVolume > 0) {
      const displayName = getExerciseName(ex.name, locale).split("(")[0].trim();
      return {
        type: "volumePR", label: t("report.hero.sessionRecord"), isDark: true,
        bigNumber: `${best.maxVolume.toLocaleString()} → ${todayVol.toLocaleString()} kg`, subText: displayName,
        exerciseName: ex.name, exerciseType: ex.type,
        vars: { name: displayName },
      };
    }
  }

  return null;
}

/** 서버에서 코치 멘트 가져오기 */
/** 서버에서 코치 3버블 멘트 가져오기 (Gemini 생성) */
async function fetchCoachMessages(
  hero: HeroData,
  locale: string,
  logs: Record<number, ExerciseLog[]>,
  exercises: WorkoutSessionData["exercises"],
  condition?: { bodyPart: string; energyLevel: number },
  sessionDesc?: string,
  streak?: number,
): Promise<string[]> {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("No user");
    const token = await user.getIdToken();

    // 세션 로그 요약 (서버에 전달)
    const sessionLogs = exercises.map((ex, i) => {
      const exLogs = logs[i];
      if (!exLogs || exLogs.length === 0) return null;
      return {
        exerciseName: ex.name.split("(")[0].trim(),
        sets: exLogs.map(l => ({
          setNumber: l.setNumber,
          reps: l.repsCompleted,
          weight: l.weightUsed,
          feedback: l.feedback,
        })),
      };
    }).filter(Boolean);

    const res = await fetch("/api/getCoachMessage", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({
        heroType: hero.type,
        exerciseName: hero.exerciseName ? hero.exerciseName.split("(")[0].trim() : undefined,
        vars: hero.vars,
        locale,
        sessionLogs,
        condition,
        sessionDesc,
        streak,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const messages = data.result?.messages;
    if (Array.isArray(messages) && messages.length > 0) return messages;
    return [data.result?.text || (locale === "ko" ? "오늘도 같이 해서 좋았어요!" : "Great training together!")];
  } catch {
    return locale === "ko"
      ? ["오늘도 같이 운동해서 좋았어요!", "끝까지 잘 해냈어요!", "내일도 기다리고 있을게요!"]
      : ["Great training together today!", "You finished strong!", "I'll be waiting tomorrow!"];
  }
}

/* === RPG 리절트 카드 === */
interface RpgInsight {
  goalLine?: string;       // 1. 목표 연결 한 줄
  weightPR?: string;       // 2. 최고 무게 신기록
  phaseUnlock?: string;    // 3. Phase 해금 알림
  phaseJustUnlocked?: boolean; // 해금 달성 시 true
  volumeCompare?: string;  // 4. vs 지난 세션 비교
}

function RpgResultCard({ totalDurationSec, totalVolume, isStrengthSession, seasonExp, prevSeasonExp, expGained, intensityLevel, formatDuration, onHelpPress, onShowPrediction, skipAnimation, insight, sessionDesc, hero, timeContext, streak, nextWorkoutName, logs, exercises, condition, savedCoachMessages, onCoachMessagesLoaded }: {
  totalDurationSec: number; totalSets?: number; totalVolume: number; successRate: number;
  isStrengthSession: boolean; seasonExp: number; prevSeasonExp: number; expGained: ExpLogEntry[];
  intensityLevel: "high" | "moderate" | "low";
  formatDuration: (s: number) => string; onHelpPress: () => void; onShowPrediction?: () => void; skipAnimation?: boolean;
  insight?: RpgInsight; sessionDesc?: string;
  hero: HeroData; timeContext: string; streak: number; nextWorkoutName?: string;
  logs: Record<number, ExerciseLog[]>; exercises: WorkoutSessionData["exercises"];
  condition?: { bodyPart: string; energyLevel: number };
  savedCoachMessages?: string[]; onCoachMessagesLoaded?: (msgs: string[]) => void;
}) {
  const { t, locale } = useTranslation();
  const current = getTierFromExp(seasonExp);
  const prev = getTierFromExp(prevSeasonExp);
  const tierUp = current.tierIdx > prev.tierIdx;
  const totalExpGained = sumExp(expGained);

  const intensityLabel = t(`report.intensity.${intensityLevel}`);
  const sessionInfo = `${translateDesc(sessionDesc || "", locale)} · ${intensityLabel} · ${formatDuration(totalDurationSec)}`;

  // 코치 3버블: 저장된 멘트 우선, 없으면 서버(Gemini)에서 로드
  const hasSaved = savedCoachMessages && savedCoachMessages.length > 0;
  const [coachMessages, setCoachMessages] = useState<string[]>(hasSaved ? savedCoachMessages : []);
  const [isThinking, setIsThinking] = useState(!skipAnimation && !hasSaved);
  const [visibleBubbles, setVisibleBubbles] = useState(skipAnimation || hasSaved ? 999 : 0);
  const [typedCharsPerBubble, setTypedCharsPerBubble] = useState<number[]>([]);
  const [showRichCard, setShowRichCard] = useState(skipAnimation || hasSaved);

  useEffect(() => {
    // 저장된 멘트가 있으면 즉시 표시 (Gemini 호출 X)
    if (hasSaved || skipAnimation) {
      setIsThinking(false);
      return;
    }
    // 서버에서 Gemini 3버블 가져오기
    fetchCoachMessages(hero, locale, logs, exercises, condition, sessionDesc, streak).then(msgs => {
      setCoachMessages(msgs);
      setIsThinking(false);
      // 저장 콜백 — 히스토리에 기록
      if (onCoachMessagesLoaded) onCoachMessagesLoaded(msgs);
    });
  }, []);

  // 3버블 순차 타이핑 애니메이션
  useEffect(() => {
    if (coachMessages.length === 0 || skipAnimation || isThinking) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const charSpeed = 18;
    const bubblePause = 500;
    let baseDelay = 0;

    coachMessages.forEach((msg, bubbleIdx) => {
      // 버블 등장
      timers.push(setTimeout(() => setVisibleBubbles(bubbleIdx + 1), baseDelay));
      // 글자별 타이핑
      for (let c = 0; c <= msg.length; c++) {
        timers.push(setTimeout(() => {
          setTypedCharsPerBubble(prev => {
            const next = [...prev];
            next[bubbleIdx] = c;
            return next;
          });
        }, baseDelay + c * charSpeed));
      }
      baseDelay += msg.length * charSpeed + bubblePause;
    });

    // 마지막 버블 타이핑 완료 후 리치카드
    timers.push(setTimeout(() => setShowRichCard(true), baseDelay + 300));

    return () => timers.forEach(clearTimeout);
  }, [coachMessages, isThinking]);

  // EXP 요약
  const expSummary = totalExpGained > 0
    ? `+${totalExpGained} EXP${tierUp ? t("report.tierUpShort", { tier: current.tier.name }) : ""}`
    : current.tier.name;

  return (
    <div className="mb-5 flex flex-col gap-3">
      {/* AI 코치 카드 — 채팅 스타일 */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden px-4 pt-4 pb-4">
        {/* 헤더 */}
        <div className="flex items-center gap-2 mb-3">
          <img src="/favicon_backup.png" alt="AI" className="w-6 h-6 rounded-full shrink-0" />
          <span className="text-[11px] font-bold text-gray-400">{t("report.aiCoach")}</span>
        </div>

        {/* 코치 3버블 — thinking dots → 순차 타이핑 (멘트 없는 히스토리 뷰에서는 숨김) */}
        {isThinking && !skipAnimation && (
          <div className="flex items-start gap-2.5 mb-2">
            <img src="/favicon_backup.png" alt="" className="w-7 h-7 rounded-full shrink-0 mt-0.5" />
            <div className="bg-[#2D6A4F]/5 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2D6A4F]/40 animate-bounce" style={{ animationDelay: "0ms", animationDuration: "1s" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2D6A4F]/40 animate-bounce" style={{ animationDelay: "150ms", animationDuration: "1s" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2D6A4F]/40 animate-bounce" style={{ animationDelay: "300ms", animationDuration: "1s" }} />
                </div>
                <span className="text-[12px] font-medium text-[#2D6A4F]/50 animate-pulse">
                  {locale === "ko" ? "세션 분석 중..." : "Analyzing session..."}
                </span>
              </div>
            </div>
          </div>
        )}
        {!isThinking && coachMessages.map((msg, idx) => {
          if (idx >= visibleBubbles) return null;
          const chars = typedCharsPerBubble[idx] ?? 0;
          const isTyping = chars < msg.length;
          return (
            <div key={idx} className="flex items-start gap-2.5 mb-2">
              {idx === 0 ? (
                <img src="/favicon_backup.png" alt="" className="w-7 h-7 rounded-full shrink-0 mt-0.5" />
              ) : (
                <div className="w-7 shrink-0" />
              )}
              <div className="max-w-[85%] bg-[#2D6A4F]/5 rounded-2xl rounded-tl-sm px-4 py-3">
                <p className="text-[14px] font-medium text-[#1B4332] leading-relaxed">
                  {msg.slice(0, chars)}
                  {isTyping && (
                    <span className="inline-block w-0.5 h-3.5 bg-[#2D6A4F] ml-0.5 animate-pulse align-middle" />
                  )}
                </p>
              </div>
            </div>
          );
        })}
        {!isThinking && coachMessages.length > 0 && <div className="mb-3" />}

        {/* 결과 리치 카드 (감정 버블 타이핑 후 등장) */}
        {showRichCard && (
          <div className={`ml-9.5 rounded-2xl p-4 animate-slide-up ${hero.isDark ? "bg-[#1B4332]" : "bg-gray-50"}`}>
            <p className={`text-[7px] font-black uppercase tracking-[0.3em] mb-2 ${hero.isDark ? "text-emerald-300/60" : "text-gray-400"}`}>
              {hero.label}
            </p>
            {hero.subText && (
              <p className={`text-[13px] font-medium mb-1 ${hero.isDark ? "text-white/70" : "text-gray-500"}`}>
                {hero.subText}
              </p>
            )}
            <div className="flex items-center gap-2">
              <p className={`text-[26px] font-black leading-none tracking-tight ${hero.isDark ? "text-white" : "text-[#1B4332]"}`}>
                {hero.bigNumber}
              </p>
              {hero.isDark && (
                <svg className="w-5 h-5 text-emerald-300/80 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 17l9.2-9.2M17 17V7H7" />
                </svg>
              )}
            </div>
            <div className={`border-t mt-3 pt-2.5 ${hero.isDark ? "border-emerald-300/20" : "border-gray-200"}`}>
              <p className={`text-[11px] font-medium ${hero.isDark ? "text-emerald-300/50" : "text-gray-400"}`}>
                {timeContext} · {new Date().toLocaleTimeString(locale === "ko" ? "ko-KR" : "en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}
              </p>
              <p className={`text-[11px] font-medium mt-0.5 ${hero.isDark ? "text-emerald-300/50" : "text-gray-400"}`}>
                {sessionInfo}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* EXP + 스트릭 (항상 펼침) */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4">
          {/* EXP 헤더 */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: current.tier.color }}>
                <span className="text-[8px] font-black text-white">&#9876;</span>
              </div>
              <span className="text-[13px] font-bold text-[#1B4332]">{expSummary}</span>
            </div>
            <button
              onClick={onHelpPress}
              className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center"
            >
              <span className="text-[9px] font-black text-gray-400">?</span>
            </button>
          </div>

          {/* 프로그레스바 */}
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold" style={{ color: current.tier.color }}>{current.tier.name} {seasonExp} EXP</span>
            <span className="text-[11px] text-gray-400">
              {current.nextTier ? t("report.tierRemaining", { next: current.nextTier.name, remaining: String(current.remaining) }) : t("report.maxTier")}
            </span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{ width: `${current.progress * 100}%`, backgroundColor: current.tier.color }}
            />
          </div>

          {/* 스트릭 + 다음 예정 */}
          <div className="mt-3 flex items-center justify-between">
            {streak >= 2 && (
              <div className="flex items-center gap-1.5">
                <div className="flex">
                  {Array.from({ length: Math.min(streak, 7) }).map((_, i) => (
                    <div key={i} className="w-2 h-2 rounded-full bg-[#2D6A4F] mr-0.5" style={{ opacity: 0.4 + (i / Math.min(streak, 7)) * 0.6 }} />
                  ))}
                </div>
                <span className="text-[11px] font-bold text-[#2D6A4F]">
                  {t("report.hero.streakLabel", { days: String(streak) })}
                </span>
              </div>
            )}
            {nextWorkoutName && (
              <span className="text-[11px] text-gray-400 font-medium">
                {t("report.streak.next", { name: nextWorkoutName })}
              </span>
            )}
          </div>

          {/* 티어업 / 보너스 EXP 상세 */}
          {(tierUp || expGained.filter(e => e.source !== "workout").length > 0 || insight?.phaseUnlock) && (
            <div className="mt-3 pt-3 border-t border-gray-100 flex flex-col gap-1">
              {expGained.filter(e => e.source !== "workout").map((e, i) => (
                <p key={i} className="text-[12px] font-bold text-[#2D6A4F]">{e.detail} +{e.amount} EXP</p>
              ))}
              {tierUp && (
                <p className="text-[12px] font-black text-[#2D6A4F]">{t("report.tierUp", { prev: prev.tier.name, current: current.tier.name })}</p>
              )}
              {insight?.phaseUnlock && (
                <p
                  className={`text-[12px] font-medium ${insight.phaseJustUnlocked ? "text-[#2D6A4F] font-bold cursor-pointer" : "text-gray-400"}`}
                  onClick={insight.phaseJustUnlocked && onShowPrediction ? onShowPrediction : undefined}
                >
                  {insight.phaseUnlock}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
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
  precomputedExpGained?: ExpLogEntry[];
  precomputedPrevExp?: number;
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
  onAnalysisComplete,
  precomputedExpGained,
  precomputedPrevExp,
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

  const { t, locale } = useTranslation();
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
    if (sec >= 3600) return t("report.formatDuration.hm", { h: String(Math.floor(sec / 3600)), m: String(Math.floor((sec % 3600) / 60)) });
    if (sec >= 60) {
      const s = sec % 60;
      return s > 0
        ? t("report.formatDuration.ms", { m: String(Math.floor(sec / 60)), s: String(s) })
        : t("report.formatDuration.mOnly", { m: String(Math.floor(sec / 60)) });
    }
    return t("report.formatDuration.sOnly", { s: String(sec) });
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
  const levelLabel = t(`report.level.${trainingLevel === "advanced" ? "advanced" : trainingLevel === "intermediate" ? "intermediate" : "beginner"}`);

  return (
    <div className="flex flex-col h-full bg-[#FAFAFA] animate-fade-in relative">
      {/* Top Bar */}
      <div className="pt-[max(1.25rem,env(safe-area-inset-top))] pb-3 px-4 sm:px-6 flex items-center justify-between shrink-0 bg-[#FAFAFA] z-10">
        <button onClick={onClose} className="p-2 -ml-2">
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-[11px] font-medium text-gray-400">{(sessionDate ? new Date(sessionDate) : new Date()).toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US", { month: "long", day: "numeric", weekday: "short" })}</span>
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
          // Use precomputed EXP from completion handler (avoids re-processing on every render)
          // For history view (sessionDate), rebuild from saved state
          const seasonState = getOrRebuildSeasonExp(recentHistory, birthYear, gender);
          const expGained = precomputedExpGained && !sessionDate ? precomputedExpGained : [];
          const prevExp = precomputedPrevExp !== undefined && !sessionDate ? precomputedPrevExp : seasonState.totalExp;
          const currentExp = sessionDate ? seasonState.totalExp : prevExp + sumExp(expGained);

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
                insight.goalLine = t("report.insight.goalLine.fatLoss", { cal: String(sessionCal), weight: String(pred4w) });
              } else if (goal === "muscle_gain") {
                const bestVal = bestE1RM?.value ?? 0;
                const target = Math.round(bw * 1.0);
                if (bestVal > 0) {
                  const rounded = Math.round(bestVal * 10) / 10;
                  const eNameFull = bestE1RM!.exerciseName.split("(")[0].trim();
                  const eName = eNameFull.length > 6 ? eNameFull.slice(0, 6) + ".." : eNameFull;
                  const pct = Math.min(100, Math.round((bestVal / target) * 100));
                  insight.goalLine = t("report.insight.goalLine.muscleGain", { name: eName, value: String(rounded), pct: String(pct) });
                }
              } else if (goal === "endurance" || goal === "health") {
                const whoMin = 150;
                const weeklyMin = freq * (sessionMin || 45);
                const pct = Math.min(200, Math.round((weeklyMin / whoMin) * 100));
                insight.goalLine = t("report.insight.goalLine.health", { pct: String(pct) });
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
                insight.weightPR = t("report.insight.weightPR", { prev: String(historyMaxWeight), current: String(todayMaxWeight) });
              }
            }
          }

          // 3. Phase 해금 알림
          const totalWorkouts = sessionDate ? recentHistory.length : recentHistory.length + 1;
          const prevWorkouts = recentHistory.length;
          const phaseThresholds = [5, 10, 20];
          // 이전에는 미달이었지만 이번에 달성한 Phase 찾기
          const justUnlockedPhase = phaseThresholds.find(th => prevWorkouts < th && totalWorkouts >= th);
          if (justUnlockedPhase) {
            insight.phaseUnlock = t("report.insight.phaseUnlock", { count: String(justUnlockedPhase) });
            insight.phaseJustUnlocked = true;
          } else {
            const nextPhase = phaseThresholds.find(th => totalWorkouts < th);
            if (nextPhase) {
              const remaining = nextPhase - totalWorkouts;
              insight.phaseUnlock = t("report.insight.phaseRemaining", { remaining: String(remaining) });
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
                insight.volumeCompare = t("report.insight.volumeUp", { volume: totalVolume.toLocaleString(), diff: String(diff) });
              } else if (diff < 0) {
                insight.volumeCompare = t("report.insight.volumeDown", { volume: totalVolume.toLocaleString(), diff: String(diff) });
              } else {
                insight.volumeCompare = t("report.insight.volumeSame", { volume: totalVolume.toLocaleString() });
              }
            }
          }

          // ── 히어로 데이터 계산 (coachLine 없이 — Gemini에서 생성) ──
          const microPR = detectMicroPR(sessionData.exercises, logs, recentHistory, t, locale);

          // 스트릭 계산
          const heroStreak = (() => {
            if (recentHistory.length === 0) return 0;
            let count = 0;
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const dayMs = 24 * 60 * 60 * 1000;
            for (let i = 0; ; i++) {
              const checkDate = new Date(today.getTime() - i * dayMs);
              const checkStr = checkDate.toDateString();
              if (recentHistory.some(h => new Date(h.date).toDateString() === checkStr)) {
                count++;
              } else if (i === 0) {
                count++;
                continue;
              } else {
                break;
              }
            }
            return count;
          })();

          // 폴백 체인: microPR > 러닝 > 완주율100% > 스트릭3+ > 총볼륨 > 첫운동
          const hero: HeroData = microPR ?? (() => {
            const totalWorkouts = recentHistory.length;
            const isRunning = sessionData.exercises.some(e => e.type === "cardio");

            if (isRunning) {
              return { type: "running" as HeroType, label: t("report.hero.todaysWork"), bigNumber: formatDuration(totalDurationSec), subText: translateDesc(sessionData.description || "", locale), isDark: false };
            }
            if (successRate >= 100 && isStrengthSession) {
              return { type: "perfect" as HeroType, label: t("report.hero.perfectSession"), bigNumber: t("report.hero.perfectDesc"), isDark: false };
            }
            if (heroStreak >= 3) {
              return { type: "streak" as HeroType, label: t("report.hero.streakLabel", { days: String(heroStreak) }), bigNumber: t("report.hero.streakDesc"), isDark: false, vars: { days: String(heroStreak) } };
            }
            if (totalVolume > 0) {
              return { type: "volume" as HeroType, label: t("report.hero.todaysWork"), bigNumber: `${totalVolume.toLocaleString()} kg`, subText: t("report.hero.totalVolume"), isDark: false };
            }
            if (totalWorkouts === 0) {
              return { type: "first" as HeroType, label: t("report.hero.firstWorkout"), bigNumber: t("report.hero.firstComplete"), isDark: false };
            }
            return { type: "volume" as HeroType, label: t("report.hero.todaysWork"), bigNumber: formatDuration(totalDurationSec), subText: translateDesc(sessionData.description || "", locale), isDark: false };
          })();

          const heroTimeContext = t(getTimeContextKey());

          // 다음 운동 예고 (요일 기반 스케줄에서 추출)
          const nextWorkout = (() => {
            try {
              const fp = JSON.parse(localStorage.getItem("alpha_fitness_profile") || "{}");
              const schedule = fp.weeklySchedule as string[] | undefined;
              if (!schedule) return undefined;
              const today = new Date().getDay(); // 0=Sun
              for (let i = 1; i <= 7; i++) {
                const nextDay = (today + i) % 7;
                const label = schedule[nextDay === 0 ? 6 : nextDay - 1]; // schedule is Mon-indexed
                if (label && label !== "rest" && label !== "휴식") {
                  return translateDesc(label, locale);
                }
              }
            } catch {}
            return undefined;
          })();

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
              hero={hero}
              timeContext={heroTimeContext}
              streak={heroStreak}
              nextWorkoutName={nextWorkout}
              logs={logs}
              exercises={sessionData.exercises}
              condition={(() => { try { const fp = JSON.parse(localStorage.getItem("alpha_fitness_profile") || "{}"); return fp.lastCondition; } catch { return undefined; } })()}
              savedCoachMessages={(() => {
                // 히스토리에서 저장된 코치 멘트 찾기
                const match = recentHistory.find(h =>
                  h.sessionData.exercises.map(e => e.name).join(",") === sessionData.exercises.map(e => e.name).join(",")
                  && h.coachMessages && h.coachMessages.length > 0
                );
                return match?.coachMessages;
              })()}
              onCoachMessagesLoaded={(msgs) => {
                // 최신 히스토리 항목에 코치 멘트 저장
                try {
                  const history = JSON.parse(localStorage.getItem("alpha_workout_history") || "[]") as WorkoutHistory[];
                  const latest = history[history.length - 1];
                  if (latest) updateCoachMessages(latest.id, msgs);
                } catch {}
              }}
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
              <span className="text-sm font-bold text-[#1B4332]">{t("report.scienceData")}</span>
              <span className="text-[10px] text-gray-400 font-medium">{t("report.scienceSub")}</span>
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
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em]">{t("report.card.e1rm")}</p>
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
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <p className="text-2xl font-black text-[#1B4332] leading-none">
                          {currentBwRatio !== null
                            ? t("report.card.bwTimes", { ratio: currentBwRatio.toFixed(1) })
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
                            {currentBwRatio >= 1.2 ? t("report.level.advanced") : currentBwRatio >= 0.8 ? t("report.level.intermediate") : t("report.level.beginner")}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-1.5">
                        <p className="text-[9px] text-gray-400 font-medium leading-tight truncate flex-1">
                          {current
                            ? `${getExerciseName(current.exerciseName, locale)} ${Math.round(current.value)}kg`
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
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em]">{t("report.card.loadStatus")}</p>
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
                          ? (sessionIntensity.level === "low" ? t("report.load.lowOptimal") : sessionIntensity.level === "high" ? t("report.load.highGrowth") : t("report.load.growth"))
                          : loadRatio > bandOverloadRatio ? t("report.load.overload") : loadRatio > bandHighRatio ? t("report.load.highLoad")
                          : (sessionIntensity.level === "low" ? t("report.load.recovery") : t("report.load.deficit")))
                      : t("report.load.first")}
                  </span>
                </div>
                <p className="text-[9px] text-gray-400 mt-1.5 font-medium">
                  {loadRatio !== null
                    ? (loadRatio > bandOverloadRatio ? t("report.load.overloadTip")
                      : loadRatio > bandHighRatio ? t("report.load.highTip")
                      : loadRatio < bandLowRatio
                        ? (sessionIntensity.level === "low" ? t("report.load.lowRecovery") : t("report.load.deficitTip"))
                        : (sessionIntensity.level === "low" ? t("report.load.lowOptimalTip") : sessionIntensity.level === "high" ? t("report.load.highGrowthTip") : t("report.load.growthTip")))
                    : (historyStats ? t("report.load.acsmBasis", { level: levelLabel }) : t("report.load.accumulating", { level: levelLabel }))}
                </p>
              </div>

              {/* Session Intensity */}
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm relative animate-count-up" style={{ animationDelay: "0.6s" }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em]">{t("report.card.intensity")}</p>
                  <button onClick={() => setHelpCard("intensity")} className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center">
                    <span className="text-[10px] font-black text-gray-400">?</span>
                  </button>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <p className="text-2xl font-black text-[#1B4332] leading-none">
                    {t(`report.intensityLabel.${sessionIntensity.level}`)}
                  </p>
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                    sessionIntensity.level === "high" ? "bg-red-50 text-red-500"
                      : sessionIntensity.level === "moderate" ? "bg-amber-50 text-amber-600"
                      : "bg-blue-50 text-blue-500"
                  }`}>
                    {sessionIntensity.basis === "percent_1rm" && sessionIntensity.avgPercentile1RM
                      ? `${sessionIntensity.avgPercentile1RM}% 1RM`
                      : t("report.intensityAvgReps", { reps: String(sessionIntensity.avgRepsPerSet) })}
                  </span>
                </div>
                <p className="text-[9px] text-gray-400 mt-1.5 font-medium">
                  {t("report.intensityWeek", { high: String(intensityRec.weekSummary.high), moderate: String(intensityRec.weekSummary.moderate), low: String(intensityRec.weekSummary.low) })}
                </p>
              </div>

              {/* Fatigue Drop */}
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm relative animate-count-up" style={{ animationDelay: "0.7s" }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em]">{t("report.card.fatigue")}</p>
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
                      {fatigueDrop > -15 ? t("report.fatigue.stable") : fatigueDrop > -25 ? t("report.fatigue.caution") : t("report.fatigue.danger")}
                    </span>
                  )}
                </div>
                <p className="text-[9px] text-gray-400 mt-1.5 font-medium">
                  {fatigueDrop !== null
                    ? t("report.fatigue.recoveryTime", { hours: fatigueDrop >= 0 ? "12" : fatigueDrop > -15 ? "24" : fatigueDrop > -25 ? "48" : "72" })
                    : t("report.fatigue.repsChange")}
                </p>
              </div>
            </>
          ) : (
            <>
              {/* Cardio/Mobility: Total Duration */}
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm relative animate-count-up" style={{ animationDelay: "0.4s" }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em]">{t("report.card.totalTime")}</p>
                </div>
                <p className="text-2xl font-black text-[#1B4332] leading-none">
                  {formatDuration(totalDurationSec)}
                </p>
                <p className="text-[9px] text-gray-400 mt-1.5 font-medium">
                  {sessionCategory === "cardio" ? t("report.card.cardioSession") : t("report.card.mobilitySession")}
                </p>
              </div>

              {/* Completion Rate */}
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm relative animate-count-up" style={{ animationDelay: "0.5s" }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em]">{t("report.card.completionRate")}</p>
                </div>
                <p className="text-2xl font-black text-[#1B4332] leading-none">
                  {successRate}%
                </p>
                <p className="text-[9px] text-gray-400 mt-1.5 font-medium">
                  {t("report.card.completionDetail", { total: String(metrics.totalSets), done: String(Math.round(metrics.totalSets * successRate / 100)) })}
                </p>
              </div>

              {/* Total Exercises */}
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm relative animate-count-up" style={{ animationDelay: "0.6s" }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em]">{t("report.card.exercises")}</p>
                </div>
                <p className="text-2xl font-black text-[#1B4332] leading-none">
                  {t("report.card.exerciseCount", { count: String(sessionData.exercises.length) })}
                </p>
                <p className="text-[9px] text-gray-400 mt-1.5 font-medium">
                  {sessionCategory === "cardio" ? t("report.card.cardioDesc") : t("report.card.mobilityDesc")}
                </p>
              </div>

              {/* Session Type */}
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm relative animate-count-up" style={{ animationDelay: "0.7s" }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em]">{t("report.card.sessionType")}</p>
                </div>
                <p className="text-2xl font-black text-[#1B4332] leading-none">
                  {sessionCategory === "cardio" ? "🏃" : "🧘"}
                </p>
                <p className="text-[9px] text-gray-400 mt-1.5 font-medium">
                  {sessionCategory === "cardio" ? t("report.card.cardioType") : t("report.card.mobilityType")}
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
                <p className="text-[9px] font-bold text-gray-400 uppercase">{t("report.summary.totalVolume")}</p>
                <p className="text-base font-black text-[#1B4332]">{totalVolume.toLocaleString()}<span className="text-[10px] text-gray-400 ml-0.5">kg</span></p>
              </div>
              <div className="flex-1 bg-white rounded-xl border border-gray-100 py-3 px-3 text-center shadow-sm">
                <p className="text-[9px] font-bold text-gray-400 uppercase">{t("report.summary.totalSets")}</p>
                <p className="text-base font-black text-[#1B4332]">{metrics.strengthSets}</p>
              </div>
              <div className="flex-1 bg-white rounded-xl border border-gray-100 py-3 px-3 text-center shadow-sm">
                <p className="text-[9px] font-bold text-gray-400 uppercase">{t("report.summary.totalReps")}</p>
                <p className="text-base font-black text-[#1B4332]">{metrics.totalReps}</p>
              </div>
            </>
          ) : (
            <>
              <div className="flex-1 bg-white rounded-xl border border-gray-100 py-3 px-3 text-center shadow-sm">
                <p className="text-[9px] font-bold text-gray-400 uppercase">{t("report.summary.duration")}</p>
                <p className="text-base font-black text-[#1B4332]">{formatDuration(totalDurationSec)}</p>
              </div>
              <div className="flex-1 bg-white rounded-xl border border-gray-100 py-3 px-3 text-center shadow-sm">
                <p className="text-[9px] font-bold text-gray-400 uppercase">{t("report.summary.totalItems")}</p>
                <p className="text-base font-black text-[#1B4332]">{metrics.totalSets}</p>
              </div>
              <div className="flex-1 bg-white rounded-xl border border-gray-100 py-3 px-3 text-center shadow-sm">
                <p className="text-[9px] font-bold text-gray-400 uppercase">{t("report.summary.completionRate")}</p>
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
                        <h3 className="font-bold text-gray-800 text-sm text-left">{getExerciseName(ex.name, locale)}</h3>
                        <span className="text-[9px] text-gray-400 uppercase font-black tracking-widest bg-gray-50 px-2 py-0.5 rounded">{ex.type}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-2">{t("report.log.setsComplete", { count: locale !== "ko" ? ex.count.replace(/(\d+)분/g, "$1 min").replace(/(\d+)초/g, "$1 sec").replace(/(\d+)세트/g, "$1 sets").replace(/(\d+)회/g, "$1 reps") : ex.count, sets: String(exerciseLogs.length) })}</p>
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
                      <h3 className="font-bold text-gray-800 text-sm text-left">{getExerciseName(ex.name, locale)}</h3>
                      <span className="text-[9px] text-gray-400 uppercase font-black tracking-widest bg-gray-50 px-2 py-0.5 rounded">{ex.type}</span>
                    </div>

                    {/* Graphs — single px-2 wrapper so all dots & labels share the same coordinate space */}
                    <div className="px-2">
                      {/* Weight Graph */}
                      {hasWeight && (
                        <>
                          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">{t("report.log.weight")}</p>
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
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">{t("report.log.reps")}</p>
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
                                  {t("report.log.repsCount", { count: String(log.repsCompleted) })}
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
                <h3 className="text-lg font-black text-[#1B4332] mb-3">{locale === "ko" ? "예상 최고 중량(1RM)" : "Estimated 1-Rep Max (1RM)"}</h3>
                <div className="space-y-3 text-[13px] text-gray-600 leading-relaxed">
                  <p>{locale === "ko" ? <>오늘 운동 기록으로 <span className="font-bold text-[#1B4332]">내가 1회 최대로 들 수 있는 무게(1RM)</span>를 추정하고, 체중 대비 몇 배인지 보여줘요.</> : <>Based on today&apos;s workout, we estimate <span className="font-bold text-[#1B4332]">the maximum weight you can lift for 1 rep (1RM)</span> and show how it compares to your body weight.</>}</p>
                  <p>{locale === "ko" ? <>예를 들어 <span className="font-bold">1.1배</span>면 체중의 1.1배를 들 수 있다는 뜻이에요.</> : <>For example, <span className="font-bold">1.1x</span> means you can lift 1.1 times your body weight.</>}</p>
                  <p>{locale === "ko" ? <>▶ 버튼으로 <span className="font-bold">4대 운동</span>(스쿼트 · 데드리프트 · 벤치프레스 · 오버헤드프레스)의 기록을 넘겨볼 수 있어요.</> : <>Use the ▶ button to browse your <span className="font-bold">Big 4 lifts</span> (Squat, Deadlift, Bench Press, Overhead Press).</>}</p>
                  <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                    <p className="text-[11px] font-bold text-gray-500">{locale === "ko" ? <>체중 대비 기준 ({gender === "female" ? "여성" : "남성"} · 벤치프레스 기준)</> : <>BW Ratio Standards ({gender === "female" ? "Female" : "Male"} · Bench Press)</>}</p>
                    {gender === "female" ? (
                      <div className="flex gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-gray-200 text-gray-600 rounded">{locale === "ko" ? "~0.5배 초급" : "~0.5x Beginner"}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-[#2D6A4F] rounded">{locale === "ko" ? "0.5~0.8배 중급" : "0.5–0.8x Intermediate"}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-700 rounded">{locale === "ko" ? "0.8배+ 상급" : "0.8x+ Advanced"}</span>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-gray-200 text-gray-600 rounded">{locale === "ko" ? "~0.8배 초급" : "~0.8x Beginner"}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-[#2D6A4F] rounded">{locale === "ko" ? "0.8~1.2배 중급" : "0.8–1.2x Intermediate"}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-700 rounded">{locale === "ko" ? "1.2배+ 상급" : "1.2x+ Advanced"}</span>
                      </div>
                    )}
                  </div>
                  <p>{locale === "ko" ? <><span className="font-bold">1RM</span>은 오늘 세트 기록(무게 × 횟수)에서 Epley 공식으로 추정한 값이에요. 실제 1회 최대 시도 없이도 내 근력 수준을 알 수 있어요.</> : <><span className="font-bold">1RM</span> is estimated from today&apos;s sets (weight x reps) using the Epley formula. You can gauge your strength level without actually attempting a max lift.</>}</p>
                  <p className="text-[10px] text-gray-400 mt-2 pt-2 border-t border-gray-100">근거: NSCA Essentials of S&C (4th ed.), Epley (1985)</p>
                </div>
              </>
            )}
            {helpCard === "loadStatus" && (
              <>
                <h3 className="text-lg font-black text-[#1B4332] mb-3">{locale === "ko" ? "부하 상태" : "Load Status"}</h3>
                <div className="space-y-3 text-[13px] text-gray-600 leading-relaxed">
                  <p>{locale === "ko" ? <>오늘 운동량이 <span className="font-bold text-[#1B4332]">내 레벨에 맞는 적정 볼륨인지</span> 보여줘요.</> : <>Shows whether today&apos;s volume is <span className="font-bold text-[#1B4332]">appropriate for your level</span>.</>}</p>
                  <p>{locale === "ko" ? <>오늘 부하는 최근 4주 평균 대비 <span className="font-bold text-[#1B4332]">{loadRatio !== null ? `${loadRatio >= 1 ? "+" : ""}${Math.round((loadRatio - 1) * 100)}%` : "-"}</span>예요. 0%면 평균과 같은 양이고, 현재 레벨(<span className="font-bold">{levelLabel}</span>)에 맞는 기준으로 판정해요.</> : <>Today&apos;s load is <span className="font-bold text-[#1B4332]">{loadRatio !== null ? `${loadRatio >= 1 ? "+" : ""}${Math.round((loadRatio - 1) * 100)}%` : "-"}</span> compared to your 4-week average. 0% means the same as average, judged against your current level (<span className="font-bold">{levelLabel}</span>).</>}</p>
                  <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                    <p className="text-[11px] font-bold text-gray-500">{locale === "ko" ? `볼륨 구간 안내 (${levelLabel})` : `Volume Zones (${levelLabel})`}</p>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 text-blue-600 rounded shrink-0">{locale === "ko" ? "볼륨 부족" : "Under"}</span>
                        <span className="text-[10px] text-gray-500">{locale === "ko" ? "성장에 필요한 최소 자극에 못 미쳐요" : "Below the minimum stimulus needed for growth"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-[#2D6A4F] rounded shrink-0">{locale === "ko" ? "성장 구간" : "Growth Zone"}</span>
                        <span className="text-[10px] text-gray-500">{locale === "ko" ? "근성장에 가장 좋은 볼륨이에요" : "Optimal volume for muscle growth"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-700 rounded shrink-0">{locale === "ko" ? "고부하" : "High Load"}</span>
                        <span className="text-[10px] text-gray-500">{locale === "ko" ? "가끔은 괜찮지만 자주 넘으면 주의" : "Okay occasionally, but watch out if frequent"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-red-100 text-red-600 rounded shrink-0">{locale === "ko" ? "과부하" : "Overload"}</span>
                        <span className="text-[10px] text-gray-500">{locale === "ko" ? "쉬어가는 게 좋아요" : "Time to take a rest"}</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                    <p className="text-[11px] font-bold text-gray-500">{locale === "ko" ? "레벨별 기준 (세션 볼륨 / 체중)" : "Standards by Level (Session Volume / BW)"}</p>
                    <div className="space-y-1 text-[10px]">
                      <div className="flex justify-between"><span className="text-gray-500">{locale === "ko" ? "초급" : "Beginner"}</span><span className="font-bold text-gray-600">{locale === "ko" ? "최소 15 · 최적 55 · 상한 70" : "Min 15 · Optimal 55 · Max 70"}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">{locale === "ko" ? "중급" : "Intermediate"}</span><span className="font-bold text-gray-600">{locale === "ko" ? "최소 40 · 최적 110 · 상한 140" : "Min 40 · Optimal 110 · Max 140"}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">{locale === "ko" ? "상급" : "Advanced"}</span><span className="font-bold text-gray-600">{locale === "ko" ? "최소 70 · 최적 180 · 상한 220" : "Min 70 · Optimal 180 · Max 220"}</span></div>
                    </div>
                  </div>
                  <p>{locale === "ko" ? <><span className="font-bold text-[#2D6A4F]">성장 구간</span>을 꾸준히 유지하면 가장 효과적이에요. 기록이 쌓이면 내 데이터에 맞게 조정돼요.</> : <>Staying consistently in the <span className="font-bold text-[#2D6A4F]">Growth Zone</span> is most effective. As your history builds up, the targets adjust to your data.</>}</p>
                  <p className="text-[10px] text-gray-400 mt-2 pt-2 border-t border-gray-100">근거: ACSM (2009), Israetel RP Strength, NSCA Volume Load</p>
                </div>
              </>
            )}
            {helpCard === "intensity" && (
              <>
                <h3 className="text-lg font-black text-[#1B4332] mb-3">{locale === "ko" ? "운동 강도" : "Workout Intensity"}</h3>
                <div className="space-y-3 text-[13px] text-gray-600 leading-relaxed">
                  <p>{locale === "ko" ? <>오늘 운동이 <span className="font-bold text-[#1B4332]">고강도·중강도·저강도</span> 중 어디에 해당하는지 보여줘요.</> : <>Shows whether today&apos;s workout falls under <span className="font-bold text-[#1B4332]">High, Moderate, or Low</span> intensity.</>}</p>
                  <p>{locale === "ko" ? "세트별 사용 중량을 예상 1RM 대비 비율(%1RM)로 환산해서 판정해요. 중량 데이터가 없으면 세트당 평균 반복수로 판정해요." : "Each set's weight is compared to your estimated 1RM (%1RM). If no weight data is available, average reps per set are used instead."}</p>
                  <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                    <p className="text-[11px] font-bold text-gray-500">{locale === "ko" ? "강도 분류 기준 (ACSM + NSCA)" : "Intensity Classification (ACSM + NSCA)"}</p>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-red-100 text-red-600 rounded shrink-0">{locale === "ko" ? "고강도" : "High"}</span>
                        <span className="text-[10px] text-gray-500">{locale === "ko" ? "80%+ 1RM · 1-6회 · 최대근력" : "80%+ 1RM · 1-6 reps · Max Strength"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-700 rounded shrink-0">{locale === "ko" ? "중강도" : "Moderate"}</span>
                        <span className="text-[10px] text-gray-500">{locale === "ko" ? "60-79% 1RM · 7-12회 · 근비대" : "60-79% 1RM · 7-12 reps · Hypertrophy"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 text-blue-600 rounded shrink-0">{locale === "ko" ? "저강도" : "Low"}</span>
                        <span className="text-[10px] text-gray-500">{locale === "ko" ? "60% 미만 1RM · 13회+ · 근지구력" : "<60% 1RM · 13+ reps · Endurance"}</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                    <p className="text-[11px] font-bold text-gray-500">{locale === "ko" ? <>주간 권장 배분 ({gender === "female" ? "여성" : "남성"} · 연령별)</> : <>Weekly Distribution ({gender === "female" ? "Female" : "Male"} · By Age)</>}</p>
                    {gender === "female" ? (
                      <div className="space-y-1 text-[10px]">
                        <div className="flex justify-between"><span className="text-gray-500">{locale === "ko" ? "20-39세" : "20-39"}</span><span className="font-bold text-gray-600">{locale === "ko" ? "고 2회 · 중 2회 · 저 1회" : "High 2x · Mod 2x · Low 1x"}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">{locale === "ko" ? "40-59세" : "40-59"}</span><span className="font-bold text-gray-600">{locale === "ko" ? "고 2회 · 중 2회 · 저 1회 (골밀도)" : "High 2x · Mod 2x · Low 1x (bone density)"}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">{locale === "ko" ? "60세+" : "60+"}</span><span className="font-bold text-gray-600">{locale === "ko" ? "고 1회 · 중 2회 · 저 1회" : "High 1x · Mod 2x · Low 1x"}</span></div>
                      </div>
                    ) : (
                      <div className="space-y-1 text-[10px]">
                        <div className="flex justify-between"><span className="text-gray-500">{locale === "ko" ? "20-39세" : "20-39"}</span><span className="font-bold text-gray-600">{locale === "ko" ? "고 2회 · 중 2회 · 저 1회" : "High 2x · Mod 2x · Low 1x"}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">{locale === "ko" ? "40-59세" : "40-59"}</span><span className="font-bold text-gray-600">{locale === "ko" ? "고 1회 · 중 3회 · 저 1회" : "High 1x · Mod 3x · Low 1x"}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">{locale === "ko" ? "60세+" : "60+"}</span><span className="font-bold text-gray-600">{locale === "ko" ? "고 1회 · 중 2회 · 저 1회" : "High 1x · Mod 2x · Low 1x"}</span></div>
                      </div>
                    )}
                  </div>
                  {gender === "female" && (
                    <p className="text-[11px] text-gray-500">{locale === "ko" ? <><span className="font-bold text-[#2D6A4F]">여성 참고</span>: 에스트로겐의 항염증 효과로 회복이 ~15% 빠르며, 40대 이후 골밀도 유지를 위해 고강도 비중을 유지하는 것이 권장돼요 (ACSM 폐경 후 가이드라인).</> : <><span className="font-bold text-[#2D6A4F]">Note for women</span>: Estrogen&apos;s anti-inflammatory effect speeds recovery by ~15%. After 40, maintaining high-intensity sessions is recommended to preserve bone density (ACSM postmenopausal guidelines).</>}</p>
                  )}
                  <p>{locale === "ko" ? <>고·중·저를 <span className="font-bold text-[#2D6A4F]">골고루 배분</span>하면 과훈련을 방지하고 성장 효율이 가장 높아요. 이번 주 배분을 확인하고 다음 세션 강도를 조절해보세요.</> : <><span className="font-bold text-[#2D6A4F]">Balancing</span> high, moderate, and low intensity prevents overtraining and maximizes growth. Check this week&apos;s distribution and adjust your next session accordingly.</>}</p>
                  <p className="text-[10px] text-gray-400 mt-2 pt-2 border-t border-gray-100">근거: ACSM Resistance Exercise Guidelines (2025), WHO Physical Activity Guidelines (2020, PMC 7719906), Schoenfeld et al. (2019, PMC 6303131)</p>
                </div>
              </>
            )}
            {helpCard === "loadTimeline" && (
              <>
                <h3 className="text-lg font-black text-[#1B4332] mb-3">{locale === "ko" ? "4주 부하 타임라인" : "4-Week Load Timeline"}</h3>
                <div className="space-y-3 text-[13px] text-gray-600 leading-relaxed">
                  <p>{locale === "ko" ? <>최근 4주간의 <span className="font-bold text-[#1B4332]">운동 부하(볼륨)를 그래프로</span> 보여줘요. 점 하나가 운동 한 번이에요.</> : <>Shows your <span className="font-bold text-[#1B4332]">training load (volume) over the past 4 weeks</span> as a chart. Each dot is one session.</>}</p>
                  <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 bg-emerald-100 border border-emerald-200 rounded-sm inline-block shrink-0" />
                      <p className="text-[11px]"><span className="font-bold text-[#2D6A4F]">{locale === "ko" ? "초록색 영역 = 성장 구간" : "Green Zone = Growth Zone"}</span></p>
                    </div>
                    <p className="text-[11px] text-gray-500 ml-5">{locale === "ko" ? <>{levelLabel} 레벨과 연령에 맞춘 적정 볼륨 구간이에요. 이 안에 있으면 잘하고 있는 거예요.</> : <>The optimal volume range for your {levelLabel} level and age. Staying inside means you&apos;re on track.</>}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="w-3 h-3 bg-amber-50 border border-amber-200 rounded-sm inline-block shrink-0" />
                      <p className="text-[11px]"><span className="font-bold text-amber-600">{locale === "ko" ? "노란색 영역 = 고부하 주의" : "Yellow Zone = High Load Warning"}</span></p>
                    </div>
                    <p className="text-[11px] text-gray-500 ml-5">{locale === "ko" ? "적정 범위를 넘은 구간이에요. 가끔은 괜찮지만 자주 넘으면 조절이 필요해요." : "Beyond the optimal range. Okay once in a while, but frequent visits mean you should dial back."}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="w-3 h-3 bg-[#2D6A4F] rounded-full inline-block shrink-0" />
                      <p className="text-[11px]"><span className="font-bold text-[#2D6A4F]">{locale === "ko" ? "점 = 세션별 부하" : "Dot = Session Load"}</span></p>
                    </div>
                    <p className="text-[11px] text-gray-500 ml-5">{locale === "ko" ? "총 볼륨(무게 × 횟수)을 체중으로 나눈 값이에요. 높을수록 강하게 운동한 거예요. 점을 터치하면 수치를 확인할 수 있어요." : "Total volume (weight x reps) divided by body weight. Higher means a harder session. Tap a dot to see the exact number."}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                    <p className="text-[11px] font-bold text-gray-500">{locale === "ko" ? "레벨별 구간 수치 (볼륨 / 체중)" : "Zone Values by Level (Volume / BW)"}</p>
                    <div className="space-y-1 text-[10px]">
                      <div className="flex justify-between"><span className="text-gray-500">{locale === "ko" ? "초급" : "Beginner"}</span><span className="font-bold text-gray-600">{locale === "ko" ? "적정 15~55 · 주의 55~70 · 상한 70+" : "Optimal 15–55 · Caution 55–70 · Max 70+"}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">{locale === "ko" ? "중급" : "Intermediate"}</span><span className="font-bold text-gray-600">{locale === "ko" ? "적정 40~110 · 주의 110~140 · 상한 140+" : "Optimal 40–110 · Caution 110–140 · Max 140+"}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">{locale === "ko" ? "상급" : "Advanced"}</span><span className="font-bold text-gray-600">{locale === "ko" ? "적정 70~180 · 주의 180~220 · 상한 220+" : "Optimal 70–180 · Caution 180–220 · Max 220+"}</span></div>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">{locale === "ko" ? "예: 체중 70kg, 총 볼륨 4,200kg → Load Score = 60" : "e.g. BW 70kg, total volume 4,200kg → Load Score = 60"}</p>
                  </div>
                  <p>{locale === "ko" ? <>꾸준히 초록 영역 안에 점이 찍히면 <span className="font-bold text-[#2D6A4F]">잘 관리되고 있는 거예요</span>. 노란 영역 위로 자주 벗어나면 볼륨 조절이 필요해요.</> : <>If your dots consistently land in the green zone, <span className="font-bold text-[#2D6A4F]">you&apos;re managing well</span>. Frequently going above the yellow zone means it&apos;s time to adjust your volume.</>}</p>
                  <p className="text-[10px] text-gray-400 mt-2 pt-2 border-t border-gray-100">근거: ACSM 점진적 과부하 원칙, Schoenfeld et al. (2017), Israetel RP Strength, NSCA</p>
                </div>
              </>
            )}
            {helpCard === "fatigueDrop" && (
              <>
                <h3 className="text-lg font-black text-[#1B4332] mb-3">{locale === "ko" ? "피로 신호" : "Fatigue Signal"}</h3>
                <div className="space-y-3 text-[13px] text-gray-600 leading-relaxed">
                  <p>{locale === "ko" ? <>운동 <span className="font-bold text-[#1B4332]">전반부와 후반부의 반복 횟수 차이</span>를 비교한 거예요.</> : <>Compares <span className="font-bold text-[#1B4332]">rep counts between the first and second half</span> of your workout.</>}</p>
                  <p>{locale === "ko" ? <>예를 들어 <span className="font-bold">-12%</span>이면, 후반에 반복 횟수가 12% 줄어든 거예요. 약간의 피로는 자연스러운 거예요.</> : <>For example, <span className="font-bold">-12%</span> means your reps dropped 12% in the second half. Some fatigue is completely normal.</>}</p>
                  <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                    <p className="text-[11px] font-bold text-gray-500">{locale === "ko" ? "피로 신호 기준" : "Fatigue Thresholds"}</p>
                    <div className="flex gap-2 flex-wrap">
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-[#2D6A4F] rounded">{locale === "ko" ? "-15%까지 안정" : "Up to -15% Stable"}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-700 rounded">{locale === "ko" ? "-15~25% 주의" : "-15–25% Caution"}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-red-100 text-red-600 rounded">{locale === "ko" ? "-25%+ 위험" : "-25%+ Warning"}</span>
                    </div>
                  </div>
                  <p>{locale === "ko" ? "피로가 크면 다음 세션에서 볼륨을 줄이거나 휴식을 더 가져야 해요. 꾸준히 안정 구간이면 잘 관리되고 있는 거예요." : "If fatigue is high, reduce volume or take more rest next session. Staying consistently in the stable zone means you're managing well."}</p>
                  <p className="text-[10px] text-gray-400 mt-2 pt-2 border-t border-gray-100">근거: Morán-Navarro et al. (2017), NSCA 세트간 피로 가이드라인, ACSM 회복 권장</p>
                </div>
              </>
            )}
            {helpCard === "levelSystem" && (
              <>
                <h3 className="text-lg font-black text-[#1B4332] mb-3">{locale === "ko" ? "시즌 티어 시스템" : "Season Tier System"}</h3>
                <div className="space-y-3 text-[13px] text-gray-600 leading-relaxed">
                  <p>{locale === "ko" ? <>운동을 완료할 때마다 <span className="font-bold text-[#1B4332]">경험치(EXP)</span>가 쌓이고, 일정 횟수를 채우면 티어가 올라가요.</> : <>Every completed workout earns <span className="font-bold text-[#1B4332]">experience points (EXP)</span>, and you rank up once you hit the threshold.</>}</p>
                  <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                    <p className="text-[11px] font-bold text-gray-500">{locale === "ko" ? "시즌 티어 구간" : "Season Tier Brackets"}</p>
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
                  <p>{locale === "ko" ? <>시즌은 <span className="font-bold text-[#1B4332]">4개월마다 리셋</span>돼요 (1~4월, 5~8월, 9~12월). 새 시즌이 시작되면 Iron부터 다시 도전!</> : <>Seasons <span className="font-bold text-[#1B4332]">reset every 4 months</span> (Jan–Apr, May–Aug, Sep–Dec). Each new season, you start fresh from Iron!</>}</p>
                  <p>{locale === "ko" ? "주 3회 꾸준히 하면 시즌 내 Diamond까지 갈 수 있어요." : "Work out 3 times a week consistently and you can reach Diamond within a single season."}</p>
                </div>
              </>
            )}
            </div>
            <button
              onClick={() => setHelpCard(null)}
              className="w-full py-3 mt-5 rounded-2xl bg-[#1B4332] text-white font-bold text-sm active:scale-[0.98] transition-all shrink-0"
            >
              {t("report.help.confirm")}
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
              {t("report.btn.share")}
            </button>
            <button
              onClick={() => { setCloseAfterShare(true); setShowShare(true); }}
              className="flex-1 py-3 rounded-2xl bg-[#1B4332] text-white font-bold text-base shadow-xl shadow-[#1B4332]/20 active:scale-95 transition-all"
            >
              {t("report.btn.complete")}
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
