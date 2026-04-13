"use client";

import React from "react";
import { ExerciseStep, getExerciseMuscleGroups } from "@/constants/workout";
import { getExerciseName } from "@/utils/exerciseName";

interface PhaseBlock {
  key: string;
  label: string;
  exercises: ExerciseStep[];
}

interface PlanLibraryPaneProps {
  mode?: "full" | "peek";
  phases: PhaseBlock[];
  localExercises: ExerciseStep[];
  firstCardRef?: React.RefObject<HTMLDivElement | null>;
  scrollEndRef?: React.RefObject<HTMLDivElement | null>;
  locale: string;
  t: (key: string, vars?: Record<string, string>) => string;
  onSelectExercise: (globalIdx: number) => void;
  onAdjustSets: (globalIdx: number, delta: number) => void;
  onAddExercise: (phaseKey: string) => void;
}

export const PlanLibraryPane: React.FC<PlanLibraryPaneProps> = ({
  mode = "full",
  phases,
  localExercises,
  firstCardRef,
  scrollEndRef,
  locale,
  t,
  onSelectExercise,
  onAdjustSets,
  onAddExercise,
}) => {
  if (mode === "peek") {
    return (
      <div className="h-full flex flex-col items-center justify-start pt-6 gap-2 bg-[#FAFBF9] border-r border-gray-200 pointer-events-none">
        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        <div
          className="text-[10px] font-bold text-gray-400 tracking-[0.2em]"
          style={{ writingMode: "vertical-rl", textOrientation: "upright" }}
        >
          {t("plan.peek_library")}
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex-1 overflow-y-auto px-6 pt-4 scrollbar-hide"
      style={{ paddingBottom: "calc(90px + var(--safe-area-bottom, 0px))" }}
    >
      <div className="flex flex-col gap-6">
        {phases.map((phase, phaseIdx) => (
          <div
            key={phase.key}
            className="animate-slide-in-bottom"
            style={{ animationDelay: `${phaseIdx * 0.08}s` }}
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="text-[11px] font-black text-gray-500 tracking-[0.2em] uppercase shrink-0">
                {phase.label}
              </span>
              <div className="flex-1 h-px bg-gray-300" />
            </div>

            <div className="flex flex-col gap-1">
              {phase.exercises.map((ex, i) => {
                const globalIdx = localExercises.indexOf(ex);
                const canAdjustSets = (ex.type === "strength" || ex.type === "core") && ex.sets > 0;
                const isFirstCard = phaseIdx === 0 && i === 0;
                return (
                  <div
                    key={globalIdx}
                    ref={isFirstCard ? firstCardRef : undefined}
                    className="px-2 py-3.5 border-b border-gray-200 relative transition-colors active:bg-gray-50/70"
                    onClick={() => onSelectExercise(globalIdx)}
                  >
                    <div className="flex justify-between items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-bold block leading-snug text-gray-900">
                          {getExerciseName(ex.name, locale)}
                        </span>
                        {(() => {
                          const groups = getExerciseMuscleGroups(ex.name);
                          if (groups.length === 0) return null;
                          return (
                            <div className="flex gap-1 mt-1 flex-wrap">
                              {groups.map((g) => (
                                <span key={g} className="text-[10px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                                  {g}
                                </span>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                      <div className="flex items-center gap-1.5 ml-2 shrink-0">
                        {canAdjustSets && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onAdjustSets(globalIdx, -1); }}
                            disabled={ex.sets <= 1}
                            className="w-6 h-6 rounded-lg flex items-center justify-center text-gray-400 active:scale-90 transition-all disabled:opacity-30"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" d="M5 12h14" />
                            </svg>
                          </button>
                        )}
                        <span className="text-[11px] font-bold text-[#1B4332] px-2 py-1 min-w-[44px] text-center">
                          {(ex.type === "strength" || ex.type === "core") && ex.sets >= 1
                            ? (<><span className="font-plan-num">{ex.sets}</span>{locale === "ko" ? t("plan.sets") : ` ${t("plan.sets")}`}</>)
                            : <span className="font-plan-num">{ex.count}</span>}
                        </span>
                        {canAdjustSets && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onAdjustSets(globalIdx, 1); }}
                            disabled={ex.sets >= 10}
                            className="w-6 h-6 rounded-lg flex items-center justify-center text-gray-400 active:scale-90 transition-all disabled:opacity-30"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" d="M12 5v14M5 12h14" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              <button
                onClick={() => onAddExercise(phase.key)}
                className="w-full py-3 text-gray-400 hover:text-gray-500 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 mt-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" d="M12 5v14M5 12h14" />
                </svg>
                <span className="text-[11px] font-bold">{t("plan.add_exercise")}</span>
              </button>
            </div>
          </div>
        ))}
      </div>
      <div ref={scrollEndRef} className="h-1" />
    </div>
  );
};
