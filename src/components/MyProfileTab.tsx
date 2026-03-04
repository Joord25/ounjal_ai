"use client";

import React from "react";
import { THEME } from "@/constants/theme";

interface MyProfileTabProps {
  onLogout: () => void;
}

export const MyProfileTab: React.FC<MyProfileTabProps> = ({ onLogout }) => {
  const handleLogoutClick = () => {
    if (confirm("로그아웃 하시겠습니까?")) {
      onLogout();
    }
  };

  return (
    <div className="flex flex-col h-full bg-white animate-fade-in px-8 pt-24 pb-32 overflow-y-auto">
      {/* Profile Header */}
      <div className="mb-12 flex flex-col items-center text-center gap-4">
        <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center">
          <svg className="w-12 h-12 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
          </svg>
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-black" style={{ color: THEME.textMain }}>
            프로필
          </h1>
          <p className="text-xs text-gray-400 uppercase tracking-widest font-bold">
            "내용을 입력해주세요."
          </p>
        </div>
      </div>

      {/* Settings / Actions */}
      <div className="flex flex-col gap-4">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2">
          Account
        </p>
        
        <button
          onClick={handleLogoutClick}
          className="w-full bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-2xl p-6 flex items-center justify-between transition-all active:scale-[0.98]"
        >
          <div className="flex flex-col items-start gap-1">
            <span className="text-lg font-bold">로그아웃</span>
            <span className="text-xs opacity-70">계정에서 로그아웃합니다</span>
          </div>
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>
    </div>
  );
};
