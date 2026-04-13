import { ExerciseLog, ExerciseStep, WorkoutHistory } from "@/constants/workout";

/**
 * 반복수 구간별 최적 공식으로 e1RM 추정
 * - 1~5회: Brzycki (저렙에서 정확, NSCA 권장)
 * - 6~10회: Epley (중렙에서 적합)
 * - 11회+: Lombardi (고렙에서 보수적)
 */
export function estimate1RM(weightKg: number, reps: number): number {
  if (reps <= 0 || weightKg <= 0) return 0;
  if (reps === 1) return weightKg;
  if (reps <= 5) return weightKg * (36 / (37 - reps)); // Brzycki
  if (reps <= 10) return weightKg * (1 + reps / 30); // Epley
  return weightKg * Math.pow(reps, 0.1); // Lombardi
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

// Exact big-4 barbell lifts only
const BIG4_PATTERNS: { match: string[]; exclude: string[] }[] = [
  // 바벨 백스쿼트
  { match: ["바벨 스쿼트", "바벨 백 스쿼트", "바벨 백스쿼트", "barbell squat", "barbell back squat", "back squat"],
    exclude: ["프론트", "front", "고블릿", "goblet", "덤벨", "dumbbell", "케틀벨", "kettlebell"] },
  // 바벨 벤치프레스
  { match: ["바벨 벤치 프레스", "바벨 벤치프레스", "벤치 프레스", "벤치프레스", "barbell bench press", "bench press", "flat bench"],
    exclude: ["덤벨", "dumbbell", "케틀벨", "kettlebell", "인클라인", "incline", "디클라인", "decline", "플로어", "floor"] },
  // 바벨 데드리프트 (컨벤셔널)
  { match: ["바벨 데드리프트", "컨벤셔널 데드리프트", "barbell deadlift", "conventional deadlift", "deadlift"],
    exclude: ["케틀벨", "kettlebell", "덤벨", "dumbbell", "루마니안", "romanian", "스티프", "stiff", "스모", "sumo", "트랩바", "trap bar", "hex"] },
  // 바벨 오버헤드프레스
  { match: ["오버헤드 프레스", "오버헤드프레스", "밀리터리 프레스", "밀리터리프레스", "바벨 숄더 프레스", "overhead press", "military press", "barbell shoulder press"],
    exclude: ["덤벨", "dumbbell", "케틀벨", "kettlebell"] },
];

function isBig4Lift(exerciseName: string): boolean {
  const lower = exerciseName.toLowerCase();
  return BIG4_PATTERNS.some(pattern =>
    pattern.match.some(m => lower.includes(m.toLowerCase())) &&
    !pattern.exclude.some(ex => lower.includes(ex.toLowerCase()))
  );
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
  details: { exercise: string; value: string; level: TrainingLevel; weightKg?: number }[];
  decayed?: boolean; // 최근 4주 미활동으로 한 단계 하향 조정됨
}

// 회의 21: i18n 키로 변경 — UI에서 t()로 렌더. details[].exercise 필드에 이 키가 저장됨.
const CATEGORY_LABELS: Record<string, string> = {
  squat: "big3.squat", bench: "big3.bench", deadlift: "big3.deadlift",
  pushup: "big3.pushup", pullup: "big3.pullup",
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

  // 헬퍼: 3대 운동 e1RM/BW ratio + raw e1RM 추출
  function extractBig3(sessions: WorkoutHistory[]): { ratios: Record<string, number>; rawE1rm: Record<string, number> } {
    const ratios: Record<string, number> = {};
    const rawE1rm: Record<string, number> = {};
    if (!bodyWeightKg || bodyWeightKg <= 0) return { ratios, rawE1rm };
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
                  if (!ratios[pattern.category] || ratio > ratios[pattern.category]) {
                    ratios[pattern.category] = ratio;
                    rawE1rm[pattern.category] = e1rm;
                  }
                }
              }
            }
          }
        }
      });
    }
    return { ratios, rawE1rm };
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
  function assessBig3Level(big3: { ratios: Record<string, number>; rawE1rm: Record<string, number> }): { details: LevelEstimation["details"]; level: TrainingLevel } {
    const details: LevelEstimation["details"] = [];
    const levels: TrainingLevel[] = Object.keys(big3.ratios).map(cat => {
      const ratio = big3.ratios[cat];
      const thresholds = LEVEL_THRESHOLDS_MALE[cat];
      if (!thresholds) return "beginner" as TrainingLevel;
      const intThresh = thresholds.intermediate * genderMult;
      const advThresh = thresholds.advanced * genderMult;
      const lvl: TrainingLevel = ratio >= advThresh ? "advanced" : ratio >= intThresh ? "intermediate" : "beginner";
      const e1rm = big3.rawE1rm[cat];
      details.push({ exercise: CATEGORY_LABELS[cat] || cat, value: e1rm ? `${Math.round(e1rm)}kg` : `${ratio.toFixed(2)}x`, level: lvl, weightKg: e1rm || undefined });
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
  if (Object.keys(allBig3.ratios).length > 0) {
    const allTime = assessBig3Level(allBig3);
    // 최근 4주 기록으로 유지 확인
    const recentBig3 = extractBig3(recentHistory);
    const recentResult = Object.keys(recentBig3.ratios).length > 0 ? assessBig3Level(recentBig3) : null;

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
  bodyWeightKg?: number,
  elapsedSec?: number
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

  // Use actual elapsed time if provided, otherwise fall back to timer-exercise estimate
  if (elapsedSec !== undefined && elapsedSec > 0) {
    totalDurationSec = elapsedSec;
  }

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

/**
 * Summarize recent history (up to 10 sessions) for AI trend analysis.
 * Returns compact data: per-session stats + computed trends.
 */
export interface HistoryTrendSummary {
  sessionCount: number;
  sessions: {
    date: string;
    totalVolume: number;
    loadScore: number;
    bestE1RM: number | null;
    category: string;
    exerciseNames: string[];
  }[];
  trends: {
    volumeChange: string | null;
    e1rmChange: string | null;
    avgLoadScore: number;
    totalSessions90d: number;
  };
}

export function summarizeHistoryForAI(history: WorkoutHistory[]): HistoryTrendSummary {
  const sorted = [...history]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10);
  const chronological = [...sorted].reverse();

  const sessions = chronological.map(h => ({
    date: new Date(h.date).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" }),
    totalVolume: h.stats.totalVolume || 0,
    loadScore: h.stats.loadScore || 0,
    bestE1RM: h.stats.bestE1RM || null,
    category: h.sessionData?.description?.split("·")[0]?.trim() || "mixed",
    exerciseNames: (h.sessionData?.exercises || [])
      .filter(e => e.type === "strength" || e.type === "core")
      .map(e => e.name.split("(")[0].trim()),
  }));

  const withVolume = sessions.filter(s => s.totalVolume > 0);
  let volumeChange: string | null = null;
  if (withVolume.length >= 2) {
    const first = withVolume[0].totalVolume;
    const last = withVolume[withVolume.length - 1].totalVolume;
    const pct = Math.round(((last - first) / first) * 100);
    volumeChange = `${pct > 0 ? "+" : ""}${pct}%`;
  }

  const withE1rm = sessions.filter(s => s.bestE1RM !== null);
  let e1rmChange: string | null = null;
  if (withE1rm.length >= 2) {
    const first = withE1rm[0].bestE1RM!;
    const last = withE1rm[withE1rm.length - 1].bestE1RM!;
    const pct = Math.round(((last - first) / first) * 100);
    e1rmChange = `${pct > 0 ? "+" : ""}${pct}%`;
  }

  const avgLoadScore = sessions.length > 0
    ? sessions.reduce((s, h) => s + h.loadScore, 0) / sessions.length
    : 0;

  return {
    sessionCount: sessions.length,
    sessions,
    trends: {
      volumeChange,
      e1rmChange,
      avgLoadScore: Math.round(avgLoadScore * 10) / 10,
      totalSessions90d: history.length,
    },
  };
}

// ============================================================
// Session Intensity Classification (ACSM 2009 + NSCA)
// ============================================================

export type IntensityLevel = "high" | "moderate" | "low";

export interface SessionIntensity {
  level: IntensityLevel;
  avgPercentile1RM: number | null; // average %1RM across strength exercises
  avgRepsPerSet: number;           // average reps per strength set
  basis: "percent_1rm" | "reps";   // which method was used
}

/**
 * Classify session intensity based on ACSM/NSCA guidelines.
 * Primary: avg %1RM across strength exercises (weight used / estimated 1RM)
 * Fallback: avg reps per set (rep-max continuum)
 *
 * ACSM (2009) + NSCA Essentials:
 * - High:     ≥80% 1RM or ≤6 reps (max strength zone)
 * - Moderate: 60-79% 1RM or 7-12 reps (hypertrophy zone)
 * - Low:      <60% 1RM or 13+ reps (endurance zone)
 */
export function classifySessionIntensity(
  exercises: ExerciseStep[],
  logs: Record<number, ExerciseLog[]>,
): SessionIntensity {
  const percentages: number[] = [];
  const allReps: number[] = [];

  exercises.forEach((ex, idx) => {
    if (ex.type !== "strength" && ex.type !== "core") return;
    const exLogs = logs[idx] || [];
    if (exLogs.length === 0) return;

    // Estimate 1RM for this exercise from the best set
    let best1RM = 0;
    for (const log of exLogs) {
      const weightStr = log.weightUsed || ex.weight;
      if (!weightStr || weightStr === "Bodyweight") continue;
      const weight = parseFloat(weightStr);
      const reps = typeof log.repsCompleted === "number" ? log.repsCompleted : parseInt(String(log.repsCompleted)) || 0;
      if (weight > 0 && reps > 0) {
        const e1rm = estimate1RM(weight, reps);
        if (e1rm > best1RM) best1RM = e1rm;
      }
    }

    // Calculate %1RM for each set
    for (const log of exLogs) {
      const weightStr = log.weightUsed || ex.weight;
      const reps = typeof log.repsCompleted === "number" ? log.repsCompleted : parseInt(String(log.repsCompleted)) || 0;
      if (reps > 0) allReps.push(reps);

      if (!weightStr || weightStr === "Bodyweight" || best1RM === 0) continue;
      const weight = parseFloat(weightStr);
      if (weight > 0 && best1RM > 0) {
        percentages.push((weight / best1RM) * 100);
      }
    }
  });

  // Primary: %1RM based classification
  if (percentages.length >= 2) {
    const avg = percentages.reduce((s, p) => s + p, 0) / percentages.length;
    return {
      level: avg >= 80 ? "high" : avg >= 60 ? "moderate" : "low",
      avgPercentile1RM: Math.round(avg),
      avgRepsPerSet: allReps.length > 0 ? Math.round(allReps.reduce((s, r) => s + r, 0) / allReps.length) : 0,
      basis: "percent_1rm",
    };
  }

  // Fallback: rep-based classification
  if (allReps.length > 0) {
    const avgReps = allReps.reduce((s, r) => s + r, 0) / allReps.length;
    return {
      level: avgReps <= 6 ? "high" : avgReps <= 12 ? "moderate" : "low",
      avgPercentile1RM: null,
      avgRepsPerSet: Math.round(avgReps),
      basis: "reps",
    };
  }

  // No strength data → default low (cardio/mobility)
  return { level: "low", avgPercentile1RM: null, avgRepsPerSet: 0, basis: "reps" };
}

/**
 * Weekly intensity recommendation by age group.
 * Based on ACSM (2009) Position Stand + WHO 2020 Guidelines + NSCA periodization.
 *
 * References:
 * - ACSM Position Stand: Progression Models in RT (2009) — PubMed 19204579
 * - WHO Guidelines on Physical Activity (2020) — PMC 7719906
 * - NSCA Essentials of S&C (4th ed.) — DUP periodization model
 * - Schoenfeld et al. (2019) — PMC 6303131 (volume-response)
 */
export interface WeeklyIntensityTarget {
  high: number;
  moderate: number;
  low: number;
  total: number;
}

export function getWeeklyIntensityTarget(birthYear?: number, gender?: "male" | "female"): WeeklyIntensityTarget {
  const age = birthYear ? new Date().getFullYear() - birthYear : 30;
  // 여성은 회복이 빨라 고강도 빈도를 남성과 동일 or +1 가능 (Hakkinen et al. 1990, Hunter 2014)
  // 다만 절대 중량은 낮으므로 부상 위험이 낮고 고강도 배분을 유지해도 안전
  const isFemale = gender === "female";

  if (age >= 60) {
    return { high: 1, moderate: 2, low: 1, total: 4 };
  } else if (age >= 40) {
    // 여성 40대+: 골밀도 유지를 위해 중강도 대신 고강도 1회 추가 권장 (ACSM 폐경 후 가이드라인)
    return isFemale
      ? { high: 2, moderate: 2, low: 1, total: 5 }
      : { high: 1, moderate: 3, low: 1, total: 5 };
  } else {
    return { high: 2, moderate: 2, low: 1, total: 5 };
  }
}

/**
 * Analyze this week's intensity distribution and recommend next session.
 * Uses DUP (Daily Undulating Periodization) principle from NSCA.
 */
export interface IntensityRecommendation {
  weekSummary: { high: number; moderate: number; low: number };
  target: WeeklyIntensityTarget;
  nextRecommended: IntensityLevel;
  reason: string;
  recoveryHours: number;
}

export function getIntensityRecommendation(
  history: WorkoutHistory[],
  birthYear?: number,
  gender?: "male" | "female",
): IntensityRecommendation {
  const target = getWeeklyIntensityTarget(birthYear, gender);
  const age = birthYear ? new Date().getFullYear() - birthYear : 30;

  // Get this week's sessions (Monday ~ Sunday)
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon...
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - mondayOffset);
  monday.setHours(0, 0, 0, 0);

  const thisWeekSessions = history.filter(h => new Date(h.date).getTime() >= monday.getTime());

  // Classify each session's intensity
  const weekSummary = { high: 0, moderate: 0, low: 0 };

  for (const h of thisWeekSessions) {
    const intensity = classifySessionIntensity(
      h.sessionData?.exercises || [],
      h.logs || {},
    );
    weekSummary[intensity.level]++;
  }

  // Hours since last session (all history)
  let hoursSinceLast = 999;
  if (history.length > 0) {
    const sorted = [...history].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    hoursSinceLast = Math.round((Date.now() - new Date(sorted[0].date).getTime()) / (1000 * 60 * 60));
  }

  // Recovery time factor by age + gender (MPS-based: ACSM recovery guidelines)
  // 여성은 에스트로겐의 항염증 효과로 회복이 ~15% 빠름 (Hunter 2014, Hakkinen et al.)
  const isFemale = gender === "female";
  const baseAgeFactor = age >= 50 ? 1.3 : age >= 40 ? 1.2 : 1.0;
  const ageFactor = isFemale ? baseAgeFactor * 0.85 : baseAgeFactor;

  // Determine what's most needed this week
  const highDeficit = target.high - weekSummary.high;
  const modDeficit = target.moderate - weekSummary.moderate;
  const lowDeficit = target.low - weekSummary.low;

  let nextRecommended: IntensityLevel;
  let reason: string;

  // If just did session and recovery is short, recommend low/moderate
  const needsRecovery = hoursSinceLast < 48 * ageFactor;

  if (needsRecovery && hoursSinceLast < 24 * ageFactor) {
    nextRecommended = "low";
    reason = "최근 세션 후 충분한 회복이 필요해요 (24시간 미만)";
  } else if (highDeficit > 0 && !needsRecovery) {
    nextRecommended = "high";
    reason = `이번 주 고강도 ${weekSummary.high}/${target.high}회 — 고강도가 필요해요`;
  } else if (modDeficit > 0) {
    nextRecommended = "moderate";
    reason = `이번 주 중강도 ${weekSummary.moderate}/${target.moderate}회 — 중강도가 필요해요`;
  } else if (lowDeficit > 0) {
    nextRecommended = "low";
    reason = `이번 주 저강도 ${weekSummary.low}/${target.low}회 — 회복 세션이 필요해요`;
  } else {
    nextRecommended = "low";
    reason = "이번 주 목표를 모두 달성했어요! 가벼운 회복 운동을 추천해요";
  }

  // Recovery hours based on recommended intensity + age
  const baseRecovery = nextRecommended === "high" ? 72 : nextRecommended === "moderate" ? 48 : 24;
  const recoveryHours = Math.round(baseRecovery * ageFactor);

  return {
    weekSummary,
    target,
    nextRecommended,
    reason,
    recoveryHours,
  };
}

/* ─── PR / 업적 감지 (PROOF 하이라이트용) ─── */

export interface Achievement {
  type: "pr" | "streak" | "milestone" | "first";
  title: string;
  titleEn: string;
  date: string;
  value?: string;
  /** PR 타입일 때만: kg 원본 수치 (렌더 시점 단위 변환용) */
  weightKg?: number;
  /** PR 타입일 때만: 운동명 (kr) — 렌더 시점 제목 조립용 */
  exerciseName?: string;
  /** PR 타입일 때만: 운동명 (en) */
  exerciseNameEn?: string;
}

/**
 * 운동 히스토리에서 주요 업적을 자동 감지
 * - PR: 종목별 최고 무게/e1RM 달성
 * - 스트릭: 연속 운동일 기록
 * - 마일스톤: 총 운동 횟수 (10/30/50/100/200/365회)
 * - 첫 달성: 처음 한 운동 종류
 */
export function detectAchievements(history: WorkoutHistory[]): Achievement[] {
  if (!history || history.length === 0) return [];

  const achievements: Achievement[] = [];
  const sorted = [...history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // ── PR 감지: 종목별 최고 무게 (최고 기록만 표시) ──
  const exerciseBest = new Map<string, { weight: number; date: string; nameEn: string }>();
  for (const h of sorted) {
    if (!h.logs) continue;
    for (let i = 0; i < h.sessionData.exercises.length; i++) {
      const ex = h.sessionData.exercises[i];
      const exLogs = h.logs[i];
      if (!exLogs) continue;
      for (const log of exLogs) {
        const w = parseFloat(log.weightUsed || "0");
        if (w <= 0) continue;
        const name = ex.name.split(" (")[0];
        const nameEn = ex.name.includes("(") ? ex.name.split("(")[1].replace(")", "").trim() : name;
        const prev = exerciseBest.get(name);
        if (!prev || w > prev.weight) {
          exerciseBest.set(name, { weight: w, date: h.date, nameEn });
        }
      }
    }
  }
  // 종목별 최고 기록만 업적으로
  for (const [name, best] of exerciseBest) {
    achievements.push({
      type: "pr",
      title: `${name} ${best.weight}kg`,
      titleEn: `${best.nameEn} ${best.weight}kg`,
      date: best.date,
      value: `${best.weight}kg`,
      weightKg: best.weight,
      exerciseName: name,
      exerciseNameEn: best.nameEn,
    });
  }

  // ── 스트릭 감지: 연속 운동일 ──
  const uniqueDates = [...new Set(sorted.map(h => h.date.slice(0, 10)))].sort();
  let maxStreak = 1;
  let currentStreak = 1;
  let streakEndDate = uniqueDates[0];

  for (let i = 1; i < uniqueDates.length; i++) {
    const prev = new Date(uniqueDates[i - 1]);
    const curr = new Date(uniqueDates[i]);
    const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays === 1) {
      currentStreak++;
      if (currentStreak > maxStreak) {
        maxStreak = currentStreak;
        streakEndDate = uniqueDates[i];
      }
    } else {
      currentStreak = 1;
    }
  }
  if (maxStreak >= 3) {
    achievements.push({
      type: "streak",
      title: `${maxStreak}일 연속 운동`,
      titleEn: `${maxStreak}-Day Streak`,
      date: streakEndDate,
      value: `${maxStreak}`,
    });
  }

  // ── 마일스톤: 총 운동 횟수 ──
  const milestones = [10, 30, 50, 100, 200, 365];
  for (const m of milestones) {
    if (sorted.length >= m) {
      achievements.push({
        type: "milestone",
        title: `${m}회 운동 달성`,
        titleEn: `${m} Workouts Complete`,
        date: sorted[m - 1].date,
        value: `${m}`,
      });
    }
  }

  // ── 첫 운동 ──
  if (sorted.length > 0) {
    achievements.push({
      type: "first",
      title: "첫 운동",
      titleEn: "First Workout",
      date: sorted[0].date,
    });
  }

  // 최신순 정렬, 중복 제거 (같은 날 같은 타입)
  const seen = new Set<string>();
  return achievements
    .filter(a => {
      const key = `${a.type}-${a.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 20); // 최대 20개
}
