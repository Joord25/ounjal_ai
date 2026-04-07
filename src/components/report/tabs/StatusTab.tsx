"use client";

import React from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { HexagonChart, type HexagonAxis } from "../HexagonChart";
import {
  type FitnessCategory,
  type CategoryPercentile,
  getCategoryBestBwRatio,
  bwRatioToPercentile,
  computeOverallPercentile,
  computeFitnessAge,
  percentileToRank,
  getAgeGroupLabel,
} from "@/utils/fitnessPercentile";
import { WorkoutHistory } from "@/constants/workout";

export interface StatusTabProps {
  exercises: { name: string }[];
  logs: Record<number, { weightUsed?: string; repsCompleted: number }[]>;
  recentHistory: WorkoutHistory[];
  bodyWeightKg: number;
  gender: "male" | "female";
  age: number;
  onHelpPress?: () => void;
}

const CATEGORY_LABELS: Record<FitnessCategory, { ko: string; en: string }> = {
  chest: { ko: "가슴", en: "Chest" },
  back: { ko: "등", en: "Back" },
  shoulder: { ko: "어깨", en: "Shoulder" },
  legs: { ko: "하체", en: "Legs" },
  cardio: { ko: "체력", en: "Cardio" },
};

const CATEGORIES: FitnessCategory[] = ["chest", "back", "shoulder", "legs", "cardio"];

/** [나] 탭 — 육각형 레이더 + 피트니스 나이 (회의 37) */
export const StatusTab: React.FC<StatusTabProps> = ({
  exercises,
  logs,
  recentHistory,
  bodyWeightKg,
  gender,
  age,
  onHelpPress,
}) => {
  const { t, locale } = useTranslation();
  const isKo = locale === "ko";

  // 카테고리별 BW ratio 추출
  const bestByCategory = getCategoryBestBwRatio(
    exercises,
    logs,
    recentHistory,
    bodyWeightKg,
  );

  // 카테고리별 퍼센타일 계산
  const categoryPercentiles: CategoryPercentile[] = CATEGORIES.map((cat) => {
    const bwRatio = bestByCategory.get(cat);
    if (bwRatio === undefined || bwRatio <= 0) {
      return { category: cat, rank: 50, percentile: 50, bwRatio: 0, hasData: false };
    }
    const percentile = bwRatioToPercentile(bwRatio, cat, gender, age);
    return {
      category: cat,
      rank: percentileToRank(percentile),
      percentile,
      bwRatio,
      hasData: true,
    };
  });

  // 종합 퍼센타일
  const overallPercentile = computeOverallPercentile(categoryPercentiles);
  const overallRank = percentileToRank(overallPercentile);

  // 피트니스 나이
  const fitnessAge = computeFitnessAge(overallPercentile, age, gender);
  const ageDiff = age - fitnessAge;

  // 데이터가 하나라도 있는지
  const hasAnyData = categoryPercentiles.some((c) => c.hasData);

  // 육각형 축 데이터 (5개 + 종합 = 6)
  const hexAxes: HexagonAxis[] = [
    ...categoryPercentiles.map((cp) => ({
      label: isKo ? CATEGORY_LABELS[cp.category].ko : CATEGORY_LABELS[cp.category].en,
      value: cp.hasData ? cp.percentile : 0,
      rankText: cp.hasData
        ? `${cp.rank}${isKo ? "등" : "th"}`
        : (isKo ? "-" : "-"),
    })),
    {
      label: isKo ? "종합" : "Overall",
      value: hasAnyData ? overallPercentile : 0,
      rankText: hasAnyData
        ? `${overallRank}${isKo ? "등" : "th"}`
        : "-",
    },
  ];

  const ageGroupLabel = getAgeGroupLabel(age, locale);
  const genderLabel = isKo ? (gender === "male" ? "남성" : "여성") : (gender === "male" ? "men" : "women");

  return (
    <div className="space-y-4">
      {/* 피트니스 나이 */}
      {hasAnyData && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm text-center relative">
          {onHelpPress && (
            <button onClick={onHelpPress} className="absolute top-4 right-4 w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
              <span className="text-[11px] font-black text-gray-400">?</span>
            </button>
          )}
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
            {t("report.status.fitnessAge")}
          </p>
          <p className="text-3xl font-black text-[#1B4332]">
            {fitnessAge}{isKo ? "세" : ""}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {ageDiff > 0
              ? (isKo ? `실제 나이보다 ${ageDiff}살 젊은 몸이에요` : `${ageDiff} years younger than your age`)
              : ageDiff === 0
                ? (isKo ? "딱 나이만큼 건강해요" : "Right on track for your age")
                : (isKo ? "지금부터 시작하면 빠르게 달라져요" : "Start now and you'll improve fast")
            }
          </p>
        </div>
      )}

      {/* 육각형 레이더 */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm relative">
        {onHelpPress && (
          <button onClick={onHelpPress} className="absolute top-4 right-4 w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
            <span className="text-[11px] font-black text-gray-400">?</span>
          </button>
        )}
        <p className="text-sm font-black text-[#1B4332] text-center mb-1">
          {isKo
            ? `${ageGroupLabel} ${genderLabel} 100명 중`
            : `Among 100 ${ageGroupLabel} ${genderLabel}`}
        </p>
        <HexagonChart axes={hexAxes} />
        {hasAnyData && (
          <div className="text-center mt-3">
            <p className="text-lg font-black text-[#1B4332]">
              {isKo ? `종합 ${overallRank}등` : `Overall rank: ${overallRank}`}
            </p>
          </div>
        )}
        {!hasAnyData && (
          <p className="text-center text-xs text-gray-400 mt-2">
            {isKo ? "운동 기록이 쌓이면 나의 위치가 보여요" : "Your ranking will appear as you log workouts"}
          </p>
        )}
      </div>
    </div>
  );
};
