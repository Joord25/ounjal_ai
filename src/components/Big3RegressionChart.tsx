"use client";

import React from "react";
import { WorkoutHistory } from "@/constants/workout";
import { useTranslation } from "@/hooks/useTranslation";
import { calcE1RMTrendByExercise } from "@/utils/predictionUtils";
import { type FitnessProfile } from "./FitnessReading";

export function Big3RegressionChart({ history, profile }: { history: WorkoutHistory[]; profile: FitnessProfile }) {
  const { locale } = useTranslation();
  const byEx = calcE1RMTrendByExercise(history);
  const [activeIdx, setActiveIdx] = React.useState(0);

  if (byEx.length === 0) {
    return (
      <div className="bg-[#FAFBF9] rounded-xl p-4 text-center">
        <p className="text-xs text-gray-400">3대 운동(벤치/스쿼트/데드) 기록이 2회 이상 필요합니다</p>
      </div>
    );
  }

  const ex = byEx[activeIdx % byEx.length];
  const { regression: reg, points } = ex;

  const targetLine = profile.bodyWeight * 1.0;
  const targetLabel = locale === "en" ? `Inter. ${Math.round(targetLine)}kg` : `중급 ${Math.round(targetLine)}kg`;
  const lastX = points[points.length - 1].x;
  const lastY = points[points.length - 1].y;
  const predX = lastX + 28;
  // 예측값 클램핑: 현재값의 1.5배 또는 체중의 3배 중 큰 값을 상한으로
  const maxReasonable = Math.max(lastY * 1.5, profile.bodyWeight * 3);
  const rawPredY = reg.predict(predX);
  const predY = Math.round(Math.max(0, Math.min(rawPredY, maxReasonable)) * 10) / 10;

  const W = 300, H = 160, PAD = { top: 20, right: 15, bottom: 30, left: 40 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const allY = [...points.map(p => p.y), predY, targetLine];
  const minY = Math.max(0, Math.min(...allY) * 0.9);
  const maxY = Math.max(...allY) * 1.1;
  const rangeY = maxY - minY || 1;
  const minX = points[0].x;
  const rangeX = predX - minX || 1;
  const toSvgX = (x: number) => PAD.left + ((x - minX) / rangeX) * chartW;
  const toSvgY = (y: number) => PAD.top + (1 - (y - minY) / rangeY) * chartH;
  const dotPositions = points.map(p => ({ cx: toSvgX(p.x), cy: toSvgY(p.y), label: p.label }));
  const regLineStart = { x: toSvgX(minX), y: toSvgY(reg.predict(minX)) };
  const regLineEnd = { x: toSvgX(lastX), y: toSvgY(reg.predict(lastX)) };
  const predLineEnd = { x: toSvgX(predX), y: toSvgY(predY) };
  const r2Explain = reg.r2 >= 0.7 ? (locale === "en" ? "High confidence" : "높은 신뢰도") : reg.r2 >= 0.4 ? (locale === "en" ? "Moderate confidence" : "보통 신뢰도") : (locale === "en" ? "Low confidence (high variance)" : "낮은 신뢰도 (데이터 변동 큼)");

  return (
    <div className="bg-[#FAFBF9] rounded-xl p-3" onClick={(e) => e.stopPropagation()}>
      {/* 종목 탭 */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-bold text-[#1B4332]">{locale === "en" ? ex.label.replace("벤치프레스", "Bench Press").replace("스쿼트", "Squat").replace("데드리프트", "Deadlift") : ex.label} {locale === "en" ? "e1RM Prediction" : "e1RM 예측"}</p>
        </div>
        <p className="text-[9px] text-gray-400">R² = {Math.round(reg.r2 * 100)}% ({r2Explain})</p>
      </div>
      {byEx.length > 1 && (
        <div className="flex gap-1.5 mb-3">
          {byEx.map((ex, i) => (
            <button
              key={ex.name}
              onClick={(ev) => { ev.stopPropagation(); setActiveIdx(i); }}
              className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                i === activeIdx % byEx.length ? "bg-[#1B4332] text-white" : "bg-gray-100 text-gray-500"
              }`}
            >
              {locale === "en" ? ex.label.replace("벤치프레스", "Bench Press").replace("스쿼트", "Squat").replace("데드리프트", "Deadlift") : ex.label}
            </button>
          ))}
        </div>
      )}

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 180 }}>
        <text x={PAD.left - 5} y={PAD.top - 6} textAnchor="end" className="fill-gray-400" fontSize="8">e1RM (kg)</text>
        {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
          const y = PAD.top + (1 - pct) * chartH;
          const val = minY + pct * rangeY;
          return (
            <g key={i}>
              <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#e5e7eb" strokeWidth="0.5" />
              <text x={PAD.left - 4} y={y + 3} textAnchor="end" className="fill-gray-400" fontSize="8">{Math.round(val)}</text>
            </g>
          );
        })}
        <g>
          <line x1={PAD.left} y1={toSvgY(targetLine)} x2={W - PAD.right} y2={toSvgY(targetLine)} stroke="#059669" strokeWidth="1" strokeDasharray="4 2" opacity="0.5" />
          <text x={W - PAD.right} y={toSvgY(targetLine) - 4} textAnchor="end" className="fill-emerald-600" fontSize="7" fontWeight="bold">{targetLabel}</text>
        </g>
        <line x1={regLineStart.x} y1={regLineStart.y} x2={regLineEnd.x} y2={regLineEnd.y} stroke="#2D6A4F" strokeWidth="1.5" opacity="0.6" />
        <line x1={regLineEnd.x} y1={regLineEnd.y} x2={predLineEnd.x} y2={predLineEnd.y} stroke="#2D6A4F" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.4" />
        <circle cx={predLineEnd.x} cy={predLineEnd.y} r="4" fill="none" stroke="#2D6A4F" strokeWidth="1.5" strokeDasharray="2 2" />
        <text x={predLineEnd.x} y={predLineEnd.y - 8} textAnchor="middle" className="fill-emerald-700" fontSize="8" fontWeight="bold">{predY}</text>
        <text x={predLineEnd.x} y={H - 5} textAnchor="middle" className="fill-gray-400" fontSize="7">{locale === "en" ? "4 wks" : "4주 후"}</text>
        {dotPositions.map((d, i) => (
          <g key={i}>
            <circle cx={d.cx} cy={d.cy} r="3" fill="#2D6A4F" />
            {(i === 0 || i === dotPositions.length - 1) && (
              <text x={d.cx} y={d.cy - 7} textAnchor="middle" className="fill-gray-600" fontSize="7">{d.label}</text>
            )}
          </g>
        ))}
        <text x={PAD.left} y={H - 5} textAnchor="start" className="fill-gray-400" fontSize="7">{locale === "en" ? "Start" : "시작"}</text>
        <text x={toSvgX(lastX)} y={H - 5} textAnchor="middle" className="fill-gray-400" fontSize="7">{locale === "en" ? "Now" : "현재"}</text>
      </svg>
      <p className="text-[9px] text-gray-400 mt-1 text-right">
        {(() => {
          // 주간 변화량 클램핑: ±20kg/주 초과는 비현실적
          const clamped = Math.max(-20, Math.min(20, ex.growthPerWeek));
          const symbol = clamped > 0 ? "▲" : clamped < 0 ? "▼" : "—";
          return locale === "en" ? `${symbol} ${clamped > 0 ? "+" : ""}${clamped}kg/wk` : `${symbol} 주간 ${clamped > 0 ? "+" : ""}${clamped}kg/주`;
        })()}
      </p>
    </div>
  );
}
