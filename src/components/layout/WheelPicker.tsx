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
  itemHeight = 48,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(null);
  const [initialized, setInitialized] = useState(false);

  const visibleItems = 5;
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
    el.scrollTo({ top: clamped * itemHeight, behavior: "smooth" });
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
    <div className="relative flex items-center justify-center">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="overflow-y-scroll scrollbar-hide"
        style={{
          height: containerHeight,
          scrollSnapType: "y mandatory",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {/* Top padding */}
        <div style={{ height: centerOffset }} />

        {values.map((v) => {
          const isSelected = v === selected;
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
                className={`transition-all duration-150 font-black ${
                  isSelected
                    ? "text-3xl text-[#1B4332]"
                    : "text-lg text-gray-300"
                }`}
              >
                {v}
                {isSelected && suffix && (
                  <span className="text-base font-bold text-gray-400 ml-1">{suffix}</span>
                )}
              </span>
            </div>
          );
        })}

        {/* Bottom padding */}
        <div style={{ height: centerOffset }} />
      </div>

      {/* Selection highlight bar */}
      <div
        className="absolute left-4 right-4 border-y-2 border-[#2D6A4F]/20 rounded-lg pointer-events-none"
        style={{
          height: itemHeight,
          top: centerOffset,
        }}
      />
    </div>
  );
};
