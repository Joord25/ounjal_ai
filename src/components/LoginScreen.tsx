"use client";

import React from "react";
import { THEME } from "@/constants/theme";

interface LoginScreenProps {
  onLogin: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  return (
    <div className="flex flex-col h-full bg-white animate-fade-in relative overflow-hidden">
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-white via-white to-gray-50" />

      {/* Main Content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-8 text-center gap-12">
        {/* Logo Area */}
        <div className="flex flex-col items-center gap-6">
          <div className="w-[360px] h-[360px] flex items-center justify-center">
            <img 
              src="/login-logo.png" 
              alt="Logo" 
              className="w-full h-full object-contain" 
            />
          </div>
        </div>

        {/* Description */}
        <p className="text-gray-400 leading-relaxed text-sm max-w-[240px]">
          당신의 컨디션과 목표에 맞춰<br />
          AI 코치가 맞춤식으로 운동을 지도합니다.
        </p>

        {/* Action Area */}
        <div className="w-full flex flex-col gap-4 mt-4">
          <button
            onClick={onLogin}
            className="w-full py-4 rounded-2xl bg-white border-2 border-gray-100 flex items-center justify-center gap-3 shadow-sm hover:bg-gray-50 active:scale-95 transition-all"
          >
            <img 
              src="https://www.svgrepo.com/show/475656/google-color.svg" 
              alt="Google" 
              className="w-6 h-6"
            />
            <span className="font-bold text-gray-700">Google로 계속하기</span>
          </button>
          
          <p className="text-[10px] text-gray-400 font-medium text-center uppercase tracking-widest">
            로그인 시 이용약관 및 개인정보 처리방침에 동의합니다
          </p>
        </div>
      </div>

      {/* Footer Spacer (Optional) */}
      <div className="h-8" />
    </div>
  );
};
