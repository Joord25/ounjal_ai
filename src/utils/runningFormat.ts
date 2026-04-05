import type { ExerciseStep, RunningType } from "@/constants/workout";

/** 페이스(sec/km) → "m:ss" 문자열. null이면 "—". */
export function formatPace(secPerKm: number | null | undefined): string {
  if (secPerKm == null || !isFinite(secPerKm) || secPerKm <= 0) return "—";
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** 거리(meters) → "5.01" (소수 2자리 문자열). 0/null이면 "—". */
export function formatRunDistanceKm(meters: number | null | undefined): string {
  if (meters == null || !isFinite(meters) || meters <= 0) return "—";
  return (meters / 1000).toFixed(2);
}

/** Strava 스타일 지속시간 포맷 "32m 22s" 또는 "1h 12m 40s". */
export function formatRunDuration(totalSec: number): string {
  if (!isFinite(totalSec) || totalSec < 0) return "0m 0s";
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.floor(totalSec % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

/**
 * 세션의 exercises에서 러닝 타입을 감지.
 * 회의 41/43:
 * - walkrun: "N초 걷기 / M초 달리기" (인터벌)
 * - fartlek: "N초 전력 / M초 보통" (인터벌)
 * - sprint: "N초 전력 / M초 회복" (인터벌)
 * - tempo: "템포" 키워드 (연속)
 * - easy: 이지/회복 러닝 (연속)
 * - long: LSD/장거리 러닝 (연속)
 */
export function detectRunningType(exercises: ExerciseStep[]): RunningType | null {
  for (const ex of exercises) {
    const c = ex.count || "";
    const n = ex.name || "";
    // 인터벌 우선 (패턴 매칭)
    if (/걷기\s*\/?\s*\d+초\s*달리기/.test(c)) return "walkrun";
    if (/전력\s*\/?\s*\d+초\s*보통/.test(c)) return "fartlek";
    if (/전력\s*\/?\s*\d+초\s*회복/.test(c)) return "sprint";
    // 연속 러닝 (이름 키워드)
    if (/템포/.test(n) || /템포/.test(c) || /tempo/i.test(n)) return "tempo";
    if (/LSD|장거리|long.*slow|long.*distance/i.test(n)) return "long";
    if (/이지\s*런|회복\s*러닝|easy.*run|recovery.*run|zone\s*2/i.test(n)) return "easy";
  }
  return null;
}

/**
 * 개별 운동이 러닝 실행 화면(GPS + 3분할 스탯)을 써야 하는지 판정.
 * FitScreen이 per-exercise 렌더하므로 세션 감지와 분리됨.
 * 회의 43: 인터벌/연속 러닝 모두 포함.
 */
export type RunExerciseMode = "interval" | "continuous" | null;

export function detectRunExerciseMode(exercise: ExerciseStep): RunExerciseMode {
  const c = exercise.count || "";
  const n = exercise.name || "";
  // 인터벌 패턴 (FitScreen intervalConfig와 동일 규칙)
  if (/\d+초\s*(걷기|전력)\s*\/?\s*\d+초\s*(달리기|보통|회복)\s*[×x]\s*\d+/i.test(c)) {
    return "interval";
  }
  // 연속 러닝 (이름 키워드)
  if (/템포|tempo/i.test(n) && /분/i.test(c)) return "continuous";
  if (/LSD|장거리|long.*slow|long.*distance/i.test(n)) return "continuous";
  if (/이지\s*런|회복\s*러닝|easy.*run|recovery.*run|zone\s*2/i.test(n)) return "continuous";
  return null;
}

/** 개별 운동의 러닝 타입 (RunningType). FitScreen completion 시 runningStats.runningType 결정용. */
export function detectExerciseRunningType(exercise: ExerciseStep): RunningType | null {
  const c = exercise.count || "";
  const n = exercise.name || "";
  if (/걷기\s*\/?\s*\d+초\s*달리기/.test(c)) return "walkrun";
  if (/전력\s*\/?\s*\d+초\s*보통/.test(c)) return "fartlek";
  if (/전력\s*\/?\s*\d+초\s*회복/.test(c)) return "sprint";
  if (/템포|tempo/i.test(n)) return "tempo";
  if (/LSD|장거리|long.*slow|long.*distance/i.test(n)) return "long";
  if (/이지\s*런|회복\s*러닝|easy.*run|recovery.*run|zone\s*2/i.test(n)) return "easy";
  return null;
}

/** 러닝 세션 여부 판정 (공유카드/리포트 분기용). */
export function isRunningSession(exercises: ExerciseStep[]): boolean {
  return detectRunningType(exercises) !== null;
}

/** 러닝 타입의 대문자 i18n 라벨 키 반환. */
export function getRunningTypeShareLabel(type: RunningType, locale: string): string {
  // ko/en 동일 대문자 라벨 — 브랜드 톤
  void locale;
  switch (type) {
    case "walkrun": return "WALK-RUN";
    case "tempo": return "TEMPO RUN";
    case "fartlek": return "FARTLEK";
    case "sprint": return "SPRINT INTERVAL";
    case "easy": return "EASY RUN";
    case "long": return "LONG DISTANCE";
  }
}
