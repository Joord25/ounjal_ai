"use client";

import React, { useRef, useEffect, useCallback } from "react";

interface RulerPickerProps {
  min: number;
  max: number;
  value: number;
  step?: number;
  onChange: (value: number) => void;
  suffix?: string;
}

const TICK_GAP = 12; // px between ticks (더 넓게)
const MAJOR_EVERY = 5;

/** 가로 눈금자 스타일 숫자 피커 */
export const RulerPicker: React.FC<RulerPickerProps> = ({
  min,
  max,
  value,
  step = 1,
  onChange,
  suffix,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isProgrammaticScroll = useRef(false);
  const rafId = useRef<number | null>(null);

  const values = Array.from({ length: Math.floor((max - min) / step) + 1 }, (_, i) => min + i * step);

  const scrollToValue = useCallback((v: number, smooth = true) => {
    const el = scrollRef.current;
    if (!el) return;
    const idx = Math.round((v - min) / step);
    const target = idx * TICK_GAP;
    isProgrammaticScroll.current = true;
    el.scrollTo({ left: target, behavior: smooth ? "smooth" : "auto" });
    // 플래그 해제 (smooth animation 끝난 뒤)
    setTimeout(() => { isProgrammaticScroll.current = false; }, smooth ? 400 : 50);
  }, [min, step]);

  // 초기 스크롤 위치 설정
  useEffect(() => {
    scrollToValue(value, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 외부 value 변경 시 스크롤 동기화
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const idx = Math.round((value - min) / step);
    const expected = idx * TICK_GAP;
    if (Math.abs(el.scrollLeft - expected) > TICK_GAP / 2) {
      scrollToValue(value, false);
    }
  }, [value, min, step, scrollToValue]);

  const handleScroll = () => {
    if (isProgrammaticScroll.current) return;
    if (rafId.current !== null) return;
    rafId.current = requestAnimationFrame(() => {
      rafId.current = null;
      const el = scrollRef.current;
      if (!el) return;
      const idx = Math.round(el.scrollLeft / TICK_GAP);
      const clampedIdx = Math.max(0, Math.min(values.length - 1, idx));
      const newValue = min + clampedIdx * step;
      if (newValue !== value) {
        onChange(newValue);
        // 햅틱
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          const vibeOn = (typeof window !== "undefined" && localStorage.getItem("alpha_settings_vibration") !== "0");
          if (vibeOn) navigator.vibrate(3);
        }
      }
    });
  };

  return (
    <div className="w-full flex flex-col items-center select-none py-15">
      {/* 현재 값 */}
      <div className="flex items-baseline gap-2 mb-14" style={{ fontVariantNumeric: "tabular-nums" }}>
        <span className="text-[65px] font-black text-[#1B4332] leading-none tracking-tight">{value}</span>
        {suffix && <span className="text-2xl font-bold text-gray-400">{suffix}</span>}
      </div>

      {/* 눈금자 */}
      <div className="relative w-full h-28">
        {/* 중앙 인디케이터 — 굵은 세로선 */}
        <div className="absolute left-1/2 -top-4 -translate-x-1/2 w-[3px] h-25 bg-[#2D6A4F] rounded-full z-10 pointer-events-none" />

        {/* 그라데이션 마스크 */}
        <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-[#FAFBF9] to-transparent z-[5] pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-[#FAFBF9] to-transparent z-[5] pointer-events-none" />

        {/* 스크롤 컨테이너 */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="w-full h-full overflow-x-auto overflow-y-hidden scrollbar-hide"
          style={{
            scrollSnapType: "x mandatory",
            scrollPaddingInline: "50%",
          }}
        >
          {/* 좌측 패딩 (첫 눈금이 중앙에서 시작) */}
          <div className="flex items-start" style={{ paddingLeft: "calc(50% - 1px)", paddingRight: "calc(50% - 1px)" }}>
            {values.map((v) => {
              const isMajor = (v - min) % (MAJOR_EVERY * step) === 0;
              return (
                <div
                  key={v}
                  className="shrink-0 flex flex-col items-center"
                  style={{ width: `${TICK_GAP}px`, scrollSnapAlign: "center" }}
                >
                  {/* 눈금 — 세로 중앙 정렬 */}
                  <div className="flex items-center justify-center" style={{ height: "50px" }}>
                    <div
                      className={isMajor ? "bg-gray-500" : "bg-gray-300"}
                      style={{ width: "1px", height: isMajor ? "50px" : "30px" }}
                    />
                  </div>
                  {isMajor && (
                    <span className="text-[11px] font-medium text-gray-400 mt-2" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {v}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
