"use client";

import React from "react";
import type { RunningStats, RunningType, WorkoutHistory } from "@/constants/workout";
import { useTranslation } from "@/hooks/useTranslation";
import { formatPace, formatRunDistanceKm, formatRunDuration, getRunningTypeShareLabel } from "@/utils/runningFormat";
import { TTCard } from "./TTCard";
import { ActivityRing } from "./ActivityRing";
import { computeWeeklyRunningStats } from "@/utils/weeklyRunning";

/**
 * 회의 64-Y (2026-04-19): 8종 runType → 3가지 카드 레이아웃 분기
 * - interval: 인터벌 상세 카드 (walkrun/vo2_interval/sprint_interval, legacy fartlek/sprint)
 * - splits: km 스플릿 카드 (easy/long/tempo/threshold)
 * - time_trial: TT 신규 카드 + 스플릿 (time_trial)
 */
type CardLayout = "interval" | "splits" | "time_trial";
function pickCardLayout(runningType: RunningType): CardLayout {
  switch (runningType) {
    case "walkrun":
    case "vo2_interval":
    case "sprint_interval":
    case "fartlek": // legacy
      return "interval";
    case "time_trial":
      return "time_trial";
    case "sprint": // legacy (Batch C 마이그 전 안전망) — 인터벌로 기본 처리
      return "interval";
    case "easy":
    case "long":
    case "tempo":
    case "threshold":
    default:
      return "splits";
  }
}

interface RunningReportBodyProps {
  runningStats: RunningStats;
  recentHistory: WorkoutHistory[];
}

