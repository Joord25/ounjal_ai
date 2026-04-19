"use client";

import React, { useRef, useState } from "react";
import { WorkoutSessionData, ExerciseLog, WorkoutAnalysis, WorkoutHistory, RunningStats } from "@/constants/workout";
import { WorkoutMetrics } from "@/utils/workoutMetrics";
import { useTranslation } from "@/hooks/useTranslation";
import { useUnits } from "@/hooks/useUnits";
import { kgToLb } from "@/utils/units";
import { getExerciseName } from "@/utils/exerciseName";
import { formatPace, formatRunDistanceKm, formatRunDuration, detectRunningType, getRunningTypeShareLabel } from "@/utils/runningFormat";

interface ShareCardProps {
  sessionData: WorkoutSessionData;
  logs: Record<number, ExerciseLog[]>;
  metrics: WorkoutMetrics;
  analysis?: WorkoutAnalysis | null;
  bodyWeightKg?: number; // kept for interface compatibility
  sessionDate?: string;
  recentHistory?: WorkoutHistory[];
  runningStats?: RunningStats;  // 회의 41: 러닝 세션 전용
  onClose: () => void;
}


// PR 감지: 오늘 세션의 e1RM이 과거 기록보다 높은지 확인
function detectPRs(
  allE1RMs: { exerciseName: string; value: number }[],
  history: WorkoutHistory[],
): { exerciseName: string; value: number; prevBest: number }[] {
  // 과거 기록에서 각 운동의 최고 e1RM 추출
  const historyBestMap = new Map<string, number>();
  for (const h of history) {
    const exercises = h.sessionData?.exercises || [];
    const hLogs = h.logs || {};
    exercises.forEach((ex, idx) => {
      const exLogs = hLogs[idx] || [];
      for (const log of exLogs) {
        const weightStr = log.weightUsed || ex.weight;
        if (!weightStr || weightStr === "Bodyweight") continue;
        const weight = parseFloat(weightStr);
        if (isNaN(weight) || weight <= 0) continue;
        const reps = typeof log.repsCompleted === "number" ? log.repsCompleted : (parseInt(String(log.repsCompleted)) || 0);
        if (reps <= 0) continue;
        const e1rm = weight * (1 + reps / 30);
        const prev = historyBestMap.get(ex.name) || 0;
        if (e1rm > prev) historyBestMap.set(ex.name, e1rm);
      }
    });
  }

  const prs: { exerciseName: string; value: number; prevBest: number }[] = [];
  for (const today of allE1RMs) {
    const prevBest = historyBestMap.get(today.exerciseName);
    // PR = 과거 기록이 있고, 오늘이 더 높을 때만 (첫 기록은 PR 아님)
    if (prevBest !== undefined && today.value > prevBest) {
      prs.push({ exerciseName: today.exerciseName, value: today.value, prevBest });
    }
  }
  return prs.sort((a, b) => b.value - a.value);
}

