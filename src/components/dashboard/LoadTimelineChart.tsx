"use client";

import React from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { WorkoutHistory as WorkoutHistoryType } from "@/constants/workout";
import { estimateTrainingLevelDetailed, getOptimalLoadBand } from "@/utils/workoutMetrics";

interface LoadTimelineChartProps {
  history: WorkoutHistoryType[];
  bodyWeightKg?: number;
  gender?: "male" | "female";
  birthYear?: number;
  onHelpPress: () => void;
}

export const LoadTimelineChart: React.FC<LoadTimelineChartProps> = ({
  history,
  bodyWeightKg,
  gender,
  birthYear,
  onHelpPress,
}) => {
  const { t } = useTranslation();

  const levelEst = estimateTrainingLevelDetailed(history, bodyWeightKg, gender);

  const now = new Date();
  const fourWeeksAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 28);
  const recentSessions = history
    .filter(h => (h.stats?.totalVolume || 0) > 0 && new Date(h.date) >= fourWeeksAgo)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (recentSessions.length < 2) return null;

  const graphData = recentSessions.map(h => ({
    date: new Date(h.date),
    loadScore: h.stats.totalVolume && bodyWeightKg ? Math.round((h.stats.totalVolume / bodyWeightKg) * 10) / 10 : h.stats.totalVolume,
    volume: h.stats.totalVolume,
  }));

  const avgLoad = graphData.length > 0
    ? graphData.reduce((s, d) => s + d.loadScore, 0) / graphData.length
    : 0;
  const loadBand = getOptimalLoadBand(avgLoad, graphData.length, levelEst.level, birthYear);
  const maxLoad = Math.max(...graphData.map(g => g.loadScore), 1);
  const maxScale = Math.max(maxLoad, loadBand.high, loadBand.overload) * 1.1;

  const latest = graphData[graphData.length - 1].loadScore;
  const isOverload = latest > loadBand.overload;
  const isHigh = latest > loadBand.high && !isOverload;
  const isOptimal = latest >= loadBand.low && latest <= loadBand.high;
  const label = isOverload ? t("proof.loadOverload") : isHigh ? t("proof.loadHigh") : isOptimal ? t("proof.loadOptimal") : t("proof.loadLow");
  const color = "text-gray-500";
  const comment = isOverload
    ? t("proof.loadOverload.desc")
    : isHigh
    ? t("proof.loadHigh.desc")
    : isOptimal
    ? t("proof.loadOptimal.desc")
    : t("proof.loadLow.desc");

  return (
    <div className="p-4 sm:p-6 bg-white rounded-3xl border border-[#2D6A4F]/10 shadow-sm">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em]">{t("proof.4weekVolume")}</p>
        <button onClick={onHelpPress} className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center">
          <span className="text-[10px] font-black text-gray-400">?</span>
        </button>
      </div>
      <div className="relative h-36 sm:h-32 mt-5 sm:mt-4 mb-2 mx-5">
        {/* Y-axis reference lines */}
        {(() => {
          const tickValues = [0, Math.round(loadBand.low), Math.round(loadBand.high), Math.round(loadBand.overload)].filter((v, i, a) => a.indexOf(v) === i);
          return tickValues.map((v, ti) => {
            const yPct = 100 - ((v / maxScale) * 80);
            if (yPct < 0 || yPct > 100) return null;
            return (
              <div key={ti} className="absolute left-0 right-0 pointer-events-none" style={{ top: `${yPct}%` }}>
                <div className="border-t border-dashed border-gray-200/60 w-full" />
                <span className="absolute -left-1 -translate-x-full -translate-y-1/2 text-[8px] text-gray-300 font-bold">{v}</span>
              </div>
            );
          });
        })()}
        {/* Zones */}
        {(() => {
          const topPct = 100 - (loadBand.high / maxScale) * 80;
          const overloadPct = 100 - (loadBand.overload / maxScale) * 80;
          const bottomPct = 100 - (loadBand.low / maxScale) * 80;
          return (
            <>
              <div className="absolute left-0 right-0 bg-amber-50/50 border-t border-amber-200/50 rounded-t" style={{ top: `${Math.max(0, overloadPct)}%`, height: `${Math.max(0, topPct - overloadPct)}%` }} />
              <div className="absolute left-0 right-0 bg-emerald-50 border-y border-emerald-100 rounded" style={{ top: `${Math.max(0, topPct)}%`, height: `${Math.max(4, bottomPct - topPct)}%` }} />
            </>
          );
        })()}
        {/* Line */}
        <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path
            className="animate-draw-line"
            style={{ animationDelay: "0.8s" }}
            d={graphData.map((d, i) => {
              const x = (i / (graphData.length - 1)) * 100;
              const y = 100 - ((d.loadScore / maxScale) * 80);
              if (i === 0) return `M ${x} ${y}`;
              const px = ((i - 1) / (graphData.length - 1)) * 100;
              const py = 100 - ((graphData[i - 1].loadScore / maxScale) * 80);
              const t = 0.35;
              return `C ${px + (x - px) * t} ${py}, ${x - (x - px) * t} ${y}, ${x} ${y}`;
            }).join(" ")}
            fill="none" stroke="#2D6A4F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"
          />
        </svg>
        {/* 마지막 점만 표시 */}
        {graphData.length > 0 && (() => {
          const lastIdx = graphData.length - 1;
          const xPct = (lastIdx / Math.max(lastIdx, 1)) * 100;
          const yPct = 100 - ((graphData[lastIdx].loadScore / maxScale) * 80);
          return (
            <div className="absolute z-10" style={{ left: `${xPct}%`, top: `${yPct}%`, transform: "translate(-50%, -50%)" }}>
              <div className="w-3 h-3 rounded-full bg-[#2D6A4F] border-2 border-white shadow-sm" />
            </div>
          );
        })()}
      </div>
      <div className="relative text-[9px] text-gray-300 font-medium mx-5">
        <span className="absolute left-0 -translate-x-1/2">{graphData.length > 0 ? `${graphData[0].date.getMonth() + 1}/${graphData[0].date.getDate()}` : ""}</span>
        <span className="absolute right-0 translate-x-1/2">{graphData.length > 0 ? `${graphData[graphData.length - 1].date.getMonth() + 1}/${graphData[graphData.length - 1].date.getDate()}` : ""}</span>
        <span>&nbsp;</span>
      </div>
      <div className="flex justify-center gap-2 text-[9px] text-gray-300 font-medium mt-1">
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-amber-50 border border-amber-200 rounded-sm inline-block" /> {t("proof.zoneHigh")}</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-100 rounded-sm inline-block" /> {t("proof.zoneOptimal")}</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-[#2D6A4F] rounded-full inline-block" /> {t("proof.zoneVolume")}</span>
      </div>
      {/* Load verdict */}
      <div className="mt-4 pt-4 border-t border-gray-100 text-center">
        <p className="text-2xl font-black text-[#1B4332]">{latest.toFixed(1)} <span className={`text-base ${color}`}>— {label}</span></p>
        <p className="text-[11px] text-gray-400 mt-1 leading-relaxed pb-2">{comment}</p>
      </div>
    </div>
  );
};
