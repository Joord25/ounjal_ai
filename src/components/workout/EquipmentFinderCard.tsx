"use client";

import React from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { getEquipmentInfo, getEquipmentFindGuide, getEquipmentUseGuide } from "@/constants/exerciseEquipment";
import { getFormCues, getFormCueSource } from "@/constants/formCues";
import { getExerciseName } from "@/utils/exerciseName";
import { getVideoEmbedUrl } from "@/constants/exerciseVideos";

/** Q1 컨펌 (회의 ζ): 단일 파일 + mode prop 분기. find = 위치/외형 / use = 안전 셋업 + 폼 cue */
type EquipmentCardMode = "find" | "use";

interface EquipmentFinderCardProps {
  exerciseName: string;
  mode: EquipmentCardMode;
}

export const EquipmentFinderCard: React.FC<EquipmentFinderCardProps> = ({ exerciseName, mode }) => {
  const { t, locale } = useTranslation();
  const equipment = getEquipmentInfo(exerciseName);
  const displayName = getExerciseName(exerciseName, locale);

  if (mode === "find") {
    const findGuide = getEquipmentFindGuide(exerciseName, locale);
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
      </div>
    );
  }

  // mode === "use"
  const useGuide = getEquipmentUseGuide(exerciseName, locale);
  const cues = getFormCues(exerciseName, locale);
  const source = getFormCueSource(exerciseName);
  const videoUrl = getVideoEmbedUrl(exerciseName);

  return (
    <div className="flex flex-col gap-5">
      {/* 회의 2026-04-28: 상단 캡션 EQUIPMENT로 통일(find와 parallel). "사용법"은 bullet 위 섹션 헤더로 이동. */}
      <div>
        <p className="text-[10px] font-black tracking-[0.18em] uppercase text-gray-400">
          {t("beginner_mode.equipment.label")}
        </p>
        <h2 className="text-2xl font-black text-[#1B4332] mt-1">{displayName}</h2>
      </div>

      {/* 회의 2026-04-28: 사용법 페이지 유튜브 미리보기 영상 — 매핑 있을 때만. */}
      {videoUrl && (
        <div className="w-full aspect-video rounded-2xl overflow-hidden bg-gray-50 border border-gray-100">
          <iframe
            src={videoUrl}
            className="w-full h-full"
            allow="autoplay; encrypted-media"
            loading="lazy"
            title={displayName}
          />
        </div>
      )}

      {useGuide.length > 0 && (
        <section>
          <p className="text-[12px] font-bold text-[#1B4332] mb-2">
            {t("beginner_mode.equipment.use.label")}
          </p>
          <ul className="flex flex-col gap-1.5 text-[13px] leading-relaxed text-gray-700">
            {useGuide.map((line, i) => (
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
