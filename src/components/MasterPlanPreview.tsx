"use client";

import React, { useState } from "react";
import { THEME } from "@/constants/theme";
import { WorkoutSessionData } from "@/constants/workout";

interface MasterPlanPreviewProps {
  sessionData: WorkoutSessionData;
  onStart: () => void;
  onBack: () => void;
  onRegenerate?: (type: string) => void;
  initialSessionType?: string;
}

const PHASE_CONFIG = [
  { key: "warmup", label: "WARM-UP", num: "01", color: "bg-gray-400", badge: "bg-gray-100 text-gray-500" },
  { key: "main", label: "MAIN", num: "02", color: "bg-gray-900", badge: "bg-gray-900 text-white" },
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

  const totalExercises = sessionData.exercises.length;
  const currentType = initialSessionType || "Recommended";
  const currentSessionConfig = SESSION_TYPES.find(s => s.type === currentType) || SESSION_TYPES[0];

  const handleTypeSelect = (type: string) => {
    if (onRegenerate) onRegenerate(type);
    setIsEditing(false);
  };

  return (
    <div className="flex flex-col h-full bg-[#F9FAFB] animate-fade-in relative overflow-hidden">
      {/* Header Bar */}
      <div className="pt-5 pb-3 px-6 flex items-center justify-between shrink-0 bg-[#F9FAFB]">
        <button onClick={onBack} className="p-2 -ml-2">
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-[10px] font-black tracking-[0.25em] text-gray-400 uppercase">
          Master Plan
        </span>
        <button
          onClick={() => setIsEditing(true)}
          className="p-2 -mr-2 text-gray-400 active:text-gray-600 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
        </button>
      </div>

      {/* Hero Section */}
      <div className="px-6 pt-2 pb-5 shrink-0">
        {/* Session Type Badge */}
        <div className="flex items-center gap-2 mb-3">
          <span className="bg-black text-white text-[10px] font-black px-2 py-1 rounded tracking-wider uppercase">
            AI
          </span>
          <span className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">
            {currentSessionConfig.label} Program
          </span>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-black text-gray-900 leading-tight tracking-tight mb-2">
          오늘의 운동 플랜
        </h1>
        <p className="text-sm text-gray-400 leading-relaxed line-clamp-2 mb-5">
          {sessionData.description}
        </p>

        {/* Stats Row */}
        <div className="flex gap-2">
          <div className="flex-1 bg-white rounded-2xl p-3 border border-gray-100">
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Exercises</p>
            <p className="text-xl font-black text-gray-900">{totalExercises}</p>
          </div>
          <div className="flex-1 bg-white rounded-2xl p-3 border border-gray-100">
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Phases</p>
            <p className="text-xl font-black text-gray-900">{phases.length}</p>
          </div>
          <div className="flex-1 bg-emerald-50 rounded-2xl p-3 border border-emerald-100">
            <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-0.5">Type</p>
            <p className="text-xl font-black text-emerald-700">{currentSessionConfig.label}</p>
          </div>
        </div>
      </div>

      {/* Exercise List */}
      <div className="flex-1 overflow-y-auto px-6 pb-36 scrollbar-hide">
        <div className="flex flex-col gap-6">
          {phases.map((phase, phaseIdx) => (
            <div key={phase.key} className="animate-slide-in-bottom" style={{ animationDelay: `${phaseIdx * 0.08}s` }}>
              {/* Phase Header */}
              <div className="flex items-center gap-2.5 mb-3">
                <div className={`w-1.5 h-8 rounded-full ${phase.color}`} />
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-gray-300 tracking-widest">{phase.num}</span>
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
                    className={`rounded-2xl p-4 transition-all ${
                      phase.key === "main"
                        ? "bg-white border-2 border-gray-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                        : phase.key === "cardio"
                        ? "bg-emerald-50 border border-emerald-100"
                        : "bg-white border border-gray-100"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <span className={`text-sm font-bold block leading-snug ${
                          phase.key === "cardio" ? "text-emerald-900" : "text-gray-900"
                        }`}>
                          {ex.name}
                        </span>
                        {ex.weight && ex.weight !== "Bodyweight" && (
                          <span className="text-xs text-emerald-600 font-bold mt-1 block">{ex.weight}</span>
                        )}
                      </div>
                      <span className={`text-[10px] font-black uppercase tracking-wide ml-3 shrink-0 px-2 py-1 rounded-lg ${
                        phase.key === "main"
                          ? "bg-gray-900 text-white"
                          : phase.key === "cardio"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-gray-100 text-gray-400"
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
      <div className="absolute bottom-0 left-0 right-0 p-5 pt-16 bg-gradient-to-t from-[#F9FAFB] via-[#F9FAFB] to-transparent z-20">
        <button
          onClick={onStart}
          className="w-full h-14 rounded-2xl bg-gray-900 active:scale-[0.98] transition-all flex items-center justify-center gap-3 shadow-xl"
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
              <span className="bg-black text-white text-[10px] font-black px-2 py-1 rounded tracking-wider">AI</span>
              <h3 className="text-lg font-black text-gray-900 tracking-tight">세션 타입 변경</h3>
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
                        ? "border-gray-900 bg-gray-50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                        : "border-gray-100 bg-white hover:border-gray-200"
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isActive ? "bg-gray-900" : "bg-gray-100"
                    }`}>
                      <svg className={`w-5 h-5 ${isActive ? "text-white" : "text-gray-500"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={session.icon} />
                      </svg>
                    </div>
                    <div className="text-left flex-1">
                      <p className={`font-black text-sm ${isActive ? "text-gray-900" : "text-gray-700"}`}>
                        {session.label}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{session.desc}</p>
                    </div>
                    {isActive && (
                      <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
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
    </div>
  );
};
