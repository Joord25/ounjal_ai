"use client";

import React from "react";
import type { RunningStats, WorkoutHistory } from "@/constants/workout";
import { useTranslation } from "@/hooks/useTranslation";
import { formatPace, formatRunDistanceKm, formatRunDuration } from "@/utils/runningFormat";

interface TTCardProps {
  runningStats: RunningStats;
  recentHistory: WorkoutHistory[];
}

/**
 * 회의 64-Y (2026-04-19) TT 카드 v1:
 * - PR 뱃지 (동일 거리(±5%) 최근 TT 대비 개인 최고 페이스면 표시)
 * - 목표 대비 차이 한 줄 (이전 기록 대비 +- N초, 첫 기록이면 "기준선" 문구)
 * - v2: 추이 차트 (스펙 외)
 */
export const TTCard: React.FC<TTCardProps> = ({ runningStats, recentHistory }) => {
  const { t, locale } = useTranslation();
  const isKo = locale === "ko";

  const currentPace = runningStats.avgPace;
  const currentDistKm = runningStats.distance / 1000;

  // 같은 거리(±5%) TT 중 현재 세션 제외한 최고 페이스
  const similarTTs = recentHistory.filter(h => {
    if (!h.runningStats) return false;
    const rt = h.runningStats.runningType;
    // time_trial 신규 + sprint legacy (마이그 전 과거 레코드 호환)
    if (rt !== "time_trial" && rt !== "sprint") return false;
    const dKm = h.runningStats.distance / 1000;
    if (currentDistKm === 0) return false;
    if (Math.abs(dKm - currentDistKm) / currentDistKm > 0.05) return false;
    return true;
  });
  const prevBest = similarTTs.reduce<number | null>((best, h) => {
    const p = h.runningStats?.avgPace;
    if (p == null) return best;
    return best == null || p < best ? p : best;
  }, null);

  const isPR = prevBest == null || (currentPace != null && currentPace < prevBest);
  const diffSec = prevBest != null && currentPace != null ? Math.round(currentPace - prevBest) : null;

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm px-5 py-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1 h-5 bg-[#2D6A4F] rounded-full" />
        <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em]">
          {t("running.tt.label")}
        </span>
        {isPR && prevBest != null && (
          <span className="ml-auto px-2 py-0.5 bg-emerald-100 rounded-full">
            <span className="text-[9px] font-black text-emerald-700 uppercase tracking-[0.15em]">
              {t("running.tt.pr")}
            </span>
          </span>
        )}
      </div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-2xl font-black text-[#1B4332] tabular-nums">
          {formatRunDistanceKm(runningStats.distance)} km
        </span>
        <span className="text-2xl font-black text-[#1B4332] tabular-nums">
          {formatRunDuration(runningStats.duration)}
        </span>
      </div>
      <p className="text-sm font-medium text-gray-500">
        {isKo ? "평균 페이스 " : "Avg pace "}
        <span className="font-black text-[#1B4332]">{formatPace(currentPace)}</span>
        {" /km"}
      </p>
      {diffSec != null && (
        <p className="text-xs font-bold mt-2 text-gray-500">
          {diffSec < 0
            ? t("running.tt.faster", { sec: String(Math.abs(diffSec)) })
            : diffSec === 0
              ? t("running.tt.same")
              : t("running.tt.slower", { sec: String(diffSec) })}
        </p>
      )}
      {diffSec == null && (
        <p className="text-xs font-bold mt-2 text-gray-400">
          {t("running.tt.firstRecord")}
        </p>
      )}
    </div>
  );
};
