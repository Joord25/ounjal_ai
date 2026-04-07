"use client";

import React from "react";
import { useTranslation } from "@/hooks/useTranslation";

// 음식 비유 풀
const FOOD_KO = [
  { food: "치킨 한 조각", cal: 250 },
  { food: "밥 한 공기", cal: 300 },
  { food: "초코파이 3개", cal: 360 },
  { food: "라면 한 그릇", cal: 500 },
  { food: "삼겹살 1인분", cal: 500 },
  { food: "떡볶이 1인분", cal: 450 },
];
const FOOD_EN = [
  { food: "a slice of pizza", cal: 270 },
  { food: "a bowl of rice", cal: 300 },
  { food: "a cheeseburger", cal: 350 },
  { food: "a bowl of ramen", cal: 500 },
  { food: "a serving of fries", cal: 365 },
];

function getFoodAnalogy(cal: number, locale: string): string {
  if (cal < 30) return "";
  const pool = locale === "ko" ? FOOD_KO : FOOD_EN;
  let best = pool[0];
  let bestDiff = Infinity;
  for (const item of pool) {
    const n = Math.round(cal / item.cal);
    if (n >= 1 && n <= 4) {
      const diff = Math.abs(cal - item.cal * n);
      if (diff < bestDiff) { bestDiff = diff; best = item; }
    }
  }
  return best.food;
}

export interface TodayTabProps {
  sessionCategory: "strength" | "cardio" | "mobility" | "mixed";
  totalVolume: number;
  volumeChangePercent: number | null;
  goal?: string;
  bodyWeightKg?: number;
  totalDurationSec: number;
  savedDurationSec?: number;
  fatigueDrop: number | null;
  totalSets?: number;
  totalReps?: number;
  paceChangeSec?: number | null;
  distanceChangeKm?: number | null;
  todayDistance?: number;
}

function estimateCalories(cat: string, sec: number, bw: number): number {
  if (sec <= 0 || bw <= 0) return 0;
  const met: Record<string, number> = { strength: 4.5, mixed: 4.5, cardio: 8.0, mobility: 2.5 };
  return Math.round((met[cat] ?? 4.0) * bw * (sec / 3600));
}

function recoveryLabel(fd: number | null, isKo: boolean): string {
  if (fd === null) return isKo ? "24시간쯤" : "~24hrs";
  if (fd >= 0) return isKo ? "12시간쯤" : "~12hrs";
  if (fd > -15) return isKo ? "24시간쯤" : "~24hrs";
  if (fd > -25) return isKo ? "48시간쯤" : "~48hrs";
  return isKo ? "48~72시간" : "48~72hrs";
}

