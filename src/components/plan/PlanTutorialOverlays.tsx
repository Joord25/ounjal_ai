"use client";

import React from "react";
import { useTranslation } from "@/hooks/useTranslation";

interface Pos {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface SettingsPos {
  top: number;
  right: number;
}

interface PlanTutorialOverlaysProps {
  showIntroTip: boolean;
  descPos: Pos | null;
  onDismissIntro: () => void;

  showTip: boolean;
  settingsBtnPos: SettingsPos | null;
  onDismissTip: () => void;

  showGuideTip: boolean;
  guideBtnPos: Pos | null;
  onDismissGuideTip: () => void;
}

/** 마스터 플랜 프리뷰 — 3개 튜토리얼 오버레이 (인트로/세팅/카드탭) */
export const PlanTutorialOverlays: React.FC<PlanTutorialOverlaysProps> = ({
  showIntroTip, descPos, onDismissIntro,
  showTip, settingsBtnPos, onDismissTip,
  showGuideTip, guideBtnPos, onDismissGuideTip,
}) => {
  const { t } = useTranslation();

  return (
    <>
      {/* Intro Tutorial Overlay — spotlight on description */}
      {showIntroTip && descPos && (
        <div className="absolute inset-0 z-[60] animate-fade-in" onClick={onDismissIntro}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
          <div
            className="absolute rounded-xl border-2 border-white/70 bg-white/10"
            style={{ top: descPos.top - 6, left: descPos.left - 8, width: descPos.width + 16, height: descPos.height + 12 }}
          />
          <div
            className="absolute px-4"
            style={{ top: descPos.top + descPos.height + 14, left: 0, right: 0 }}
          >
            <div className="bg-white rounded-2xl px-5 py-5 shadow-2xl mx-2 relative">
              <div className="absolute -top-2 left-8 w-4 h-4 bg-white rotate-45 rounded-sm" />
              <p className="text-[12.5px] text-gray-600 leading-relaxed">{t("plan.tip_intro")}</p>
              <p className="text-[10px] text-gray-400 mt-3 font-medium">{t("plan.tip_dismiss")}</p>
            </div>
          </div>
        </div>
      )}

      {/* Settings Tutorial Tooltip Overlay */}
      {!showIntroTip && showTip && settingsBtnPos && (
        <div className="absolute inset-0 z-[60] animate-fade-in" onClick={onDismissTip}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
          <div className="absolute flex flex-col items-end" style={{ top: settingsBtnPos.top - 4, right: settingsBtnPos.right - 4 }}>
            <div className="w-10 h-10 rounded-full border-2 border-white/80 bg-white/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </div>
            <div className="mt-3 mr-1 bg-white rounded-2xl px-5 py-4 shadow-2xl max-w-[240px] relative">
              <div className="absolute -top-2 right-4 w-4 h-4 bg-white rotate-45 rounded-sm" />
              <p className="text-sm font-bold text-[#1B4332] leading-relaxed">{t("plan.tip_settings")}</p>
              <p className="text-[11px] text-gray-400 mt-2 font-medium">{t("plan.tip_dismiss")}</p>
            </div>
          </div>
        </div>
      )}

      {/* Card Tap Tutorial Overlay */}
      {!showIntroTip && !showTip && showGuideTip && guideBtnPos && (
        <div className="absolute inset-0 z-[60] animate-fade-in" onClick={onDismissGuideTip}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
          <div
            className="absolute rounded-2xl border-2 border-white/80 bg-white/10"
            style={{ top: guideBtnPos.top - 4, left: guideBtnPos.left - 4, width: guideBtnPos.width + 8, height: guideBtnPos.height + 8 }}
          />
          <div
            className="absolute px-4"
            style={{ top: guideBtnPos.top + guideBtnPos.height + 14, left: 0, right: 0 }}
          >
            <div className="bg-white rounded-2xl px-5 py-4 shadow-2xl mx-2 relative">
              <div className="absolute -top-2 left-8 w-4 h-4 bg-white rotate-45 rounded-sm" />
              <p className="text-sm font-bold text-[#1B4332] leading-relaxed">{t("plan.tip_card")}</p>
              <p className="text-[11px] text-gray-400 mt-2 font-medium">{t("plan.tip_dismiss")}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
