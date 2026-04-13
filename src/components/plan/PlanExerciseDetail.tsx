"use client";

import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { ExerciseStep, deriveSetDetails, getExerciseMuscleGroups } from "@/constants/workout";
import { getExerciseName } from "@/utils/exerciseName";
import { getMuscleColor } from "./muscleColor";
import { getVideoEmbedUrl, getYoutubeSearchUrl } from "@/constants/exerciseVideos";

interface PlanExerciseDetailProps {
  exercise: ExerciseStep;
  globalIdx: number;
  onUpdateSetDetail: (idx: number, setIdx: number, patch: { reps?: number; weight?: string }) => void;
  onAddSet: (idx: number) => void;
  onRemoveSet: (idx: number, setIdx: number) => void;
  onSwap: (idx: number) => void;
  onDelete: (idx: number) => void;
  onFormGuide: (ex: ExerciseStep) => void;
  canDelete: boolean;
  canSwap: boolean;
}

type ActivePill = { setIdx: number; field: "reps" | "weight" } | null;

/** Kenko Add Sets 카드 — 운동 헤더 · SET 행 · ADD SET · 액션바 */
export const PlanExerciseDetail: React.FC<PlanExerciseDetailProps> = ({
  exercise, globalIdx,
  onUpdateSetDetail, onAddSet, onRemoveSet,
  onSwap, onDelete, onFormGuide,
  canDelete, canSwap,
}) => {
  const { locale, t } = useTranslation();
  const setDetails = deriveSetDetails(exercise);
  const muscleGroups = getExerciseMuscleGroups(exercise.name);
  const color = getMuscleColor(exercise.name);
  const hasWeight = exercise.type === "strength" || (exercise.weight && exercise.weight !== "Bodyweight" && exercise.weight !== "맨몸");
  const isTimeBased = exercise.type === "warmup" || exercise.type === "cardio" || /분|초|min|sec/i.test(exercise.count);

  const [active, setActive] = useState<ActivePill>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) setActive(null);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [active]);

  const parseWeight = (w?: string): number => {
    if (!w) return 0;
    const m = w.match(/(\d+(?:\.\d+)?)/);
    return m ? parseFloat(m[1]) : 0;
  };

  const isActive = (setIdx: number, field: "reps" | "weight") =>
    active && active.setIdx === setIdx && active.field === field;

  return (
    <div ref={cardRef} className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <div className={`w-11 h-11 rounded-xl ${color.bg} flex items-center justify-center shrink-0`}>
          <span className={`text-base font-black ${color.fg}`}>
            {muscleGroups[0]?.[0] || "?"}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-black text-[#1B4332] leading-tight">
            {getExerciseName(exercise.name, locale)}
          </h2>
          {muscleGroups.length > 0 && (
            <div className="flex gap-1 mt-1 flex-wrap">
              {muscleGroups.map((g) => (
                <span key={g} className="text-[10px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                  {g}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="h-px bg-gray-100 mx-4" />

      {/* 세트 리스트 */}
      {!isTimeBased && (
        <div className="flex flex-col px-4 py-2">
          {setDetails.map((set, i) => {
            const weightKg = parseWeight(set.weight);
            const repsActive = isActive(i, "reps");
            const weightActive = isActive(i, "weight");
            return (
              <div key={`${globalIdx}-set-${i}`} className="flex items-center py-3 gap-2 border-b border-gray-100 last:border-b-0">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] w-10 shrink-0">
                  SET <span className="font-plan-num">{i + 1}</span>
                </span>

                {/* weight pill (좌측) */}
                {hasWeight && (
                  <>
                    <div className="flex-1 flex items-center justify-center">
                      <PillEditor
                        value={weightKg}
                        label="kg"
                        color="text-[#2D6A4F]"
                        active={!!weightActive}
                        onActivate={() => setActive({ setIdx: i, field: "weight" })}
                        onDecrement={() => onUpdateSetDetail(globalIdx, i, { weight: `${Math.max(0, weightKg - 2.5)}kg` })}
                        onIncrement={() => onUpdateSetDetail(globalIdx, i, { weight: `${weightKg + 2.5}kg` })}
                      />
                    </div>
                    <span className="text-gray-300 text-xs shrink-0">×</span>
                  </>
                )}

                {/* reps pill (우측) */}
                <div className="flex-1 flex items-center justify-center">
                  <PillEditor
                    value={set.reps}
                    label={t("plan.reps")}
                    color="text-[#1B4332]"
                    active={!!repsActive}
                    onActivate={() => setActive({ setIdx: i, field: "reps" })}
                    onDecrement={() => onUpdateSetDetail(globalIdx, i, { reps: Math.max(1, set.reps - 1) })}
                    onIncrement={() => onUpdateSetDetail(globalIdx, i, { reps: Math.min(100, set.reps + 1) })}
                  />
                </div>

                {/* 세트 삭제 */}
                {setDetails.length > 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onRemoveSet(globalIdx, i); }}
                    className="w-6 h-6 rounded-md text-gray-300 hover:text-red-500 flex items-center justify-center active:scale-90 transition-all shrink-0"
                    aria-label={t("plan.delete")}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })}

          {/* ADD SET */}
          <button
            onClick={() => onAddSet(globalIdx)}
            className="w-full py-2.5 mt-2 mb-1 text-[#2D6A4F] font-bold text-xs tracking-wider flex items-center justify-center gap-1 active:scale-[0.98] transition-all border border-dashed border-gray-300 rounded-lg hover:bg-emerald-50/30"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" d="M12 5v14M5 12h14" />
            </svg>
            {t("plan.add_set")}
          </button>
        </div>
      )}

      {/* 시간 기반 */}
      {isTimeBased && (
        <div className="py-6 text-center">
          <span className="font-plan-num text-2xl font-bold text-[#1B4332]">
            {exercise.count}
          </span>
        </div>
      )}

      <div className="h-px bg-gray-100" />

      {/* 액션바 — 교체 / 삭제 (자세 가이드는 카드 내부 미리보기로 이동) */}
      <div className="flex items-stretch divide-x divide-gray-100">
        {canSwap && (
          <button
            onClick={() => onSwap(globalIdx)}
            className="flex-1 flex items-center justify-center gap-1.5 py-3 text-gray-600 active:bg-gray-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
            </svg>
            <span className="text-[11px] font-bold">{t("plan.swap")}</span>
          </button>
        )}
        {canDelete && (
          <button
            onClick={() => onDelete(globalIdx)}
            className="flex-1 flex items-center justify-center gap-1.5 py-3 text-red-500 active:bg-red-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span className="text-[11px] font-bold">{t("plan.delete")}</span>
          </button>
        )}
      </div>

      {/* 자세 가이드 미리보기 — 카드 최하단 (FitScreen 사이즈) */}
      {(() => {
        const embedUrl = getVideoEmbedUrl(exercise.name);
        if (!embedUrl) return null;
        const searchUrl = getYoutubeSearchUrl(exercise.name);
        return (
          <div className="px-4 pt-3 pb-4 flex justify-center">
            <button
              onClick={() => window.open(searchUrl, "_blank")}
              className="aspect-[9/16] max-h-[40dvh] rounded-2xl overflow-hidden bg-black relative shadow-lg active:scale-[0.97] transition-all"
            >
              <iframe
                src={embedUrl}
                className="w-full h-full pointer-events-none scale-[1.15] origin-center"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                tabIndex={-1}
                title={t("plan.form_guide")}
              />
              <div className="absolute inset-0 flex items-end justify-end p-2 pointer-events-none">
                <div className="px-2 py-1 rounded-lg bg-black/50 backdrop-blur-sm flex items-center gap-1">
                  <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                  <span className="text-[9px] font-bold text-white">{t("plan.form_guide")}</span>
                </div>
              </div>
            </button>
          </div>
        );
      })()}
    </div>
  );
};

/** 숫자 pill — 기본은 숫자+라벨 세로 스택, 활성화 시 ± 좌우 펼침 */
interface PillEditorProps {
  value: number;
  label: string;
  color: string;
  active: boolean;
  onActivate: () => void;
  onDecrement: () => void;
  onIncrement: () => void;
}
const PillEditor: React.FC<PillEditorProps> = ({ value, label, color, active, onActivate, onDecrement, onIncrement }) => {
  if (!active) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); onActivate(); }}
        className="flex flex-col items-center justify-center py-1 px-3 rounded-full active:bg-gray-50 transition-colors min-w-[52px]"
      >
        <span className={`font-plan-num text-[20px] font-bold leading-none ${color}`}>
          {value}
        </span>
        <span className="text-[10px] font-medium text-gray-400 mt-0.5">{label}</span>
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1 rounded-full bg-gray-50 ring-1 ring-[#1B4332]/20 px-1.5 py-1">
      <button
        onClick={(e) => { e.stopPropagation(); onDecrement(); }}
        aria-label={`decrement ${label}`}
        className="w-6 h-6 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-600 active:scale-90 transition-all"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" d="M5 12h14" />
        </svg>
      </button>
      <div className="flex flex-col items-center justify-center min-w-[36px]">
        <span className={`font-plan-num text-[18px] font-bold leading-none ${color}`}>
          {value}
        </span>
        <span className="text-[9px] font-medium text-gray-400 mt-0.5">{label}</span>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onIncrement(); }}
        aria-label={`increment ${label}`}
        className="w-6 h-6 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-600 active:scale-90 transition-all"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" d="M12 5v14M5 12h14" />
        </svg>
      </button>
    </div>
  );
};
