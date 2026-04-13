"use client";

import React, { useRef, useEffect, useCallback, useState } from "react";

interface WheelPickerProps {
  values: number[];
  selected: number;
  onChange: (value: number) => void;
  suffix?: string;
  itemHeight?: number;
}

export const WheelPicker: React.FC<WheelPickerProps> = ({
  values,
  selected,
  onChange,
  suffix = "",
  itemHeight = 72,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(null);
  const [initialized, setInitialized] = useState(false);

  const visibleItems = 3;
  const containerHeight = itemHeight * visibleItems;
  const centerOffset = Math.floor(visibleItems / 2) * itemHeight;

  // Scroll to selected value on mount
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const idx = values.indexOf(selected);
    if (idx >= 0) {
      el.scrollTop = idx * itemHeight;
      setTimeout(() => setInitialized(true), 50);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const snapToNearest = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollTop / itemHeight);
    const clamped = Math.max(0, Math.min(values.length - 1, idx));
    try { el.scrollTo({ top: clamped * itemHeight, behavior: "smooth" }); } catch { el.scrollTop = clamped * itemHeight; }
    if (values[clamped] !== selected) {
      onChange(values[clamped]);
    }
  }, [values, selected, onChange, itemHeight]);

  const handleScroll = useCallback(() => {
    if (!initialized) return;
    isScrollingRef.current = true;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      isScrollingRef.current = false;
      snapToNearest();
    }, 80);
  }, [snapToNearest, initialized]);

  useEffect(() => {
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, []);

  return (
    <div className="relative flex items-center justify-center w-full">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="overflow-y-scroll scrollbar-hide relative z-10 w-full"
        style={{
          height: containerHeight,
          scrollSnapType: "y mandatory",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {/* Top padding */}
        <div style={{ height: centerOffset }} />

        {values.map((v) => {
          const idx = values.indexOf(v);
          const selectedIdx = values.indexOf(selected);
          const distance = Math.abs(idx - selectedIdx);
          const isSelected = distance === 0;
          // 거리에 따라 opacity 감소
          const opacity = isSelected ? 1 : distance === 1 ? 0.55 : distance === 2 ? 0.25 : 0.12;
          return (
            <div
              key={v}
              style={{
                height: itemHeight,
                scrollSnapAlign: "start",
              }}
              className="flex items-center justify-center"
            >
              <span
                className={`transition-all duration-200 ${
                  isSelected
                    ? "text-4xl font-black text-[#1B4332]"
                    : "text-xl font-medium text-gray-700"
                }`}
                style={{ opacity, fontVariantNumeric: "tabular-nums" }}
              >
                {v}
                {isSelected && suffix && (
                  <span className="text-lg font-bold text-gray-400 ml-1">{suffix}</span>
                )}
              </span>
            </div>
          );
        })}

        {/* Bottom padding */}
        <div style={{ height: centerOffset }} />
      </div>

      {/* 상단/하단 가로선 */}
      <div
        className="absolute left-1/2 -translate-x-1/2 h-px bg-[#2D6A4F] pointer-events-none"
        style={{
          width: 140,
          top: centerOffset,
        }}
      />
      <div
        className="absolute left-1/2 -translate-x-1/2 h-px bg-[#2D6A4F] pointer-events-none"
        style={{
          width: 140,
          top: centerOffset + itemHeight,
        }}
      />
    </div>
  );
};
