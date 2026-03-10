import { ExerciseLog, ExerciseStep, WorkoutHistory } from "@/constants/workout";

/**
 * Epley formula: e1RM = weight × (1 + reps / 30)
 * Only valid for reps <= 30 and weight > 0
 */
export function estimate1RM(weightKg: number, reps: number): number {
  if (reps <= 0 || weightKg <= 0) return 0;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

export type SessionCategory = "strength" | "cardio" | "mobility" | "mixed";

export interface WorkoutMetrics {
  sessionCategory: SessionCategory;
  totalVolume: number;
  totalSets: number;
  totalReps: number; // only strength/core reps
  totalDurationSec: number; // total seconds for timer-based exercises
  strengthSets: number;
  timerSets: number;
  bestE1RM: { exerciseName: string; value: number } | null;
  allE1RMs: { exerciseName: string; value: number }[];
  bwRatio: number | null;
  successRate: number;
  fatigueDrop: number | null;
  loadScore: number;
}

/**
 * Calculate fatigue drop per-exercise, then average.
 * For each exercise with 2+ sets, compare first-half vs second-half avg reps.
 * This avoids comparing reps across different exercises (e.g., 8-rep bench vs 20-rep crunches).
 */
function calcFatigueDrop(exercises: ExerciseStep[], logs: Record<number, ExerciseLog[]>): number | null {
  const perExerciseDrops: number[] = [];

  exercises.forEach((_, idx) => {
    const exLogs = logs[idx] || [];
    if (exLogs.length < 2) return;

    const mid = Math.floor(exLogs.length / 2);
    const firstHalf = exLogs.slice(0, mid || 1); // at least 1 in first half
    const secondHalf = exLogs.slice(mid || 1);

    const safeReps = (l: ExerciseLog) => typeof l.repsCompleted === "number" ? l.repsCompleted : (parseInt(String(l.repsCompleted)) || 0);
    const avgFirst = firstHalf.reduce((s, l) => s + safeReps(l), 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((s, l) => s + safeReps(l), 0) / secondHalf.length;

    if (avgFirst > 0) {
      perExerciseDrops.push(((avgSecond - avgFirst) / avgFirst) * 100);
    }
  });

  if (perExerciseDrops.length === 0) return null;
  return Math.round(perExerciseDrops.reduce((s, d) => s + d, 0) / perExerciseDrops.length);
}

/**
 * Load score = totalVolume normalized. Simple proxy for session intensity.
 * Higher = heavier session. Can compare across sessions when divided by bodyweight.
 */
function calcLoadScore(totalVolume: number, bodyWeightKg?: number): number {
  if (bodyWeightKg && bodyWeightKg > 0) {
    return Math.round((totalVolume / bodyWeightKg) * 10) / 10;
  }
  return totalVolume;
}

/** Compound lifts eligible for e1RM / BW Ratio display */
const COMPOUND_LIFT_KEYWORDS = [
  // 한국어
  "스쿼트", "데드리프트", "벤치 프레스", "벤치프레스", "오버헤드 프레스", "오버헤드프레스",
  "숄더 프레스", "숄더프레스", "밀리터리 프레스", "밀리터리프레스",
  "바벨 로우", "바벨로우", "펜들레이 로우", "펜들레이로우",
  "프론트 스쿼트", "프론트스쿼트", "루마니안 데드리프트", "루마니안데드리프트",
  "레그 프레스", "레그프레스", "힙 쓰러스트", "힙쓰러스트",
  "인클라인 벤치", "인클라인벤치", "디클라인 벤치", "디클라인벤치",
  "클린", "스내치", "저크", "클린 앤 프레스",
  // English
  "squat", "deadlift", "bench press", "overhead press", "shoulder press",
  "military press", "barbell row", "pendlay row", "front squat",
  "romanian deadlift", "leg press", "hip thrust", "incline bench",
  "decline bench", "clean", "snatch", "jerk", "clean and press",
];

function isCompoundLift(exerciseName: string): boolean {
  const lower = exerciseName.toLowerCase();
  return COMPOUND_LIFT_KEYWORDS.some(kw => lower.includes(kw.toLowerCase()));
}

const BIG4_KEYWORDS = [
  "스쿼트", "squat",
  "데드리프트", "deadlift",
  "벤치 프레스", "벤치프레스", "bench press",
  "오버헤드 프레스", "오버헤드프레스",
  "overhead press", "military press",
];

const BIG4_EXCLUDE = ["덤벨", "dumbbell"];

function isBig4Lift(exerciseName: string): boolean {
  const lower = exerciseName.toLowerCase();
  if (BIG4_EXCLUDE.some(ex => lower.includes(ex))) return false;
  return BIG4_KEYWORDS.some(kw => lower.includes(kw.toLowerCase()));
}

function isTimerExercise(ex: ExerciseStep): boolean {
  return ex.type === "cardio" || ex.type === "warmup" || ex.type === "mobility";
}

function parseCountToSeconds(count: string): number {
  const match = count.match(/(\d+)/);
  const val = match ? parseInt(match[1]) : 0;
  if (count.includes("초") || count.toLowerCase().includes("sec")) return val;
  if (count.includes("분") || count.toLowerCase().includes("min")) return val * 60;
  return val;
}

function detectSessionCategory(exercises: ExerciseStep[]): SessionCategory {
  let strength = 0;
  let cardio = 0;
  let mobility = 0;
  for (const ex of exercises) {
    if (ex.type === "strength") strength++;
    else if (ex.type === "cardio") cardio++;
    else if (ex.type === "mobility") mobility++;
    // warmup & core are auxiliary — don't determine session category
  }
  if (strength > 0 && cardio === 0) return "strength";
  if (strength === 0 && cardio > 0) return "cardio";
  if (strength === 0 && cardio === 0 && mobility > 0) return "mobility";
  if (strength > 0 && cardio > 0) return "mixed";
  // fallback: only warmup+core exercises → treat as mobility/recovery
  return "mobility";
}

// ============================================================
// Training Level Estimation (근거: NSCA, Rippetoe & Kilgore 2006)
// ============================================================

export type TrainingLevel = "beginner" | "intermediate" | "advanced";

/** 3대 운동 키워드 매칭 (e1RM/BW 비율로 레벨 판정) */
const BIG3_PATTERNS: {
  category: "squat" | "bench" | "deadlift";
  keywords: string[];
}[] = [
  {
    category: "squat",
    keywords: ["스쿼트", "squat", "프론트 스쿼트", "프론트스쿼트", "front squat"],
  },
  {
    category: "bench",
    keywords: ["벤치 프레스", "벤치프레스", "bench press", "인클라인 벤치", "인클라인벤치", "incline bench"],
  },
  {
    category: "deadlift",
    keywords: ["데드리프트", "deadlift", "루마니안 데드리프트", "루마니안데드리프트", "romanian deadlift"],
  },
];

/** 맨몸 운동 키워드 */
const BODYWEIGHT_PATTERNS: {
  category: "pushup" | "pullup";
  keywords: string[];
}[] = [
  { category: "pushup", keywords: ["푸쉬업", "푸시업", "push-up", "pushup", "push up"] },
  { category: "pullup", keywords: ["풀업", "턱걸이", "pull-up", "pullup", "pull up", "chin-up", "chinup"] },
];

/**
 * e1RM/BW 비율 기준 레벨 판정 (남성 기준)
 * 여성은 x0.6 보정 (NSCA 성별 보정)
 */
const LEVEL_THRESHOLDS_MALE: Record<string, { intermediate: number; advanced: number }> = {
  squat:    { intermediate: 0.75, advanced: 1.25 },
  bench:    { intermediate: 0.50, advanced: 1.00 },
  deadlift: { intermediate: 0.75, advanced: 1.50 },
};

/** 맨몸 운동 렙수 기준 (남성 기준, 여성 상체 x0.5) */
const BODYWEIGHT_THRESHOLDS_MALE: Record<string, { intermediate: number; advanced: number }> = {
  pushup: { intermediate: 10, advanced: 25 },
  pullup: { intermediate: 1, advanced: 8 },
};

/** 연령 보정 계수 (ACSM 2011, 고령자 메타분석 2024) */
export function getAgeMultiplier(birthYear?: number): number {
  if (!birthYear) return 1.0;
  const age = new Date().getFullYear() - birthYear;
  if (age < 40) return 1.0;
  if (age < 50) return 0.9;
  if (age < 60) return 0.8;
  if (age < 70) return 0.7;
  return 0.6;
}

/** 레벨 판정 결과 + 근거 */
export interface LevelEstimation {
  level: TrainingLevel;
  source: "big3" | "bodyweight" | "default";
  details: { exercise: string; value: string; level: TrainingLevel }[];
  decayed?: boolean; // 최근 4주 미활동으로 한 단계 하향 조정됨
}

const CATEGORY_LABELS: Record<string, string> = {
  squat: "스쿼트", bench: "벤치프레스", deadlift: "데드리프트",
  pushup: "푸쉬업", pullup: "풀업/턱걸이",
};

/**
 * 히스토리에서 훈련 레벨을 자동 추정 (판정 근거 포함)
 * 1순위: 3대 운동 e1RM/BW 비율
 * 2순위: 맨몸 운동 렙수
 * 3순위: 기본값 "beginner"
 */
export function estimateTrainingLevel(
  history: WorkoutHistory[],
  bodyWeightKg?: number,
  gender?: "male" | "female"
): TrainingLevel {
  return estimateTrainingLevelDetailed(history, bodyWeightKg, gender).level;
}

export function estimateTrainingLevelDetailed(
  history: WorkoutHistory[],
  bodyWeightKg?: number,
  gender?: "male" | "female"
): LevelEstimation {
  const genderMult = gender === "female" ? 0.6 : 1.0;
  const bwGenderMult = gender === "female" ? 0.5 : 1.0; // 여성 상체 맨몸 보정

  // 최근 4주 기준선
  const recentCutoff = Date.now() - 28 * 24 * 60 * 60 * 1000;

  // 헬퍼: 3대 운동 e1RM/BW를 기간 필터 적용하여 추출
  function extractBig3(sessions: WorkoutHistory[]): Record<string, number> {
    const best: Record<string, number> = {};
    if (!bodyWeightKg || bodyWeightKg <= 0) return best;
    for (const h of sessions) {
      const exercises = h.sessionData?.exercises || [];
      const logs = h.logs || {};
      exercises.forEach((ex, idx) => {
        const exLogs = logs[idx] || [];
        for (const pattern of BIG3_PATTERNS) {
          const lower = ex.name.toLowerCase();
          if (pattern.keywords.some(kw => lower.includes(kw.toLowerCase()))) {
            for (const log of exLogs) {
              const weightStr = log.weightUsed || ex.weight;
              if (weightStr && weightStr !== "Bodyweight") {
                const weight = parseFloat(weightStr);
                if (!isNaN(weight) && weight > 0 && log.repsCompleted > 0) {
                  const e1rm = estimate1RM(weight, log.repsCompleted);
                  const ratio = e1rm / bodyWeightKg!;
                  if (!best[pattern.category] || ratio > best[pattern.category]) {
                    best[pattern.category] = ratio;
                  }
                }
              }
            }
          }
        }
      });
    }
    return best;
  }

  // 헬퍼: 맨몸 운동 최고 렙수를 기간 필터 적용하여 추출
  function extractBodyweight(sessions: WorkoutHistory[]): Record<string, number> {
    const best: Record<string, number> = {};
    for (const h of sessions) {
      const exercises = h.sessionData?.exercises || [];
      const logs = h.logs || {};
      exercises.forEach((ex, idx) => {
        const exLogs = logs[idx] || [];
        for (const pattern of BODYWEIGHT_PATTERNS) {
          const lower = ex.name.toLowerCase();
          if (pattern.keywords.some(kw => lower.includes(kw.toLowerCase()))) {
            for (const log of exLogs) {
              if (log.repsCompleted > 0) {
                if (!best[pattern.category] || log.repsCompleted > best[pattern.category]) {
                  best[pattern.category] = log.repsCompleted;
                }
              }
            }
          }
        }
      });
    }
    return best;
  }

  // 헬퍼: 카테고리별 레벨 판정
  function assessBig3Level(ratios: Record<string, number>): { details: LevelEstimation["details"]; level: TrainingLevel } {
    const details: LevelEstimation["details"] = [];
    const levels: TrainingLevel[] = Object.keys(ratios).map(cat => {
      const ratio = ratios[cat];
      const thresholds = LEVEL_THRESHOLDS_MALE[cat];
      if (!thresholds) return "beginner" as TrainingLevel;
      const intThresh = thresholds.intermediate * genderMult;
      const advThresh = thresholds.advanced * genderMult;
      const lvl: TrainingLevel = ratio >= advThresh ? "advanced" : ratio >= intThresh ? "intermediate" : "beginner";
      details.push({ exercise: CATEGORY_LABELS[cat] || cat, value: `e1RM/BW ${ratio.toFixed(2)}x`, level: lvl });
      return lvl;
    });
    const counts = { beginner: 0, intermediate: 0, advanced: 0 };
    levels.forEach(l => counts[l]++);
    const level: TrainingLevel =
      counts.advanced >= counts.intermediate && counts.advanced >= counts.beginner ? "advanced"
      : counts.intermediate >= counts.beginner ? "intermediate" : "beginner";
    return { details, level };
  }

  function assessBWLevel(repsMap: Record<string, number>): { details: LevelEstimation["details"]; level: TrainingLevel } {
    const details: LevelEstimation["details"] = [];
    const levels: TrainingLevel[] = Object.keys(repsMap).map(cat => {
      const reps = repsMap[cat];
      const thresholds = BODYWEIGHT_THRESHOLDS_MALE[cat];
      if (!thresholds) return "beginner" as TrainingLevel;
      const intThresh = thresholds.intermediate * bwGenderMult;
      const advThresh = thresholds.advanced * bwGenderMult;
      const lvl: TrainingLevel = reps >= advThresh ? "advanced" : reps >= intThresh ? "intermediate" : "beginner";
      details.push({ exercise: CATEGORY_LABELS[cat] || cat, value: `${reps}회`, level: lvl });
      return lvl;
    });
    const counts = { beginner: 0, intermediate: 0, advanced: 0 };
    levels.forEach(l => counts[l]++);
    const level: TrainingLevel =
      counts.advanced >= counts.intermediate && counts.advanced >= counts.beginner ? "advanced"
      : counts.intermediate >= counts.beginner ? "intermediate" : "beginner";
    return { details, level };
  }

  // 한 단계 내리기
  function decayLevel(level: TrainingLevel): TrainingLevel {
    if (level === "advanced") return "intermediate";
    if (level === "intermediate") return "beginner";
    return "beginner";
  }

  const recentHistory = history.filter(h => new Date(h.date).getTime() > recentCutoff);

  // 1순위: 3대 운동
  const allBig3 = extractBig3(history);
  if (Object.keys(allBig3).length > 0) {
    const allTime = assessBig3Level(allBig3);
    // 최근 4주 기록으로 유지 확인
    const recentBig3 = extractBig3(recentHistory);
    const recentResult = Object.keys(recentBig3).length > 0 ? assessBig3Level(recentBig3) : null;

    let finalLevel = allTime.level;
    let decayed = false;

    // 최근 4주에 해당 레벨 수준 기록이 없으면 한 단계 하향
    if (allTime.level !== "beginner") {
      if (!recentResult || recentResult.level < allTime.level) {
        finalLevel = decayLevel(allTime.level);
        decayed = true;
      }
    }

    // details는 역대 최고 기록 표시 (유저가 자기 최고를 볼 수 있게)
    return { level: finalLevel, source: "big3", details: allTime.details, decayed };
  }

  // 2순위: 맨몸 운동
  const allBW = extractBodyweight(history);
  if (Object.keys(allBW).length > 0) {
    const allTime = assessBWLevel(allBW);
    const recentBW = extractBodyweight(recentHistory);
    const recentResult = Object.keys(recentBW).length > 0 ? assessBWLevel(recentBW) : null;

    let finalLevel = allTime.level;
    let decayed = false;

    if (allTime.level !== "beginner") {
      if (!recentResult || recentResult.level < allTime.level) {
        finalLevel = decayLevel(allTime.level);
        decayed = true;
      }
    }

    return { level: finalLevel, source: "bodyweight", details: allTime.details, decayed };
  }

  return { level: "beginner", source: "default", details: [] };
}

/**
 * 레벨+연령 기반 최적 부하 밴드 계산 (세션당 볼륨/체중 기준)
 *
 * 옵션 C 하이브리드: ACSM 연령/레벨별 절대 기준 + Israetel MV/MEV/MAV/MRV 개념
 *
 * Israetel Volume Landmarks:
 * - MV  (Maintenance Volume): 현재 근량 유지에 필요한 최소 볼륨
 * - MEV (Minimum Effective Volume): 성장이 시작되는 최소 볼륨
 * - MAV (Maximum Adaptive Volume): 최대 적응 효과를 내는 볼륨 상한
 * - MRV (Maximum Recoverable Volume): 회복 가능한 최대 볼륨 (초과 시 과훈련)
 *
 * 세션당 Load Score (볼륨/체중) 기준:
 * - 초급: MEV 15, MAV 55, MRV 70 (가벼운 무게, 적은 세트)
 * - 중급: MEV 40, MAV 110, MRV 140 (중간 무게, 보통 세트)
 * - 상급: MEV 70, MAV 180, MRV 220 (무거운 무게, 많은 세트)
 *
 * 근거: ACSM (2009) 점진적 과부하, Israetel RP Strength, NSCA 4th ed.
 */
export interface LoadBand {
  low: number;      // MEV: 성장 최소 볼륨 (이하 = 볼륨 부족)
  high: number;     // MAV: 성장 최적 상한 (이상 = 고부하)
  overload: number; // MRV: 회복 가능 한계 (이상 = 과부하)
  source: "reference" | "hybrid"; // 기준선 출처
}

export function getOptimalLoadBand(
  avgLoadScore: number,
  sessionCount: number,
  level: TrainingLevel,
  birthYear?: number
): LoadBand {
  const ageMult = getAgeMultiplier(birthYear);

  // ACSM/Israetel 기반 세션당 Load Score(볼륨/체중) 절대 기준
  // MEV (low): Minimum Effective Volume — 성장이 시작되는 최소치
  // MAV (high): Maximum Adaptive Volume — 최대 적응 효과 상한
  // MRV (overload): Maximum Recoverable Volume — 회복 가능 한계
  const reference = {
    beginner:     { mev: 15, mav: 55, mrv: 70 },
    intermediate: { mev: 40, mav: 110, mrv: 140 },
    advanced:     { mev: 70, mav: 180, mrv: 220 },
  };

  const ref = reference[level];

  if (sessionCount >= 4 && avgLoadScore > 0) {
    // 하이브리드: ACSM 기준(70%) + 개인 히스토리(30%) 블렌딩
    // 히스토리가 쌓일수록 개인 비중 증가 (최대 40%)
    const personalWeight = Math.min(0.4, sessionCount * 0.04);
    const refWeight = 1 - personalWeight;

    return {
      low: (ref.mev * refWeight + avgLoadScore * 0.75 * personalWeight) * ageMult,
      high: ref.mav * refWeight + avgLoadScore * 1.35 * personalWeight,
      overload: ref.mrv * refWeight + avgLoadScore * 1.55 * personalWeight,
      source: "hybrid",
    };
  }

  // 히스토리 부족: 순수 ACSM 기준
  return {
    low: ref.mev * ageMult,
    high: ref.mav,
    overload: ref.mrv,
    source: "reference",
  };
}

export function buildWorkoutMetrics(
  exercises: ExerciseStep[],
  logs: Record<number, ExerciseLog[]>,
  bodyWeightKg?: number
): WorkoutMetrics {
  let totalVolume = 0;
  let totalSets = 0;
  let totalReps = 0;
  let totalDurationSec = 0;
  let strengthSets = 0;
  let timerSets = 0;
  let targetOrBetter = 0;
  let totalLogEntries = 0;
  let bestE1RM: { exerciseName: string; value: number } | null = null;
  const e1rmMap = new Map<string, { exerciseName: string; value: number }>();

  const sessionCategory = detectSessionCategory(exercises);

  exercises.forEach((exercise, idx) => {
    const exerciseLogs = logs[idx] || [];
    const isTimer = isTimerExercise(exercise);

    exerciseLogs.forEach((log) => {
      totalSets++;
      totalLogEntries++;

      if (log.feedback !== "fail") {
        targetOrBetter++;
      }

      // Guard: repsCompleted may arrive as string from AI-generated data
      const safeReps = typeof log.repsCompleted === "number" ? log.repsCompleted : (parseInt(String(log.repsCompleted)) || 0);

      if (isTimer) {
        timerSets++;
        // For timer exercises, repsCompleted = target count (seconds or reps for the timer)
        totalDurationSec += parseCountToSeconds(exercise.count) * (log.setNumber === 1 ? 1 : 0) || safeReps;
      } else {
        strengthSets++;
        totalReps += safeReps;

        // Parse weight for volume and e1RM
        const weightStr = log.weightUsed || exercise.weight;
        if (weightStr && weightStr !== "Bodyweight") {
          const weight = parseFloat(weightStr);
          if (!isNaN(weight) && weight > 0) {
            totalVolume += weight * log.repsCompleted;

            if (isCompoundLift(exercise.name)) {
              const e1rm = estimate1RM(weight, log.repsCompleted);
              if (!bestE1RM || e1rm > bestE1RM.value) {
                bestE1RM = { exerciseName: exercise.name, value: e1rm };
              }
              if (isBig4Lift(exercise.name)) {
                const existing = e1rmMap.get(exercise.name);
                if (!existing || e1rm > existing.value) {
                  e1rmMap.set(exercise.name, { exerciseName: exercise.name, value: e1rm });
                }
              }
            }
          }
        }
      }
    });

    // For timer exercises with no logs, still accumulate planned duration
    if (isTimer && exerciseLogs.length === 0) {
      totalDurationSec += parseCountToSeconds(exercise.count) * exercise.sets;
    }
  });

  const successRate = totalLogEntries > 0
    ? Math.round((targetOrBetter / totalLogEntries) * 100)
    : 0;

  const finalE1RM = bestE1RM as { exerciseName: string; value: number } | null;
  const bwRatio = finalE1RM && bodyWeightKg && bodyWeightKg > 0
    ? Math.round((finalE1RM.value / bodyWeightKg) * 100) / 100
    : null;

  // Only compute fatigue drop for strength exercises (need at least 2 sets total)
  const fatigueDrop = strengthSets >= 2 ? calcFatigueDrop(
    exercises.filter(e => !isTimerExercise(e)),
    // Re-index logs for strength-only exercises
    (() => {
      const filtered: Record<number, ExerciseLog[]> = {};
      let newIdx = 0;
      exercises.forEach((ex, idx) => {
        if (!isTimerExercise(ex)) {
          filtered[newIdx] = logs[idx] || [];
          newIdx++;
        }
      });
      return filtered;
    })()
  ) : null;

  const loadScore = calcLoadScore(totalVolume, bodyWeightKg);

  return {
    sessionCategory,
    totalVolume,
    totalSets,
    totalReps,
    totalDurationSec,
    strengthSets,
    timerSets,
    bestE1RM: finalE1RM,
    allE1RMs: Array.from(e1rmMap.values()).sort((a, b) => b.value - a.value),
    bwRatio,
    successRate,
    fatigueDrop,
    loadScore,
  };
}

/**
 * Extract best 1RM for each big-4 lift from workout history.
 * Applies a decay of ~5% per week after 4 weeks of no data for that lift.
 */
export function getBig4FromHistory(
  history: WorkoutHistory[],
): { exerciseName: string; value: number; weeksAgo: number; decayed: boolean }[] {
  const big4Map = new Map<string, { exerciseName: string; value: number; date: string }>();

  // Scan all history, newest first
  const sorted = [...history].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  for (const h of sorted) {
    const exercises = h.sessionData?.exercises || [];
    const logs = h.logs || {};

    exercises.forEach((exercise, idx) => {
      if (!isBig4Lift(exercise.name)) return;

      const exerciseLogs = logs[idx] || [];
      let bestForExercise = 0;

      for (const log of exerciseLogs) {
        const weightStr = log.weightUsed || exercise.weight;
        if (!weightStr || weightStr === "Bodyweight") continue;
        const weight = parseFloat(weightStr);
        if (isNaN(weight) || weight <= 0) continue;
        const safeReps = typeof log.repsCompleted === "number" ? log.repsCompleted : (parseInt(String(log.repsCompleted)) || 0);
        const e1rm = estimate1RM(weight, safeReps);
        if (e1rm > bestForExercise) bestForExercise = e1rm;
      }

      if (bestForExercise > 0) {
        const existing = big4Map.get(exercise.name);
        if (!existing || bestForExercise > existing.value) {
          big4Map.set(exercise.name, { exerciseName: exercise.name, value: bestForExercise, date: h.date });
        }
      }
    });
  }

  const now = Date.now();
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

  return Array.from(big4Map.values()).map(entry => {
    const weeksAgo = Math.floor((now - new Date(entry.date).getTime()) / WEEK_MS);
    let value = entry.value;
    let decayed = false;
    // Decay 5% per week after 4 weeks
    if (weeksAgo > 4) {
      const decayWeeks = weeksAgo - 4;
      value = value * Math.pow(0.95, decayWeeks);
      decayed = true;
    }
    return { exerciseName: entry.exerciseName, value, weeksAgo, decayed };
  }).sort((a, b) => b.value - a.value);
}
