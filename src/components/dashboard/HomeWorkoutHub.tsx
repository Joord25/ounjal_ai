"use client";

import React, { useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";

export type HomeWorkoutMuscleGroup = "full" | "upper" | "lower" | "core";
export type HomeWorkoutDuration = 15 | 30 | 45;
export type HomeWorkoutIntensity = "low" | "moderate" | "high";

export interface HomeWorkoutSelection {
  muscleGroup: HomeWorkoutMuscleGroup;
  duration: HomeWorkoutDuration;
  intensity: HomeWorkoutIntensity;
}

interface HomeWorkoutHubProps {
  busy: boolean;
  hasActivePrograms: boolean;
  onBack: () => void;
  onOpenMyPlans: () => void;
  onOpenProfile: () => void;
  onStart: (selection: HomeWorkoutSelection) => void;
}

const ICON_MY_PLANS = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M6 4h12a1 1 0 011 1v16l-7-4-7 4V5a1 1 0 011-1z" />
  </svg>
);
const ICON_PROFILE = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <circle cx="12" cy="9" r="3.5" />
    <path d="M5 20c1.5-3.5 4-5 7-5s5.5 1.5 7 5" />
  </svg>
);

interface ChipProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

const Chip: React.FC<ChipProps> = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`flex-1 py-2.5 rounded-xl text-[12px] font-bold transition-all ${
      active ? "bg-[#1B4332] text-white" : "bg-white text-gray-500 border border-gray-200"
    }`}
  >
    {children}
  </button>
);

/**
 * 회의 2026-04-27: ROOT 카드 → 홈트 진입판 풀스크린 화면.
 * 부위/시간/강도 입력 → /api/planSession (`equipment: "bodyweight_only"`) 호출 → master_plan_preview 진입.
 * 1차 룰엔진 땜빵 (memory:project_homeworkout_youtube_pivot — 추후 자체 유튜브 콘텐츠로 전환 예정).
 */
export const HomeWorkoutHub: React.FC<HomeWorkoutHubProps> = ({ busy, hasActivePrograms, onBack, onOpenMyPlans, onOpenProfile, onStart }) => {
  const { t } = useTranslation();
  const [muscleGroup, setMuscleGroup] = useState<HomeWorkoutMuscleGroup>("full");
  const [duration, setDuration] = useState<HomeWorkoutDuration>(30);
  const [intensity, setIntensity] = useState<HomeWorkoutIntensity>("moderate");

  return (
    <div className="h-full w-full bg-white overflow-y-auto relative">
      <button
        onClick={onBack}
        disabled={busy}
        className="absolute left-4 top-[max(2.5rem,env(safe-area-inset-top))] z-10 p-2 text-gray-500 active:text-[#1B4332] transition-colors disabled:opacity-40"
        aria-label={t("homeWorkoutHub.back")}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      {/* 우상단 [📋][👤] — 회의 2026-04-27 와이어프레임 */}
      <div className="absolute right-4 top-[max(2.5rem,env(safe-area-inset-top))] z-10 flex gap-2">
        <button
          onClick={onOpenMyPlans}
          aria-label={t("root.myPlan.aria")}
          className="relative w-10 h-10 rounded-full border border-gray-100 bg-white flex items-center justify-center active:scale-[0.94] transition-transform text-[#1B4332]"
        >
          {ICON_MY_PLANS}
          {hasActivePrograms && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#2D6A4F]" />}
        </button>
        <button
          onClick={onOpenProfile}
          aria-label={t("root.profile.aria")}
          className="w-10 h-10 rounded-full border border-gray-100 bg-white flex items-center justify-center text-[#1B4332] active:scale-[0.94] transition-transform"
        >
          {ICON_PROFILE}
        </button>
      </div>

      <div className="px-6 pt-[max(2.5rem,env(safe-area-inset-top))] pb-10 max-w-md mx-auto">
        <div className="mb-6 mt-12 pl-2">
          <p className="text-[10px] font-black tracking-[0.18em] uppercase text-gray-400">{t("homeWorkoutHub.caption")}</p>
          <h1 className="text-3xl font-black text-[#1B4332] mt-1">{t("homeWorkoutHub.title")}</h1>
        </div>

        <div className="bg-white border border-gray-100 rounded-3xl shadow-sm px-6 py-7">
          <p className="text-[10px] font-black tracking-[0.18em] uppercase text-gray-400 mb-1">{t("homeWorkoutHub.session.caption")}</p>
          <p className="text-xl font-black text-[#1B4332] mb-6">{t("homeWorkoutHub.session.title")}</p>

          <div className="mb-5">
            <p className="text-[10px] font-black tracking-[0.18em] uppercase text-gray-400 mb-2">{t("homeWorkoutHub.area.label")}</p>
            <div className="flex gap-2">
              <Chip active={muscleGroup === "full"} onClick={() => setMuscleGroup("full")}>{t("homeWorkoutHub.area.full")}</Chip>
              <Chip active={muscleGroup === "upper"} onClick={() => setMuscleGroup("upper")}>{t("homeWorkoutHub.area.upper")}</Chip>
              <Chip active={muscleGroup === "lower"} onClick={() => setMuscleGroup("lower")}>{t("homeWorkoutHub.area.lower")}</Chip>
              <Chip active={muscleGroup === "core"} onClick={() => setMuscleGroup("core")}>{t("homeWorkoutHub.area.core")}</Chip>
            </div>
          </div>

          <div className="mb-5">
            <p className="text-[10px] font-black tracking-[0.18em] uppercase text-gray-400 mb-2">{t("homeWorkoutHub.duration.label")}</p>
            <div className="flex gap-2">
              <Chip active={duration === 15} onClick={() => setDuration(15)}>{t("homeWorkoutHub.duration.15")}</Chip>
              <Chip active={duration === 30} onClick={() => setDuration(30)}>{t("homeWorkoutHub.duration.30")}</Chip>
              <Chip active={duration === 45} onClick={() => setDuration(45)}>{t("homeWorkoutHub.duration.45")}</Chip>
            </div>
          </div>

          <div className="mb-6">
            <p className="text-[10px] font-black tracking-[0.18em] uppercase text-gray-400 mb-2">{t("homeWorkoutHub.intensity.label")}</p>
            <div className="flex gap-2">
              <Chip active={intensity === "low"} onClick={() => setIntensity("low")}>{t("homeWorkoutHub.intensity.low")}</Chip>
              <Chip active={intensity === "moderate"} onClick={() => setIntensity("moderate")}>{t("homeWorkoutHub.intensity.moderate")}</Chip>
              <Chip active={intensity === "high"} onClick={() => setIntensity("high")}>{t("homeWorkoutHub.intensity.high")}</Chip>
            </div>
          </div>

          <button
            onClick={() => onStart({ muscleGroup, duration, intensity })}
            disabled={busy}
            className="w-full py-3.5 rounded-2xl bg-[#1B4332] text-white text-[14px] font-black active:scale-[0.98] transition-transform disabled:opacity-40"
          >
            {busy ? t("homeWorkoutHub.starting") : t("homeWorkoutHub.start")}
          </button>
        </div>
      </div>
    </div>
  );
};
