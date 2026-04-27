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
    <div className="flex items-stretch sm:items-center justify-center h-[100dvh] bg-[#FAFBF9] sm:bg-gray-100">
      {/* 회의 2026-04-28: 데스크톱 폰프레임(384x824) 폐기 → fluid 컬럼.
          모바일: 풀스크린 (외곽-내부 같은 #FAFBF9, 차이 없음).
          데스크톱: 외곽 회색(gray-100) + 컬럼 #FAFBF9 + 살짝 그림자 → 컬럼 경계 visible (나답 스타일). */}
      <div
        className="relative overflow-hidden w-full h-[100dvh] sm:w-[415px] sm:shadow-lg"
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
