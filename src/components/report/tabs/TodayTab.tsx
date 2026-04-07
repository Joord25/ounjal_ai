"use client";

import React from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { useState } from "react";

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
  /** 도움말 콜백 */
  onHelpPress?: () => void;
}

/** [오늘] 탭 — 성별 고정 하이라이트 (회의 38) */
export const TodayTab: React.FC<TodayTabProps> = ({
  sessionCategory, totalVolume, volumeChangePercent, goal, gender,
  bodyWeightKg, totalDurationSec, savedDurationSec, fatigueDrop,
  totalSets, totalReps, sessionDesc, graphData, prInfo, loadBand, todayLoadScore,
  onHelpPress,
}) => {
  const { locale } = useTranslation();
  const ko = locale === "ko";
  const [activeGraphDot, setActiveGraphDot] = useState<number | null>(null);
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
        /* 남성/근비대: 4주 그래프 메인 — LoadTimelineChart 디자인 동일 */
        <div className="bg-white rounded-3xl border border-[#2D6A4F]/10 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em]">
              {ko ? "4주 운동량 변화" : "4-Week Volume Trend"}
            </p>
            {onHelpPress && (
              <button onClick={onHelpPress} className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center">
                <span className="text-[10px] font-black text-gray-400">?</span>
              </button>
            )}
          </div>
          {graphData && graphData.length >= 1 ? (() => {
            const maxLoad = Math.max(...graphData.map(g => g.loadScore), 1);
            const bandHigh = loadBand?.high ?? maxLoad;
            const bandLow = loadBand?.low ?? 0;
            const bandOverload = bandHigh * 1.2;
            const maxScale = Math.max(maxLoad, bandHigh, bandOverload) * 1.1;
            const tickValues = [0, Math.round(bandLow), Math.round(bandHigh), Math.round(bandOverload)].filter((v, i, a) => a.indexOf(v) === i);
            const latest = graphData[graphData.length - 1].loadScore;

            return (
              <>
                <div className="relative h-36 mt-5 mb-2 mx-5">
                  {/* Y축 눈금 */}
                  {tickValues.map((v, ti) => {
                    const yPct = 100 - ((v / maxScale) * 80);
                    if (yPct < 0 || yPct > 100) return null;
                    return (
                      <div key={ti} className="absolute left-0 right-0 pointer-events-none" style={{ top: `${yPct}%` }}>
                        <div className="border-t border-dashed border-gray-200/60 w-full" />
                        <span className="absolute -left-1 -translate-x-full -translate-y-1/2 text-[8px] text-gray-300 font-bold">{v}</span>
                      </div>
                    );
                  })}
                  {/* 적정/과부하 영역 */}
                  {loadBand && (() => {
                    const topPct = 100 - (bandHigh / maxScale) * 80;
                    const overloadPct = 100 - (bandOverload / maxScale) * 80;
                    const bottomPct = 100 - (bandLow / maxScale) * 80;
                    return (
                      <>
                        <div className="absolute left-0 right-0 bg-amber-50/50 border-t border-amber-200/50 rounded-t" style={{ top: `${Math.max(0, overloadPct)}%`, height: `${Math.max(0, topPct - overloadPct)}%` }} />
                        <div className="absolute left-0 right-0 bg-emerald-50 border-y border-emerald-100 rounded" style={{ top: `${Math.max(0, topPct)}%`, height: `${Math.max(4, bottomPct - topPct)}%` }} />
                      </>
                    );
                  })()}
                  {/* 라인 */}
                  <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <path
                      d={graphData.map((d, i) => {
                        const x = graphData.length === 1 ? 50 : (i / (graphData.length - 1)) * 100;
                        const y = 100 - ((d.loadScore / maxScale) * 80);
                        return `${i === 0 ? "M" : "L"} ${x} ${y}`;
                      }).join(" ")}
                      fill="none" stroke="#2D6A4F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                  {/* 점 */}
                  {graphData.map((d, i) => {
                    const xPct = graphData.length === 1 ? 50 : (i / (graphData.length - 1)) * 100;
                    const yPct = 100 - ((d.loadScore / maxScale) * 80);
                    const isActive = activeGraphDot === i;
                    return (
                      <button
                        type="button"
                        key={i}
                        className="absolute z-10 flex items-center justify-center"
                        style={{ left: `${xPct}%`, top: `${yPct}%`, transform: "translate(-50%, -50%)", width: 44, height: 44, background: "none", border: "none", padding: 0 }}
                        onPointerUp={(e) => { e.stopPropagation(); setActiveGraphDot(isActive ? null : i); }}
                      >
                        {isActive && (
                          <span className="absolute -top-7 text-[10px] font-black text-gray-700 bg-white px-1.5 py-0.5 rounded shadow-sm border border-gray-100 z-20 whitespace-nowrap pointer-events-none">
                            {d.loadScore.toFixed(1)}
                          </span>
                        )}
                        <div className={`rounded-full border-2 transition-transform ${isActive ? "scale-150" : ""} w-2 h-2 bg-white border-[#2D6A4F]`} />
                      </button>
                    );
                  })}
                </div>
                {/* X축 날짜 */}
                <div className="relative text-[9px] text-gray-300 font-medium mx-5">
                  <span className="absolute left-0 -translate-x-1/2">{`${graphData[0].date.getMonth() + 1}/${graphData[0].date.getDate()}`}</span>
                  <span className="absolute right-0 translate-x-1/2">{`${graphData[graphData.length - 1].date.getMonth() + 1}/${graphData[graphData.length - 1].date.getDate()}`}</span>
                  <span>&nbsp;</span>
                </div>
                {/* 범례 */}
                <div className="flex justify-center gap-2 text-[9px] text-gray-300 font-medium mt-1">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 bg-amber-50 border border-amber-200 rounded-sm inline-block" /> {ko ? "많음" : "High"}</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-100 rounded-sm inline-block" /> {ko ? "딱 좋음" : "Optimal"}</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 bg-[#2D6A4F] rounded-full inline-block" /> {ko ? "운동량" : "Volume"}</span>
                </div>
                {/* 판정 */}
                <div className="mt-4 pt-4 border-t border-gray-100 text-center">
                  <p className="text-2xl font-black text-[#1B4332]">
                    {latest.toFixed(1)} {graphVerdict && <span className={`text-base ${graphVerdict.color}`}>— {graphVerdict.text}</span>}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-1 leading-relaxed pb-2">
                    {graphVerdict?.color === "text-[#2D6A4F]"
                      ? (ko ? "목표에 맞는 운동량이에요. 이 페이스 유지하세요." : "Right on target. Keep this pace.")
                      : graphVerdict?.color === "text-amber-600"
                        ? (ko ? "운동량이 많았어요. 다음엔 좀 가볍게 가도 괜찮아요." : "That was a lot. Going lighter next time is fine.")
                        : (ko ? "운동량이 적었어요. 쉬는 날엔 괜찮지만 계속되면 아쉬워요." : "Volume was low. OK for rest days, but don't make it a habit.")}
                  </p>
                </div>
              </>
            );
          })() : (
            <div className="h-36 flex items-center justify-center">
              <p className="text-xs text-gray-400">{ko ? "데이터가 쌓이면 그래프가 보여요" : "Graph appears with more data"}</p>
            </div>
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
