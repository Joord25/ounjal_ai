"use client";

import React from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { useUnits } from "@/hooks/useUnits";
import { kgToLb } from "@/utils/units";
import { WorkoutHistory } from "@/constants/workout";
import { classifySessionIntensity, getWeeklyIntensityTarget } from "@/utils/workoutMetrics";
import { translateDesc } from "../reportUtils";

export interface NextTabProps {
  todayBodyPart?: string;
  sessionCategory: "strength" | "cardio" | "mobility" | "mixed";
  fatigueDrop: number | null;
  recentHistory: WorkoutHistory[];
  weeklySchedule?: string[];
  streak: number;
  totalVolume: number;
  gender?: "male" | "female";
  /** 오늘 세션 설명 (부위 추출용) */
  sessionDesc?: string;
  /** 오늘 세션 운동 목록 (부위 추출용) */
  exercises?: { name: string; type?: string }[];
  /** 오늘 세션 로그 (무게 목표 산출용) */
  logs?: Record<number, { weightUsed?: string; repsCompleted: number }[]>;
  /** 출생년도 (퀘스트 타겟 산출) */
  birthYear?: number;
}

// 부위 매핑
const BODY_PART_MAP: Record<string, { ko: string; en: string; opposite: string }> = {
  upper_push: { ko: "가슴·어깨", en: "Chest & Shoulders", opposite: "upper_pull" },
  upper_pull: { ko: "등·팔", en: "Back & Arms", opposite: "upper_push" },
  lower: { ko: "하체", en: "Legs", opposite: "upper_push" },
  full_body: { ko: "전신", en: "Full Body", opposite: "lower" },
  core: { ko: "코어", en: "Core", opposite: "upper_push" },
  cardio: { ko: "유산소", en: "Cardio", opposite: "upper_push" },
};

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_KO = ["월", "화", "수", "목", "금", "토", "일"];
const DAY_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** sessionDesc/exercises에서 부위 추출 (todayBodyPart null 대응) */
function detectBodyPart(desc?: string, exercises?: { name: string; type?: string }[]): string | null {
  const text = (desc || "").toLowerCase();
  if (/가슴|chest|벤치|bench|푸쉬|push/i.test(text)) return "upper_push";
  if (/등|back|로우|row|풀업|pull/i.test(text)) return "upper_pull";
  if (/하체|leg|스쿼트|squat|데드|dead|런지|lunge/i.test(text)) return "lower";
  if (/전신|full|전체/i.test(text)) return "full_body";
  if (/코어|core|복근|ab/i.test(text)) return "core";
  if (/러닝|run|cardio|유산소/i.test(text)) return "cardio";

  // 운동 목록에서 추출
  if (exercises) {
    const names = exercises.map(e => e.name.toLowerCase()).join(" ");
    if (/벤치|bench|체스트|chest|푸쉬업|push/i.test(names)) return "upper_push";
    if (/로우|row|풀업|pull|랫/i.test(names)) return "upper_pull";
    if (/스쿼트|squat|데드|dead|레그|leg|런지|lunge/i.test(names)) return "lower";
  }
  return null;
}

/** 부위별 마지막 최고 무게에서 +2.5kg (남) / +1.25kg (여) */
function getWeightGoal(
  recommendedPart: string,
  history: WorkoutHistory[],
  gender: "male" | "female",
  locale: string,
): { exerciseName: string; targetWeight: number } | null {
  const partKeywords: Record<string, string[]> = {
    upper_push: ["벤치", "bench", "체스트", "chest", "숄더", "shoulder", "프레스", "press"],
    upper_pull: ["로우", "row", "풀업", "pull", "랫", "lat"],
    lower: ["스쿼트", "squat", "데드", "dead", "레그", "leg"],
  };
  const keywords = partKeywords[recommendedPart];
  if (!keywords) return null;

  let bestExercise = "";
  let bestWeight = 0;

  for (const h of history) {
    if (!h.logs) continue;
    for (let i = 0; i < h.sessionData.exercises.length; i++) {
      const ex = h.sessionData.exercises[i];
      const nameLower = ex.name.toLowerCase();
      if (!keywords.some(kw => nameLower.includes(kw))) continue;
      const exLogs = h.logs[i];
      if (!exLogs) continue;
      for (const l of exLogs) {
        const w = parseFloat(l.weightUsed || "0");
        if (w > bestWeight) {
          bestWeight = w;
          bestExercise = ex.name;
        }
      }
    }
  }

  if (bestWeight <= 0) return null;

  const step = gender === "female" ? 1.25 : 2.5;
  const target = Math.round((bestWeight + step) * 10) / 10;
  // 운동명 간소화
  const displayName = bestExercise.split("(")[0].trim();

  return { exerciseName: displayName, targetWeight: target };
}

