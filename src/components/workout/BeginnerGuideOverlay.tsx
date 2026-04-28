"use client";

import React, { useEffect } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { trackEvent } from "@/utils/analytics";
import { EquipmentFinderCard } from "./EquipmentFinderCard";
import { TutorialVideoCard } from "./TutorialVideoCard";

export type BeginnerOverlayPhase = "warmup_intro" | "main_equipment" | "tutorial_video_warmup" | "tutorial_video_main";

interface BeginnerGuideOverlayProps {
  phase: BeginnerOverlayPhase;
  exerciseName: string;
  onContinue: () => void;
  onSkip: () => void;
}

export const BeginnerGuideOverlay: React.FC<BeginnerGuideOverlayProps> = ({
  phase, exerciseName, onContinue, onSkip,
}) => {
  const { t } = useTranslation();

  useEffect(() => {
    trackEvent("beginner_mode_overlay_show", { phase, exercise: exerciseName });
  }, [phase, exerciseName]);

  const handleContinue = () => {
    trackEvent("beginner_mode_overlay_cta", { phase, exercise: exerciseName });
    onContinue();
  };

  const handleSkip = () => {
    trackEvent("beginner_mode_overlay_skip", { phase, exercise: exerciseName });
    onSkip();
  };

  return (
    <div className="fixed inset-0 z-[70] bg-white flex flex-col animate-fade-in">
      <header className="flex justify-end px-5 pt-5">
        <button
          type="button"
          onClick={handleSkip}
          className="text-[12px] font-medium text-gray-400 active:text-gray-600 px-2 py-1"
        >
          {t("beginner_mode.overlay.skip")}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-6 pt-2 pb-6">
        {phase === "warmup_intro" && (
          <div className="flex flex-col gap-5">
            <div>
              <p className="text-[10px] font-black tracking-[0.18em] uppercase text-gray-400">
                {t("beginner_mode.warmup.label")}
              </p>
              <h2 className="text-2xl font-black text-[#1B4332] mt-1">
                {t("beginner_mode.warmup.title")}
              </h2>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/warmup/stretching-zone.jpg"
              alt={t("beginner_mode.warmup.title")}
              loading="eager"
              className="w-full aspect-[4/3] object-cover rounded-2xl bg-gray-50 border border-gray-100"
            />

            <ol className="flex flex-col gap-3 text-[14px] leading-relaxed text-gray-700">
              <li className="flex gap-2.5">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#2D6A4F] text-white text-[11px] font-black flex items-center justify-center mt-0.5">1</span>
                <div className="flex flex-col gap-1.5">
                  <span>{t("beginner_mode.warmup.step_1")}</span>
                  <span className="flex gap-1.5 items-start text-[12.5px] text-gray-500 bg-gray-50 rounded-lg px-2.5 py-2">
                    <svg className="flex-shrink-0 w-4 h-4 text-amber-500 mt-px" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4a2 2 0 00-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
                    </svg>
                    <span>{t("beginner_mode.warmup.step_1_note")}</span>
                  </span>
                </div>
              </li>
              <li className="flex gap-2.5">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#2D6A4F] text-white text-[11px] font-black flex items-center justify-center mt-0.5">2</span>
                <span>{t("beginner_mode.warmup.step_2")}</span>
              </li>
              <li className="flex gap-2.5">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#2D6A4F] text-white text-[11px] font-black flex items-center justify-center mt-0.5">3</span>
                <span>{t("beginner_mode.warmup.step_3")}</span>
              </li>
            </ol>
            <p className="text-[14px] font-bold text-[#1B4332] mt-2">
              {t("beginner_mode.warmup.confirm")}
            </p>
          </div>
        )}

        {phase === "main_equipment" && (
          <EquipmentFinderCard exerciseName={exerciseName} />
        )}

        {(phase === "tutorial_video_warmup" || phase === "tutorial_video_main") && (
          <TutorialVideoCard
            variant={phase === "tutorial_video_warmup" ? "warmup" : "main"}
            exerciseName={exerciseName}
          />
        )}
      </div>

      <footer className="px-6 pt-3 pb-6 border-t border-gray-100 bg-white">
        <button
          type="button"
          onClick={handleContinue}
          className="w-full h-14 rounded-2xl bg-[#1B4332] text-white text-[15px] font-black active:scale-[0.98] transition-transform"
        >
          {phase === "warmup_intro"
            ? t("beginner_mode.warmup.cta")
            : phase === "main_equipment"
              ? t("beginner_mode.equipment.cta")
              : t("beginner_mode.tutorial.cta_done")}
        </button>
      </footer>
    </div>
  );
};
