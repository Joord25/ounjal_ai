"use client";

import React, { useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { useUnits } from "@/hooks/useUnits";
import { kgToLb } from "@/utils/units";
import { WorkoutHistory as WorkoutHistoryType } from "@/constants/workout";

interface VolumeTrendChartProps {
  monthHistory: WorkoutHistoryType[];
}

export const VolumeTrendChart: React.FC<VolumeTrendChartProps> = ({ monthHistory }) => {
  const { t, locale } = useTranslation();
  const { system: unitSystem, labels: unitLabels } = useUnits();
  const toDisp = (kg: number) => unitSystem === "imperial" ? kgToLb(kg) : kg;
  const [activeVolumeDot, setActiveVolumeDot] = useState<number | null>(null);

  const sessionsWithVolume = monthHistory
    .filter(h => (h.stats?.totalVolume || 0) > 0)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (sessionsWithVolume.length === 0) {
    return (
      <div className="p-6 bg-white rounded-3xl border border-[#2D6A4F]/10 shadow-sm">
        <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em] mb-1">{t("proof.monthVolume")}</p>
        <h3 className="text-xl font-black text-gray-300">{t("proof.noVolume")}</h3>
      </div>
    );
  }

  // Group sessions by date string
  const dateGroups: { dateStr: string; sessions: { volume: number; idx: number }[] }[] = [];
  let globalIdx = 0;
  sessionsWithVolume.forEach(h => {
    const dateStr = new Date(h.date).toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US", { month: "numeric", day: "numeric" });
    const vol = h.stats.totalVolume || 0;
    const last = dateGroups[dateGroups.length - 1];
    if (last && last.dateStr === dateStr) {
      last.sessions.push({ volume: vol, idx: globalIdx++ });
    } else {
      dateGroups.push({ dateStr, sessions: [{ volume: vol, idx: globalIdx++ }] });
    }
  });
  const recentGroups = dateGroups.slice(-7);

  const allDots: { volume: number; xPct: number; globalIdx: number }[] = [];
  const lineDots: { volume: number; xPct: number }[] = [];

  const totalSessions = recentGroups.reduce((s, g) => s + g.sessions.length, 0);
  const isSingleGroup = recentGroups.length === 1;
  let sessionCounter = 0;

  recentGroups.forEach((group, gi) => {
    let maxVol = 0;
    group.sessions.forEach((s) => {
      const xPct = isSingleGroup
        ? (totalSessions === 1 ? 50 : (sessionCounter / (totalSessions - 1)) * 100)
        : (gi / (recentGroups.length - 1)) * 100;
      allDots.push({ volume: s.volume, xPct, globalIdx: s.idx });
      if (s.volume > maxVol) { maxVol = s.volume; }
      sessionCounter++;
    });
    if (isSingleGroup) {
      group.sessions.forEach((s, si) => {
        const xPct = totalSessions === 1 ? 50 : ((sessionCounter - group.sessions.length + si) / (totalSessions - 1)) * 100;
        lineDots.push({ volume: s.volume, xPct });
      });
    } else {
      lineDots.push({ volume: maxVol, xPct: gi / (recentGroups.length - 1) * 100 });
    }
  });

  const allVolumes = allDots.map(d => d.volume);
  const rawMin = Math.min(...allVolumes);
  const rawMax = Math.max(...allVolumes);
  const padding = rawMax - rawMin < 100 ? 200 : (rawMax - rawMin) * 0.2;
  const minV = Math.max(0, rawMin - padding);
  const range = (rawMax + padding) - minV;

  const getY = (v: number) => 95 - ((v - minV) / range) * 90;

  return (
    <div className="p-4 sm:p-6 bg-white rounded-3xl border border-[#2D6A4F]/10 shadow-sm overflow-visible">
      <div className="flex justify-between items-baseline mb-3 sm:mb-4">
        <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em]">{t("proof.monthVolume")}</p>
        <span className="text-[9px] font-black text-gray-300">{t("proof.recentDays", { count: String(recentGroups.length) })}</span>
      </div>

      <div className="relative h-36 sm:h-32 mt-5 sm:mt-4 mb-2 mx-5">
        {/* Y-axis reference lines */}
        {(() => {
          const mid = Math.round((rawMin + rawMax) / 2 / 100) * 100;
          const ticks = [rawMin, mid, rawMax].filter((v, i, a) => a.indexOf(v) === i && v >= 0);
          return ticks.map((v, ti) => {
            const yPct = getY(v);
            if (yPct < 0 || yPct > 100) return null;
            return (
              <div key={ti} className="absolute left-0 right-0 pointer-events-none" style={{ top: `${yPct}%` }}>
                <div className="border-t border-dashed border-gray-200/60 w-full" />
                <span className="absolute -left-1 -translate-x-full -translate-y-1/2 text-[8px] text-gray-300 font-bold">{v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}</span>
              </div>
            );
          });
        })()}
        <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path
            d={
              lineDots.map((d, i) => {
                const y = getY(d.volume);
                return `${i === 0 ? "M" : "L"} ${d.xPct} ${y}`;
              }).join(" ") + ` L ${lineDots[lineDots.length - 1].xPct} 100 L ${lineDots[0].xPct} 100 Z`
            }
            fill="url(#volumeGradient)"
          />
          <defs>
            <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2D6A4F" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#2D6A4F" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d={lineDots.map((d, i) => {
              const y = getY(d.volume);
              return `${i === 0 ? "M" : "L"} ${d.xPct} ${y}`;
            }).join(" ")}
            fill="none" stroke="#2D6A4F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"
          />
        </svg>
        {allDots.map((d, i) => {
          const yPct = getY(d.volume);
          const isActive = activeVolumeDot === i;
          return (
            <button type="button" key={i} className="absolute z-10 flex items-center justify-center"
              style={{ left: `${d.xPct}%`, top: `${yPct}%`, transform: "translate(-50%, -50%)", width: 44, height: 44, background: "none", border: "none", padding: 0 }}
              onPointerUp={(e) => { e.stopPropagation(); setActiveVolumeDot(isActive ? null : i); }}
            >
              {isActive && (
                <span className="absolute -top-7 text-[10px] font-black text-gray-700 bg-white px-1.5 py-0.5 rounded shadow-sm border border-gray-100 z-20 whitespace-nowrap pointer-events-none">
                  {Math.round(toDisp(d.volume)).toLocaleString()}{unitLabels.weight}
                </span>
              )}
              <div className={`rounded-full transition-transform ${isActive ? "scale-150" : ""} w-2 h-2 bg-white border-2 border-[#2D6A4F]`} />
            </button>
          );
        })}
      </div>
      <div className="relative text-[9px] text-gray-300 font-medium mx-5">
        <span className="absolute left-0 -translate-x-1/2">{recentGroups[0].dateStr}</span>
        <span className="absolute right-0 translate-x-1/2">{recentGroups[recentGroups.length - 1].dateStr}</span>
        <span>&nbsp;</span>
      </div>
    </div>
  );
};
