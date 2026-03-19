"use client";

import React, { useRef, useState } from "react";
import { ExerciseStep } from "@/constants/workout";

interface PlanShareCardProps {
  exercises: ExerciseStep[];
  currentIntensity?: "high" | "moderate" | "low" | null;
  onClose: () => void;
}

const PHASE_META: Record<string, { label: string; color: string }> = {
  warmup: { label: "WARM-UP", color: "#374151" },
  main: { label: "MAIN", color: "#1B4332" },
  core: { label: "CORE", color: "#4B5563" },
  cardio: { label: "CARDIO", color: "#10B981" },
};

function getPhaseKey(ex: ExerciseStep): string {
  if (ex.phase) return ex.phase;
  if (ex.type === "warmup") return "warmup";
  if (ex.type === "core" || ex.type === "mobility") return "core";
  if (ex.type === "cardio") return "cardio";
  return "main";
}

function rebuildCount(ex: ExerciseStep): string {
  if (ex.type === "warmup" || ex.type === "cardio" || ex.type === "mobility") {
    if (/분|초|min|sec/i.test(ex.count)) return ex.count;
  }
  if (ex.sets > 1) {
    const repsStr = typeof ex.reps === "number" ? `${ex.reps}회` : String(ex.reps);
    return `${ex.sets}세트 × ${repsStr}`;
  }
  return ex.count;
}

