"use client";

import React from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { translateDesc } from "@/components/report/reportUtils";
import type { WorkoutGoal } from "@/constants/workout";

type RunningVariant = "walkrun" | "tempo" | "fartlek" | "sprint";

interface PlanHeroProps {
  description: string;
  goal?: WorkoutGoal;
  currentIntensity?: "high" | "moderate" | "low" | null;
  /** 러닝 세션 여부 */
  isRunningSession: boolean;
  /** 현재 러닝 변종 (러닝 세션일 때) */
  currentRunningVariant: RunningVariant | null;
  /** 러닝 변종 교체 핸들러 */
  onRunningVariantSwap: (variant: RunningVariant) => void;
  /** 러닝 변종 드롭다운 표시 */
  showRunningSwap: boolean;
  setShowRunningSwap: React.Dispatch<React.SetStateAction<boolean>>;
  /** 튜토리얼 위치 측정용 ref */
  descRef: React.RefObject<HTMLDivElement | null>;
  runningSwapRef: React.RefObject<HTMLDivElement | null>;
}

/** 마스터 플랜 프리뷰 — 히어로 섹션 (AI 코치 + 강도 + 타이틀 + 설명 + 경험메시지) */
export const PlanHero: React.FC<PlanHeroProps> = ({
  description,
  goal,
  currentIntensity,
  isRunningSession,
  currentRunningVariant,
  onRunningVariantSwap,
  showRunningSwap,
  setShowRunningSwap,
  descRef,
  runningSwapRef,
}) => {
  const { t, locale } = useTranslation();

  return (
    <div ref={descRef} className="pt-2 pb-5">
      {/* 제목 + 강도 뱃지 + 러닝 타입 교체 버튼 */}
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <h1 className="text-2xl font-black text-[#1B4332] leading-tight tracking-tight">
            {t("plan.title")}
          </h1>
          {currentIntensity && (
            <span className={`text-[10px] font-black px-2 py-0.5 rounded shrink-0 ${
              currentIntensity === "high" ? "bg-red-100 text-red-600"
                : currentIntensity === "moderate" ? "bg-amber-100 text-amber-700"
                : "bg-blue-100 text-blue-600"
            }`}>
              {t(`plan.intensity.${currentIntensity}`)}
            </span>
          )}
        </div>
        {isRunningSession && currentRunningVariant && (
          <div ref={runningSwapRef} className="relative shrink-0 mt-1">
            <button
              onClick={() => setShowRunningSwap(v => !v)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-bold text-[#2D6A4F] active:scale-95 transition-all"
            >
              <span>{t(`plan.running.${currentRunningVariant}.label`)}</span>
              <svg className={`w-3 h-3 opacity-60 transition-transform ${showRunningSwap ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showRunningSwap && (
              <div className="absolute right-0 top-full mt-1.5 w-64 bg-white rounded-2xl border border-gray-200 shadow-xl p-2 z-50 animate-fade-in">
                {(["walkrun", "tempo", "fartlek", "sprint"] as const).map((variant) => {
                  const isCurrent = variant === currentRunningVariant;
                  return (
                    <button
                      key={variant}
                      onClick={() => onRunningVariantSwap(variant)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl transition-all active:scale-[0.98] ${
                        isCurrent ? "bg-emerald-50" : "hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className={`text-[12px] font-black ${isCurrent ? "text-[#2D6A4F]" : "text-[#1B4332]"}`}>
                          {t(`plan.running.${variant}.label`)}
                        </span>
                        {isCurrent && (
                          <svg className="w-3.5 h-3.5 text-[#2D6A4F]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-500 leading-snug">
                        {t(`plan.running.${variant}.desc`)}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 설명 */}
      <p className="text-sm text-gray-500 leading-relaxed line-clamp-2 mb-2">
        {translateDesc(description, locale)}
      </p>

      {/* 러닝 가이드 (러닝 세션일 때만) */}
      {isRunningSession && currentRunningVariant && (
        <p className="text-[13px] font-semibold text-[#1B4332]/80 leading-relaxed mb-2">
          {t(`running.guide.${currentRunningVariant}`)}
        </p>
      )}

      {/* 경험 메시지 */}
      <p className="text-[13px] font-bold text-[#2D6A4F] leading-relaxed">
        {(() => {
          const desc = (description || "").toLowerCase();
          const g = goal || "general_fitness";
          let part = "default";
          if (/가슴|푸시|chest|push|벤치/.test(desc)) part = "chest";
          else if (/등|풀|back|pull|로우|랫/.test(desc)) part = "back";
          else if (/하체|레그|스쿼트|leg|squat|런지|데드/.test(desc)) part = "lower";
          else if (/코어|복근|core|ab|플랭크/.test(desc)) part = "core";
          else if (/러닝|유산소|cardio|run|hiit|서킷/.test(desc)) part = "cardio";
          else if (/모빌리티|회복|스트레칭/.test(desc)) part = "mobility";
          return t(`exp.${g}.${part}`) !== `exp.${g}.${part}` ? t(`exp.${g}.${part}`) : t(`exp.general_fitness.${part}`);
        })()}
      </p>
    </div>
  );
};
