"use client";

import React from "react";


export type TabId = "today" | "proof" | "my";

interface Tab {
  id: TabId;
  label: string;
}

interface BottomTabsProps {
  active: TabId;
  onChange: (id: TabId) => void;
}

const TABS: Tab[] = [
  { id: "today", label: "Today" },
  { id: "proof", label: "Proof" },
  { id: "my", label: "My" },
];

export const BottomTabs: React.FC<BottomTabsProps> = ({ active, onChange }) => {
  return (
    <div
      className="absolute bottom-0 left-0 right-0 flex justify-center pb-[max(16px,env(safe-area-inset-bottom))] px-6"
      style={{ zIndex: 40 }}
    >
      <div
        className="flex items-center justify-around w-full max-w-[340px] h-[52px] rounded-full border border-gray-200 shadow-[0_4px_20px_rgba(0,0,0,0.12)]"
        style={{
          background: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        {TABS.map((tab) => {
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`relative flex items-center justify-center h-[36px] ${tab.id === "my" ? "w-[84px]" : "px-5"} rounded-full transition-all duration-300 ${
                isActive
                  ? "bg-[#1B4332] shadow-[0_2px_12px_rgba(27,67,50,0.3)]"
                  : "active:scale-95"
              }`}
            >
              <span
                className={`text-[11px] font-serif font-bold uppercase tracking-widest transition-colors duration-300 ${
                  isActive ? "text-white" : "text-gray-500"
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
