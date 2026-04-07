"use client";

import React from "react";
import { useTranslation } from "@/hooks/useTranslation";

// ── 음식 비유 풀 ──
const FOOD_KO = [
  { food: "치킨 한 조각", cal: 250 },
  { food: "밥 한 공기", cal: 300 },
  { food: "라면 한 그릇", cal: 500 },
  { food: "삼겹살 1인분", cal: 500 },
  { food: "떡볶이 1인분", cal: 450 },
  { food: "마라탕 반 그릇", cal: 350 },
  { food: "아이스 아메리카노 7잔", cal: 280 },
];
const FOOD_EN = [
  { food: "a slice of pizza", cal: 270 },
  { food: "a bowl of rice", cal: 300 },
  { food: "a cheeseburger", cal: 350 },
  { food: "a bowl of ramen", cal: 500 },
  { food: "a serving of fries", cal: 365 },
];

function getFoodAnalogy(cal: number, locale: string): string {
  if (cal < 100) return ""; // 100kcal 미만은 음식 비유 의미 없음
  const pool = locale === "ko" ? FOOD_KO : FOOD_EN;
  let best: typeof pool[0] | null = null;
  let bestDiff = Infinity;
  for (const item of pool) {
    const n = Math.round(cal / item.cal);
    if (n >= 1 && n <= 4) {
      const diff = Math.abs(cal - item.cal * n);
      if (diff < bestDiff) { bestDiff = diff; best = item; }
    }
  }
  if (!best) return ""; // 매칭 실패
  const n = Math.max(1, Math.round(cal / best.cal));
  if (n === 1) return best.food;
  if (locale === "ko") return `${best.food} ${n}개분`;
  return `${n}x ${best.food}`;
}

function estimateCalories(cat: string, sec: number, bw: number): number {
  if (sec <= 0 || bw <= 0) return 0;
  const met: Record<string, number> = { strength: 4.5, mixed: 4.5, cardio: 8.0, mobility: 2.5 };
  return Math.round((met[cat] ?? 4.0) * bw * (sec / 3600));
}

export interface TodayTabProps {
  sessionCategory: "strength" | "cardio" | "mobility" | "mixed";
  totalVolume: number;
  volumeChangePercent: number | null;
  goal?: string;
  gender?: "male" | "female";
  bodyWeightKg?: number;
  totalDurationSec: number;
  savedDurationSec?: number;
  fatigueDrop: number | null;
  totalSets?: number;
  totalReps?: number;
  /** 운동 설명 (부위 요약) */
  sessionDesc?: string;
  /** 4주 그래프 데이터 */
  graphData?: { date: Date; loadScore: number; volume: number }[];
  /** PR 정보 (있을 때만) */
  prInfo?: { exerciseName: string; value: string } | null;
  /** 부하 밴드 (적정 범위) */
  loadBand?: { low: number; high: number } | null;
  /** 오늘 부하 점수 */
  todayLoadScore?: number;
}

