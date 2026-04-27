"use client";

import React from "react";
import { useUnits } from "@/hooks/useUnits";

interface UnitToggleProps {
  /** Metric 옵션 라벨 (예: "cm", "kg") */
  metric: string;
  /** Imperial 옵션 라벨 (예: "ft", "lb") */
  imperial: string;
  /** 외곽 컨테이너 className 오버라이드. 디폴트 "flex justify-center mb-4". */
  className?: string;
}

/**
 * 단위 즉시 전환 토글 (metric / imperial).
 *
 * 회의 2026-04-28-γ 후속. Onboarding height/weight + MyProfileTab 등
 * 단위 의존 입력 화면에 공통 사용. 클릭 즉시 useUnits.setSystem() 호출
 * → localStorage + 컨텍스트 갱신 → 단위 영향 컴포넌트 자동 재렌더.
 */
export const UnitToggle: React.FC<UnitToggleProps> = ({ metric, imperial, className }) => {
  const { system, setSystem } = useUnits();
  return (
    <div className={className ?? "flex justify-center mb-4"}>
      <div className="inline-flex rounded-full bg-gray-100 p-0.5 text-[11px]" role="tablist" aria-label="Unit system">
        <button
          type="button"
          role="tab"
          aria-selected={system === "metric"}
          onClick={() => setSystem("metric")}
          className={`px-3 py-1 rounded-full font-bold transition-colors ${
            system === "metric" ? "bg-white text-[#1B4332] shadow-sm" : "text-gray-500 active:text-[#1B4332]"
          }`}
        >
          {metric}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={system === "imperial"}
          onClick={() => setSystem("imperial")}
          className={`px-3 py-1 rounded-full font-bold transition-colors ${
            system === "imperial" ? "bg-white text-[#1B4332] shadow-sm" : "text-gray-500 active:text-[#1B4332]"
          }`}
        >
          {imperial}
        </button>
      </div>
    </div>
  );
};
