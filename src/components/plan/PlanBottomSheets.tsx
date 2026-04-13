"use client";

import React from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { ExerciseStep, LABELED_EXERCISE_POOLS } from "@/constants/workout";
import { getExerciseName } from "@/utils/exerciseName";

const MUSCLE_GROUP_EN: Record<string, string> = {
  "웜업": "Warm-up", "가슴": "Chest", "어깨": "Shoulders", "삼두": "Triceps",
  "등": "Back", "후면 어깨": "Rear Delts", "이두": "Biceps", "하체": "Legs",
  "종아리": "Calves", "전신": "Full Body", "코어": "Core", "가동성": "Mobility",
};
function tLabel(label: string, locale: string): string {
  return locale === "ko" ? label : (MUSCLE_GROUP_EN[label] || label);
}

const INTENSITY_OPTIONS = [
  { level: "high" as const, labelKey: "plan.intensity.high", descKey: "plan.intensity.high_desc", color: "bg-red-500", border: "border-red-300", bg: "bg-red-50", text: "text-red-600" },
  { level: "moderate" as const, labelKey: "plan.intensity.moderate", descKey: "plan.intensity.moderate_desc", color: "bg-amber-500", border: "border-amber-300", bg: "bg-amber-50", text: "text-amber-700" },
  { level: "low" as const, labelKey: "plan.intensity.low", descKey: "plan.intensity.low_desc", color: "bg-blue-500", border: "border-blue-300", bg: "bg-blue-50", text: "text-blue-600" },
] as const;

interface PlanBottomSheetsProps {
  // Intensity adjustment sheet
  isEditing: boolean;
  setIsEditing: (v: boolean) => void;
  currentIntensity?: "high" | "moderate" | "low" | null;
  recommendedIntensity?: "high" | "moderate" | "low" | null;
  onIntensitySelect: (level: "high" | "moderate" | "low") => void;
  onRegenerate?: () => void;
  onBack: () => void;

  // Add exercise sheet
  addToPhase: string | null;
  setAddToPhase: (v: string | null) => void;
  onAddExercise: (name: string) => void;

  // Swap exercise sheet
  swapExercise: { exercise: ExerciseStep; index: number; sameGroup: string[] } | null;
  setSwapExercise: (v: null) => void;
  onSwapExercise: (idx: number, newName: string) => void;

  // Shared search/filter state for add+swap
  swapSearch: string;
  setSwapSearch: (v: string) => void;
  swapFilter: string | null;
  setSwapFilter: (v: string | null | ((p: string | null) => string | null)) => void;

  // For existing names check (add sheet)
  localExercises: ExerciseStep[];
}

