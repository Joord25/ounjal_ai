"use client";

import React from "react";
import type { RunningStats, WorkoutHistory } from "@/constants/workout";
import { useTranslation } from "@/hooks/useTranslation";
import { formatPace } from "@/utils/runningFormat";

interface TTCardProps {
  runningStats: RunningStats;
  recentHistory: WorkoutHistory[];
}

/**
 * 회의 64-α (2026-04-19) TT 카드 — Kenko 엄격 (colored container 제거)
 * - 배경 박스 제거, 타이포 + 구분선만으로 정보 위계 전달
 * - 첫 기록: BASELINE 라벨 + 다음 목표 페이스 (대형 타이포)
 * - 2회차+: PR 라벨 + 방향 아이콘 + 초 차이 (큰 문자)
 * - 자기 자신 비교 버그 수정 유지 (distance/duration/avgPace 매칭 시 제외)
 */
export const TTCard: React.FC<TTCardProps> = ({ runningStats, recentHistory }) => {
  const { t } = useTranslation();

  const currentPace = runningStats.avgPace;
  const currentDistKm = runningStats.distance / 1000;
  const currentDuration = runningStats.duration;

  const similarTTs = recentHistory.filter(h => {
    if (!h.runningStats) return false;
    const rt = h.runningStats.runningType;
    if (rt !== "time_trial" && rt !== "sprint") return false;
    const isSelf =
      h.runningStats.distance === runningStats.distance &&
      h.runningStats.duration === currentDuration &&
      h.runningStats.avgPace === currentPace;
    if (isSelf) return false;
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
  const isFirstRecord = diffSec == null;

  const nextTargetPace = currentPace != null ? Math.max(1, currentPace - 5) : null;

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm px-6 py-7">
      {/* 타이틀: '기록 측정' 좌 / 상태 라벨 우 */}
      <div className="flex items-baseline justify-between mb-5">
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.18em]">
          {t("running.tt.label")}
        </span>
        {isFirstRecord && (
          <span className="text-[10px] font-black text-[#2D6A4F] uppercase tracking-[0.18em]">
            {t("running.tt.baselineBadge")}
          </span>
        )}
        {!isFirstRecord && isPR && prevBest != null && (
          <span className="text-[10px] font-black text-[#2D6A4F] uppercase tracking-[0.18em]">
            {t("running.tt.pr")}
          </span>
        )}
      </div>

      {/* 구분선 */}
      <div className="border-t border-gray-100 mb-5" />

      {/* Hero 카드 스타일 3분할 — grid 3등분 + border-r 구분선 */}
      <div className="grid grid-cols-3">
        <div className="flex flex-col items-center text-center border-r border-gray-100">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.18em] mb-2">
            {t("running.tt.currentPaceLabel")}
          </p>
          <p className="text-3xl font-black text-[#1B4332] leading-none tabular-nums">
            {formatPace(currentPace)}
          </p>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] mt-2">/km</p>
        </div>

        <div className="flex flex-col items-center text-center border-r border-gray-100">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.18em] mb-2">
            {t("running.tt.nextTargetLabel")}
          </p>
          <p className="text-3xl font-black text-[#2D6A4F] leading-none tabular-nums">
            {isFirstRecord
              ? formatPace(nextTargetPace)
              : prevBest != null ? formatPace(prevBest) : formatPace(currentPace)}
          </p>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] mt-2">/km</p>
        </div>

        <div className="flex flex-col items-center text-center">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.18em] mb-2">
            {t("running.tt.diffLabel")}
          </p>
          {isFirstRecord ? (
            <p className="text-3xl font-black text-[#1B4332] leading-none tabular-nums">−5s</p>
          ) : (
            <p className={`text-3xl font-black leading-none tabular-nums ${diffSec! < 0 ? "text-[#2D6A4F]" : diffSec! > 0 ? "text-amber-600" : "text-gray-500"}`}>
              {diffSec! < 0 ? `−${Math.abs(diffSec!)}` : diffSec! > 0 ? `+${diffSec!}` : "0"}s
            </p>
          )}
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] mt-2">
            {isFirstRecord ? t("running.tt.target") : t("running.tt.actual")}
          </p>
        </div>
      </div>

      {/* 힌트 문구 — 오른쪽 정렬 */}
      <p className="text-xs font-medium text-gray-500 mt-5 text-right">
        {isFirstRecord
          ? t("running.tt.nextTargetHint")
          : diffSec != null && diffSec < 0
            ? t("running.tt.fasterShort", { sec: String(Math.abs(diffSec)) })
            : diffSec != null && diffSec > 0
              ? t("running.tt.slower", { sec: String(diffSec) })
              : t("running.tt.same")}
      </p>
    </div>
  );
};
