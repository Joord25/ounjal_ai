"use client";

import React, { useEffect } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { trackEvent } from "@/utils/analytics";
import { EquipmentFinderCard } from "./EquipmentFinderCard";

export type BeginnerOverlayPhase = "warmup_intro" | "main_equipment";

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

            <p className="text-[14px] leading-relaxed text-gray-700">
              {t("beginner_mode.warmup.body")}
            </p>
          </div>
        )}

        {phase === "main_equipment" && (
          <EquipmentFinderCard exerciseName={exerciseName} />
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
            : t("beginner_mode.equipment.cta")}
        </button>
      </footer>
    </div>
  );
};
