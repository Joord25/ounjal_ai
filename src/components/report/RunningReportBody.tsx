"use client";

import React from "react";
import type { RunningStats, RunningType, WorkoutHistory } from "@/constants/workout";
import { useTranslation } from "@/hooks/useTranslation";
import { formatPace, formatRunDistanceKm, formatRunDuration, getRunningTypeShareLabel } from "@/utils/runningFormat";
import { TTCard } from "./TTCard";

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

  // ── 이번 주(월~일) 러닝 누적 ──
  const weekly = (() => {
    const now = new Date();
    const dow = (now.getDay() + 6) % 7;
    const monday = new Date(now);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(now.getDate() - dow);
    let runs = 0;
    let totalDistance = 0;
    let totalDuration = 0;
    for (const h of recentHistory) {
      if (!h.runningStats) continue;
      const d = new Date(h.date);
      if (d >= monday) {
        runs += 1;
        totalDistance += h.runningStats.distance;
        totalDuration += h.runningStats.duration;
      }
    }
    // 오늘 세션 포함 (히스토리에 아직 없을 때만)
    const todayStr = new Date().toISOString().slice(0, 10);
    const alreadyInHistory = recentHistory.some(h => h.runningStats && h.date?.startsWith(todayStr));
    if (!alreadyInHistory) {
      runs += 1;
      totalDistance += runningStats.distance;
      totalDuration += runningStats.duration;
    }
    return { runs, totalDistance, totalDuration };
  })();

  const typeLabel = getRunningTypeShareLabel(runningStats.runningType, locale);
  // 회의 41 후속: GPS 없거나 실내일 때 Distance 자리를 Rounds 또는 Duration으로 대체
  const hasGpsData = runningStats.gpsAvailable && !runningStats.isIndoor && runningStats.distance > 0;
  // 회의 64-Y: 카드 레이아웃 분기
  const cardLayout = pickCardLayout(runningStats.runningType);

  return (
    <div className="flex flex-col gap-3">
      {/* ── Hero Stats Card (3분할) ── */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm px-5 py-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-5 bg-[#2D6A4F] rounded-full" />
          <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em]">
            {typeLabel}
          </span>
          {runningStats.isIndoor && (
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em]">
              · {t("running.indoor.label")}
            </span>
          )}
        </div>

        <div className="flex items-start justify-around gap-2">
          {/* Distance — GPS 없으면 Rounds로 대체 */}
          {hasGpsData ? (
            <div className="flex flex-col items-center flex-1">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em] mb-1">
                {t("running.stats.distance")}
              </p>
              <p className="text-3xl font-black text-[#1B4332] leading-none tabular-nums">
                {formatRunDistanceKm(runningStats.distance)}
              </p>
              <p className="text-[10px] font-bold text-gray-400 mt-1">km</p>
            </div>
          ) : (
            <div className="flex flex-col items-center flex-1">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em] mb-1">
                {t("running.stats.rounds")}
              </p>
              <p className="text-3xl font-black text-[#1B4332] leading-none tabular-nums">
                {(runningStats.intervalRounds || []).length || "—"}
              </p>
              <p className="text-[10px] font-bold text-gray-400 mt-1">rounds</p>
            </div>
          )}

          <div className="w-px h-14 bg-gray-100 mt-3" />

          {/* Pace (전력 평균 우선 노출 — 러닝 코치 권고) */}
          <div className="flex flex-col items-center flex-1">
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em] mb-1">
              {runningStats.sprintAvgPace != null ? t("running.stats.sprintPace") : t("running.stats.pace")}
            </p>
            <p className="text-3xl font-black text-[#1B4332] leading-none tabular-nums">
              {formatPace(runningStats.sprintAvgPace ?? runningStats.avgPace)}
            </p>
            <p className="text-[10px] font-bold text-gray-400 mt-1">/km</p>
          </div>

          <div className="w-px h-14 bg-gray-100 mt-3" />

          {/* Time */}
          <div className="flex flex-col items-center flex-1">
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em] mb-1">
              {t("running.stats.time")}
            </p>
            <p className="text-3xl font-black text-[#1B4332] leading-none tabular-nums">
              {formatRunDuration(runningStats.duration)}
            </p>
            <p className="text-[10px] font-bold text-gray-400 mt-1">{t("running.stats.timeUnit")}</p>
          </div>
        </div>
      </div>

      {/* ── TT v1 카드 (time_trial 레이아웃 전용, 회의 64-Y Q4) ── */}
      {cardLayout === "time_trial" && (
        <TTCard runningStats={runningStats} recentHistory={recentHistory} />
      )}

      {/* ── Interval Breakdown Card (라운드별 전력/회복 — 오운잘 특화) ── */}
      {/* 회의 42 후속: 기록 없어도 카드 기본 양식 노출 */}
      {/* 회의 64-Y: interval 레이아웃에서만 렌더 (연속 주행/TT는 숨김) */}
      {cardLayout === "interval" && (
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm px-5 py-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-5 bg-[#2D6A4F] rounded-full" />
          <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em]">
            {t("running.report.breakdown")}
          </span>
        </div>

        {/* 전력 평균 / 회복 평균 요약 */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="bg-gray-50 rounded-2xl p-3">
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em] mb-0.5">
              {t("running.report.sprintAvg")}
            </p>
            <p className="text-lg font-black text-[#1B4332] leading-none tabular-nums">
              {formatPace(runningStats.sprintAvgPace)}
            </p>
          </div>
          <div className="bg-gray-50 rounded-2xl p-3">
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em] mb-0.5">
              {t("running.report.recoveryAvg")}
            </p>
            <p className="text-lg font-black text-[#1B4332] leading-none tabular-nums">
              {formatPace(runningStats.recoveryAvgPace)}
            </p>
          </div>
        </div>

        {/* 라운드별 상세 — 데이터 있으면 리스트, 없으면 빈 상태 안내 */}
        {(runningStats.intervalRounds || []).length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {runningStats.intervalRounds.map((round) => (
              <div key={round.round} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-b-0">
                <span className="text-[11px] font-bold text-gray-500">
                  {t("running.stats.rounds")} {round.round}
                </span>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-bold text-red-500 uppercase">
                      {t("running.phase.sprint")}
                    </span>
                    <span className="text-xs font-black text-[#1B4332] tabular-nums">
                      {formatPace(round.sprintPace)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-bold text-emerald-600 uppercase">
                      {t("running.phase.recovery")}
                    </span>
                    <span className="text-xs font-black text-[#1B4332] tabular-nums">
                      {formatPace(round.recoveryPace)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
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

      {/* ── Km Splits ── */}
      {/* 회의 64-Y: splits 또는 time_trial 레이아웃에서 렌더 */}
      {(cardLayout === "splits" || cardLayout === "time_trial") && runningStats.splits && runningStats.splits.length > 0 && (() => {
        const splits = runningStats.splits;
        const paces = splits.map(s => s.paceSec);
        const fastest = Math.min(...paces);
        const slowest = Math.max(...paces);
        return (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm px-5 py-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-5 bg-[#2D6A4F] rounded-full" />
              <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em]">
                {t("running.report.kmSplits")}
              </span>
            </div>
            <div className="space-y-2">
              {splits.map((s) => {
                const isFastest = s.paceSec === fastest && splits.length > 1;
                const isSlowest = s.paceSec === slowest && splits.length > 1;
                const barPct = slowest > fastest
                  ? 100 - ((s.paceSec - fastest) / (slowest - fastest)) * 60
                  : 80;
                return (
                  <div key={s.km} className="flex items-center gap-3">
                    <span className="text-[11px] font-bold text-gray-400 w-8 text-right">{s.km}km</span>
                    <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden relative">
                      <div
                        className={`h-full rounded-full transition-all ${isFastest ? "bg-[#2D6A4F]" : isSlowest ? "bg-amber-400" : "bg-[#2D6A4F]/40"}`}
                        style={{ width: `${barPct}%` }}
                      />
                    </div>
                    <span className={`text-[12px] font-black tabular-nums w-12 text-right ${isFastest ? "text-[#2D6A4F]" : isSlowest ? "text-amber-500" : "text-gray-600"}`}>
                      {formatPace(s.paceSec)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── This Week Card ── */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm px-5 py-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-5 bg-[#2D6A4F] rounded-full" />
          <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em]">
            {t("running.report.thisWeek")}
          </span>
        </div>

        {/* 주간 도트 (최대 5개) */}
        <div className="flex items-center gap-1.5 mb-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <span
              key={i}
              className={`rounded-full ${
                i < weekly.runs
                  ? "w-2.5 h-2.5 bg-[#2D6A4F]"
                  : "w-1.5 h-1.5 bg-gray-200"
              }`}
            />
          ))}
        </div>

        <div className="flex items-baseline gap-4">
          <div>
            <p className="text-2xl font-black text-[#1B4332] leading-none tabular-nums">
              {weekly.runs}
            </p>
            <p className="text-[10px] font-bold text-gray-400 mt-1">
              {t("running.report.runs")}
            </p>
          </div>
          <div className="w-px h-10 bg-gray-100" />
          <div>
            <p className="text-lg font-black text-[#1B4332] leading-none tabular-nums">
              {formatRunDuration(weekly.totalDuration)}
            </p>
            <p className="text-[10px] font-bold text-gray-400 mt-1">total time</p>
          </div>
          {weekly.totalDistance > 0 && (
            <>
              <div className="w-px h-10 bg-gray-100" />
              <div>
                <p className="text-lg font-black text-[#1B4332] leading-none tabular-nums">
                  {formatRunDistanceKm(weekly.totalDistance)}
                  <span className="text-xs text-gray-400 ml-1">km</span>
                </p>
                <p className="text-[10px] font-bold text-gray-400 mt-1">distance</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
