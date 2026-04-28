"use client";

import React from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { getEquipmentInfo, getEquipmentFindGuide } from "@/constants/exerciseEquipment";
import { getFormCues, getFormCueSource } from "@/constants/formCues";
import { getExerciseName } from "@/utils/exerciseName";

interface EquipmentFinderCardProps {
  exerciseName: string;
}

export const EquipmentFinderCard: React.FC<EquipmentFinderCardProps> = ({ exerciseName }) => {
  const { t, locale } = useTranslation();
  const equipment = getEquipmentInfo(exerciseName);
  const findGuide = getEquipmentFindGuide(exerciseName, locale);
  const cues = getFormCues(exerciseName, locale);
  const source = getFormCueSource(exerciseName);
  const displayName = getExerciseName(exerciseName, locale);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-[10px] font-black tracking-[0.18em] uppercase text-gray-400">
          {t("beginner_mode.equipment.label")}
        </p>
        <h2 className="text-2xl font-black text-[#1B4332] mt-1">{displayName}</h2>
      </div>

      {equipment && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={equipment.imagePath}
          alt={displayName}
          loading="eager"
          className="w-full aspect-square object-contain rounded-2xl bg-gray-50 border border-gray-100"
        />
      )}

      {findGuide.length > 0 && (
        <section>
          <p className="text-[12px] font-bold text-[#1B4332] mb-2">
            {t("beginner_mode.equipment.find_label")}
          </p>
          <ul className="flex flex-col gap-1.5 text-[13px] leading-relaxed text-gray-700">
            {findGuide.map((line, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-[#2D6A4F] font-bold flex-shrink-0">·</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {cues.length > 0 && (
        <section>
          <p className="text-[12px] font-bold text-[#1B4332] mb-2">
            {t("beginner_mode.equipment.cue_label")}
          </p>
          <ol className="flex flex-col gap-1.5 text-[13px] leading-relaxed text-gray-700">
            {cues.map((line, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="text-[#2D6A4F] font-bold flex-shrink-0 w-4">{i + 1}.</span>
                <span>{line}</span>
              </li>
            ))}
          </ol>
          {source && (
            <p className="text-[10px] text-gray-400 mt-2 italic">
              {t("beginner_mode.equipment.cue_source").replace("{source}", source)}
            </p>
          )}
        </section>
      )}
    </div>
  );
};
