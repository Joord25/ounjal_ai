"use client";

import React from "react";
import { LAYOUT, THEME } from "@/constants/theme";

interface PhoneFrameProps {
  children: React.ReactNode;
}

export const PhoneFrame: React.FC<PhoneFrameProps> = ({ children }) => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 sm:p-0">
      {/* Content Container (Responsive: Full on mobile, Fixed on desktop) */}
      <div
        className="relative overflow-hidden w-full h-[100dvh] sm:w-[384px] sm:h-[824px] bg-white shadow-2xl transition-all duration-300 sm:rounded-[40px]"
        style={{
          backgroundColor: THEME.bg,
        }}
      >
        {/* Content Area */}
        <main
          className="relative w-full h-full flex flex-col animate-fade-in overflow-hidden"
        >
          {children}
        </main>
      </div>
    </div>
  );
};
