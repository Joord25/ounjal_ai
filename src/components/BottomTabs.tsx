"use client";

import React from "react";
import { LAYOUT, THEME } from "@/constants/theme";

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
      className="flex items-center justify-around border-t border-gray-100 bg-white px-4 shrink-0 pb-safe"
      style={{ height: `calc(${LAYOUT.tabH}px + env(safe-area-inset-bottom))`, zIndex: 40 }}
    >
      {TABS.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className="flex flex-col items-center justify-center gap-1 transition-colors duration-200"
          >
            {isActive && (
              <div
                className="h-1 w-1 rounded-full mb-1"
                style={{ backgroundColor: THEME.accent }}
              />
            )}
            <span
              className={`text-xs font-medium uppercase tracking-widest ${
                isActive ? "text-text-main" : "text-gray-300"
              }`}
              style={{ color: isActive ? THEME.textMain : "#D1D5DB" }}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};
