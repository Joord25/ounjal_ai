"use client";

import React, { useState } from "react";
import { auth, googleProvider } from "@/lib/firebase";
import { signInWithPopup } from "firebase/auth";

interface LoginScreenProps {
  onLogin: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
      // onAuthStateChanged in page.tsx will handle the rest
      onLogin();
    } catch (err: any) {
      if (err.code === "auth/popup-closed-by-user") {
        // User closed the popup, not an error
        setError(null);
      } else {
        console.error("Login failed:", err);
        setError("로그인에 실패했습니다. 다시 시도해주세요.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white animate-fade-in relative overflow-y-auto scrollbar-hide">
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-white via-white to-gray-50" />

      {/* Main Content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-8 pb-8 pt-2 text-center gap-6">
        {/* Logo Area */}
        <div className="flex flex-col items-center gap-6">
          <div className="w-[280px] h-[280px] sm:w-[360px] sm:h-[360px] flex items-center justify-center">
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
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full py-4 rounded-2xl bg-white border-2 border-gray-100 flex items-center justify-center gap-3 shadow-sm hover:bg-gray-50 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
          >
            {isLoading ? (
              <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
            ) : (
              <img
                src="https://www.svgrepo.com/show/475656/google-color.svg"
                alt="Google"
                className="w-6 h-6"
              />
            )}
            <span className="font-bold text-gray-700">
              {isLoading ? "로그인 중..." : "Google로 계속하기"}
            </span>
          </button>

          {error && (
            <p className="text-xs text-red-500 font-medium text-center">{error}</p>
          )}

          <p className="text-[10px] text-gray-400 font-medium text-center uppercase tracking-widest">
            로그인 시 이용약관 및 개인정보 처리방침에 동의합니다
          </p>
        </div>
      </div>

      {/* Footer Spacer */}
      <div className="h-8 shrink-0" />
    </div>
  );
};
