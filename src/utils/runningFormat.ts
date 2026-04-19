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

/**
 * 지속시간 포맷 (회의 64 후속, 2026-04-19): 콜론 표기로 통일
 * - < 1시간: "9:27" (m:ss) — 페이스 "4:43/km"와 시각 쌍
 * - ≥ 1시간: "1:09:27" (h:mm:ss)
 * 기존 "9m 27s" / "1h 12m 40s" 대비 30~33% 폭 압축, 한 줄 표시 안정.
 */
export function formatRunDuration(totalSec: number): string {
  if (!isFinite(totalSec) || totalSec < 0) return "0:00";
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.floor(totalSec % 60);
  const ss = String(s).padStart(2, "0");
  if (h > 0) {
    const mm = String(m).padStart(2, "0");
    return `${h}:${mm}:${ss}`;
  }
  return `${m}:${ss}`;
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
  // 회의 64-I (박서진 자문): tag-at-source 1순위 — 엔진이 직접 runType 세팅했으면 그걸 사용
  for (const ex of exercises) {
    if (ex.runType) return ex.runType;
  }
  // 2순위: 과거 Firestore 레코드 regex fallback
  for (const ex of exercises) {
    const c = ex.count || "";
    const n = ex.name || "";
    if (/걷기\s*\/?\s*\d+초\s*달리기/.test(c)) return "walkrun";
    if (/전력\s*\/?\s*\d+초\s*보통/.test(c)) return "fartlek";
    if (/전력\s*\/?\s*\d+초\s*회복/.test(c)) return "sprint";
    if (/템포/.test(n) || /템포/.test(c) || /tempo/i.test(n)) return "tempo";
    if (/LSD|장거리|long.*slow|long.*distance/i.test(n)) return "long";
    if (/이지\s*런|회복\s*러닝|easy.*run|recovery.*run|zone\s*2/i.test(n)) return "easy";
  }
  return null;
}

/**
 * 개별 운동이 러닝 실행 화면(GPS + 3분할 스탯)을 써야 하는지 판정.
 * FitScreen이 per-exercise 렌더하므로 세션 감지와 분리됨.
 * 회의 64-I (박서진 자문, 2026-04-18): tag-at-source 우선, regex는 legacy fallback.
 */
export type RunExerciseMode = "interval" | "continuous" | null;

export function detectRunExerciseMode(exercise: ExerciseStep): RunExerciseMode {
  // 1순위: exercise.runKind (엔진이 직접 태깅)
  if (exercise.runKind === "continuous") return "continuous";
  if (exercise.runKind === "interval") {
    // FitScreen intervalConfig regex로 파싱 가능한 것만 interval UI. 파싱 불가(Pure Sprints "20-30초…")는 continuous fallback.
    const c = exercise.count || "";
    if (/\d+초\s*(걷기|전력)\s*\/?\s*\d+초\s*(달리기|보통|회복)\s*[×x]\s*\d+/i.test(c)) {
      return "interval";
    }
    return "continuous";
  }
  // 2순위: 과거 Firestore 레코드용 regex fallback (v1 pre-태깅)
  const c = exercise.count || "";
  const n = exercise.name || "";
  if (/\d+초\s*(걷기|전력)\s*\/?\s*\d+초\s*(달리기|보통|회복)\s*[×x]\s*\d+/i.test(c)) {
    return "interval";
  }
  if (/템포|tempo/i.test(n) && /분/i.test(c)) return "continuous";
  if (/LSD|장거리|long.*slow|long.*distance/i.test(n)) return "continuous";
  if (/이지\s*런|회복\s*러닝|easy.*run|recovery.*run|zone\s*2/i.test(n)) return "continuous";
  return null;
}

/** 개별 운동의 러닝 타입 (RunningType). FitScreen completion 시 runningStats.runningType 결정용. */
export function detectExerciseRunningType(exercise: ExerciseStep): RunningType | null {
  // 1순위: tag-at-source
  if (exercise.runType) return exercise.runType;
  // 2순위: regex fallback
  const c = exercise.count || "";
  const n = exercise.name || "";
  // 회의 64-Y (2026-04-19): 8종 regex fallback (tag 없는 legacy 레코드용)
  if (/Time\s*Trial|All-out|전력\s*질주|기록\s*측정|2km\s*전력|5km\s*전력/i.test(n + " " + c)) return "time_trial";
  if (/Threshold|Sub-?T(?:hreshold)?|Bakken/i.test(n)) return "threshold";
  if (/Norwegian|4x4|4\s*×\s*4|변속주|Fartlek/i.test(n)) return "vo2_interval";
  if (/걷기\s*\/?\s*\d+초\s*달리기/.test(c)) return "walkrun";
  if (/전력\s*\/?\s*\d+초\s*보통/.test(c)) return "vo2_interval";
  if (/전력\s*\/?\s*\d+초\s*회복/.test(c)) return "sprint_interval";
  if (/스트라이드|Strides|Pure\s*Sprints/i.test(n) || /\d+m\s*[×x]\s*\d+/i.test(n + " " + c)) return "sprint_interval";
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
    case "easy": return "EASY RUN";
    case "long": return "LONG DISTANCE";
    case "tempo": return "TEMPO RUN";
    case "threshold": return "THRESHOLD";
    case "vo2_interval": return "VO2 INTERVAL";
    case "sprint_interval": return "SPRINT INTERVAL";
    case "time_trial": return "TIME TRIAL";
    // legacy (Firestore 과거 레코드 호환, Batch C 마이그 전)
    case "fartlek": return "VO2 INTERVAL";
    case "sprint": return "SPRINT INTERVAL";
  }
}