export const TodayTab: React.FC<TodayTabProps> = ({
  sessionCategory, totalVolume, volumeChangePercent, goal, bodyWeightKg,
  totalDurationSec, savedDurationSec, fatigueDrop, totalSets, totalReps,
  paceChangeSec, distanceChangeKm, todayDistance,
}) => {
  const { locale } = useTranslation();
  const ko = locale === "ko";
  const isRunning = sessionCategory === "cardio";
  const dur = totalDurationSec > 0 ? totalDurationSec : (savedDurationSec ?? 0);
  const bw = bodyWeightKg ?? 70;
  const cal = estimateCalories(sessionCategory, dur, bw);
  const food = getFoodAnalogy(cal, locale);

  // ── 카드 데이터 ──
  interface Card { label: string; value: string; meaning: string }
  const cards: Card[] = [];

  // 카드 1: 자극(근력) / 페이스(러닝)
  if (isRunning) {
    const has = paceChangeSec !== null && paceChangeSec !== undefined;
    cards.push({
      label: ko ? "페이스" : "Pace",
      value: has
        ? `${Math.abs(paceChangeSec!)}${ko ? "초 " : "s "}${paceChangeSec! < 0 ? (ko ? "빨라짐" : "faster") : (ko ? "느려짐" : "slower")}`
        : (todayDistance ? `${(todayDistance / 1000).toFixed(1)}km` : (ko ? "첫 러닝" : "First run")),
      meaning: has
        ? (paceChangeSec! < 0 ? (ko ? "지난번보다 빨라졌어요" : "Faster than last time") : (ko ? "꾸준히 달리고 있어요" : "Keeping pace"))
        : (ko ? "다음부터 페이스를 비교할 수 있어요" : "Pace comparison starts next time"),
    });
  } else {
    const has = volumeChangePercent !== null;
    cards.push({
      label: ko ? "자극" : "Stimulus",
      value: has
        ? `${volumeChangePercent! > 0 ? "+" : ""}${volumeChangePercent}%`
        : `${totalVolume > 0 ? totalVolume.toLocaleString() + "kg" : (ko ? "기록 없음" : "No data")}`,
      meaning: has
        ? (volumeChangePercent! > 0
            ? (goal === "fat_loss" ? (ko ? "칼로리 소모에 효과적이에요" : "Great for burning calories")
              : goal === "muscle_gain" ? (ko ? "근비대에 충분한 자극이에요" : "Enough for growth")
              : (ko ? "지난번보다 더 했어요" : "More than last time"))
            : volumeChangePercent === 0
              ? (ko ? "꾸준히 유지하고 있어요" : "Consistent")
              : (ko ? "가볍게 마무리했어요" : "Light finish"))
        : (totalVolume > 0
            ? (ko ? "오늘 총 볼륨이에요" : "Total volume today")
            : (ko ? "다음부터 비교돼요" : "Comparison starts next time")),
    });
  }

  // 카드 2: 칼로리
  cards.push({
    label: ko ? "칼로리" : "Calories",
    value: cal > 30 ? `${cal}kcal` : "-",
    meaning: cal > 30
      ? (food ? (ko ? `${food} 정도 태웠어요` : `About ${food} burned`) : (ko ? "소모한 칼로리예요" : "Calories burned"))
      : (ko ? "운동 시간 데이터가 부족해요" : "Not enough duration data"),
  });

  // 카드 3: 회복
  cards.push({
    label: ko ? "회복" : "Recovery",
    value: recoveryLabel(fatigueDrop, ko),
    meaning: fatigueDrop !== null && fatigueDrop < -15
      ? (ko ? "좀 빡셌어요, 충분히 쉬세요" : "That was tough, rest well")
      : (ko ? "쉬면 충분해요" : "Rest and you're good"),
  });

  // 카드 4: vs 지난번
  if (isRunning && distanceChangeKm !== null && distanceChangeKm !== undefined) {
    cards.push({
      label: ko ? "vs 지난번" : "vs Last",
      value: `${distanceChangeKm > 0 ? "+" : ""}${distanceChangeKm.toFixed(1)}km`,
      meaning: distanceChangeKm > 0
        ? (ko ? "지난번보다 더 뛰었어요" : "Ran more than last time")
        : (ko ? "거리는 줄었지만 괜찮아요" : "Less distance but that's ok"),
    });
  } else if (volumeChangePercent !== null) {
    cards.push({
      label: ko ? "vs 지난번" : "vs Last",
      value: `${volumeChangePercent > 0 ? "+" : ""}${volumeChangePercent}%`,
      meaning: volumeChangePercent > 0
        ? (ko ? "지난번보다 성장했어요" : "You grew since last time")
        : volumeChangePercent === 0
          ? (ko ? "안정적으로 유지 중이에요" : "Holding steady")
          : (ko ? "가벼운 날이었어요" : "Light day"),
    });
  } else {
    // 비교 데이터 없을 때 — 실제 세트/렙 표시
    cards.push({
      label: ko ? "오늘 수행" : "Completed",
      value: totalSets ? `${totalSets}${ko ? "세트" : " sets"}` : "-",
      meaning: totalReps
        ? (ko ? `총 ${totalReps}회 수행했어요` : `${totalReps} total reps`)
        : (ko ? "오늘의 기록이에요" : "Today's record"),
    });
  }

  return (
    <div className="space-y-2.5 mb-4">
      {cards.map((card, i) => (
        <div key={i} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between gap-4">
          <div className="shrink-0">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">{card.label}</p>
            <p className="text-xl font-black text-[#1B4332] leading-tight">{card.value}</p>
          </div>
          <p className="text-xs text-gray-500 text-right leading-snug">{card.meaning}</p>
        </div>
      ))}
    </div>
  );
};