export const PlanShareCard: React.FC<PlanShareCardProps> = ({
  exercises,
  currentIntensity,
  onClose,
}) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [mode, setMode] = useState<"dark" | "light">("dark");
  const cardRef = useRef<HTMLDivElement>(null);

  const today = new Date();
  const dateStr = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, "0")}.${String(today.getDate()).padStart(2, "0")}`;

  // Group exercises by phase
  const phaseOrder = ["warmup", "main", "core", "cardio"];
  const grouped = phaseOrder
    .map((key) => ({
      key,
      meta: PHASE_META[key],
      exercises: exercises.filter((ex) => getPhaseKey(ex) === key),
    }))
    .filter((g) => g.exercises.length > 0);

  const totalExercises = exercises.length;
  const totalSets = exercises.reduce((sum, ex) => sum + (ex.sets || 1), 0);

  const intensityLabel = currentIntensity === "high" ? "고강도" : currentIntensity === "moderate" ? "중강도" : currentIntensity === "low" ? "저강도" : null;
  const intensityColor = currentIntensity === "high" ? "#EF4444" : currentIntensity === "moderate" ? "#F59E0B" : "#3B82F6";

  const isDark = mode === "dark";
  const bg = isDark
    ? "linear-gradient(160deg, #0a1a14 0%, #1B4332 40%, #2D6A4F 100%)"
    : "linear-gradient(160deg, #FAFBF9 0%, #F0FDF4 40%, #ECFDF5 100%)";
  const textPrimary = isDark ? "#FFFFFF" : "#1B4332";
  const textSecondary = isDark ? "rgba(255,255,255,0.5)" : "#6B7280";
  const textTertiary = isDark ? "rgba(255,255,255,0.3)" : "#9CA3AF";
  const pillBg = isDark ? "rgba(255,255,255,0.1)" : "#F3F4F6";
  const dividerColor = isDark ? "rgba(255,255,255,0.08)" : "#E5E7EB";

  const scrollRef = useRef<HTMLDivElement>(null);

  const captureCard = async (): Promise<Blob | null> => {
    if (!cardRef.current) return null;
    // Scroll preview to top so full card is captured
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    // Wait a frame for scroll to settle
    await new Promise(r => setTimeout(r, 50));
    const html2canvas = (await import("html2canvas-pro")).default;
    const canvas = await html2canvas(cardRef.current, {
      backgroundColor: null,
      scale: 3,
      useCORS: true,
      logging: false,
    });
    return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  };

  const handleShare = async () => {
    setIsCapturing(true);
    try {
      const blob = await captureCard();
      if (!blob) return;
      if (navigator.share && navigator.canShare?.({ files: [new File([blob], "plan.png", { type: "image/png" })] })) {
        const file = new File([blob], "ohunjal-plan.png", { type: "image/png" });
        await navigator.share({ files: [file], title: "오운잘 운동 플랜" });
      } else {
        downloadBlob(blob);
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") { /* canceled */ }
      else console.error("Share failed:", err);
    } finally {
      setIsCapturing(false);
    }
  };

  const handleDownload = async () => {
    setIsCapturing(true);
    try {
      const blob = await captureCard();
      if (blob) downloadBlob(blob);
    } catch (err) {
      console.error("Download failed:", err);
    } finally {
      setIsCapturing(false);
    }
  };

  const downloadBlob = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ohunjal-plan-${today.toISOString().slice(0, 10)}.png`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center animate-fade-in" style={{ padding: "env(safe-area-inset-top, 0px) 0 env(safe-area-inset-bottom, 0px) 0" }}>
      {/* Close */}
      <button onClick={onClose} className="absolute top-4 right-4 z-10 w-10 h-10 flex items-center justify-center" style={{ top: "max(1rem, env(safe-area-inset-top, 0px))" }}>
        <svg className="w-6 h-6 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <p className="text-white/60 text-xs font-bold mb-4 tracking-wider uppercase">플랜 공유</p>

      {/* Card Preview — auto height, fixed width */}
      <div ref={scrollRef} className="relative w-[270px] rounded-2xl overflow-y-auto max-w-[85vw] max-h-[70vh]">
        <div
          ref={cardRef}
          className="w-[270px] flex flex-col p-6"
          style={{
            background: bg,
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          {/* Header */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <span style={{
                fontSize: 9,
                fontWeight: 900,
                color: "#FFFFFF",
                background: "#1B4332",
                padding: "2px 6px",
                borderRadius: 4,
                letterSpacing: "0.1em",
              }}>
                AI
              </span>
              {intensityLabel && (
                <span style={{
                  fontSize: 9,
                  fontWeight: 900,
                  color: intensityColor,
                  background: isDark ? "rgba(255,255,255,0.1)" : `${intensityColor}15`,
                  padding: "2px 6px",
                  borderRadius: 4,
                }}>
                  {intensityLabel}
                </span>
              )}
            </div>
            <p style={{ fontSize: 18, fontWeight: 900, color: textPrimary, lineHeight: 1.2, letterSpacing: "-0.02em" }}>
              오늘의 운동 플랜
            </p>
            <p style={{ fontSize: 10, color: textSecondary, marginTop: 4, fontWeight: 600 }}>
              {dateStr}
            </p>
          </div>

          {/* Stats Row */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <div style={{ background: pillBg, borderRadius: 10, padding: "6px 12px", flex: 1, textAlign: "center" }}>
              <p style={{ fontSize: 8, fontWeight: 800, color: textTertiary, letterSpacing: "0.15em", textTransform: "uppercase" as const }}>종목</p>
              <p style={{ fontSize: 18, fontWeight: 900, color: textPrimary, lineHeight: 1.3 }}>{totalExercises}</p>
            </div>
            <div style={{ background: pillBg, borderRadius: 10, padding: "6px 12px", flex: 1, textAlign: "center" }}>
              <p style={{ fontSize: 8, fontWeight: 800, color: textTertiary, letterSpacing: "0.15em", textTransform: "uppercase" as const }}>총 세트</p>
              <p style={{ fontSize: 18, fontWeight: 900, color: textPrimary, lineHeight: 1.3 }}>{totalSets}</p>
            </div>
          </div>

          {/* Phase List */}
          <div>
            {grouped.map((phase, pi) => (
              <div key={phase.key} style={{ marginBottom: pi < grouped.length - 1 ? 12 : 0 }}>
                {/* Phase Label */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <div style={{ width: 3, height: 14, borderRadius: 2, background: phase.meta.color }} />
                  <span style={{ fontSize: 8, fontWeight: 900, color: textTertiary, letterSpacing: "0.15em" }}>
                    {phase.meta.label}
                  </span>
                </div>
                {/* Exercise Items */}
                {phase.exercises.map((ex, ei) => (
                  <div key={ei} style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "5px 0",
                    borderBottom: ei < phase.exercises.length - 1 ? `1px solid ${dividerColor}` : "none",
                    marginLeft: 9,
                  }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: textPrimary, flex: 1 }}>
                      {ex.name.split("(")[0].trim()}
                    </span>
                    <span style={{ fontSize: 9, fontWeight: 700, color: textSecondary, marginLeft: 8, whiteSpace: "nowrap", textAlign: "right", minWidth: 65 }}>
                      {rebuildCount(ex)}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Brand Footer */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginTop: 12 }}>
            <img src="/share.logo.png" alt="오운잘 AI" style={{ height: 60 }} />
          </div>
        </div>
      </div>

      {/* Mode Toggle + Actions */}
      <div className="flex items-center gap-4 mt-5">
        {/* Mode toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMode("dark")}
            className={`w-7 h-7 rounded-full border-2 transition-all ${
              mode === "dark" ? "border-emerald-400 scale-110" : "border-white/20"
            }`}
            style={{ background: "linear-gradient(135deg, #0a1a14, #1B4332)" }}
          />
          <button
            onClick={() => setMode("light")}
            className={`w-7 h-7 rounded-full border-2 transition-all ${
              mode === "light" ? "border-emerald-400 scale-110" : "border-white/20"
            }`}
            style={{ background: "linear-gradient(135deg, #FAFBF9, #ECFDF5)" }}
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-5 mt-5">
        <button onClick={handleDownload} disabled={isCapturing} className="flex flex-col items-center gap-1.5 opacity-80 hover:opacity-100 transition-opacity">
          <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </div>
          <span className="text-white/50 text-[10px] font-bold">저장</span>
        </button>
        <button onClick={handleShare} disabled={isCapturing} className="flex flex-col items-center gap-1.5 opacity-80 hover:opacity-100 transition-opacity">
          <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
          </div>
          <span className="text-white/50 text-[10px] font-bold">공유</span>
        </button>
      </div>

      {isCapturing && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="w-8 h-8 border-2 border-white/20 border-t-emerald-400 rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
};
