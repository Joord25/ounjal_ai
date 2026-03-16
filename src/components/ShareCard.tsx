"use client";

import React, { useRef, useState } from "react";
import { WorkoutSessionData, ExerciseLog, WorkoutAnalysis } from "@/constants/workout";
import { WorkoutMetrics } from "@/utils/workoutMetrics";

interface ShareCardProps {
  sessionData: WorkoutSessionData;
  logs: Record<number, ExerciseLog[]>;
  metrics: WorkoutMetrics;
  analysis?: WorkoutAnalysis | null;
  bodyWeightKg?: number;
  sessionDate?: string;
  onClose: () => void;
}

// 3대 운동 판별 (바벨 백스쿼트, 벤치프레스, 데드리프트)
const BIG3_KEYWORDS = ["바벨 백 스쿼트", "벤치 프레스", "데드리프트", "barbell back squat", "bench press", "deadlift"];

function isBig3(name: string): boolean {
  const lower = name.toLowerCase();
  return BIG3_KEYWORDS.some(k => lower.includes(k.toLowerCase()));
}

// 재미있는 실물 비교 (무게 kg 기준)
function getWeightComparison(kg: number): { image: string | null; emoji: string; name: string; drama: string } {
  if (kg >= 200) return { image: "/lion.png", emoji: "", name: "수컷 사자", drama: "수컷 사자 1마리를 거뜬히 들어올린다" };
  if (kg >= 150) return { image: null, emoji: "🏍️", name: "대형 오토바이", drama: "대형 오토바이 1대를 거뜬히 들어올린다" };
  if (kg >= 120) return { image: null, emoji: "🧊", name: "대형 냉장고", drama: "대형 냉장고 1대를 거뜬히 들어올린다" };
  if (kg >= 100) return { image: "/panda.png", emoji: "", name: "성인 판다", drama: "성인 판다 1마리를 거뜬히 들어올린다" };
  if (kg >= 80) return { image: null, emoji: "🚴", name: "성인남성", drama: "성인남성 1명을 거뜬히 들어올린다" };
  if (kg >= 60) return { image: "/bigdog.png", emoji: "", name: "대형견", drama: "대형견 1마리 정도는 Easy" };
  if (kg >= 40) return { image: null, emoji: "🧳", name: "대형 캐리어", drama: "대형 캐리어 2개를 거뜬히 들어올린다" };
  return { image: null, emoji: "🎒", name: "쌀포대", drama: "쌀포대 1개를 거뜬히 들어올린다" };
}

