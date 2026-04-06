"use client";

import React, { useState, useRef, useEffect } from "react";

const LANGUAGES = [
  { code: "/", label: "한국어", flag: "🇰🇷" },
  { code: "/en", label: "English", flag: "🇺🇸" },
  { code: "/ja", label: "日本語", flag: "🇯🇵" },
  { code: "/zh", label: "中文", flag: "🇨🇳" },
];

export function LanguageSelector({ current }: { current: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const currentLang = LANGUAGES.find((l) => l.code === current) || LANGUAGES[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg border border-white/20 hover:border-white/40 transition-colors"
      >
        <span className="text-base">{currentLang.flag}</span>
        <span className="text-sm font-medium text-white/70 hidden sm:inline">{currentLang.label}</span>
        <svg className={`w-3.5 h-3.5 text-white/50 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50 min-w-[180px] animate-fade-in">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Select Language</p>
          </div>
          {LANGUAGES.map((lang) => (
            <a
              key={lang.code}
              href={lang.code}
              className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${lang.code === current ? "bg-[#f0fdf4]" : ""}`}
            >
              <span className="text-2xl w-8 h-8 flex items-center justify-center bg-gray-50 rounded-full">{lang.flag}</span>
              <span className={`text-sm font-medium flex-1 ${lang.code === current ? "text-[#059669]" : "text-gray-700"}`}>{lang.label}</span>
              {lang.code === current && (
                <svg className="w-5 h-5 text-[#059669]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
