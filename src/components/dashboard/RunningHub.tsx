"use client";

import React, { useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { RunningProgramSheet } from "./RunningProgramSheet";

interface RunningHubProps {
  isLoggedIn: boolean;
  isPremium: boolean;
  hasActivePrograms: boolean;
  /** 회의 2026-04-27: 진행 중 러닝 프로그램 — select 화면에 "이어가기" 카드로 표시 */
  activeRunningPrograms?: Array<{ programId: string; programName: string; completed: number; total: number; nextSession: { id: string } | null }>;
  onBack: () => void;
  onOpenMyPlans: () => void;
  onOpenProfile: () => void;
  onStartFirstSession: (programId: string) => void;
  onResumeProgram: (programId: string, nextSessionId: string) => void;
  onRequestLogin: () => void;
  onRequestPaywall: () => void;
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

interface CompletionInfo {
  programId: string;
  programName: string;
  firstSessionTitle: string;
}

/**
 * 회의 2026-04-27: ROOT 카드 → 러닝 진입판 풀스크린 화면.
 * RunningProgramSheet variant="fullscreen" 호출 + 생성 완료 시 자체 완료 화면 표시.
 */
export const RunningHub: React.FC<RunningHubProps> = ({
  isLoggedIn,
  isPremium,
  hasActivePrograms,
  activeRunningPrograms,
  onBack,
  onOpenMyPlans,
  onOpenProfile,
  onStartFirstSession,
  onResumeProgram,
  onRequestLogin,
  onRequestPaywall,
}) => {
  const { t } = useTranslation();
  const [completion, setCompletion] = useState<CompletionInfo | null>(null);

  if (completion) {
    // Kenko 완료 화면 — 회색 체크 + 프로그램명 + 코치 3줄 + 2버튼
    const coachLines = [
      t("running_program.coach.intro_line1").replace("{programName}", completion.programName),
      t("running_program.coach.intro_line2").replace("{sessionTitle}", completion.firstSessionTitle),
      t("running_program.coach.intro_line3"),
    ];
    return (
      <div className="h-full w-full bg-white overflow-y-auto">
        <div className="px-6 pt-[max(2.5rem,env(safe-area-inset-top))] pb-10 max-w-md mx-auto flex flex-col h-full">
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-6">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-[#2D6A4F]">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p className="text-[10px] font-black tracking-[0.18em] uppercase text-gray-400 mb-2">{t("runningHub.completion.label")}</p>
            <p className="text-2xl font-black text-[#1B4332] mb-6">{completion.programName}</p>
            <div className="flex flex-col gap-3 px-2 max-w-sm">
              {coachLines.map((line, i) => (
                <p key={i} className="text-[13px] text-gray-600 leading-relaxed">{line}</p>
              ))}
            </div>
          </div>
          <div className="flex gap-3 mt-8">
            <button
              onClick={onOpenMyPlans}
              className="flex-1 py-3 rounded-2xl bg-white border border-gray-200 text-[#1B4332] text-[13px] font-black active:scale-[0.98] transition-transform"
            >
              {t("runningHub.completion.viewPlans")}
            </button>
            <button
              onClick={() => onStartFirstSession(completion.programId)}
              className="flex-1 py-3 rounded-2xl bg-[#1B4332] text-white text-[13px] font-black active:scale-[0.98] transition-transform"
            >
              {t("runningHub.completion.startToday")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-white overflow-y-auto relative">
      {/* 우상단 [📋][👤] 오버레이 — 회의 2026-04-27. 좌상단 ←는 RunningProgramSheet의 step-aware 버튼. */}
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
      <RunningProgramSheet
        open
        variant="fullscreen"
        onClose={onBack}
        onProgramCreated={(info) => setCompletion(info)}
        isLoggedIn={isLoggedIn}
        isPremium={isPremium}
        onRequestLogin={onRequestLogin}
        onRequestPaywall={onRequestPaywall}
        activePrograms={activeRunningPrograms}
        onResumeProgram={onResumeProgram}
      />
    </div>
  );
};