export const ShareCard: React.FC<ShareCardProps> = ({
  sessionData,
  logs,
  metrics,
  bodyWeightKg,
  sessionDate,
  onClose,
}) => {
  const [currentCard, setCurrentCard] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);
  const [mode, setMode] = useState<"transparent" | "filled">("transparent");
  const cardRef = useRef<HTMLDivElement>(null);

  const date = sessionDate ? new Date(sessionDate) : new Date();
  const dateStr = `${String(date.getFullYear()).slice(2)}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;

  const { totalVolume, allE1RMs, totalDurationSec, sessionCategory } = metrics;
  const isStrength = sessionCategory === "strength" || sessionCategory === "mixed";

  const formatDuration = (sec: number) => {
    if (sec >= 3600) return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
    if (sec >= 60) return `${Math.floor(sec / 60)}m ${sec % 60 > 0 ? `${sec % 60}s` : ""}`.trim();
    return `${sec}s`;
  };

  // 메인 운동 목록 (warmup, core, mobility 제외 — 오직 strength만)
  const mainExercises = sessionData.exercises
    .filter(ex => ex.type === "strength" || ex.type === "cardio")
    .map((ex) => {
      const origIdx = sessionData.exercises.indexOf(ex);
      const exLogs = logs[origIdx] || [];
      const completedSets = exLogs.filter(l => (l.repsCompleted ?? 0) > 0).length;
      return { name: ex.name, nameKo: ex.name.replace(/\s*\(.*\)$/, ""), sets: completedSets, type: ex.type };
    })
    .filter(e => e.sets > 0 && e.type === "strength");

  // 3대 운동 중 수행한 것의 E1RM
  const big3E1RM = allE1RMs.find(e => isBig3(e.exerciseName));

  // 카드 2 표시 여부: 3대 운동 E1RM이 있고 체중이 있을 때만
  const showCard2 = !!(big3E1RM && bodyWeightKg);
  const totalCards = showCard2 ? 2 : 1;

  const labelColor = mode === "filled" ? "rgba(52,211,153,0.6)" : "rgba(255,255,255,0.5)";
  const shadow = mode === "transparent" ? "0 2px 8px rgba(0,0,0,0.8)" : "none";
  const shadowLight = mode === "transparent" ? "0 1px 4px rgba(0,0,0,0.8)" : "none";

  const captureCard = async (): Promise<Blob | null> => {
    if (!cardRef.current) return null;
    const html2canvas = (await import("html2canvas-pro")).default;
    const canvas = await html2canvas(cardRef.current, {
      backgroundColor: "rgba(0,0,0,0)",
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
      if (navigator.share && navigator.canShare?.({ files: [new File([blob], "ohunjal.png", { type: "image/png" })] })) {
        const file = new File([blob], "ohunjal-workout.png", { type: "image/png" });
        await navigator.share({ files: [file], title: "오운잘 운동 기록" });
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
    a.download = `ohunjal-${date.toISOString().slice(0, 10)}.png`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Swipe
  const touchStartX = useRef(0);
  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0 && currentCard < totalCards - 1) setCurrentCard(c => c + 1);
      if (diff < 0 && currentCard > 0) setCurrentCard(c => c - 1);
    }
  };

  // Brand footer (shared)
  const BrandFooter = () => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginTop: 4 }}>
      <img src="/share.logo.png" alt="오운잘 AI" style={{ height: 100 }} />
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center animate-fade-in" style={{ padding: "env(safe-area-inset-top, 0px) 0 env(safe-area-inset-bottom, 0px) 0" }}>
      {/* Close */}
      <button onClick={onClose} className="absolute top-4 right-4 z-10 w-10 h-10 flex items-center justify-center" style={{ top: "max(1rem, env(safe-area-inset-top, 0px))" }}>
        <svg className="w-6 h-6 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <p className="text-white/60 text-xs font-bold mb-4 tracking-wider uppercase">운동 기록 공유</p>

      {/* Card preview */}
      <div
        className="relative w-[300px] h-[480px] rounded-2xl overflow-hidden max-w-[90vw] max-h-[60vh]"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={mode === "transparent" ? {
          aspectRatio: "300/480",
          backgroundImage: "linear-gradient(45deg, #333 25%, transparent 25%), linear-gradient(-45deg, #333 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #333 75%), linear-gradient(-45deg, transparent 75%, #333 75%)",
          backgroundSize: "16px 16px",
          backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
        } : { aspectRatio: "300/480" }}
      >
        <div
          ref={cardRef}
          className="w-[300px] h-[480px] flex flex-col justify-center items-center p-7"
          style={{
            background: mode === "filled" ? "linear-gradient(135deg, #0a1a14 0%, #1B4332 50%, #2D6A4F 100%)" : "transparent",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          {/* ===== Card 1: Summary ===== */}
          {currentCard === 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center", textAlign: "center", width: "100%" }}>
              {/* Training Type */}
              <div>
                <p style={{ color: labelColor, fontSize: 12, fontWeight: 700, letterSpacing: "0.05em", marginBottom: 4 }}>
                  {dateStr}
                </p>
                <p style={{ color: "white", fontSize: 20, fontWeight: 900, lineHeight: 1.3, textShadow: shadow }}>
                  {/* "근력 훈련 • 전반적 피로감 회복 • 3세트" → "근력 훈련" */}
                  {(() => {
                    const raw = (sessionData.description || sessionData.title).replace(/^(monday|tuesday|wednesday|thursday|friday|saturday|sunday|[월화수목금토일]요일)[:\s]*/i, "");
                    return raw.includes("•") ? raw.split("•")[0].trim() : raw.split(" - ")[0].trim();
                  })()}
                </p>
              </div>

              {/* Main Exercises */}
              <div>
                <p style={{ color: labelColor, fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase" as const, marginBottom: 8 }}>
                  EXERCISES
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {mainExercises.slice(0, 6).map((ex, i) => (
                    <p key={i} style={{
                      color: "white",
                      fontSize: 14,
                      fontWeight: 700,
                      lineHeight: 1.4,
                      textShadow: shadow,
                    }}>
                      {ex.nameKo}
                    </p>
                  ))}
                  {mainExercises.length > 6 && (
                    <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 600 }}>
                      +{mainExercises.length - 6}
                    </p>
                  )}
                </div>
              </div>

              {/* Volume + Time row */}
              <div style={{ display: "flex", gap: 24, justifyContent: "center" }}>
                {isStrength && totalVolume > 0 && (
                  <div>
                    <p style={{ color: labelColor, fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase" as const, marginBottom: 4 }}>Volume</p>
                    <p style={{ color: "white", fontSize: 28, fontWeight: 900, lineHeight: 1, textShadow: shadow }}>
                      {totalVolume.toLocaleString()}
                      <span style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", marginLeft: 2 }}>kg</span>
                    </p>
                  </div>
                )}
                <div>
                  <p style={{ color: labelColor, fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase" as const, marginBottom: 4 }}>Time</p>
                  <p style={{ color: "white", fontSize: 28, fontWeight: 900, lineHeight: 1, textShadow: shadow }}>
                    {formatDuration(totalDurationSec)}
                  </p>
                </div>
              </div>

              <BrandFooter />
            </div>
          )}

          {/* ===== Card 2: Big 3 Lift 1RM ===== */}
          {currentCard === 1 && showCard2 && big3E1RM && bodyWeightKg && (() => {
            const comparison = getWeightComparison(big3E1RM.value);
            return (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center", textAlign: "center", width: "100%" }}>
              {/* Illustration */}
              <div style={{ marginBottom: 4 }}>
                {comparison.image ? (
                  <img src={comparison.image} alt="" style={{ height: 140, objectFit: "contain" }} />
                ) : (
                  <p style={{ fontSize: 64, lineHeight: 1 }}>{comparison.emoji}</p>
                )}
              </div>

              {/* Drama text */}
              <p style={{
                color: "white",
                fontSize: 18,
                fontWeight: 900,
                lineHeight: 1.5,
                textShadow: shadow,
              }}>
                {comparison.drama}
              </p>

              {/* Exercise + Weight */}
              <div style={{
                display: "flex",
                alignItems: "baseline",
                gap: 8,
                justifyContent: "center",
              }}>
                <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: 700, textShadow: shadowLight }}>
                  {big3E1RM.exerciseName.replace(/\s*\(.*\)$/, "")}
                </span>
                <span style={{ color: "white", fontSize: 28, fontWeight: 900, textShadow: shadow }}>
                  {Math.round(big3E1RM.value)}
                  <span style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", marginLeft: 2 }}>kg</span>
                </span>
              </div>

              {/* Other big 3 lifts if available */}
              {(() => {
                const otherBig3 = allE1RMs.filter(e => e !== big3E1RM && isBig3(e.exerciseName));
                if (otherBig3.length === 0) return null;
                return (
                  <div style={{ width: "100%", marginTop: 4 }}>
                    {otherBig3.map((e, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 600, textShadow: shadowLight }}>
                          {e.exerciseName.replace(/\s*\(.*\)$/, "")}
                        </span>
                        <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: 800, textShadow: shadowLight }}>
                          {Math.round(e.value)}kg
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })()}

              <BrandFooter />
            </div>
            );
          })()}
        </div>
      </div>

      {/* Dots + Mode toggle */}
      <div className="flex items-center gap-4 mt-5">
        {/* Dots */}
        {totalCards > 1 && (
          <div className="flex gap-2">
            {Array.from({ length: totalCards }).map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentCard(i)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === currentCard ? "w-6 bg-emerald-400" : "w-1.5 bg-white/30"
                }`}
              />
            ))}
          </div>
        )}

        <div className="w-px h-4 bg-white/20" />

        {/* Mode toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMode("transparent")}
            className={`w-7 h-7 rounded-full border-2 transition-all ${
              mode === "transparent" ? "border-emerald-400 scale-110" : "border-white/20"
            }`}
            style={{
              backgroundImage: "linear-gradient(45deg, #555 25%, transparent 25%), linear-gradient(-45deg, #555 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #555 75%), linear-gradient(-45deg, transparent 75%, #555 75%)",
              backgroundSize: "6px 6px",
              backgroundPosition: "0 0, 0 3px, 3px -3px, -3px 0px",
            }}
          />
          <button
            onClick={() => setMode("filled")}
            className={`w-7 h-7 rounded-full border-2 transition-all ${
              mode === "filled" ? "border-emerald-400 scale-110" : "border-white/20"
            }`}
            style={{ background: "linear-gradient(135deg, #0a1a14, #1B4332)" }}
          />
        </div>
      </div>

      {/* Action buttons */}
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