/** 마스터 플랜 프리뷰 — 3개 바텀시트 통합 (강도조정 / 종목추가 / 종목교체) */
export const PlanBottomSheets: React.FC<PlanBottomSheetsProps> = ({
  isEditing, setIsEditing,
  currentIntensity, recommendedIntensity, onIntensitySelect,
  onRegenerate, onBack,
  addToPhase, setAddToPhase, onAddExercise,
  swapExercise, setSwapExercise, onSwapExercise,
  swapSearch, setSwapSearch,
  swapFilter, setSwapFilter,
  localExercises,
}) => {
  const { t, locale } = useTranslation();

  return (
    <>
      {/* Intensity Adjustment Sheet */}
      {isEditing && (
        <div className="absolute inset-0 z-50">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setIsEditing(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[2rem] p-6 animate-slide-up shadow-2xl" style={{ paddingBottom: "calc(var(--safe-area-bottom, 0px) + 16px)" }}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-6" />

            <h3 className="text-lg font-black text-[#1B4332] tracking-tight mb-1">{t("plan.adjust")}</h3>
            <p className="text-[11px] text-gray-400 font-medium mb-5">{t("plan.adjust_desc")}</p>

            <div className="space-y-2.5 mb-5">
              {INTENSITY_OPTIONS.map((opt) => {
                const isActive = currentIntensity === opt.level;
                const isRec = recommendedIntensity === opt.level;
                return (
                  <button
                    key={opt.level}
                    onClick={() => onIntensitySelect(opt.level)}
                    className={`w-full p-4 rounded-2xl border-2 flex items-center gap-3 active:scale-[0.98] transition-all ${
                      isActive
                        ? `${opt.border} ${opt.bg} shadow-[2px_2px_0px_0px] shadow-current`
                        : isRec
                          ? `${opt.border} ${opt.bg}/30 hover:${opt.bg}`
                          : "border-gray-100 bg-white hover:border-gray-200"
                    }`}
                  >
                    <div className={`w-3 h-8 rounded-full ${opt.color} shrink-0`} />
                    <div className="text-left flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className={`font-black text-sm ${isActive ? opt.text : "text-gray-700"}`}>{t(opt.labelKey)}</p>
                        {isRec && !isActive && (
                          <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-emerald-100 text-[#2D6A4F]">{t("plan.recommended")}</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{t(opt.descKey)}</p>
                    </div>
                    {isActive && (
                      <div className={`w-6 h-6 rounded-full ${opt.color} flex items-center justify-center shrink-0`}>
                        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {onRegenerate && (
              <button
                onClick={() => { onRegenerate(); setIsEditing(false); }}
                className="w-full py-3.5 rounded-2xl border-2 border-gray-200 bg-white text-gray-700 font-bold text-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2 hover:bg-gray-50"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                </svg>
                {t("plan.regenerate")}
              </button>
            )}

            <button
              onClick={() => { onBack(); setIsEditing(false); }}
              className="w-full py-3.5 rounded-2xl border-2 border-gray-100 bg-gray-50 text-gray-400 font-bold text-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2 hover:bg-gray-100 mt-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
              </svg>
              {t("plan.restart")}
            </button>
          </div>
        </div>
      )}

      {/* Add Exercise Sheet */}
      {addToPhase && (
        <div className="absolute inset-0 z-50">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setAddToPhase(null)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[2rem] p-6 animate-slide-up shadow-2xl" style={{ paddingBottom: "calc(var(--safe-area-bottom, 0px) + 16px)" }}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em]">{t("plan.add_exercise")}</p>
              <button onClick={() => setAddToPhase(null)} className="text-sm text-gray-400 font-bold">{t("plan.close")}</button>
            </div>

            <input
              type="text"
              value={swapSearch}
              onChange={(e) => setSwapSearch(e.target.value)}
              placeholder={t("plan.search")}
              className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-[13px] text-[#1B4332] font-medium placeholder-gray-300 outline-none focus:border-[#2D6A4F] transition-colors mb-2"
            />

            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide mb-3 pb-0.5">
              {LABELED_EXERCISE_POOLS.map(p => (
                <button
                  key={p.label}
                  onClick={() => setSwapFilter(prev => prev === p.label ? null : p.label)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all ${
                    swapFilter === p.label ? "bg-[#1B4332] text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  {tLabel(p.label, locale)}
                </button>
              ))}
            </div>

            <div className="h-[30vh] overflow-y-auto space-y-1.5">
              {(() => {
                const q = swapSearch.replace(/\s/g, "").toLowerCase();
                const isSearching = q.length > 0;
                const existingNames = new Set(localExercises.map(e => e.name));

                if (swapFilter !== null) {
                  const pool = LABELED_EXERCISE_POOLS.find(p => p.label === swapFilter);
                  if (!pool) return null;
                  const list = pool.exercises
                    .filter(e => !existingNames.has(e))
                    .filter(e => !isSearching || e.replace(/\s/g, "").toLowerCase().includes(q));
                  if (list.length === 0) return <p className="text-center text-sm text-gray-400 font-medium py-6">{t("plan.no_results")}</p>;
                  return list.map((name: string) => (
                    <button
                      key={name}
                      onClick={() => onAddExercise(name)}
                      className="w-full text-left px-4 py-3 rounded-xl bg-white border border-gray-200 text-[13px] font-bold text-gray-600 active:scale-[0.98] transition-all"
                    >
                      {getExerciseName(name, locale)}
                    </button>
                  ));
                }

                if (!isSearching) return <p className="text-center text-sm text-gray-400 font-medium py-6">{t("plan.select_tab")}</p>;

                return LABELED_EXERCISE_POOLS
                  .map((group) => {
                    const keywordMatch = group.keywords.some((kw: string) => kw.includes(q) || q.includes(kw));
                    const matched = group.exercises
                      .filter((e: string) => !existingNames.has(e))
                      .filter((e: string) => keywordMatch || e.replace(/\s/g, "").toLowerCase().includes(q));
                    if (matched.length === 0) return null;
                    return (
                      <div key={group.label}>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] mt-2 mb-1">{tLabel(group.label, locale)}</p>
                        {matched.map((name: string) => (
                          <button
                            key={name}
                            onClick={() => onAddExercise(name)}
                            className="w-full text-left px-4 py-3 rounded-xl bg-white border border-gray-200 text-[13px] font-bold text-gray-600 active:scale-[0.98] transition-all mb-1.5"
                          >
                            {getExerciseName(name, locale)}
                          </button>
                        ))}
                      </div>
                    );
                  })
                  .filter(Boolean);
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Swap Exercise Sheet */}
      {swapExercise && (
        <div className="absolute inset-0 z-50">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setSwapExercise(null)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[2rem] p-6 animate-slide-up shadow-2xl" style={{ paddingBottom: "calc(var(--safe-area-bottom, 0px) + 16px)" }}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em]">{t("plan.swap_title")}</p>
              <button onClick={() => setSwapExercise(null)} className="text-sm text-gray-400 font-bold">{t("plan.close")}</button>
            </div>
            <p className="text-[10px] font-bold text-gray-500 mb-3">
              {t("plan.current")} <span className="text-[#1B4332]">{getExerciseName(swapExercise.exercise.name, locale)}</span>
            </p>

            <input
              type="text"
              value={swapSearch}
              onChange={(e) => setSwapSearch(e.target.value)}
              placeholder={t("plan.search")}
              className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-[13px] text-[#1B4332] font-medium placeholder-gray-300 outline-none focus:border-[#2D6A4F] transition-colors mb-2"
            />

            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide mb-3 pb-0.5">
              <button
                onClick={() => setSwapFilter(null)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all ${
                  swapFilter === null ? "bg-[#1B4332] text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {t("plan.recommended")}
              </button>
              {LABELED_EXERCISE_POOLS.map(p => (
                <button
                  key={p.label}
                  onClick={() => setSwapFilter(p.label)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all ${
                    swapFilter === p.label ? "bg-[#1B4332] text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  {tLabel(p.label, locale)}
                </button>
              ))}
            </div>

            <div className="h-[30vh] overflow-y-auto space-y-1.5">
              {(() => {
                const q = swapSearch.replace(/\s/g, "").toLowerCase();
                const isSearching = q.length > 0;
                const currentName = swapExercise.exercise.name;
                const sameGroup = swapExercise.sameGroup;

                if (swapFilter !== null) {
                  const pool = LABELED_EXERCISE_POOLS.find(p => p.label === swapFilter);
                  if (!pool) return null;
                  const list = pool.exercises
                    .filter(e => e !== currentName)
                    .filter(e => !isSearching || e.replace(/\s/g, "").toLowerCase().includes(q));
                  if (list.length === 0) return (
                    <p className="text-center text-sm text-gray-400 font-medium py-6">{t("plan.no_results")}</p>
                  );
                  return list.map((alt: string) => (
                    <button
                      key={alt}
                      onClick={() => onSwapExercise(swapExercise.index, alt)}
                      className={`w-full text-left px-4 py-3 rounded-xl bg-white border text-[13px] font-bold active:scale-[0.98] transition-all ${
                        sameGroup.includes(alt) ? "border-[#2D6A4F] text-[#1B4332]" : "border-gray-200 text-gray-600"
                      }`}
                    >
                      {getExerciseName(alt, locale)}
                    </button>
                  ));
                }

                if (!isSearching) {
                  if (sameGroup.length === 0) return <p className="text-center text-sm text-gray-400 font-medium py-6">{t("plan.select_from_tab")}</p>;
                  return sameGroup.map((alt: string) => (
                    <button
                      key={alt}
                      onClick={() => onSwapExercise(swapExercise.index, alt)}
                      className="w-full text-left px-4 py-3 rounded-xl bg-white border border-gray-200 text-[13px] font-bold text-[#1B4332] active:scale-[0.98] transition-all"
                    >
                      {getExerciseName(alt, locale)}
                    </button>
                  ));
                }

                return LABELED_EXERCISE_POOLS
                  .map((group) => {
                    const keywordMatch = group.keywords.some((kw: string) => kw.includes(q) || q.includes(kw));
                    const matched = group.exercises
                      .filter((e: string) => e !== currentName)
                      .filter((e: string) => keywordMatch || e.replace(/\s/g, "").toLowerCase().includes(q));
                    if (matched.length === 0) return null;
                    return (
                      <div key={group.label}>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] mt-2 mb-1">{tLabel(group.label, locale)}</p>
                        {matched.map((alt: string) => (
                          <button
                            key={alt}
                            onClick={() => onSwapExercise(swapExercise.index, alt)}
                            className={`w-full text-left px-4 py-3 rounded-xl bg-white border text-[13px] font-bold active:scale-[0.98] transition-all mb-1.5 ${
                              sameGroup.includes(alt) ? "border-[#2D6A4F] text-[#1B4332]" : "border-gray-200 text-gray-600"
                            }`}
                          >
                            {getExerciseName(alt, locale)}
                          </button>
                        ))}
                      </div>
                    );
                  })
                  .filter(Boolean);
              })()}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
