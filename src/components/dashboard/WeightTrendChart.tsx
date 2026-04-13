"use client";

import React from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { useUnits } from "@/hooks/useUnits";
import { kgToLb } from "@/utils/units";

interface WeightTrendChartProps {
  weightLog: { date: string; weight: number }[];
  onViewAll: () => void;
  embedded?: boolean;
}

export const WeightTrendChart: React.FC<WeightTrendChartProps> = ({ weightLog, onViewAll, embedded }) => {
  const { t } = useTranslation();
  const { system: unitSystem, labels: unitLabels } = useUnits();
  const toDisp = (kg: number) => unitSystem === "imperial" ? kgToLb(kg) : kg;

  const sorted = [...weightLog].sort((a, b) => a.date.localeCompare(b.date));
  const recent = sorted.slice(-30);
  if (recent.length === 0) return null;

  const weights = recent.map(e => e.weight);
  const rawMin = Math.min(...weights);
  const rawMax = Math.max(...weights);
  const padding = rawMax - rawMin < 1 ? 2 : (rawMax - rawMin) * 0.2;
  const minW = rawMin - padding;
  const maxW = rawMax + padding;
  const range = maxW - minW;
  const latestWeight = weights[weights.length - 1];
  const firstWeight = weights[0];
  const diff = latestWeight - firstWeight;

  return (
    <div className={embedded ? "overflow-visible transition-all" : "p-4 sm:p-6 bg-white rounded-3xl border border-[#2D6A4F]/10 shadow-sm overflow-visible transition-all"}>
      <div className="flex justify-between items-baseline mb-1">
        {!embedded && (
        <div className="flex items-center gap-2">
          <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em]">{t("proof.weightTrend")}</p>
        </div>
        )}
        <button
          type="button"
          className="flex items-center gap-2 cursor-pointer active:scale-95 transition-transform ml-auto"
          onClick={onViewAll}
        >
          <span className={`text-[10px] font-black ${diff > 0 ? "text-rose-400" : diff < 0 ? "text-sky-400" : "text-gray-400"}`}>
            {diff > 0 ? "+" : ""}{toDisp(diff).toFixed(1)}{unitLabels.weight}
          </span>
          <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
      <div className="flex items-baseline gap-1 mb-1 sm:mb-2">
        <h3 className="text-2xl sm:text-3xl font-black text-[#1B4332]">{toDisp(latestWeight).toFixed(1)}</h3>
        <span className="text-base sm:text-lg text-[#2D6A4F]/50">{unitLabels.weight}</span>
      </div>
      <p className="text-[12px] font-bold text-[#2D6A4F] mb-3">
        {diff <= -1 ? t("proof.weightMsg.losing") : diff <= -0.3 ? t("proof.weightMsg.starting") : diff >= 0.5 ? t("proof.weightMsg.gaining") : t("proof.weightMsg.steady")}
      </p>

      <div className="relative h-36 sm:h-32 mt-2 sm:mt-1 mb-2 mx-5">
        {/* Y-axis reference lines */}
        {(() => {
          const ticks = [rawMin, (rawMin + rawMax) / 2, rawMax];
          return ticks.map((v, ti) => {
            const yPct = 95 - ((v - minW) / range) * 90;
            return (
              <div key={ti} className="absolute left-0 right-0 pointer-events-none" style={{ top: `${yPct}%` }}>
                <div className="border-t border-dashed border-gray-200/60 w-full" />
                <span className="absolute -left-1 -translate-x-full -translate-y-1/2 text-[8px] text-gray-300 font-bold">{v.toFixed(1)}</span>
              </div>
            );
          });
        })()}
        <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path
            d={recent.map((_, i) => {
              const x = recent.length === 1 ? 50 : (i / (recent.length - 1)) * 100;
              const y = 95 - ((weights[i] - minW) / range) * 90;
              return `${i === 0 ? "M" : "L"} ${x} ${y}`;
            }).join(" ") + ` L 100 100 L 0 100 Z`}
            fill="url(#weightGradient)"
          />
          <defs>
            <linearGradient id="weightGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2D6A4F" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#2D6A4F" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d={recent.map((_, i) => {
              const x = recent.length === 1 ? 50 : (i / (recent.length - 1)) * 100;
              const y = 95 - ((weights[i] - minW) / range) * 90;
              if (i === 0) return `M ${x} ${y}`;
              const px = (i - 1) / (recent.length - 1) * 100;
              const py = 95 - ((weights[i - 1] - minW) / range) * 90;
              const t = 0.2;
              return `C ${px + (x - px) * t} ${py}, ${x - (x - px) * t} ${y}, ${x} ${y}`;
            }).join(" ")}
            fill="none" stroke="#2D6A4F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"
          />
        </svg>
        {/* 마지막 점만 표시 */}
        {weights.length > 0 && (() => {
          const lastIdx = weights.length - 1;
          const xPct = weights.length === 1 ? 50 : (lastIdx / (weights.length - 1)) * 100;
          const yPct = 95 - ((weights[lastIdx] - minW) / range) * 90;
          return (
            <div className="absolute z-10" style={{ left: `${xPct}%`, top: `${yPct}%`, transform: "translate(-50%, -50%)" }}>
              <div className="w-3 h-3 rounded-full bg-[#2D6A4F] border-2 border-white shadow-sm" />
            </div>
          );
        })()}
      </div>
      <div className="relative text-[9px] text-gray-300 font-medium mx-5">
        <span className="absolute left-0 -translate-x-1/2">{recent[0].date.slice(5).replace("-", "/")}</span>
        <span className="absolute right-0 translate-x-1/2">{recent[recent.length - 1].date.slice(5).replace("-", "/")}</span>
        <span>&nbsp;</span>
      </div>
    </div>
  );
};