function getDaysSincePart(history: WorkoutHistory[], bodyParts: string[]): number {
  const now = Date.now();
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i];
    const desc = (h.sessionData.description || h.sessionData.title || "").toLowerCase();
    const partKeywords: Record<string, string[]> = {
      upper_push: ["가슴", "어깨", "chest", "shoulder", "push"],
      upper_pull: ["등", "팔", "back", "arm", "pull"],
      lower: ["하체", "다리", "leg", "squat", "lower"],
      full_body: ["전신", "full"],
      core: ["코어", "복근", "core", "ab"],
      cardio: ["러닝", "달리기", "run", "cardio"],
    };
    for (const part of bodyParts) {
      const kws = partKeywords[part] || [];
      if (kws.some(kw => desc.includes(kw))) {
        return Math.floor((now - new Date(h.date).getTime()) / (24 * 60 * 60 * 1000));
      }
    }
  }
  return 30;
}

interface NextAdvice {
  message: string;
  recommendedPart: string;
  recommendedPartKey: string; // 내부 키 (무게 목표 산출용)
  recommendedIntensity: string;
}

function generateNextAdvice(
  bodyPart: string | null,
  sessionCategory: string,
  fatigueDrop: number | null,
  recentHistory: WorkoutHistory[],
  streak: number,
  ko: boolean,
  intensityLighter: string,
  intensitySame: string,
  intensityHarder: string,
): NextAdvice {
  // 1) 첫 운동
  if (recentHistory.length === 0) {
    return {
      message: ko ? "첫 운동 해냈어요! 이틀 뒤에 다른 부위로 한번 더 와보세요" : "First workout done! Come back in 2 days with a different group",
      recommendedPart: ko ? "다른 부위" : "Different group",
      recommendedPartKey: "",
      recommendedIntensity: intensityLighter,
    };
  }

  // 2) 3일+ 연속
  if (streak >= 3) {
    return {
      message: ko ? `${streak}일 연속 잘 버텼어요. 내일은 가볍게 쉬어가세요` : `${streak} days in a row! Take it easy tomorrow`,
      recommendedPart: ko ? "스트레칭·유산소" : "Stretch & Cardio",
      recommendedPartKey: "cardio",
      recommendedIntensity: intensityLighter,
    };
  }

  // 3) 러닝 후
  if (sessionCategory === "cardio") {
    const daysSince = getDaysSincePart(recentHistory, ["upper_push", "upper_pull"]);
    const dayMsg = daysSince > 5 ? (ko ? ` 상체 안 한 지 ${daysSince}일 됐어요.` : ` Upper body gap: ${daysSince} days.`) : "";
    return {
      message: ko ? `오늘 뛰느라 다리 고생했으니 다음엔 상체 해주세요.${dayMsg}` : `Legs worked hard, try upper body next.${dayMsg}`,
      recommendedPart: ko ? "가슴·어깨" : "Chest & Shoulders",
      recommendedPartKey: "upper_push",
      recommendedIntensity: intensitySame,
    };
  }

  // 4) 피로 높음
  if (fatigueDrop !== null && fatigueDrop < -25) {
    const partInfo = bodyPart ? BODY_PART_MAP[bodyPart] : null;
    return {
      message: ko ? "컨디션 안 좋은데도 나온 거 대단해요. 다음엔 무게 올려봐요" : "Impressive showing up on a tough day. Push harder next time",
      recommendedPart: partInfo ? (ko ? partInfo.ko : partInfo.en) : (ko ? "같은 부위" : "Same group"),
      recommendedPartKey: bodyPart || "",
      recommendedIntensity: intensityHarder,
    };
  }

  // 5) 일반
  if (bodyPart && BODY_PART_MAP[bodyPart]) {
    const todayInfo = BODY_PART_MAP[bodyPart];
    // 가장 오래 안 한 부위
    const allParts = Object.keys(BODY_PART_MAP).filter(p => p !== "cardio" && p !== "core");
    let longestGapPart = todayInfo.opposite;
    let longestGap = 0;
    for (const part of allParts) {
      if (part === bodyPart) continue;
      const days = getDaysSincePart(recentHistory, [part]);
      if (days > longestGap) { longestGap = days; longestGapPart = part; }
    }
    const recKey = longestGap > 7 ? longestGapPart : todayInfo.opposite;
    const recInfo = BODY_PART_MAP[recKey] ?? BODY_PART_MAP["upper_push"];
    const intensity = fatigueDrop !== null && fatigueDrop < -15 ? intensityLighter : intensitySame;
    const todayName = ko ? todayInfo.ko : todayInfo.en;
    const nextName = ko ? recInfo.ko : recInfo.en;

    const message = longestGap > 7
      ? (ko ? `${nextName} 안 한 지 ${longestGap}일 됐어요. 다음엔 ${nextName} 먼저 챙겨주세요` : `${nextName} gap: ${longestGap} days. Prioritize it next`)
      : (ko ? `오늘 ${todayName} 열심히 했으니까 다음엔 ${nextName} 해주면 딱이에요` : `Great ${todayName} session! ${nextName} next would be perfect`);

    return { message, recommendedPart: ko ? recInfo.ko : recInfo.en, recommendedPartKey: recKey, recommendedIntensity: intensity };
  }

  // 폴백
  return {
    message: ko ? "오늘 잘했어요! 다음엔 다른 부위로 가볍게 가세요" : "Great work! Try a different group next",
    recommendedPart: ko ? "이전과 다른 부위" : "Different group",
    recommendedPartKey: "",
    recommendedIntensity: intensitySame,
  };
}

