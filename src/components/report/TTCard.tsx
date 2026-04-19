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
      {/* 타이틀 한 줄 (기록 측정 · 첫 기록 / 기록 측정 · PR) — 같은 단위로 묶어 위계 명확화 */}
      <div className="mb-5">
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.18em]">
          {t("running.tt.label")}
          {isFirstRecord && (
            <>
              <span className="mx-2 text-gray-300">·</span>
              <span className="text-[#2D6A4F]">{t("running.tt.baselineBadge")}</span>
            </>
          )}
          {!isFirstRecord && isPR && prevBest != null && (
            <>
              <span className="mx-2 text-gray-300">·</span>
              <span className="text-[#2D6A4F]">{t("running.tt.pr")}</span>
            </>
          )}
        </span>
      </div>

      {/* 구분선 — 타이틀과 콘텐츠 분리 */}
      <div className="border-t border-gray-100 mb-5" />

      {/* 첫 기록: NEXT TARGET — 중앙 정렬 hero 레이아웃 */}
      {isFirstRecord && nextTargetPace != null && (
        <div className="flex flex-col items-center text-center py-4">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.18em] mb-4">
            {t("running.tt.nextTargetLabel")}
          </p>
          <p className="text-[56px] font-black text-[#1B4332] leading-none tabular-nums">
            {formatPace(nextTargetPace)}
          </p>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] mt-3">/km</p>
          <p className="text-xs font-medium text-gray-500 mt-5">
            {t("running.tt.nextTargetHint")}
          </p>
        </div>
      )}

      {/* 2회차+: 방향 아이콘 + 초 차이 — 중앙 정렬 */}
      {!isFirstRecord && diffSec != null && (
        <div className="flex flex-col items-center text-center py-4 gap-3">
          {diffSec < 0 && (
            <svg className="w-8 h-8" viewBox="0 0 16 16" fill="none" aria-label="faster">
              <path d="M8 2v10m-4-4l4 4 4-4" stroke="#2D6A4F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          {diffSec > 0 && (
            <svg className="w-8 h-8" viewBox="0 0 16 16" fill="none" aria-label="slower">
              <path d="M8 14V4m-4 4l4-4 4 4" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          {diffSec === 0 && (
            <svg className="w-8 h-8" viewBox="0 0 16 16" fill="none" aria-label="same">
              <path d="M3 6h10M3 10h10" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" />
            </svg>
          )}
          <p className={`text-2xl font-black ${diffSec < 0 ? "text-[#2D6A4F]" : diffSec > 0 ? "text-amber-600" : "text-gray-500"}`}>
            {diffSec < 0
              ? t("running.tt.fasterShort", { sec: String(Math.abs(diffSec)) })
              : diffSec === 0
                ? t("running.tt.same")
                : t("running.tt.slower", { sec: String(diffSec) })}
          </p>
        </div>
      )}
    </div>
  );
};
