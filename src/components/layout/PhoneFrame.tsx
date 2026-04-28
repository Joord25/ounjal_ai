"use client";

import React from "react";
import { LAYOUT, THEME } from "@/constants/theme";
import { PullToRefresh } from "@/components/PullToRefresh";

interface PhoneFrameProps {
  children: React.ReactNode;
  pullToRefresh?: boolean;
}

export const PhoneFrame: React.FC<PhoneFrameProps> = ({ children, pullToRefresh = true }) => {
  return (
    <div className="flex items-stretch sm:items-center justify-center h-[100svh] bg-[#FAFBF9] sm:bg-gray-100">
      {/* 회의 ζ-3 (2026-04-28): cbad2b5 의 'calc(100dvh - env())' 폐기. 안드 PWA 에서 env() 가 0 으로 잡히는 케이스 발견 → viewport 가 nav 뒤까지 확장 → 화면이 nav 뒤로 숨음.
          신규 패턴 — 100svh (small viewport height): chrome/nav 노출 상태 기준 안정 viewport. Chrome team 권장 (Modern CSS 2025 가이드). 100dvh 와 달리 jank X, env() 의존 X.
          나답 PWA 도 같은 패턴 추정. */}
      <div
        className="relative overflow-hidden w-full h-[100svh] sm:w-[415px] sm:shadow-lg"
        style={{
          backgroundColor: THEME.bg,
        }}
      >
        {/* Content Area */}
        <main
          className="relative w-full h-full flex flex-col animate-fade-in overflow-hidden"
        >
          <PullToRefresh enabled={pullToRefresh}>
            {children}
          </PullToRefresh>
        </main>
      </div>
    </div>
  );
};
