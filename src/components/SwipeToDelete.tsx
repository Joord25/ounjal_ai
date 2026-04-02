"use client";

import React, { useRef, useState } from "react";

interface SwipeToDeleteProps {
  children: React.ReactNode;
  onDelete: () => void;
  confirmMessage?: string;
}

export const SwipeToDelete: React.FC<SwipeToDeleteProps> = ({
  children,
  onDelete,
  confirmMessage = "이 기록을 삭제할까요?",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const currentXRef = useRef(0);
  const isDragging = useRef(false);
  const isHorizontal = useRef<boolean | null>(null);

  const [offsetX, setOffsetX] = useState(0);
  const [showButton, setShowButton] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const THRESHOLD = 80;

  const handleTouchStart = (e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    startYRef.current = e.touches[0].clientY;
    currentXRef.current = 0;
    isDragging.current = true;
    isHorizontal.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return;

    const dx = e.touches[0].clientX - startXRef.current;
    const dy = e.touches[0].clientY - startYRef.current;

    // 방향 판별 (첫 10px 이동으로 결정)
    if (isHorizontal.current === null && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
      isHorizontal.current = Math.abs(dx) > Math.abs(dy);
    }

    // 수직 스크롤이면 무시
    if (isHorizontal.current === false) return;
    if (isHorizontal.current === null) return;

    // 왼쪽으로만 (음수)
    const clampedX = Math.min(0, Math.max(-120, dx));
    currentXRef.current = clampedX;
    setOffsetX(clampedX);
  };

  const handleTouchEnd = () => {
    isDragging.current = false;
    isHorizontal.current = null;

    if (currentXRef.current < -THRESHOLD) {
      setOffsetX(-80);
      setShowButton(true);
    } else {
      setOffsetX(0);
      setShowButton(false);
    }
  };

  const handleDelete = () => {
    setShowConfirm(true);
  };

  const handleConfirmDelete = () => {
    setShowConfirm(false);
    setOffsetX(0);
    setShowButton(false);
    onDelete();
  };

  const handleCancel = () => {
    setShowConfirm(false);
    setOffsetX(0);
    setShowButton(false);
  };

  if (showConfirm) {
    return (
      <div className="flex items-center justify-between p-4 rounded-2xl bg-red-50 border border-red-200 animate-fade-in">
        <p className="text-sm font-bold text-red-600">{confirmMessage}</p>
        <div className="flex gap-2 shrink-0 ml-2">
          <button onClick={handleCancel} className="text-xs font-bold text-gray-500 px-3 py-1.5 rounded-lg bg-gray-100">취소</button>
          <button onClick={handleConfirmDelete} className="text-xs font-bold text-white px-3 py-1.5 rounded-lg bg-red-500">삭제</button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative overflow-hidden rounded-2xl">
      {/* 삭제 버튼 배경 */}
      <div className="absolute inset-y-0 right-0 w-20 flex items-center justify-center bg-red-500 rounded-r-2xl">
        <button onClick={handleDelete} className="text-white text-xs font-bold">삭제</button>
      </div>

      {/* 컨텐츠 */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: isDragging.current ? "none" : "transform 0.25s ease-out",
        }}
        className="relative z-10 bg-white"
      >
        {children}
      </div>
    </div>
  );
};
