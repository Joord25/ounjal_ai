"use client";

import React from "react";
import { useTranslation } from "@/hooks/useTranslation";

export type TabId = "home" | "proof" | "nutrition" | "my";

const TAB_IDS: TabId[] = ["home", "proof", "nutrition", "my"];
const TAB_KEYS: Record<TabId, string> = {
  home: "tab.home",
  proof: "tab.proof",
  nutrition: "tab.nutrition",
  my: "tab.my",
};

interface BottomTabsProps {
  active: TabId;
  onChange: (id: TabId) => void;
}

export const BottomTabs: React.FC<BottomTabsProps> = ({ active, onChange }) => {
  const { t } = useTranslation();
  return (
    <div
      className="absolute bottom-0 left-0 right-0 flex justify-center px-4 sm:px-6"
      style={{
        zIndex: 40,
        paddingBottom: "calc(var(--safe-area-bottom, 0px) + 16px)",
      }}
    >
      <div
        className="flex items-center justify-around w-full max-w-[340px] h-[52px] rounded-full border border-gray-200 shadow-[0_4px_20px_rgba(0,0,0,0.12)]"
        style={{
          background: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        {TAB_IDS.map((id) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className={`relative flex items-center justify-center h-[36px] px-5 rounded-full transition-all duration-300 ${
                isActive
                  ? "bg-[#1B4332] shadow-[0_2px_12px_rgba(27,67,50,0.3)]"
                  : "active:scale-95"
              }`}
            >
              <span
                className={`text-[11px] font-sans font-bold tracking-wide transition-colors duration-300 ${
                  isActive ? "text-white" : "text-gray-500"
                }`}
              >
                {t(TAB_KEYS[id])}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
