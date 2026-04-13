"use client";

import React from "react";
import { ExerciseStep } from "@/constants/workout";
import { PlanExerciseDetail } from "./PlanExerciseDetail";
import { getMuscleColor } from "./muscleColor";
import { getExerciseName } from "@/utils/exerciseName";

interface PlanSelectedPaneProps {
  mode: "full" | "peek";
  exercise: ExerciseStep | null;
  globalIdx: number | null;
  canDelete: boolean;
  canSwap: boolean;
  locale: string;
  t: (key: string, vars?: Record<string, string>) => string;
  onUpdateSetDetail: (exerciseIdx: number, setIdx: number, patch: { reps?: number; weight?: string }) => void;
  onAddSet: (exerciseIdx: number) => void;
  onRemoveSet: (exerciseIdx: number, setIdx: number) => void;
  onSwap: (idx: number) => void;
  onDelete: (idx: number) => void;
  onFormGuide: (ex: ExerciseStep) => void;
  onUpdateCount?: (idx: number, newCount: string) => void;
}

/**
 * SELECTED pane — LIBRARY에서 운동 클릭 시 뜨는 상세 편집 화면.
 * Phase 2: 기존 PlanExerciseDetail을 그대로 사용 (Kenko 카드 재설계는 Phase 3).
 * mode === "peek": 우측 20% 영역에서 세로 스트립 형태로 힌트 표시.
 */
export const PlanSelectedPane: React.FC<PlanSelectedPaneProps> = ({
  mode,
  exercise,
  globalIdx,
  canDelete,
  canSwap,
  locale,
  t,
  onUpdateSetDetail,
  onAddSet,
  onRemoveSet,
  onSwap,
  onDelete,
  onFormGuide,
  onUpdateCount,
}) => {
  if (mode === "peek") {
    const color = exercise ? getMuscleColor(exercise.name) : null;
    const name = exercise ? getExerciseName(exercise.name, locale) : null;
    return (
      <div className="h-full flex flex-col items-center justify-start pt-6 gap-2 bg-white border-l border-gray-200 pointer-events-none">
        {color && (
          <span
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: color.hex }}
          />
        )}
        <div
          className="text-[10px] font-bold text-gray-400 tracking-[0.2em]"
          style={{ writingMode: "vertical-rl", textOrientation: "upright" }}
        >
          {name ? name.slice(0, 8) : t("plan.peek_detail")}
        </div>
      </div>
    );
  }

  if (!exercise || globalIdx === null) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-6 text-center bg-white">
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
          </svg>
        </div>
        <p className="text-sm font-bold text-gray-500">
          {t("plan.empty_selected")}
        </p>
      </div>
    );
  }

  return (
    <div
      className="h-full overflow-y-auto px-3 pt-4 scrollbar-hide bg-white min-w-0"
      style={{ paddingBottom: "120px" }}
    >
      <PlanExerciseDetail
        exercise={exercise}
        globalIdx={globalIdx}
        onUpdateSetDetail={onUpdateSetDetail}
        onAddSet={onAddSet}
        onRemoveSet={onRemoveSet}
        onSwap={onSwap}
        onDelete={onDelete}
        onFormGuide={onFormGuide}
        onUpdateCount={onUpdateCount}
        canDelete={canDelete}
        canSwap={canSwap}
      />
    </div>
  );
};
