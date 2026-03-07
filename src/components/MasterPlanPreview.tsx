"use client";

import React, { useState, useRef, useEffect } from "react";
import { THEME } from "@/constants/theme";
import { WorkoutSessionData, ExerciseStep } from "@/constants/workout";

interface MasterPlanPreviewProps {
  sessionData: WorkoutSessionData;
  onStart: () => void;
  onBack: () => void;
  onRegenerate?: (type: string) => void;
  initialSessionType?: string;
}

const PHASE_CONFIG = [
  { key: "warmup", label: "WARM-UP", num: "01", color: "bg-gray-700", badge: "bg-gray-700 text-white" },
  { key: "main", label: "MAIN", num: "02", color: "bg-[#1B4332]", badge: "bg-[#1B4332] text-white" },
  { key: "core", label: "CORE", num: "03", color: "bg-gray-600", badge: "bg-gray-600 text-white" },
  { key: "cardio", label: "CARDIO", num: "04", color: "bg-emerald-500", badge: "bg-emerald-500 text-white" },
] as const;

const SESSION_TYPES = [
  { type: "Recommended", label: "AI 추천", desc: "요일별 스케줄 기반 자동 추천", icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" },
  { type: "Strength", label: "근력", desc: "근비대 및 파워 향상", icon: "M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" },
  { type: "Running", label: "러닝", desc: "심폐지구력 및 체력 증진", icon: "M13 10V3L4 14h7v7l9-11h-7z" },
  { type: "Mobility", label: "가동성", desc: "회복 및 유연성 향상", icon: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" },
] as const;

export const MasterPlanPreview: React.FC<MasterPlanPreviewProps> = ({
  sessionData,
  onStart,
  onBack,
  onRegenerate,
  initialSessionType
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [guideExercise, setGuideExercise] = useState<ExerciseStep | null>(null);
  const [showIntroTip, setShowIntroTip] = useState(() => {
    if (typeof window !== "undefined") {
      return !localStorage.getItem("alpha_tip_intro");
    }
    return true;
  });
  const [showTip, setShowTip] = useState(() => {
    if (typeof window !== "undefined") {
      return !localStorage.getItem("alpha_tip_change_program");
    }
    return true;
  });
  const [showGuideTip, setShowGuideTip] = useState(() => {
    if (typeof window !== "undefined") {
      return !localStorage.getItem("alpha_tip_guide_button");
    }
    return true;
  });

  const dismissIntroTip = () => {
    setShowIntroTip(false);
    localStorage.setItem("alpha_tip_intro", "1");
  };

  const dismissTip = () => {
    setShowTip(false);
    localStorage.setItem("alpha_tip_change_program", "1");
  };

  const dismissGuideTip = () => {
    setShowGuideTip(false);
    localStorage.setItem("alpha_tip_guide_button", "1");
  };

  const firstGuideRef = useRef<HTMLButtonElement>(null);
  const settingsBtnRef = useRef<HTMLButtonElement>(null);
  const descRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [guideBtnPos, setGuideBtnPos] = useState<{ top: number; left: number } | null>(null);
  const [settingsBtnPos, setSettingsBtnPos] = useState<{ top: number; right: number } | null>(null);
  const [descPos, setDescPos] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();

    if (showIntroTip && descRef.current) {
      const r = descRef.current.getBoundingClientRect();
      setDescPos({
        top: r.top - containerRect.top,
        left: r.left - containerRect.left,
        width: r.width,
        height: r.height,
      });
    }

    if (!showIntroTip && showTip && settingsBtnRef.current) {
      const btnRect = settingsBtnRef.current.getBoundingClientRect();
      setSettingsBtnPos({
        top: btnRect.top - containerRect.top,
        right: containerRect.right - btnRect.right,
      });
    }

    if (!showIntroTip && !showTip && showGuideTip && firstGuideRef.current) {
      const btnRect = firstGuideRef.current.getBoundingClientRect();
      setGuideBtnPos({
        top: btnRect.top - containerRect.top,
        left: btnRect.left - containerRect.left,
      });
    }
  }, [showIntroTip, showTip, showGuideTip]);

  const warmups = sessionData.exercises.filter(e => e.type === "warmup");
  const main = sessionData.exercises.filter(e => {
    if (e.type === "strength") return true;
    if (e.type === "cardio") return !e.name.includes("추가") && !e.name.includes("Additional");
    return false;
  });
  const core = sessionData.exercises.filter(e => e.type === "core" || e.type === "mobility");
  const additionalCardio = sessionData.exercises.filter(e => {
    if (e.type === "cardio") return e.name.includes("추가") || e.name.includes("Additional");
    return false;
  });

  const phases = [
    { ...PHASE_CONFIG[0], exercises: warmups },
    { ...PHASE_CONFIG[1], exercises: main },
    { ...PHASE_CONFIG[2], exercises: core },
    { ...PHASE_CONFIG[3], exercises: additionalCardio },
  ].filter(p => p.exercises.length > 0);

  const currentType = initialSessionType || "Recommended";
  const currentSessionConfig = SESSION_TYPES.find(s => s.type === currentType) || SESSION_TYPES[0];

  const handleTypeSelect = (type: string) => {
    if (onRegenerate) onRegenerate(type);
    setIsEditing(false);
  };

  return (
    <div ref={containerRef} className="flex flex-col h-full bg-[#FAFBF9] animate-fade-in relative overflow-hidden">
      {/* Header Bar */}
      <div className="pt-5 pb-3 px-6 flex items-center justify-between shrink-0 bg-[#FAFBF9]">
        <button onClick={onBack} className="p-2 -ml-2">
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-[11px] font-serif font-medium tracking-[0.25em] text-gray-400 uppercase">
          Master Plan
        </span>
        <button
          ref={settingsBtnRef}
          onClick={() => setIsEditing(true)}
          className="relative p-2 -mr-2 text-gray-400 active:text-gray-600 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-6 pb-[90px] scrollbar-hide">
        {/* Hero Section */}
        <div className="pt-2 pb-5">
          {/* Session Type Badge */}
          <div ref={descRef} className="flex items-center gap-2 mb-3">
            <span className="bg-[#1B4332] text-white text-[10px] font-black px-2 py-1 rounded tracking-wider uppercase">
              AI
            </span>
            <span className="text-[10px] font-bold text-gray-500 tracking-widest uppercase">
              {currentSessionConfig.label} Program
            </span>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-black text-[#1B4332] leading-tight tracking-tight mb-2">
            오늘의 운동 플랜
          </h1>
          <p className="text-sm text-gray-500 leading-relaxed line-clamp-2">
            {sessionData.description}
          </p>
        </div>

        {/* Exercise List */}
        <div className="flex flex-col gap-6">
          {phases.map((phase, phaseIdx) => (
            <div key={phase.key} className="animate-slide-in-bottom" style={{ animationDelay: `${phaseIdx * 0.08}s` }}>
              {/* Phase Header */}
              <div className="flex items-center gap-2.5 mb-3">
                <div className={`w-1.5 h-8 rounded-full ${phase.color}`} />
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-gray-400 tracking-widest">{phase.num}</span>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded ${phase.badge}`}>
                    {phase.label}
                  </span>
                </div>
              </div>

              {/* Exercise Cards */}
              <div className="flex flex-col gap-2 ml-4">
                {phase.exercises.map((ex, i) => (
                  <div
                    key={i}
                    className={`rounded-2xl p-4 transition-all bg-white border-2 ${
                      phase.key === "main"
                        ? "border-[#1B4332] shadow-[2px_2px_0px_0px_#1B4332]"
                        : phase.key === "warmup"
                        ? "border-gray-700 shadow-[2px_2px_0px_0px_#374151]"
                        : phase.key === "core"
                        ? "border-gray-600 shadow-[2px_2px_0px_0px_#4B5563]"
                        : phase.key === "cardio"
                        ? "border-emerald-500 shadow-[2px_2px_0px_0px_#10B981]"
                        : "border-gray-300 shadow-[2px_2px_0px_0px_#D1D5DB]"
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <button
                        ref={phaseIdx === 0 && i === 0 ? firstGuideRef : undefined}
                        onClick={() => setGuideExercise(ex)}
                        className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center mt-0.5 transition-colors ${
                          phase.key === "main"
                            ? "bg-[#1B4332]/10 text-[#1B4332] hover:bg-[#1B4332]/20"
                            : phase.key === "warmup"
                            ? "bg-gray-700/10 text-gray-700 hover:bg-gray-700/20"
                            : phase.key === "core"
                            ? "bg-gray-600/10 text-gray-600 hover:bg-gray-600/20"
                            : phase.key === "cardio"
                            ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                            : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                        }`}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827m0 3h.01" />
                        </svg>
                      </button>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-bold block leading-snug text-gray-900">
                          {ex.name}
                        </span>
                        {ex.weight && ex.weight !== "Bodyweight" && (
                          <span className="text-xs text-[#2D6A4F] font-bold mt-1 block">{ex.weight}</span>
                        )}
                      </div>
                      <span className={`text-[10px] font-black uppercase tracking-wide ml-2 shrink-0 px-2 py-1 rounded-lg ${
                        phase.key === "main"
                          ? "bg-[#1B4332] text-white"
                          : phase.key === "warmup"
                          ? "bg-gray-700 text-white"
                          : phase.key === "core"
                          ? "bg-gray-600 text-white"
                          : phase.key === "cardio"
                          ? "bg-emerald-500 text-white"
                          : "bg-gray-200 text-gray-600"
                      }`}>
                        {ex.count}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="absolute bottom-0 left-0 right-0 px-5 pb-2 pt-8 bg-gradient-to-t from-[#FAFBF9] via-[#FAFBF9] to-transparent z-20">
        <button
          onClick={onStart}
          className="w-full h-14 rounded-2xl bg-[#1B4332] active:scale-[0.98] transition-all flex items-center justify-center gap-3 shadow-xl shadow-[#1B4332]/20 hover:bg-[#2D6A4F]"
        >
          <span className="text-white font-black text-base tracking-wide">START WORKOUT</span>
          <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
      </div>

      {/* Session Type Bottom Sheet */}
      {isEditing && (
        <div className="absolute inset-0 z-50">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setIsEditing(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[2rem] p-6 pb-10 animate-slide-up shadow-2xl">
            {/* Handle */}
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-6" />

            <div className="flex items-center gap-2 mb-5">
              <span className="bg-[#1B4332] text-white text-[10px] font-black px-2 py-1 rounded tracking-wider">AI</span>
              <h3 className="text-lg font-black text-[#1B4332] tracking-tight">세션 타입 변경</h3>
            </div>

            <div className="space-y-2.5">
              {SESSION_TYPES.map((session) => {
                const isActive = currentType === session.type;
                return (
                  <button
                    key={session.type}
                    onClick={() => handleTypeSelect(session.type)}
                    className={`w-full p-4 rounded-2xl border-2 flex items-center gap-4 active:scale-[0.98] transition-all ${
                      isActive
                        ? "border-[#2D6A4F] bg-emerald-50 shadow-[2px_2px_0px_0px_#2D6A4F]"
                        : "border-gray-100 bg-white hover:border-gray-200"
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isActive ? "bg-[#2D6A4F]" : "bg-gray-100"
                    }`}>
                      <svg className={`w-5 h-5 ${isActive ? "text-white" : "text-gray-500"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={session.icon} />
                      </svg>
                    </div>
                    <div className="text-left flex-1">
                      <p className={`font-black text-sm ${isActive ? "text-[#1B4332]" : "text-gray-700"}`}>
                        {session.label}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{session.desc}</p>
                    </div>
                    {isActive && (
                      <div className="w-6 h-6 rounded-full bg-[#2D6A4F] flex items-center justify-center shrink-0">
                        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Intro Tutorial Overlay — spotlight on description */}
      {showIntroTip && descPos && (
        <div className="absolute inset-0 z-[60] animate-fade-in" onClick={dismissIntroTip}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
          {/* Spotlight highlight on description area */}
          <div
            className="absolute rounded-xl border-2 border-white/70 bg-white/10"
            style={{ top: descPos.top - 6, left: descPos.left - 8, width: descPos.width + 16, height: descPos.height + 12 }}
          />
          {/* Tooltip below the description */}
          <div
            className="absolute px-4"
            style={{ top: descPos.top + descPos.height + 14, left: 0, right: 0 }}
          >
            <div className="bg-white rounded-2xl px-5 py-5 shadow-2xl mx-2 relative">
              <div className="absolute -top-2 left-8 w-4 h-4 bg-white rotate-45 rounded-sm" />
              <p className="text-[12.5px] text-gray-600 leading-relaxed">
                ACSM 국제 공인 스포츠의학 기관 및 건강운동관리사 가이드라인과 최근 5년 내 <span className="font-bold text-[#2D6A4F]">500건 이상</span>의 SCI급 연구 논문들을 기반으로, 컨디션 · 체력 · 휴식까지 고려한 요일별 맞춤 프로그램입니다.
              </p>
              <p className="text-[10px] text-gray-400 mt-3 font-medium">탭하여 닫기</p>
            </div>
          </div>
        </div>
      )}

      {/* Settings Tutorial Tooltip Overlay */}
      {!showIntroTip && showTip && settingsBtnPos && (
        <div className="absolute inset-0 z-[60] animate-fade-in" onClick={dismissTip}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
          <div className="absolute flex flex-col items-end" style={{ top: settingsBtnPos.top - 4, right: settingsBtnPos.right - 4 }}>
            {/* Spotlight ring on actual settings button */}
            <div className="w-10 h-10 rounded-full border-2 border-white/80 bg-white/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </div>
            {/* Tooltip bubble */}
            <div className="mt-3 mr-1 bg-white rounded-2xl px-5 py-4 shadow-2xl max-w-[240px] relative">
              <div className="absolute -top-2 right-4 w-4 h-4 bg-white rotate-45 rounded-sm" />
              <p className="text-sm font-bold text-[#1B4332] leading-relaxed">
                다른 프로그램을 원하시면<br/>여기서 변경할 수 있어요
              </p>
              <p className="text-[11px] text-gray-400 mt-2 font-medium">탭하여 닫기</p>
            </div>
          </div>
        </div>
      )}

      {/* Guide Button Tutorial Overlay */}
      {!showIntroTip && !showTip && showGuideTip && guideBtnPos && (
        <div className="absolute inset-0 z-[60] animate-fade-in" onClick={dismissGuideTip}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
          <div className="absolute flex items-start gap-3" style={{ top: guideBtnPos.top - 4, left: guideBtnPos.left - 4 }}>
            {/* Spotlight ring on actual button */}
            <div className="w-9 h-9 rounded-full border-2 border-white/80 bg-white/10 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827m0 3h.01" />
              </svg>
            </div>
            {/* Tooltip bubble */}
            <div className="bg-white rounded-2xl px-5 py-4 shadow-2xl max-w-[240px] relative mt-0.5">
              <div className="absolute top-3 -left-2 w-4 h-4 bg-white rotate-45 rounded-sm" />
              <p className="text-sm font-bold text-[#1B4332] leading-relaxed">
                운동 자세한 설명과 정확한 자세가 궁금하면<br/>여기를 눌러보세요
              </p>
              <p className="text-[11px] text-gray-400 mt-2 font-medium">탭하여 닫기</p>
            </div>
          </div>
        </div>
      )}

      {/* Exercise Guide Bottom Sheet */}
      {guideExercise && (
        <div className="absolute inset-0 z-50">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setGuideExercise(null)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[2rem] p-6 pb-10 animate-slide-up shadow-2xl">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-6" />

            {/* Exercise Name */}
            <div className="mb-5">
              {(() => {
                const parts = guideExercise.name.split('(');
                const korean = parts[0].trim();
                const english = parts.length > 1 ? parts[1].replace(')', '').trim() : "";
                return (
                  <>
                    <h3 className="text-xl font-black text-[#1B4332] tracking-tight">{korean}</h3>
                    {english && <p className="text-sm text-gray-400 mt-1">{english}</p>}
                  </>
                );
              })()}
            </div>

            {/* Exercise Info */}
            <div className="grid grid-cols-3 gap-2 mb-6">
              <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Type</p>
                <p className="text-sm font-black text-gray-900 uppercase">{guideExercise.type}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Sets</p>
                <p className="text-sm font-black text-gray-900">{guideExercise.sets}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Volume</p>
                <p className="text-sm font-black text-gray-900">{guideExercise.count}</p>
              </div>
            </div>

            {guideExercise.weight && guideExercise.weight !== "Bodyweight" && (
              <div className="bg-emerald-50 rounded-xl p-3 mb-6 border border-emerald-100 text-center">
                <p className="text-[9px] font-black text-[#2D6A4F] uppercase tracking-widest mb-0.5">Weight</p>
                <p className="text-sm font-black text-[#1B4332]">{guideExercise.weight}</p>
              </div>
            )}

            {/* YouTube Search Button */}
            <button
              onClick={() => {
                const parts = guideExercise.name.split('(');
                const searchTerm = parts.length > 1 ? parts[1].replace(')', '').trim() : parts[0].trim();
                window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(searchTerm + " exercise form guide")}`, "_blank");
              }}
              className="w-full p-4 rounded-2xl bg-[#1B4332] text-white flex items-center justify-center gap-3 active:scale-[0.98] transition-all shadow-lg hover:bg-[#2D6A4F]"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
              <span className="font-black text-sm tracking-wide">YouTube에서 자세 가이드 보기</span>
            </button>

            <button
              onClick={() => setGuideExercise(null)}
              className="w-full p-3 mt-2 rounded-xl text-gray-400 font-bold text-sm active:scale-[0.98] transition-all"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