export const ShareCard: React.FC<ShareCardProps> = ({
  sessionData,
  logs,
  metrics,
  sessionDate,
  recentHistory = [],
  runningStats,
  onClose,
}) => {
  const { locale, t } = useTranslation();
  const { system: unitSystem, labels: unitLabels } = useUnits();
  const U = unitLabels.weight;
  const toDispW = (kg: number) => unitSystem === "imperial" ? Math.round(kgToLb(kg) * 10) / 10 : kg;
  const [currentCard, setCurrentCard] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);
  const [mode, setMode] = useState<"transparent" | "filled">("transparent");
  const cardRef = useRef<HTMLDivElement>(null);

  const date = sessionDate ? new Date(sessionDate) : new Date();
  const dateStr = `${String(date.getFullYear()).slice(2)}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;

  const { totalVolume, allE1RMs, totalDurationSec, sessionCategory } = metrics;
  const isStrength = sessionCategory === "strength" || sessionCategory === "mixed";

  // 회의 41: 러닝 세션 감지 및 공유카드 분기 데이터 (runningStats는 prop으로 수신)
  const runningType = detectRunningType(sessionData.exercises);
  const isRunning = runningType !== null;
  // recentHistory에서 이번 주(월~일) 러닝 집계 (카드 2 Weekly용)
  const weeklyRunning = (() => {
    if (!isRunning) return null;
    const now = new Date();
    const dow = (now.getDay() + 6) % 7; // 월=0 ... 일=6
    const monday = new Date(now);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(now.getDate() - dow);
    let runs = 0;
    let totalDistance = 0;
    let totalDuration = 0;
    for (const h of recentHistory) {
      if (!h.runningStats) continue;
      const d = new Date(h.date);
      if (d >= monday) {
        runs += 1;
        totalDistance += h.runningStats.distance;
        totalDuration += h.runningStats.duration;
      }
    }
    // 오늘 세션도 포함 (히스토리에 아직 반영 전일 수 있음)
    if (runningStats) {
      runs += 1;
      totalDistance += runningStats.distance;
      totalDuration += runningStats.duration;
    }
    return { runs, totalDistance, totalDuration };
  })();

  const formatDuration = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  // 메인 운동 목록 (warmup, core, mobility 제외 — 오직 strength만)
  const mainExercises = sessionData.exercises
    .filter(ex => ex.type === "strength" || ex.type === "cardio")
    .map((ex) => {
      const origIdx = sessionData.exercises.indexOf(ex);
      const exLogs = logs[origIdx] || [];
      const completedSets = exLogs.filter(l => (l.repsCompleted ?? 0) > 0).length;
      // 공유카드: ko일 때 한글명만 (영문 괄호 제거)
      const fullName = getExerciseName(ex.name, locale);
      const displayName = locale === "ko" ? fullName.split("(")[0].trim() : fullName;
      return { name: ex.name, displayName, sets: completedSets, type: ex.type };
    })
    .filter(e => e.sets > 0 && e.type === "strength");

  // PR 감지
  const prs = detectPRs(allE1RMs, recentHistory);
  const hasPR = prs.length > 0;

  // 카드 2: 항상 표시 (PR 있으면 PR 카드, 없으면 노력 요약 카드)
  const totalCards = 2;

  const labelColor = mode === "filled" ? "rgba(52,211,153,0.6)" : "rgba(255,255,255,0.5)";
  const shadow = mode === "transparent" ? "0 2px 8px rgba(0,0,0,0.8)" : "none";


  const captureCard = async (): Promise<Blob | null> => {
    if (!cardRef.current) return null;
    const html2canvas = (await import("html2canvas-pro")).default;
    // 회의 64-α 후속: 폰트 로딩 완료 대기 (Rubik 등 Google Fonts가 캡처 전 준비되도록)
    if (typeof document !== "undefined" && "fonts" in document) {
      try { await (document as Document & { fonts: { ready: Promise<void> } }).fonts.ready; } catch {}
    }
    const canvas = await html2canvas(cardRef.current, {
      // iOS Safari에서 transparent 폴백 시 흰 배경으로 나오는 이슈 방지 — 필드 시 solid 다크 지정
      backgroundColor: mode === "filled" ? "#1B4332" : null,
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
        await navigator.share({ files: [file], title: locale === "ko" ? "오운잘 운동 기록" : "Ohunjal Workout" });
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
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginTop: 8 }}>
      <img src="/share.logo.png" alt="Ohunjal AI" style={{ height: 100 }} />
    </div>
  );

  return (
    <div className="fixed inset-0 z-[200] bg-black/90 flex flex-col items-center animate-fade-in" style={{ padding: "max(1rem, env(safe-area-inset-top, 0px)) 0 calc(max(1rem, env(safe-area-inset-bottom, 0px)) + 60px) 0" }}>
      {/* Close */}
      <button onClick={onClose} className="absolute top-4 right-4 z-10 w-10 h-10 flex items-center justify-center" style={{ top: "max(1rem, env(safe-area-inset-top, 0px))" }}>
        <svg className="w-6 h-6 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <p className="text-white/60 text-xs font-bold mb-4 tracking-wider uppercase">{locale === "ko" ? "운동 기록 공유" : "Share Workout"}</p>

      {/* Card preview */}
      <div
        className="relative w-[300px] h-[533px] rounded-2xl overflow-hidden max-w-[90vw] max-h-[60vh]"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={mode === "transparent" ? {
          aspectRatio: "9/16",
          backgroundImage: "linear-gradient(45deg, #333 25%, transparent 25%), linear-gradient(-45deg, #333 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #333 75%), linear-gradient(-45deg, transparent 75%, #333 75%)",
          backgroundSize: "16px 16px",
          backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
        } : { aspectRatio: "9/16" }}
      >
        <div
          ref={cardRef}
          className="w-[300px] h-[533px] flex flex-col justify-center items-center p-5"
          style={{
            // 회의 64-α 후속 (2026-04-19): iOS Safari html2canvas 캡처에서 linear-gradient가 빠지는 이슈 대응
            // backgroundColor(solid) + backgroundImage(gradient) 분리 → gradient 실패해도 solid는 유지
            backgroundColor: mode === "filled" ? "#1B4332" : "transparent",
            backgroundImage: mode === "filled" ? "linear-gradient(135deg, #0a1a14 0%, #1B4332 50%, #2D6A4F 100%)" : "none",
            fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', 'Helvetica Neue', sans-serif",
          }}
        >
          {/* ===== Card 1: Summary ===== */}
          {currentCard === 0 && !isRunning && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center", textAlign: "center", width: "100%" }}>
              {/* Training Type */}
              <div>
                <p style={{ color: labelColor, fontSize: 12, fontWeight: 700, letterSpacing: "0.05em" }}>
                  {dateStr}
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
                      {ex.displayName}
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
                      {Math.round(toDispW(totalVolume)).toLocaleString()}
                      <span style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", marginLeft: 2 }}>{U}</span>
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

          {/* ===== Card 1: Running Summary (회의 41, Strava 세로 3스탯) ===== */}
          {currentCard === 0 && isRunning && runningType && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", width: "100%" }}>
              {/* 날짜·타입 헤더 제거 (대표 지시 2026-04-19): 깔끔한 스탯 중심 카드 */}
              {/* html2canvas 호환 위해 gap 대신 marginBottom 사용 */}

              {/* Distance */}
              <div style={{ textAlign: "center", marginBottom: 12 }}>
                <p style={{ color: "white", fontSize: 15, fontWeight: 600, letterSpacing: "0em", marginBottom: 4, lineHeight: 1, fontFamily: "var(--font-rubik), -apple-system, BlinkMacSystemFont, sans-serif" }}>
                  {t("share.running.distance")}
                </p>
                <p style={{ color: "white", fontSize: 52, fontWeight: 700, lineHeight: 1, textShadow: shadow, letterSpacing: "-0.02em", fontFamily: "var(--font-rubik), -apple-system, BlinkMacSystemFont, sans-serif" }}>
                  {formatRunDistanceKm(runningStats?.distance)}
                  <span style={{ fontSize: 20, color: "white", marginLeft: 5, fontWeight: 600, letterSpacing: "-0.01em", fontFamily: "var(--font-rubik), -apple-system, BlinkMacSystemFont, sans-serif" }}>{t("share.running.unitKm")}</span>
                </p>
              </div>

              {/* Pace */}
              <div style={{ textAlign: "center", marginBottom: 12 }}>
                <p style={{ color: "white", fontSize: 15, fontWeight: 600, letterSpacing: "0em", marginBottom: 4, lineHeight: 1, fontFamily: "var(--font-rubik), -apple-system, BlinkMacSystemFont, sans-serif" }}>
                  {t("share.running.pace")}
                </p>
                <p style={{ color: "white", fontSize: 52, fontWeight: 700, lineHeight: 1, textShadow: shadow, letterSpacing: "-0.02em", fontFamily: "var(--font-rubik), -apple-system, BlinkMacSystemFont, sans-serif" }}>
                  {formatPace(runningStats?.sprintAvgPace ?? runningStats?.avgPace)}
                  <span style={{ fontSize: 20, color: "white", marginLeft: 5, fontWeight: 600, letterSpacing: "-0.01em", fontFamily: "var(--font-rubik), -apple-system, BlinkMacSystemFont, sans-serif" }}>{t("share.running.unitPerKm")}</span>
                </p>
              </div>

              {/* Time */}
              <div style={{ textAlign: "center", marginBottom: 20 }}>
                <p style={{ color: "white", fontSize: 15, fontWeight: 600, letterSpacing: "0em", marginBottom: 4, lineHeight: 1, fontFamily: "var(--font-rubik), -apple-system, BlinkMacSystemFont, sans-serif" }}>
                  {t("share.running.time")}
                </p>
                <p style={{ color: "white", fontSize: 52, fontWeight: 700, lineHeight: 1, textShadow: shadow, letterSpacing: "-0.02em", fontFamily: "var(--font-rubik), -apple-system, BlinkMacSystemFont, sans-serif" }}>
                  {formatRunDuration(runningStats?.duration ?? totalDurationSec).replace(/:/g, " : ")}
                </p>
              </div>

              <BrandFooter />
            </div>
          )}

          {/* ===== Card 2: PR 달성 or 노력 요약 ===== */}
          {currentCard === 1 && isRunning && weeklyRunning && (
            <div style={{ display: "flex", flexDirection: "column", gap: 28, alignItems: "center", width: "100%" }}>
              <p style={{ color: labelColor, fontSize: 11, fontWeight: 800, letterSpacing: "0.15em" }}>
                {t("share.running.weekly.title")}
              </p>

              {/* Runs */}
              <div style={{ textAlign: "center" }}>
                <p style={{ color: labelColor, fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                  {t("share.running.weekly.runs")}
                </p>
                <p style={{ color: "white", fontSize: 44, fontWeight: 900, lineHeight: 1, textShadow: shadow }}>
                  {weeklyRunning.runs}
                </p>
              </div>

              {/* Total Time */}
              <div style={{ textAlign: "center" }}>
                <p style={{ color: labelColor, fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                  {t("share.running.weekly.totalTime")}
                </p>
                <p style={{ color: "white", fontSize: 36, fontWeight: 900, lineHeight: 1, textShadow: shadow }}>
                  {formatRunDuration(weeklyRunning.totalDuration)}
                </p>
              </div>

              {/* Total Distance (실내 누적 제외 — distance > 0만) */}
              {weeklyRunning.totalDistance > 0 && (
                <div style={{ textAlign: "center" }}>
                  <p style={{ color: labelColor, fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                    {t("share.running.weekly.totalDistance")}
                  </p>
                  <p style={{ color: "white", fontSize: 36, fontWeight: 900, lineHeight: 1, textShadow: shadow }}>
                    {formatRunDistanceKm(weeklyRunning.totalDistance)}
                    <span style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", marginLeft: 4, fontWeight: 700 }}>{t("share.running.unitKm")}</span>
                  </p>
                </div>
              )}

              <BrandFooter />
            </div>
          )}

          {/* ===== Card 2: PR 달성 or 노력 요약 (웨이트) ===== */}
          {currentCard === 1 && !isRunning && (() => {
            const totalSetsCount = mainExercises.reduce((sum, ex) => sum + ex.sets, 0);

            if (hasPR) {
              // PR 카드
              const topPR = prs[0];
              const improvement = Math.round(topPR.value - topPR.prevBest);
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 28, alignItems: "center", width: "100%" }}>
                  <p style={{ color: "#FCD34D", fontSize: 11, fontWeight: 800, letterSpacing: "0.15em" }}>
                    PERSONAL RECORD
                  </p>

                  <div style={{ display: "flex", flexDirection: "column", gap: 24, width: "100%" }}>
                    <div>
                      <p style={{ color: labelColor, fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                        {locale === "ko" ? getExerciseName(topPR.exerciseName, locale).split("(")[0].trim() : getExerciseName(topPR.exerciseName, locale)}
                      </p>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                        <span style={{ color: "white", fontSize: 40, fontWeight: 900, lineHeight: 1, textShadow: shadow }}>
                          {Math.round(toDispW(topPR.value))}
                        </span>
                        <span style={{ color: labelColor, fontSize: 16, fontWeight: 700 }}>{U}</span>
                        <span style={{ color: "#FCD34D", fontSize: 14, fontWeight: 800, marginLeft: 4 }}>+{Math.round(toDispW(typeof improvement === "number" ? improvement : parseFloat(String(improvement))))}</span>
                      </div>
                    </div>

                    {prs.slice(1, 3).map((pr, i) => (
                      <div key={i}>
                        <p style={{ color: labelColor, fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                          {locale === "ko" ? getExerciseName(pr.exerciseName, locale).split("(")[0].trim() : getExerciseName(pr.exerciseName, locale)}
                        </p>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                          <span style={{ color: "white", fontSize: 28, fontWeight: 900, lineHeight: 1, textShadow: shadow }}>
                            {Math.round(toDispW(pr.value))}
                          </span>
                          <span style={{ color: labelColor, fontSize: 14, fontWeight: 700 }}>{U}</span>
                          <span style={{ color: "#FCD34D", fontSize: 12, fontWeight: 800, marginLeft: 4 }}>+{Math.round(toDispW(pr.value - pr.prevBest))}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <BrandFooter />
                </div>
              );
            }

            // 노력 요약 카드 — Strava 스타일 미니멀
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 28, alignItems: "center", width: "100%" }}>
                <div style={{ textAlign: "center" }}>
                  <p style={{ color: labelColor, fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Sets</p>
                  <p style={{ color: "white", fontSize: 40, fontWeight: 900, lineHeight: 1, textShadow: shadow }}>
                    {totalSetsCount}<span style={{ color: labelColor, fontSize: 16, fontWeight: 700, marginLeft: 4 }}>{locale === "ko" ? "세트" : "sets"}</span>
                  </p>
                </div>

                <div style={{ textAlign: "center" }}>
                  <p style={{ color: labelColor, fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Time</p>
                  <p style={{ color: "white", fontSize: 40, fontWeight: 900, lineHeight: 1, textShadow: shadow }}>
                    {formatDuration(totalDurationSec)}
                  </p>
                </div>

                {isStrength && totalVolume > 0 && (
                  <div style={{ textAlign: "center" }}>
                    <p style={{ color: labelColor, fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Volume</p>
                    <p style={{ color: "white", fontSize: 40, fontWeight: 900, lineHeight: 1, textShadow: shadow }}>
                      {Math.round(toDispW(totalVolume)).toLocaleString()}<span style={{ color: labelColor, fontSize: 16, fontWeight: 700, marginLeft: 4 }}>{U}</span>
                    </p>
                  </div>
                )}

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
      <div className="flex items-center gap-5 mt-4 shrink-0 mb-4">
        <button onClick={handleDownload} disabled={isCapturing} className="flex flex-col items-center gap-1.5 opacity-80 hover:opacity-100 transition-opacity">
          <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </div>
          <span className="text-white/50 text-[10px] font-bold">{locale === "ko" ? "저장" : "Save"}</span>
        </button>
        <button onClick={handleShare} disabled={isCapturing} className="flex flex-col items-center gap-1.5 opacity-80 hover:opacity-100 transition-opacity">
          <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
          </div>
          <span className="text-white/50 text-[10px] font-bold">{locale === "ko" ? "공유" : "Share"}</span>
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
