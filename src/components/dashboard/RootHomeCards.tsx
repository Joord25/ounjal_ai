"use client";

import React from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { trackEvent } from "@/utils/analytics";
import { getTrialStatus } from "@/utils/trialStatus";
import { getPlanCount } from "@/utils/userProfile";

export type RootCardTarget = "weight" | "running" | "home_workout";

interface RootHomeCardsProps {
  userName: string;
  isLoggedIn: boolean;
  isPremium: boolean;
  onSelectCard: (target: RootCardTarget) => void;
  onOpenMyPlans: () => void;
  /** 회의 2026-04-28-γ Phase E QA: 우상단 내플랜 옆 프로필 아이콘 → 프로필 탭 진입 */
  onOpenProfile: () => void;
  hasActivePrograms: boolean;
}

// Figma Kenko UI Kit · icons / ic-tonnage-lifted (node 0:4223)
const ICON_WEIGHT = (
  <svg viewBox="0 0 22 22" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="w-12 h-12" aria-hidden="true">
    <path fillRule="evenodd" clipRule="evenodd" d="M16.9806 13.077C16.9806 9.811 14.2977 7.154 11 7.154C7.70226 7.154 5.01944 9.811 5.01944 13.077C5.01944 16.343 7.70226 19 11 19C14.2977 19 16.9806 16.343 16.9806 13.077M6.42194 6.589C7.72043 5.688 9.29761 5.154 11 5.154C12.7064 5.154 14.2866 5.69 15.5872 6.596C15.4741 5.897 14.7864 3 11 3C7.32462 3 6.56734 5.763 6.42194 6.589M19 13.077C19 17.446 15.4115 21 11 21C6.58854 21 3 17.446 3 13.077C3 11.435 3.50688 9.909 4.37423 8.642V6.731C4.5479 4.693 6.15133 1 11 1C15.8487 1 17.4521 4.693 17.6217 6.645L17.6258 8.642C18.4931 9.908 19 11.435 19 13.077M15.1944 14.077C14.637 14.077 14.1847 13.629 14.1847 13.077C14.1847 12.236 13.8525 11.445 13.2507 10.849C12.6479 10.252 11.8492 9.923 11 9.923C10.4426 9.923 9.99028 9.475 9.99028 8.923C9.99028 8.371 10.4426 7.923 11 7.923C12.3884 7.923 13.6949 8.46 14.6784 9.434C15.6619 10.408 16.2041 11.702 16.2041 13.077C16.2041 13.629 15.7517 14.077 15.1944 14.077" />
  </svg>
);

// 러닝 픽토그램 — public/icons/root/running.png (대표 제공, 좌우 반전본). 절대 다른 SVG로 교체 금지.
const ICON_RUNNING = (
  <img
    src="/icons/root/running.png"
    alt=""
    className="w-14 h-14 object-contain"
    style={{
      filter: "brightness(0) saturate(100%) invert(35%) sepia(28%) saturate(889%) hue-rotate(108deg) brightness(96%) contrast(86%)",
    }}
  />
);

// 홈트 — Heroicons "home" solid (MIT). 웨이트(Figma fill)와 같은 톤(채움)으로 통일.
const ICON_HOME_WORKOUT = (
  <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="w-12 h-12" aria-hidden="true">
    <path fillRule="evenodd" clipRule="evenodd" d="M11.47 3.84a.75.75 0 011.06 0l8.69 8.69a.75.75 0 101.06-1.06l-8.689-8.69a2.25 2.25 0 00-3.182 0l-8.69 8.69a.75.75 0 001.061 1.06l8.69-8.69z" />
    <path d="M12 5.432l8.159 8.159c.03.03.06.058.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15a.75.75 0 01-.75-.75v-4.5a.75.75 0 00-.75-.75h-3a.75.75 0 00-.75.75V21a.75.75 0 01-.75.75H5.625a1.875 1.875 0 01-1.875-1.875v-6.198a2.29 2.29 0 00.091-.086L12 5.43z" />
  </svg>
);

interface CardProps {
  caption: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}

const RootCard: React.FC<CardProps> = ({ caption, label, icon, onClick }) => (
  <button
    onClick={onClick}
    className="w-full bg-white border border-gray-100 rounded-3xl shadow-sm px-6 py-7 flex items-center justify-between active:scale-[0.98] transition-transform hover:bg-gray-50 text-left"
  >
    <div className="flex items-baseline gap-3">
      <span className="text-3xl font-black text-[#1B4332]">{label}</span>
      <span className="text-[10px] font-black tracking-[0.18em] uppercase text-gray-400">{caption}</span>
    </div>
    <span className="text-[#2D6A4F] shrink-0">{icon}</span>
  </button>
);