/** [다음] 탭 — 다음 운동 조언 + 무게 목표 + 주간 스케줄 */
export const NextTab: React.FC<NextTabProps> = ({
  todayBodyPart, sessionCategory, fatigueDrop, recentHistory,
  weeklySchedule, streak, totalVolume, gender, sessionDesc, exercises, logs, birthYear,
}) => {
  const { t, locale } = useTranslation();
  const { system: unitSystem, labels: unitLabels } = useUnits();
  const toDispW = (kg: number) => unitSystem === "imperial" ? Math.round(kgToLb(kg) * 10) / 10 : kg;
  const ko = locale === "ko";

  // todayBodyPart가 null이면 sessionDesc/exercises에서 추출
  const bodyPart = todayBodyPart || detectBodyPart(sessionDesc, exercises);

  const advice = generateNextAdvice(
    bodyPart, sessionCategory, fatigueDrop, recentHistory, streak, ko,
    t("report.next.intensity.lighter"), t("report.next.intensity.same"), t("report.next.intensity.harder"),
  );

  // 무게 목표
  const weightGoal = advice.recommendedPartKey
    ? getWeightGoal(advice.recommendedPartKey, recentHistory, gender ?? "male", locale)
    : null;

  // 이번 주 운동 현황 (recentHistory 기반)
  const weekSummary = (() => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun
    // 이번 주 월요일 기준
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);

    // 이번 주 운동한 날 + 부위 + 강도
    const thisWeekSessions: { dayIdx: number; dayLabel: string; desc: string; intensity?: string }[] = [];
    for (const h of recentHistory) {
      const d = new Date(h.date);
      if (d >= monday && d <= now) {
        const idx = d.getDay() === 0 ? 6 : d.getDay() - 1;
        const desc = h.sessionData.description || h.sessionData.title || "";
        const rawLabel = desc.split("·")[0]?.trim() || (ko ? "운동" : "Workout");
        const partLabel = translateDesc(rawLabel, locale);
        let intensity = "";
        if (h.logs && h.sessionData?.exercises) {
          const lvl = classifySessionIntensity(h.sessionData.exercises, h.logs).level;
          intensity = lvl === "high" ? (ko ? "고강도" : "High") : lvl === "moderate" ? (ko ? "중강도" : "Mod") : (ko ? "저강도" : "Low");
        }
        thisWeekSessions.push({ dayIdx: idx, dayLabel: ko ? DAY_KO[idx] : DAY_EN[idx], desc: partLabel, intensity });
      }
    }
    // 오늘도 포함
    const todayIdx = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const todayRawDesc = sessionDesc?.split("·")[0]?.trim() || (ko ? "운동" : "Workout");
    const todayDesc = translateDesc(todayRawDesc, locale);
    const todayAlready = thisWeekSessions.some(s => s.dayIdx === todayIdx);
    if (!todayAlready) {
      let todayIntensityLabel = "";
      if (exercises && logs) {
        const lvl = classifySessionIntensity(exercises as Parameters<typeof classifySessionIntensity>[0], logs as Parameters<typeof classifySessionIntensity>[1]).level;
        todayIntensityLabel = lvl === "high" ? (ko ? "고강도" : "High") : lvl === "moderate" ? (ko ? "중강도" : "Mod") : (ko ? "저강도" : "Low");
      }
      thisWeekSessions.push({ dayIdx: todayIdx, dayLabel: ko ? DAY_KO[todayIdx] : DAY_EN[todayIdx], desc: todayDesc, intensity: todayIntensityLabel });
    }

    // 주간 빈도
    let weeklyFreq = 3;
    try { weeklyFreq = JSON.parse(localStorage.getItem("ohunjal_fitness_profile") || "{}").weeklyFrequency || 3; } catch {}

    const done = thisWeekSessions.length;
    const remaining = Math.max(0, weeklyFreq - done);

    return { sessions: thisWeekSessions.sort((a, b) => a.dayIdx - b.dayIdx), done, remaining, weeklyFreq };
  })();

  // 퀘스트 진행률 (ACSM 강도 분배)
  const questProgress = (() => {
    const target = getWeeklyIntensityTarget(birthYear, gender);
    // 이번 주 세션들의 강도 분류
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);

    let high = 0, moderate = 0, low = 0;
    for (const h of recentHistory) {
      const d = new Date(h.date);
      if (d < monday || d > now) continue;
      if (!h.logs || !h.sessionData?.exercises) continue;
      const intensity = classifySessionIntensity(h.sessionData.exercises, h.logs);
      if (intensity.level === "high") high++;
      else if (intensity.level === "moderate") moderate++;
      else low++;
    }
    // 오늘 세션도 포함
    if (exercises && logs) {
      const todayIntensity = classifySessionIntensity(exercises as Parameters<typeof classifySessionIntensity>[0], logs as Parameters<typeof classifySessionIntensity>[1]);
      if (todayIntensity.level === "high") high++;
      else if (todayIntensity.level === "moderate") moderate++;
      else low++;
    }

    return {
      high: { done: high, target: target.high },
      moderate: { done: moderate, target: target.moderate },
      low: { done: low, target: target.low },
      total: { done: high + moderate + low, target: target.total },
    };
  })();

  // 퀘스트 기반 강도 추천 (부족한 강도 우선)
  const questBasedIntensity = (() => {
    const { high, moderate, low } = questProgress;
    if (high.done < high.target) return { level: "high" as const, message: ko ? `이번 주 고강도 ${high.done}/${high.target}회 — 다음엔 빡세게!` : `High intensity ${high.done}/${high.target} — push hard next!` };
    if (moderate.done < moderate.target) return { level: "moderate" as const, message: ko ? `이번 주 중강도 ${moderate.done}/${moderate.target}회 — 적당하게 가세요` : `Moderate ${moderate.done}/${moderate.target} — keep it steady` };
    if (low.done < low.target) return { level: "low" as const, message: ko ? `이번 주 저강도 ${low.done}/${low.target}회 — 가볍게 회복!` : `Low ${low.done}/${low.target} — light recovery!` };
    return { level: null, message: ko ? "이번 주 목표 다 채웠어요!" : "Weekly goals complete!" };
  })();

  return (
    <div className="flex flex-col gap-5 mb-4">
      {/* 메인 조언 카드 (회의 64-α: Kenko 적용) */}
      <div className="bg-white rounded-3xl border border-gray-100 p-6 py-7 shadow-sm">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.18em] mb-4">{t("report.next.title")}</p>
        <p className="text-sm font-medium text-[#1B4332] leading-relaxed mb-5">
          &ldquo;{advice.message}&rdquo;
        </p>
        <div className="border-t border-gray-100 pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.18em]">{t("report.next.recommendedPart")}</span>
            <span className="text-sm font-black text-[#1B4332]">{advice.recommendedPart}</span>
          </div>
          <div className="border-t border-gray-100" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.18em]">{t("report.next.recommendedIntensity")}</span>
            <span className="text-sm font-black text-[#1B4332]">
              {questBasedIntensity.level === "high" ? (ko ? "고강도" : "High")
                : questBasedIntensity.level === "moderate" ? (ko ? "중강도" : "Moderate")
                : questBasedIntensity.level === "low" ? (ko ? "저강도" : "Low")
                : advice.recommendedIntensity}
            </span>
          </div>
          {weightGoal && <>
            <div className="border-t border-gray-100" />
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.18em]">{ko ? "무게 목표" : "Weight Goal"}</span>
              <span className="text-sm font-black text-[#2D6A4F]">{weightGoal.exerciseName} {toDispW(weightGoal.targetWeight)}{unitLabels.weight}</span>
            </div>
          </>}
        </div>
      </div>

      {/* 이번 주 퀘스트 (회의 64-α: Kenko 적용, emerald 톤 통일) */}
      <div className="bg-white rounded-3xl border border-gray-100 p-6 py-7 shadow-sm">
        <div className="flex items-baseline justify-between mb-5">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.18em]">
            {ko ? "이번 주 퀘스트" : "Weekly Quest"}
          </span>
          <span className="text-sm font-black text-[#1B4332] tabular-nums">
            {questProgress.total.done}/{questProgress.total.target}
          </span>
        </div>
        <p className="text-xs text-[#2D6A4F] font-bold mb-5">{questBasedIntensity.message}</p>
        <div className="space-y-4">
          {([
            { label: ko ? "고강도" : "High", ...questProgress.high, color: "bg-[#2D6A4F]" },
            { label: ko ? "중강도" : "Moderate", ...questProgress.moderate, color: "bg-[#2D6A4F]/60" },
            { label: ko ? "저강도" : "Low", ...questProgress.low, color: "bg-[#2D6A4F]/35" },
            { label: ko ? "총 운동" : "Total", ...questProgress.total, color: "bg-[#1B4332]" },
          ] as const).map((q, i) => (
            <div key={i}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.18em]">{q.label}</span>
                <span className="text-xs font-black text-[#1B4332] tabular-nums">
                  {q.done}/{q.target}{ko ? "회" : "x"}
                  {q.done >= q.target && q.target > 0 && <span className="text-[#2D6A4F] ml-1.5">{ko ? "달성" : "Done"}</span>}
                </span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-[width] duration-500 ease-out ${q.color}`}
                  style={{ width: `${q.target > 0 ? Math.min(100, (q.done / q.target) * 100) : 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        {/* 이번 주 운동 기록 */}
        {weekSummary.sessions.length > 0 && <>
          <div className="border-t border-gray-100 my-5" />
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.18em] mb-3">
            {ko ? "이번 주 기록" : "This Week"}
          </p>
          <div className="space-y-2">
            {weekSummary.sessions.map((s, i) => (
              <div key={i} className="flex items-center justify-between py-0.5">
                <span className="text-xs font-black text-[#1B4332] tabular-nums w-6">{s.dayLabel}</span>
                <div className="flex-1 flex items-center justify-end gap-2 min-w-0">
                  <span className="text-xs text-gray-500 truncate">{s.desc}</span>
                  {s.intensity && (
                    <span className={`text-[10px] font-black uppercase tracking-[0.12em] ${
                      s.intensity.includes("고") || s.intensity === "High" ? "text-[#2D6A4F]"
                      : s.intensity.includes("중") || s.intensity === "Mod" ? "text-gray-600"
                      : "text-gray-400"
                    }`}>
                      {s.intensity}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>}
      </div>
    </div>
  );
};
