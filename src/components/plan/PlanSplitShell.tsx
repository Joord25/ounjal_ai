"use client";

import React from "react";

export type FocusedPane = "library" | "selected";

interface PlanSplitShellProps {
  focused: FocusedPane;
  onFocusChange: (pane: FocusedPane) => void;
  library: React.ReactNode;
  selected: React.ReactNode;
}

/**
 * 8:2 ↔ 2:8 슬라이드 셸.
 * focused === "library": LIBRARY 80%, SELECTED 20% peek (우측)
 * focused === "selected": LIBRARY 20% peek (좌측), SELECTED 80%
 * peek 영역 탭 → 해당 pane으로 focus 전환.
 */
export const PlanSplitShell: React.FC<PlanSplitShellProps> = ({
  focused,
  onFocusChange,
  library,
  selected,
}) => {
  const libraryFocused = focused === "library";
  return (
    <div className="flex-1 flex overflow-hidden">
      <div
        className={`transition-[flex-grow] duration-300 ease-out overflow-hidden flex flex-col min-w-0 ${
          libraryFocused ? "flex-[4] cursor-auto" : "flex-[1] cursor-pointer"
        }`}
        onClick={libraryFocused ? undefined : () => onFocusChange("library")}
        aria-label={libraryFocused ? undefined : "Library로 전환"}
      >
        {library}
      </div>
      <div
        className={`transition-[flex-grow] duration-300 ease-out overflow-hidden flex flex-col min-w-0 ${
          libraryFocused ? "flex-[1] cursor-pointer" : "flex-[4] cursor-auto"
        }`}
        onClick={libraryFocused ? () => onFocusChange("selected") : undefined}
        aria-label={libraryFocused ? "Selected로 전환" : undefined}
      >
        {selected}
      </div>
    </div>
  );
};
