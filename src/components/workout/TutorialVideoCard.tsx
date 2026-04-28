"use client";

import React, { useEffect } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { trackEvent } from "@/utils/analytics";
import { getVideoEmbedUrl, getYoutubeSearchUrl } from "@/constants/exerciseVideos";
import { getExerciseName } from "@/utils/exerciseName";

interface TutorialVideoCardProps {
  /** "warmup" = 워밍업 운동 / "main" = 메인 컴파운드 (벤치 등) */
  variant: "warmup" | "main";
  exerciseName: string;
}

export const TutorialVideoCard: React.FC<TutorialVideoCardProps> = ({
  variant, exerciseName,
}) => {
  const { t, locale } = useTranslation();
  const embedUrl = getVideoEmbedUrl(exerciseName);
  const searchUrl = getYoutubeSearchUrl(exerciseName);
  const displayName = getExerciseName(exerciseName, locale);
  const titleKey = variant === "warmup"
    ? "beginner_mode.tutorial.title_warmup"
    : "beginner_mode.tutorial.title_main";

  useEffect(() => {
    trackEvent("tutorial_video_show", { variant, exercise: exerciseName });
    if (embedUrl) trackEvent("tutorial_video_play", { variant, exercise: exerciseName });
  }, [variant, exerciseName, embedUrl]);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-[10px] font-black tracking-[0.18em] uppercase text-gray-400">
          {t("beginner_mode.tutorial.label")}
        </p>
        <h2 className="text-2xl font-black text-[#1B4332] mt-1">{t(titleKey)}</h2>
        {variant === "main" && (
          <p className="text-[12px] text-gray-500 mt-1">{displayName}</p>
        )}
      </div>

      <div className="rounded-2xl overflow-hidden bg-black aspect-video relative">
        {embedUrl ? (
          <iframe
            src={embedUrl}
            title={displayName}
            className="absolute inset-0 w-full h-full"
            frameBorder={0}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-[13px] gap-2 px-6 text-center">
            <span>{displayName}</span>
            <a
              href={searchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-[12px] text-white/80"
            >
              YouTube
            </a>
          </div>
        )}
      </div>

      <p className="text-[14px] leading-relaxed text-gray-700">
        {t("beginner_mode.tutorial.body")}
      </p>
    </div>
  );
};