export const RunningReportBody: React.FC<RunningReportBodyProps> = ({ runningStats, recentHistory }) => {
  const { t, locale } = useTranslation();

  // ── 이번 주(월~일) 러닝 누적 (회의 64-α: 유틸로 분리) ──
  const weekly = computeWeeklyRunningStats(recentHistory, runningStats);

  const typeLabel = getRunningTypeShareLabel(runningStats.runningType, locale);
  // 회의 41 후속: GPS 없거나 실내일 때 Distance 자리를 Rounds 또는 Duration으로 대체
  const hasGpsData = runningStats.gpsAvailable && !runningStats.isIndoor && runningStats.distance > 0;
  // 회의 64-Y: 카드 레이아웃 분기
  const cardLayout = pickCardLayout(runningStats.runningType);

  return (
    <div className="flex flex-col gap-5">
      {/* ── Hero Stats Card (회의 64-α: Kenko 2블록 레이아웃) ── */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm px-6 py-7">
        {/* 타이틀 라벨 */}
        <div className="flex items-center gap-2 mb-6">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.18em]">
            {typeLabel}
          </span>
          {runningStats.isIndoor && (
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.18em]">
              · {t("running.indoor.label")}
            </span>
          )}
        </div>

        {/* 3분할: 거리 / 페이스 / 총 시간 — 명시적 divider + gap-6 */}
        <div className="flex items-stretch gap-6">
          {/* 거리 or Rounds */}
          {hasGpsData ? (
            <div className="flex-1 flex flex-col items-center text-center">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.18em] mb-2">
                {t("running.stats.distance")}
              </p>
              <p className="text-3xl font-black text-[#1B4332] leading-none tabular-nums">
                {formatRunDistanceKm(runningStats.distance)}
              </p>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] mt-2">km</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center text-center">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.18em] mb-2">
                {t("running.stats.rounds")}
              </p>
              <p className="text-3xl font-black text-[#1B4332] leading-none tabular-nums">
                {(runningStats.intervalRounds || []).length || "—"}
              </p>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] mt-2">rounds</p>
            </div>
          )}

          <div className="w-px bg-gray-100" />

          {/* Pace */}
          <div className="flex-1 flex flex-col items-center text-center">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.18em] mb-2">
              {runningStats.sprintAvgPace != null ? t("running.stats.sprintPace") : t("running.stats.pace")}
            </p>
            <p className="text-3xl font-black text-[#1B4332] leading-none tabular-nums">
              {formatPace(runningStats.sprintAvgPace ?? runningStats.avgPace)}
            </p>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] mt-2">/km</p>
          </div>

          <div className="w-px bg-gray-100" />

          {/* Time — 상단 '총 시간', 하단 '시간' */}
          <div className="flex-1 flex flex-col items-center text-center">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.18em] mb-2">
              {t("running.stats.timeUnit")}
            </p>
            <p className="text-3xl font-black text-[#1B4332] leading-none tabular-nums">
              {formatRunDuration(runningStats.duration)}
            </p>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] mt-2">
              {t("running.stats.time")}
            </p>
          </div>
        </div>
      </div>

      {/* ── TT v1 카드 (time_trial 레이아웃 전용, 회의 64-Y Q4) ── */}
      {cardLayout === "time_trial" && (
        <TTCard runningStats={runningStats} recentHistory={recentHistory} />
      )}

      {/* ── Interval Breakdown Card (회의 64-α: Kenko 미니 바 리스트) ── */}
      {/* 회의 64-Y: interval 레이아웃에서만 렌더 (연속 주행/TT는 숨김) */}
      {cardLayout === "interval" && (
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm px-6 py-7">
        <div className="mb-5">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.18em]">
            {t("running.report.breakdown")}
          </span>
        </div>

        {/* 전력 평균 / 회복 평균 요약 — 타이포 그리드만 (배경 박스 제거) */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div className="flex flex-col items-start">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.18em] mb-2">
              {t("running.report.sprintAvg")}
            </p>
            <p className="text-3xl font-black text-[#1B4332] leading-none tabular-nums">
              {formatPace(runningStats.sprintAvgPace)}
            </p>
          </div>
          <div className="flex flex-col items-start">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.18em] mb-2">
              {t("running.report.recoveryAvg")}
            </p>
            <p className="text-3xl font-black text-[#1B4332] leading-none tabular-nums">
              {formatPace(runningStats.recoveryAvgPace)}
            </p>
          </div>
        </div>
        <div className="border-t border-gray-100 pt-5" />

        {/* 라운드별 상세 — Kenko 수평 미니 바 2개 (전력/회복 정규화) */}
        {(runningStats.intervalRounds || []).length > 0 ? (() => {
          const rounds = runningStats.intervalRounds;
          const sprintPaces = rounds.map(r => r.sprintPace).filter((p): p is number => p != null && p > 0);
          const recoveryPaces = rounds.map(r => r.recoveryPace).filter((p): p is number => p != null && p > 0);
          const sprintMin = sprintPaces.length > 0 ? Math.min(...sprintPaces) : 0;
          const sprintMax = sprintPaces.length > 0 ? Math.max(...sprintPaces) : 1;
          const recoveryMin = recoveryPaces.length > 0 ? Math.min(...recoveryPaces) : 0;
          const recoveryMax = recoveryPaces.length > 0 ? Math.max(...recoveryPaces) : 1;
          // 페이스 값이 낮을수록 빠름 → 더 긴 바 (fastest=100%, slowest=40%)
          const barPct = (pace: number | null | undefined, min: number, max: number): number => {
            if (pace == null || pace <= 0) return 0;
            if (max === min) return 80;
            return Math.max(40, 100 - ((pace - min) / (max - min)) * 60);
          };
          return (
            <div className="flex flex-col gap-2.5">
              {rounds.map((round) => (
                <div key={round.round} className="flex items-center gap-3 py-1.5">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] w-14 shrink-0">
                    {t("running.stats.rounds")} {round.round}
                  </span>
                  <div className="flex-1 flex flex-col gap-1">
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#2D6A4F] transition-[width] duration-500 ease-out"
                        style={{ width: `${barPct(round.sprintPace, sprintMin, sprintMax)}%` }}
                      />
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#2D6A4F]/50 transition-[width] duration-500 ease-out"
                        style={{ width: `${barPct(round.recoveryPace, recoveryMin, recoveryMax)}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 shrink-0 w-14">
                    <span className="text-xs font-black text-[#1B4332] tabular-nums leading-none">
                      {formatPace(round.sprintPace)}
                    </span>
                    <span className="text-xs font-black text-gray-400 tabular-nums leading-none">
                      {formatPace(round.recoveryPace)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          );
        })() : (
          <div className="py-4 text-center">
            <p className="text-[11px] font-medium text-gray-400">
              {runningStats.isIndoor
                ? t("running.indoor.desc")
                : runningStats.gpsAvailable
                  ? t("running.gps.searching")
                  : t("running.gps.denied")}
            </p>
          </div>
        )}
      </div>
      )}

      {/* ── Km Splits (회의 64-α: Kenko 미니멀 단일 톤) ── */}
      {/* 회의 64-Y: splits 또는 time_trial 레이아웃에서 렌더 */}
      {(cardLayout === "splits" || cardLayout === "time_trial") && runningStats.splits && runningStats.splits.length > 0 && (() => {
        const splits = runningStats.splits;
        const paces = splits.map(s => s.paceSec);
        const fastest = Math.min(...paces);
        const slowest = Math.max(...paces);
        return (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm px-6 py-7">
            <div className="mb-5">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.18em]">
                {t("running.report.kmSplits")}
              </span>
            </div>
            <div className="space-y-3">
              {splits.map((s) => {
                const isFastest = s.paceSec === fastest && splits.length > 1;
                const isSlowest = s.paceSec === slowest && splits.length > 1;
                const barPct = slowest > fastest
                  ? 100 - ((s.paceSec - fastest) / (slowest - fastest)) * 60
                  : 80;
                return (
                  <div key={s.km} className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] w-10 text-right">
                      {s.km}km
                    </span>
                    <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-[width] duration-500 ease-out ${isFastest ? "bg-[#2D6A4F]" : isSlowest ? "bg-gray-300" : "bg-[#2D6A4F]/35"}`}
                        style={{ width: `${barPct}%` }}
                      />
                    </div>
                    <span className={`text-xs font-black tabular-nums w-12 text-right ${isFastest ? "text-[#2D6A4F]" : "text-gray-500"}`}>
                      {formatPace(s.paceSec)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── This Week Card (회의 64-α Phase 1.5: Variant A Activity Ring) ── */}
      {(() => {
        const totalDistanceKm = weekly.totalDistance / 1000;
        const hasDistance = weekly.totalDistance > 0;
        const ringPercent = hasDistance
          ? Math.min(100, (totalDistanceKm / weekly.weeklyGoalKm) * 100)
          : Math.min(100, (weekly.runs / 5) * 100);
        const todayDow = (new Date().getDay() + 6) % 7;
        const weekdayKeys = [
          "running.weekly.mon",
          "running.weekly.tue",
          "running.weekly.wed",
          "running.weekly.thu",
          "running.weekly.fri",
          "running.weekly.sat",
          "running.weekly.sun",
        ];
        return (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm px-6 py-7">
            <div className="mb-6">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.18em]">
                {t("running.report.thisWeek")}
              </span>
            </div>

            {/* 상단: ActivityRing + 대표 숫자 */}
            <div className="flex items-center gap-6 mb-6">
              <ActivityRing
                size={128}
                strokeWidth={12}
                value={ringPercent}
                color="#2D6A4F"
                trackColor="#F3F4F6"
                ariaLabel={t("running.weekly.goalLabel")}
              >
                <span className="text-lg font-black text-[#1B4332] tabular-nums">
                  {Math.round(ringPercent)}%
                </span>
              </ActivityRing>
              <div className="flex-1 min-w-0">
                {hasDistance ? (
                  <>
                    <p className="text-[56px] font-black text-[#1B4332] leading-none tabular-nums">
                      {formatRunDistanceKm(weekly.totalDistance)}
                    </p>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] mt-2">km</p>
                    <div className="border-t border-gray-100 mt-4 pt-3">
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.18em]">
                        {t("running.weekly.goalLabel")} · {weekly.weeklyGoalKm} km
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-[56px] font-black text-[#1B4332] leading-none tabular-nums">
                      {weekly.runs}
                    </p>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] mt-2">
                      {t("running.weekly.runsLabel")}
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* 중단: 3분할 스탯 */}
            <div className="border-t border-gray-100 pt-5 mb-5 grid grid-cols-3 gap-4">
              <div className="flex flex-col items-start">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.18em] mb-2">
                  {t("running.report.runs")}
                </p>
                <p className="text-2xl font-black text-[#1B4332] leading-none tabular-nums">
                  {weekly.runs}
                </p>
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em] mt-2">
                  {t("running.weekly.runsLabel")}
                </p>
              </div>
              <div className="flex flex-col items-start">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.18em] mb-2">
                  {t("running.weekly.totalTime")}
                </p>
                <p className="text-2xl font-black text-[#1B4332] leading-none tabular-nums">
                  {formatRunDuration(weekly.totalDuration)}
                </p>
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em] mt-2">total</p>
              </div>
              <div className="flex flex-col items-start">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.18em] mb-2">
                  {t("running.weekly.avgPace")}
                </p>
                <p className="text-2xl font-black text-[#1B4332] leading-none tabular-nums">
                  {weekly.avgPace != null ? formatPace(weekly.avgPace) : "—"}
                </p>
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em] mt-2">/km</p>
              </div>
            </div>

            {/* 하단: 요일 도트 7개 */}
            <div className="border-t border-gray-100 pt-5 flex items-center justify-between">
              {weekly.daysRun.map((ran, i) => (
                <div key={i} className={`flex flex-col items-center gap-1.5 ${i === todayDow ? "relative" : ""}`}>
                  <span className={`text-[10px] font-black uppercase tracking-[0.15em] ${i === todayDow ? "text-[#2D6A4F]" : "text-gray-400"}`}>
                    {t(weekdayKeys[i])}
                  </span>
                  {ran ? (
                    <span className={`w-2 h-2 rounded-full bg-[#2D6A4F] ${i === todayDow ? "ring-2 ring-[#2D6A4F]/20" : ""}`} />
                  ) : (
                    <span className="w-1 h-1 rounded-full bg-gray-200" />
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
};