/** [오늘] 탭 — 성별 고정 하이라이트 (회의 38) */
export const TodayTab: React.FC<TodayTabProps> = ({
  sessionCategory, totalVolume, volumeChangePercent, goal, gender,
  bodyWeightKg, totalDurationSec, savedDurationSec, fatigueDrop,
  totalSets, totalReps, sessionDesc, graphData, prInfo, loadBand, todayLoadScore,
}) => {
  const { locale } = useTranslation();
  const ko = locale === "ko";
  const dur = totalDurationSec > 0 ? totalDurationSec : (savedDurationSec ?? 0);
  const bw = bodyWeightKg ?? 70;
  const cal = estimateCalories(sessionCategory, dur, bw);
  const food = getFoodAnalogy(cal, ko ? "ko" : "en");
  const minutes = Math.round(dur / 60);

  // 성별+목표로 메인 결정: 감량→칼로리, 근비대→볼륨, 기본→성별
  const showCalorieMain = goal === "fat_loss" || (goal !== "muscle_gain" && gender === "female");

  // 강도 해석
  const intensityMsg = (() => {
    if (goal === "fat_loss") return ko ? "감량 목표에 맞는 강도예요" : "Right intensity for fat loss";
    if (goal === "muscle_gain") return ko ? "근비대에 딱 맞아요" : "Perfect for muscle growth";
    if (goal === "endurance") return ko ? "체력 향상에 좋아요" : "Great for endurance";
    return ko ? "적절한 강도로 했어요" : "Good intensity";
  })();

  // vs 지난번 해석
  const vsLastMsg = (() => {
    if (volumeChangePercent === null) return null;
    if (showCalorieMain) {
      // 칼로리 기준 비교 (볼륨 변화를 칼로리 맥락으로)
      if (volumeChangePercent > 5) return ko ? "지난번보다 더 태웠어요" : "Burned more than last time";
      if (volumeChangePercent < -5) return ko ? "오늘은 가볍게 했어요" : "Light session today";
      return ko ? "꾸준히 유지 중이에요" : "Staying consistent";
    }
    // 볼륨 기준 비교
    if (volumeChangePercent > 5) return ko ? `지난번보다 ${volumeChangePercent}% 더 했어요` : `${volumeChangePercent}% more than last time`;
    if (volumeChangePercent < -5) return ko ? "오늘은 회복 날이었어요" : "Recovery day today";
    return ko ? "꾸준히 유지하고 있어요" : "Holding steady";
  })();

  // 4주 그래프 판정
  const graphVerdict = (() => {
    if (!todayLoadScore || !loadBand) return null;
    if (todayLoadScore >= loadBand.low && todayLoadScore <= loadBand.high)
      return { text: ko ? "딱 좋아요" : "Just right", color: "text-[#2D6A4F]" };
    if (todayLoadScore > loadBand.high)
      return { text: ko ? "좀 많았어요" : "A bit much", color: "text-amber-600" };
    return { text: ko ? "조금 적어요" : "A bit low", color: "text-blue-500" };
  })();

  // 부위·시간·세트 한줄
  const summaryLine = [
    sessionDesc || (ko ? "운동" : "Workout"),
    `${minutes}${ko ? "분" : "min"}`,
    totalSets ? `${totalSets}${ko ? "세트" : " sets"}` : null,
  ].filter(Boolean).join(" · ");

  return (
    <div className="space-y-3 mb-4">

      {/* PR 뱃지 (있을 때만) */}
      {prInfo && (
        <div className="bg-[#1B4332] rounded-2xl p-4 shadow-sm">
          <p className="text-[10px] font-black text-emerald-300/60 uppercase tracking-wider mb-1">
            {ko ? "신기록" : "New Record"}
          </p>
          <p className="text-lg font-black text-white">{prInfo.value}</p>
          <p className="text-xs text-emerald-300/80 mt-0.5">{prInfo.exerciseName}</p>
        </div>
      )}

      {/* ── 메인 하이라이트 ── */}
      {showCalorieMain ? (
        /* 여성/감량: 칼로리 메인 — 영양 탭 스타일 */
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">
            {ko ? "오늘 소모한 칼로리" : "Calories Burned"}
          </p>
          <div className="flex items-baseline gap-2">
            <p className="text-4xl font-black text-[#1B4332]">
              {cal > 0 ? cal.toLocaleString() : "-"}
            </p>
            <span className="text-base font-bold text-gray-400">kcal</span>
          </div>
          {food && (
            <p className="text-sm text-[#2D6A4F] font-bold mt-2">
              {ko ? `${food} 태웠어요` : `Burned ${food}`}
            </p>
          )}
          {cal === 0 && (
            <p className="text-xs text-gray-400 mt-2">
              {ko ? "운동 시간 데이터가 부족해요" : "Not enough duration data"}
            </p>
          )}
        </div>
      ) : (
        /* 남성/근비대: 4주 그래프 메인 */
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-3">
            {ko ? "4주 운동량 변화" : "4-Week Volume Trend"}
          </p>
          {/* 미니 그래프 */}
          {graphData && graphData.length >= 1 ? (
            <div className="relative h-24 mb-3">
              {/* 적정 범위 배경 */}
              {loadBand && (() => {
                const allScores = graphData.map(d => d.loadScore);
                const maxScore = Math.max(...allScores, loadBand.high * 1.2);
                const lowY = 100 - (loadBand.low / maxScore) * 100;
                const highY = 100 - (loadBand.high / maxScore) * 100;
                return (
                  <div
                    className="absolute left-0 right-0 bg-emerald-50 rounded"
                    style={{ top: `${highY}%`, bottom: `${100 - lowY}%` }}
                  />
                );
              })()}
              <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                <path
                  d={graphData.map((d, i) => {
                    const x = graphData.length === 1 ? 50 : (i / (graphData.length - 1)) * 100;
                    const maxScore = Math.max(...graphData.map(g => g.loadScore), 1);
                    const y = 95 - (d.loadScore / maxScore) * 85;
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
              {/* 오늘 포인트 */}
              {graphData.length > 0 && (() => {
                const maxScore = Math.max(...graphData.map(g => g.loadScore), 1);
                const last = graphData[graphData.length - 1];
                const x = 100;
                const y = 95 - (last.loadScore / maxScore) * 85;
                return (
                  <div className="absolute" style={{ left: `${x}%`, top: `${y}%`, transform: "translate(-50%, -50%)" }}>
                    <div className="w-3 h-3 bg-white border-[2.5px] border-[#2D6A4F] rounded-full" />
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="h-24 flex items-center justify-center">
              <p className="text-xs text-gray-400">{ko ? "데이터가 쌓이면 그래프가 보여요" : "Graph appears with more data"}</p>
            </div>
          )}
          {/* 판정 */}
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-black text-[#1B4332]">
              {todayLoadScore ? todayLoadScore.toFixed(1) : totalVolume > 0 ? totalVolume.toLocaleString() + "kg" : "-"}
            </p>
            {graphVerdict && (
              <span className={`text-sm font-black ${graphVerdict.color}`}>
                — {graphVerdict.text}
              </span>
            )}
          </div>
          {todayLoadScore && !graphVerdict && totalVolume > 0 && (
            <p className="text-xs text-gray-500 mt-1">{ko ? "오늘 총 볼륨이에요" : "Today's total volume"}</p>
          )}
        </div>
      )}

      {/* ── 보조 정보 카드 ── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
        {/* 부위·시간·세트 */}
        <div>
          <p className="text-sm font-black text-[#1B4332]">{summaryLine}</p>
          <p className="text-xs text-gray-500 mt-0.5">{intensityMsg}</p>
        </div>

        <div className="h-px bg-gray-100" />

        {/* 칼로리 (남성 보조) / 볼륨 (여성 보조) */}
        {!showCalorieMain ? (
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">{ko ? "칼로리 소모" : "Calories"}</span>
            <span className="text-sm font-bold text-[#1B4332]">
              {cal > 0 ? `${cal}kcal${food ? ` · ${food}` : ""}` : "-"}
            </span>
          </div>
        ) : (
          totalVolume > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">{ko ? "총 볼륨" : "Volume"}</span>
              <span className="text-sm font-bold text-[#1B4332]">{totalVolume.toLocaleString()}kg</span>
            </div>
          )
        )}

        {/* vs 지난번 */}
        {vsLastMsg && (
          <>
            <div className="h-px bg-gray-100" />
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">{ko ? "vs 지난번" : "vs Last"}</span>
              <span className="text-sm font-bold text-[#1B4332]">{vsLastMsg}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
