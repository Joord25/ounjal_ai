"use client";

import React from "react";
import { WorkoutHistory } from "@/constants/workout";
import { useTranslation } from "@/hooks/useTranslation";
import { linearRegression, dateToDayIndex, calcCalorieBalanceTrend } from "@/utils/predictionUtils";
import { type FitnessProfile } from "./FitnessReading";

export function RegressionChart({ goal, history, weightLog, profile }: {
  goal: string;
  history: WorkoutHistory[];
  weightLog: { date: string; weight: number }[];
  profile: FitnessProfile;
}) {
  const { locale } = useTranslation();
  // 목표별 데이터 포인트 + 회귀선 + 예측 구간 생성
  const chartData = React.useMemo(() => {
    const sorted = [...history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    if (sorted.length < 2) return null;

    let points: { x: number; y: number; label: string }[] = [];
    let yLabel = "";
    let targetLine: number | null = null;
    let targetLabel = "";

    const baseDate = sorted[0].date;

    if (goal === "fat_loss") {
      // 칼로리 밸런스 누적 추이 (섭취 - BMR - 운동소모)
      const age = new Date().getFullYear() - profile.birthYear;
      const h = profile.height || 170;
      const balanceTrend = calcCalorieBalanceTrend(sorted, profile.gender, profile.bodyWeight, h, age);
      if (balanceTrend && balanceTrend.points.length >= 2) {
        points = balanceTrend.points;
        yLabel = locale === "en" ? "Calorie balance (kcal)" : "칼로리 밸런스 (kcal)";
        // 7700kcal 적자 = -1kg, 목표 -5kg = -38500kcal
        targetLine = -38500;
        targetLabel = "-5kg 감량 라인";
      } else {
        return null;
      }
    } else if (goal === "muscle_gain") {
      // 운동별 e1RM — 선택된 종목 데이터만 사용
      return null; // muscle_gain은 별도 컴포넌트(Big3RegressionChart)에서 처리
    } else {
      // 체력/건강: 주간 운동 빈도 (주차별 집계)
      const weekMap = new Map<number, number>();
      sorted.forEach(s => {
        const week = Math.floor(dateToDayIndex(s.date, baseDate) / 7);
        weekMap.set(week, (weekMap.get(week) || 0) + 1);
      });
      const weeks = Array.from(weekMap.entries()).sort((a, b) => a[0] - b[0]);
      if (weeks.length < 2) return null;
      // 회의 22: 차트 라벨 locale 반영
      const isEnLoc = locale === "en";
      points = weeks.map(([w, freq]) => ({ x: w, y: freq, label: isEnLoc ? `${freq}x` : `${freq}회` }));
      yLabel = isEnLoc ? "Weekly workouts" : "주간 운동 횟수";
      targetLine = Math.ceil(150 / profile.sessionMinutes);
      targetLabel = isEnLoc ? `WHO target ${targetLine}x/wk` : `WHO 권장 ${targetLine}회/주`;
    }

    if (points.length < 2) return null;

    const reg = linearRegression(points.map(p => ({ x: p.x, y: p.y })));
    if (!reg) return null;

    // 예측 구간: 마지막 포인트부터 4주(28일) 또는 4주차 앞
    const lastX = points[points.length - 1].x;
    const predStep = goal === "endurance" || goal === "health" ? 4 : 28;
    const predX = lastX + predStep;
    const rawPredY = reg.predict(predX);
    // 예측값 클램핑: 음수 방지, 소수점 반올림
    const predY = Math.round(Math.max(0, rawPredY) * 10) / 10;

    return { points, reg, yLabel, targetLine, targetLabel, lastX, predX, predY };
  }, [goal, history, weightLog, profile]);

  if (!chartData) {
    return (
      <div className="bg-[#FAFBF9] rounded-xl p-4 text-center">
        <p className="text-xs text-gray-400">{history.length === 0 ? "운동 기록 2회 이상 필요합니다" : `${2 - history.length}회만 더 운동하면 그래프가 표시됩니다`}</p>
      </div>
    );
  }

  const { points, reg, yLabel, targetLine, targetLabel, lastX, predX, predY } = chartData;

  // SVG 좌표 계산
  const W = 300, H = 160, PAD = { top: 20, right: 15, bottom: 30, left: 40 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const isFatLoss = goal === "fat_loss";
  // fat_loss: targetLine(-38500)은 스케일 계산에서 제외 (너무 큰 값)
  const dataY = [...points.map(p => p.y), predY];
  const allY = [...dataY, ...(targetLine && !isFatLoss ? [targetLine] : [])];

  let minY: number, maxY: number;
  if (isFatLoss) {
    // fat_loss: 0을 중앙에 배치, 데이터 범위 기준 대칭
    const absMax = Math.max(Math.abs(Math.min(...dataY)), Math.abs(Math.max(...dataY)), 500) * 1.2;
    minY = -absMax;
    maxY = absMax;
  } else {
    minY = Math.max(0, Math.min(...allY) * 0.9);
    maxY = Math.max(...allY) * 1.1;
  }
  const rangeY = maxY - minY || 1;

  const minX = points[0].x;
  const rangeX = predX - minX || 1;

  const toSvgX = (x: number) => PAD.left + ((x - minX) / rangeX) * chartW;
  // fat_loss: Y축 반전 (적자가 아래로)
  const toSvgY = isFatLoss
    ? (y: number) => PAD.top + ((y - minY) / rangeY) * chartH  // 반전: 음수가 아래
    : (y: number) => PAD.top + (1 - (y - minY) / rangeY) * chartH;

  // 실제 데이터 점
  const dotPositions = points.map(p => ({ cx: toSvgX(p.x), cy: toSvgY(p.y), label: p.label }));

  // 회귀선 (시작 ~ 마지막 데이터)
  const regLineStart = { x: toSvgX(minX), y: toSvgY(reg.predict(minX)) };
  const regLineEnd = { x: toSvgX(lastX), y: toSvgY(reg.predict(lastX)) };

  // 예측 점선 (마지막 데이터 ~ 미래)
  const predLineEnd = { x: toSvgX(predX), y: toSvgY(predY) };

  const [showHelp, setShowHelp] = React.useState(false);

  const goalHelpMap: Record<string, string> = {
    fat_loss: "매 운동의 칼로리 소모를 추정하고, 섭취 칼로리(다이어트 기준)에서 기초대사량과 운동 소모를 뺀 누적 밸런스를 추적합니다. 점선은 현재 추세가 유지될 경우 4주 후 예상 누적 적자입니다. 7,700kcal 적자 ≈ 1kg 감량.",
    muscle_gain: "매 세션의 Best e1RM(추정 1회 최대 중량)을 추적합니다. 회귀선은 근력 성장 추세이고, 점선은 이 속도로 4주 뒤 도달할 e1RM 예측입니다.",
    endurance: "주차별 운동 횟수를 집계하여 운동 습관 추세를 보여줍니다. 점선은 WHO 권장 기준 대비 현재 추세의 4주 후 예측입니다.",
    health: "주차별 운동 횟수를 집계하여 운동 습관 추세를 보여줍니다. 점선은 WHO 권장 기준 대비 현재 추세의 4주 후 예측입니다.",
  };

  const r2Explain = reg.r2 >= 0.7 ? (locale === "en" ? "High confidence" : "높은 신뢰도") : reg.r2 >= 0.4 ? (locale === "en" ? "Moderate confidence" : "보통 신뢰도") : (locale === "en" ? "Low confidence (high variance)" : "낮은 신뢰도 (데이터 변동 큼)");

  return (
    <div className="bg-[#FAFBF9] rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-bold text-[#1B4332]">{locale === "en" ? "Regression Prediction" : "회귀분석 예측"}</p>
          <button onClick={() => setShowHelp(!showHelp)} className="w-4 h-4 rounded-full bg-[#2D6A4F]/10 flex items-center justify-center">
            <span className="text-[9px] font-black text-[#2D6A4F]">?</span>
          </button>
        </div>
        <p className="text-[9px] text-gray-400">R² = {Math.round(reg.r2 * 100)}% ({r2Explain})</p>
      </div>

      {showHelp && (
        <div className="absolute inset-0 z-[70] flex items-center justify-center animate-fade-in" onClick={() => setShowHelp(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
          <div className="bg-white rounded-2xl p-5 shadow-2xl mx-8 relative z-10 max-w-[320px]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-[#1B4332]">그래프 읽는 법</p>
              <button onClick={() => setShowHelp(false)} className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
                <span className="text-xs text-gray-400">✕</span>
              </button>
            </div>
            <p className="text-[12px] text-gray-600 leading-relaxed mb-4">{goalHelpMap[goal] || goalHelpMap.health}</p>
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-[#2D6A4F] inline-block shrink-0" />
                <span className="text-[11px] text-[#1B4332] font-medium">실제 데이터 (운동 기록)</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-5 h-0 border-t-2 border-[#2D6A4F]/60 inline-block shrink-0" />
                <span className="text-[11px] text-[#1B4332] font-medium">추세선</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-5 h-0 border-t-2 border-dashed border-[#2D6A4F]/40 inline-block shrink-0" />
                <span className="text-[11px] text-[#1B4332] font-medium">4주 후 예측</span>
              </div>
              {targetLine && (
                <div className="flex items-center gap-3">
                  <span className="w-5 h-0 border-t border-dashed border-emerald-600/50 inline-block shrink-0" />
                  <span className="text-[11px] text-[#1B4332] font-medium">목표 라인</span>
                </div>
              )}
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100">
              <p className="text-[11px] text-gray-500 leading-relaxed">
                <span className="font-bold text-[#2D6A4F]">R²(신뢰도)</span> — 100%에 가까울수록 예측이 정확합니다
              </p>
            </div>
          </div>
        </div>
      )}

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 180 }}>
        {/* fat_loss: 0 기준선 배경 영역 */}
        {isFatLoss && (
          <>
            {/* 위쪽 (과잉): 연한 빨강 */}
            <rect x={PAD.left} y={PAD.top} width={chartW} height={toSvgY(0) - PAD.top} fill="#FEE2E2" opacity="0.3" />
            {/* 아래쪽 (적자): 연한 초록 */}
            <rect x={PAD.left} y={toSvgY(0)} width={chartW} height={PAD.top + chartH - toSvgY(0)} fill="#D1FAE5" opacity="0.3" />
            {/* 0 기준선 */}
            <line x1={PAD.left} y1={toSvgY(0)} x2={W - PAD.right} y2={toSvgY(0)} stroke="#6B7280" strokeWidth="1" strokeDasharray="4 2" opacity="0.6" />
            <text x={PAD.left - 4} y={toSvgY(0) + 3} textAnchor="end" className="fill-gray-500" fontSize="8" fontWeight="bold">0</text>
          </>
        )}

        {/* Y축 레이블 */}
        <text x={PAD.left - 5} y={PAD.top - 6} textAnchor="end" className="fill-gray-400" fontSize="8">
          {isFatLoss ? (locale === "en" ? "Surplus ↑" : "과잉 ↑") : yLabel}
        </text>
        {isFatLoss && (
          <text x={PAD.left - 5} y={PAD.top + chartH + 10} textAnchor="end" className="fill-gray-400" fontSize="8">
            {locale === "en" ? "Deficit ↓" : "적자 ↓"}
          </text>
        )}

        {/* Y축 눈금 */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
          const y = PAD.top + (isFatLoss ? pct : (1 - pct)) * chartH;
          const val = minY + pct * rangeY;
          if (isFatLoss && Math.abs(val) < rangeY * 0.05) return null; // 0 근처 눈금 생략 (기준선과 겹침)
          return (
            <g key={i}>
              <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#e5e7eb" strokeWidth="0.5" />
              <text x={PAD.left - 4} y={y + 3} textAnchor="end" className="fill-gray-400" fontSize="8">{Math.round(val)}</text>
            </g>
          );
        })}

        {/* 목표 라인 */}
        {targetLine && (
          <g>
            <line x1={PAD.left} y1={toSvgY(targetLine)} x2={W - PAD.right} y2={toSvgY(targetLine)} stroke="#059669" strokeWidth="1" strokeDasharray="4 2" opacity="0.5" />
            <text x={W - PAD.right} y={toSvgY(targetLine) - 4} textAnchor="end" className="fill-emerald-600" fontSize="7" fontWeight="bold">{targetLabel}</text>
          </g>
        )}

        {/* 회귀선 (실제 구간) */}
        <line x1={regLineStart.x} y1={regLineStart.y} x2={regLineEnd.x} y2={regLineEnd.y} stroke="#2D6A4F" strokeWidth="1.5" opacity="0.6" />

        {/* 예측 점선 (미래 구간) */}
        <line x1={regLineEnd.x} y1={regLineEnd.y} x2={predLineEnd.x} y2={predLineEnd.y} stroke="#2D6A4F" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.4" />

        {/* 예측 포인트 */}
        <circle cx={predLineEnd.x} cy={predLineEnd.y} r="4" fill="none" stroke="#2D6A4F" strokeWidth="1.5" strokeDasharray="2 2" />
        <text x={predLineEnd.x} y={predLineEnd.y - 8} textAnchor="middle" className="fill-emerald-700" fontSize="8" fontWeight="bold">{Math.round(predY * 10) / 10}</text>
        <text x={predLineEnd.x} y={H - 5} textAnchor="middle" className="fill-gray-400" fontSize="7">{locale === "en" ? "4 wks" : "4주 후"}</text>

        {/* 데이터 점 */}
        {dotPositions.map((d, i) => (
          <g key={i}>
            <circle cx={d.cx} cy={d.cy} r="3" fill="#2D6A4F" />
            {/* 첫 번째와 마지막 점에만 라벨 */}
            {(i === 0 || i === dotPositions.length - 1) && (
              <text x={d.cx} y={d.cy - 7} textAnchor="middle" className="fill-gray-600" fontSize="7">{d.label}</text>
            )}
          </g>
        ))}

        {/* X축: 시작/끝 날짜 */}
        <text x={PAD.left} y={H - 5} textAnchor="start" className="fill-gray-400" fontSize="7">{locale === "en" ? "Start" : "시작"}</text>
        <text x={toSvgX(lastX)} y={H - 5} textAnchor="middle" className="fill-gray-400" fontSize="7">{locale === "en" ? "Now" : "현재"}</text>
      </svg>
      <p className="text-[9px] text-gray-400 mt-1 text-right">
        {(() => {
          const arrow = reg.slope > 0 ? "▲" : reg.slope < 0 ? "▼" : "—";
          const val = (goal === "muscle_gain" ? "+" : "") + (Math.round(reg.slope * 7 * 10) / 10);
          const unit = goal === "fat_loss" || goal === "muscle_gain" ? "kg" : (locale === "en" ? "x" : "회");
          // 회의 22: trend 라벨 locale 반영
          return locale === "en"
            ? `${arrow} ${val}${unit}/wk`
            : `${arrow} 주간 ${val}${unit}/주`;
        })()}
      </p>
    </div>
  );
}