export const RootHomeCards: React.FC<RootHomeCardsProps> = ({ userName, isLoggedIn, isPremium, onSelectCard, onOpenMyPlans, onOpenProfile, hasActivePrograms }) => {
  const { t, locale } = useTranslation();

  const displayName = userName || t("home.defaultName");

  // 시간대별 인사말 — ChatHome과 동일 (회의 2026-04-27: ROOT 화면 헤더 통일)
  const greetingMsg = (() => {
    const hour = new Date().getHours();
    if (hour < 6) return t("home.greeting.dawn");
    if (hour < 10) return t("home.greeting.morning");
    if (hour < 12) return t("home.greeting.preLunch");
    if (hour < 15) return t("home.greeting.lunch");
    if (hour < 18) return t("home.greeting.afternoon");
    if (hour < 21) return t("home.greeting.evening");
    return t("home.greeting.night");
  })();

  const dateStr = (() => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const date = now.getDate();
    const days = locale === "en" ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] : ["일", "월", "화", "수", "목", "금", "토"];
    if (locale === "en") {
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return `${months[now.getMonth()]} ${date} (${days[now.getDay()]})`;
    }
    return `${month}월 ${date}일 (${days[now.getDay()]})`;
  })();

  const handleCardClick = (target: RootCardTarget) => {
    trackEvent("root_card_click", { target });
    onSelectCard(target);
  };

  const handleMyPlansClick = () => {
    trackEvent("root_my_plans_click", { has_active: hasActivePrograms });
    onOpenMyPlans();
  };

  return (
    <div className="h-full w-full flex flex-col bg-[#FAFBF9]">
      {/* 상단 CTA — 인사 + 날짜 + 상태 pill (ChatHome 헤더와 동일) */}
      <div className="pt-[max(2.5rem,env(safe-area-inset-top))] px-6 pb-2 shrink-0 relative">
        <div className="absolute right-3 top-[max(2.5rem,env(safe-area-inset-top))] flex items-center">
          <button
            onClick={handleMyPlansClick}
            className={`p-2 transition-colors ${hasActivePrograms ? "text-[#2D6A4F]" : "text-gray-400 active:text-[#1B4332]"}`}
            aria-label={t("root.myPlan.aria")}
          >
            <svg className="w-6 h-6" fill={hasActivePrograms ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </button>
          <button
            onClick={onOpenProfile}
            className="p-2 text-gray-400 active:text-[#1B4332] transition-colors"
            aria-label={t("root.profile.aria")}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="9" r="3.5" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 20c1.5-3.5 4-5 7-5s5.5 1.5 7 5" />
            </svg>
          </button>
        </div>
        <h1 className="font-black leading-snug pr-24">
          <span className={`text-[#2D6A4F] ${displayName.length > 6 ? "text-2xl" : "text-3xl"}`}>{displayName}</span>
          <span className={`text-[#1B4332] ${greetingMsg.length > 14 ? "text-base" : "text-xl"}`}> {locale === "en" ? "" : "님, "}{greetingMsg}</span>
        </h1>
        <div className="flex items-center justify-between mt-1">
          <p className="text-[12px] font-medium text-gray-400">{dateStr}</p>
          {(() => {
            const trial = getTrialStatus(isLoggedIn, isPremium, getPlanCount());
            if (isPremium) {
              return (
                <span className="shrink-0 px-2.5 py-1 rounded-full bg-[#2D6A4F] text-white text-[10px] font-bold whitespace-nowrap">
                  {locale === "en" ? "Premium" : "프리미엄"}
                </span>
              );
            }
            if (trial.stage === "premium") return null;
            const isGuest = trial.stage === "guest";
            const label = locale === "ko"
              ? (trial.stage === "exhausted" ? "무료 완료" : (isGuest ? "체험 " : "무료 ") + `${trial.remaining}번 남음`)
              : (trial.stage === "exhausted" ? "Trial done" : (isGuest ? "Trial: " : "Free: ") + `${trial.remaining} left`);
            const warn = trial.remaining <= 1;
            return (
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap ${
                warn ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-[#1B4332]"
              }`}>
                {label}
              </span>
            );
          })()}
        </div>
      </div>

      {/* 3카드 — 화면 가운데 정렬 */}
      <div className="flex-1 flex flex-col justify-center px-6 pb-10">
        <div className="flex flex-col gap-5">
          <RootCard
            caption={t("root.weight.caption")}
            label={t("root.weight.label")}
            icon={ICON_WEIGHT}
            onClick={() => handleCardClick("weight")}
          />
          <RootCard
            caption={t("root.running.caption")}
            label={t("root.running.label")}
            icon={ICON_RUNNING}
            onClick={() => handleCardClick("running")}
          />
          <RootCard
            caption={t("root.homeWorkout.caption")}
            label={t("root.homeWorkout.label")}
            icon={ICON_HOME_WORKOUT}
            onClick={() => handleCardClick("home_workout")}
          />
        </div>
      </div>
    </div>
  );
};
